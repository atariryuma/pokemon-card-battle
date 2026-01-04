/**
 * SETUP-ERROR.JS - セットアップ専用エラークラス
 *
 * 目的:
 * - セットアップフェーズでの詳細なエラー情報の提供
 * - エラーリカバリー戦略の実装
 * - ユーザーフィードバックの改善
 *
 * 設計原則:
 * - カスタムエラークラスで情報を構造化
 * - リカバリー可能性の明示
 * - ユーザー向けメッセージとデバッグ情報の分離
 */

/**
 * セットアップエラーの種類
 */
export const SetupErrorType = {
    // 状態関連エラー
    INVALID_STATE: 'INVALID_STATE',
    MISSING_PLAYER: 'MISSING_PLAYER',
    MISSING_HAND: 'MISSING_HAND',

    // カード関連エラー
    CARD_NOT_FOUND: 'CARD_NOT_FOUND',
    INVALID_CARD_TYPE: 'INVALID_CARD_TYPE',
    NOT_BASIC_POKEMON: 'NOT_BASIC_POKEMON',

    // 配置関連エラー
    SLOT_OCCUPIED: 'SLOT_OCCUPIED',
    INVALID_ZONE: 'INVALID_ZONE',
    INVALID_INDEX: 'INVALID_INDEX',
    BENCH_FULL: 'BENCH_FULL',

    // マリガン関連エラー
    NO_BASIC_POKEMON: 'NO_BASIC_POKEMON',
    MULLIGAN_LIMIT_REACHED: 'MULLIGAN_LIMIT_REACHED',

    // アニメーション関連エラー
    ANIMATION_FAILED: 'ANIMATION_FAILED',
    ANIMATION_TIMEOUT: 'ANIMATION_TIMEOUT',

    // システムエラー
    GAME_INSTANCE_NOT_FOUND: 'GAME_INSTANCE_NOT_FOUND',
    STATE_QUEUE_ERROR: 'STATE_QUEUE_ERROR',
    UNEXPECTED_ERROR: 'UNEXPECTED_ERROR'
};

/**
 * リカバリー戦略
 */
export const RecoveryStrategy = {
    RETRY: 'RETRY',               // 再試行可能
    SKIP: 'SKIP',                 // スキップして続行
    ROLLBACK: 'ROLLBACK',         // 前の状態に戻す
    USER_INPUT: 'USER_INPUT',     // ユーザー入力待ち
    RESTART_SETUP: 'RESTART_SETUP', // セットアップをやり直し
    NONE: 'NONE'                  // リカバリー不可
};

/**
 * セットアップエラークラス
 */
export class SetupError extends Error {
    /**
     * @param {string} type - エラータイプ (SetupErrorType)
     * @param {string} message - デバッグ用詳細メッセージ
     * @param {Object} options - 追加オプション
     */
    constructor(type, message, options = {}) {
        super(message);

        this.name = 'SetupError';
        this.type = type;
        this.timestamp = new Date();

        // ユーザー向けメッセージ（日本語）
        this.userMessage = options.userMessage || this._getDefaultUserMessage(type);

        // リカバリー戦略
        this.recoveryStrategy = options.recoveryStrategy || this._getDefaultRecoveryStrategy(type);

        // コンテキスト情報
        this.context = {
            playerId: options.playerId || null,
            cardId: options.cardId || null,
            zone: options.zone || null,
            index: options.index || null,
            phase: options.phase || null,
            ...options.context
        };

        // リカバリー可能かどうか
        this.isRecoverable = this.recoveryStrategy !== RecoveryStrategy.NONE;

        // 元のエラー（ラップする場合）
        this.originalError = options.originalError || null;

        // スタックトレースを保持
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SetupError);
        }
    }

    /**
     * デフォルトのユーザー向けメッセージを取得
     * @private
     */
    _getDefaultUserMessage(type) {
        const messages = {
            [SetupErrorType.INVALID_STATE]: 'ゲーム状態が不正です。',
            [SetupErrorType.MISSING_PLAYER]: 'プレイヤー情報が見つかりません。',
            [SetupErrorType.MISSING_HAND]: '手札情報が見つかりません。',

            [SetupErrorType.CARD_NOT_FOUND]: '指定されたカードが見つかりません。',
            [SetupErrorType.INVALID_CARD_TYPE]: '無効なカードタイプです。',
            [SetupErrorType.NOT_BASIC_POKEMON]: 'たねポケモンのみ配置できます。',

            [SetupErrorType.SLOT_OCCUPIED]: 'その場所にはすでにポケモンがいます。',
            [SetupErrorType.INVALID_ZONE]: '無効な配置場所です。',
            [SetupErrorType.INVALID_INDEX]: '無効な位置が指定されました。',
            [SetupErrorType.BENCH_FULL]: 'ベンチがいっぱいです。',

            [SetupErrorType.NO_BASIC_POKEMON]: '手札にたねポケモンがありません。',
            [SetupErrorType.MULLIGAN_LIMIT_REACHED]: 'マリガンの上限に達しました。',

            [SetupErrorType.ANIMATION_FAILED]: 'アニメーションの実行に失敗しました。',
            [SetupErrorType.ANIMATION_TIMEOUT]: 'アニメーションがタイムアウトしました。',

            [SetupErrorType.GAME_INSTANCE_NOT_FOUND]: 'ゲームインスタンスが見つかりません。',
            [SetupErrorType.STATE_QUEUE_ERROR]: '状態更新キューでエラーが発生しました。',
            [SetupErrorType.UNEXPECTED_ERROR]: '予期しないエラーが発生しました。'
        };

        return messages[type] || '不明なエラーが発生しました。';
    }

    /**
     * デフォルトのリカバリー戦略を取得
     * @private
     */
    _getDefaultRecoveryStrategy(type) {
        const strategies = {
            // 状態関連エラー: 再起動が必要
            [SetupErrorType.INVALID_STATE]: RecoveryStrategy.RESTART_SETUP,
            [SetupErrorType.MISSING_PLAYER]: RecoveryStrategy.RESTART_SETUP,
            [SetupErrorType.MISSING_HAND]: RecoveryStrategy.RESTART_SETUP,

            // カード関連エラー: ユーザー入力待ち
            [SetupErrorType.CARD_NOT_FOUND]: RecoveryStrategy.USER_INPUT,
            [SetupErrorType.INVALID_CARD_TYPE]: RecoveryStrategy.USER_INPUT,
            [SetupErrorType.NOT_BASIC_POKEMON]: RecoveryStrategy.USER_INPUT,

            // 配置関連エラー: ユーザー入力待ち
            [SetupErrorType.SLOT_OCCUPIED]: RecoveryStrategy.USER_INPUT,
            [SetupErrorType.INVALID_ZONE]: RecoveryStrategy.USER_INPUT,
            [SetupErrorType.INVALID_INDEX]: RecoveryStrategy.USER_INPUT,
            [SetupErrorType.BENCH_FULL]: RecoveryStrategy.USER_INPUT,

            // マリガン関連エラー: 自動処理
            [SetupErrorType.NO_BASIC_POKEMON]: RecoveryStrategy.RETRY,
            [SetupErrorType.MULLIGAN_LIMIT_REACHED]: RecoveryStrategy.SKIP,

            // アニメーション関連エラー: スキップ可能
            [SetupErrorType.ANIMATION_FAILED]: RecoveryStrategy.SKIP,
            [SetupErrorType.ANIMATION_TIMEOUT]: RecoveryStrategy.SKIP,

            // システムエラー: リカバリー不可
            [SetupErrorType.GAME_INSTANCE_NOT_FOUND]: RecoveryStrategy.NONE,
            [SetupErrorType.STATE_QUEUE_ERROR]: RecoveryStrategy.RETRY,
            [SetupErrorType.UNEXPECTED_ERROR]: RecoveryStrategy.NONE
        };

        return strategies[type] || RecoveryStrategy.NONE;
    }

    /**
     * エラー情報を構造化されたオブジェクトとして取得
     */
    toJSON() {
        return {
            name: this.name,
            type: this.type,
            message: this.message,
            userMessage: this.userMessage,
            recoveryStrategy: this.recoveryStrategy,
            isRecoverable: this.isRecoverable,
            context: this.context,
            timestamp: this.timestamp.toISOString(),
            stack: this.stack
        };
    }

    /**
     * ユーザー向けの表示情報を取得
     */
    getUserDisplay() {
        return {
            title: 'セットアップエラー',
            message: this.userMessage,
            canRetry: this.isRecoverable,
            suggestions: this._getSuggestions()
        };
    }

    /**
     * ユーザーへの提案を取得
     * @private
     */
    _getSuggestions() {
        const suggestions = {
            [SetupErrorType.NOT_BASIC_POKEMON]: [
                '手札からたねポケモンを選択してください。',
                'たねポケモンには「BASIC」と表示されています。'
            ],
            [SetupErrorType.SLOT_OCCUPIED]: [
                '空いている場所を選択してください。',
                'ベンチには最大5体まで配置できます。'
            ],
            [SetupErrorType.BENCH_FULL]: [
                'ベンチは既に満員です。',
                '別のポケモンを選択してください。'
            ],
            [SetupErrorType.NO_BASIC_POKEMON]: [
                'マリガンを実行します。',
                '新しい手札を配り直します。'
            ]
        };

        return suggestions[this.type] || ['もう一度お試しください。'];
    }

    /**
     * コンソールログ用のフォーマット
     */
    toString() {
        return `[${this.name}] ${this.type}: ${this.message}\n` +
               `User Message: ${this.userMessage}\n` +
               `Recovery: ${this.recoveryStrategy}\n` +
               `Context: ${JSON.stringify(this.context, null, 2)}`;
    }
}

/**
 * エラーハンドラークラス
 * SetupErrorの処理とリカバリーを管理
 */
export class SetupErrorHandler {
    constructor(gameContext) {
        this.gameContext = gameContext;
        this.errorLog = [];
        this.maxLogSize = 50;
    }

    /**
     * エラーを処理
     * @param {SetupError} error - セットアップエラー
     * @returns {Promise<Object>} リカバリー結果
     */
    async handleError(error) {
        // エラーログに記録
        this._logError(error);

        // コンソールに出力
        console.error(error.toString());

        // ユーザーに通知
        this._notifyUser(error);

        // リカバリー戦略に応じて処理
        const result = await this._executeRecovery(error);

        return result;
    }

    /**
     * エラーをログに記録
     * @private
     */
    _logError(error) {
        this.errorLog.push({
            error: error.toJSON(),
            timestamp: new Date()
        });

        // ログサイズ制限
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }
    }

    /**
     * ユーザーに通知
     * @private
     */
    _notifyUser(error) {
        const display = error.getUserDisplay();

        // プロンプトメッセージを更新
        try {
            const state = this.gameContext.getState();
            const newState = {
                ...state,
                prompt: {
                    ...state.prompt,
                    message: display.message,
                    type: 'error'
                }
            };
            this.gameContext.updateState(newState);
        } catch (e) {
            console.error('Failed to update user prompt:', e);
        }

        // トーストメッセージ（オプション）
        if (typeof window !== 'undefined' && window.showToast) {
            window.showToast(display.message, 'error');
        }
    }

    /**
     * リカバリー戦略を実行
     * @private
     */
    async _executeRecovery(error) {
        switch (error.recoveryStrategy) {
            case RecoveryStrategy.RETRY:
                return { action: 'retry', success: true };

            case RecoveryStrategy.SKIP:
                return { action: 'skip', success: true };

            case RecoveryStrategy.ROLLBACK:
                return await this._rollbackState();

            case RecoveryStrategy.USER_INPUT:
                return { action: 'wait_for_user', success: true };

            case RecoveryStrategy.RESTART_SETUP:
                return await this._restartSetup();

            case RecoveryStrategy.NONE:
            default:
                return { action: 'none', success: false };
        }
    }

    /**
     * 状態をロールバック
     * @private
     */
    async _rollbackState() {
        // 実装は後で追加（状態履歴が必要）
        console.warn('Rollback not implemented yet');
        return { action: 'rollback', success: false };
    }

    /**
     * セットアップを再開始
     * @private
     */
    async _restartSetup() {
        try {
            const gameInstance = this.gameContext.getGameInstance();
            if (gameInstance && typeof gameInstance.triggerInitialSetup === 'function') {
                await gameInstance.triggerInitialSetup();
                return { action: 'restart', success: true };
            }
        } catch (e) {
            console.error('Failed to restart setup:', e);
        }
        return { action: 'restart', success: false };
    }

    /**
     * エラーログを取得
     */
    getErrorLog() {
        return [...this.errorLog];
    }

    /**
     * エラーログをクリア
     */
    clearErrorLog() {
        this.errorLog = [];
    }
}
