/**
 * ERROR-HANDLER.JS - ゲーム用エラーハンドリングシステム
 *
 * エラー捕捉、ユーザーフレンドリーな表示、リトライ機能を提供
 */

import { GAME_PHASES } from './phase-manager.js';
import { noop } from './utils.js';

/**
 * エラータイプの定義
 */
export const ERROR_TYPES = {
    NETWORK: 'network',
    GAME_STATE: 'game_state',
    INVALID_ACTION: 'invalid_action',
    CARD_NOT_FOUND: 'card_not_found',
    SETUP_FAILED: 'setup_failed',
    ANIMATION_FAILED: 'animation_failed',
    UNKNOWN: 'unknown'
};

/**
 * 回復可能なエラーの定義
 */
export const RECOVERABLE_ERRORS = new Set([
    ERROR_TYPES.NETWORK,
    ERROR_TYPES.SETUP_FAILED,
    ERROR_TYPES.ANIMATION_FAILED
]);

/**
 * エラーハンドリングマネージャー
 */
export class ErrorHandler {
    constructor() {
        this.errorHistory = [];
        this.maxRetries = 3;
        this.retryDelays = [1000, 2000, 5000]; // ms
        
        // グローバルエラーハンドラー設定
        this.setupGlobalHandlers();
    }

    /**
     * グローバルエラーハンドラーの設定
     */
    setupGlobalHandlers() {
        // Unhandled Promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('🚨 Unhandled Promise Rejection:', event.reason);
            this.handleError(event.reason, ERROR_TYPES.UNKNOWN, false);
            event.preventDefault();
        });

        // JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('🚨 JavaScript Error:', event.error);
            this.handleError(event.error, ERROR_TYPES.UNKNOWN, false);
        });
    }

    /**
     * メインエラーハンドリング
     */
    async handleError(error, type = ERROR_TYPES.UNKNOWN, canRetry = true) {
        const errorInfo = this.classifyError(error, type);
        this.logError(errorInfo);
        
        // 回復可能なエラーの場合はリトライを試行（ただし回数制限あり）
        if (canRetry && RECOVERABLE_ERRORS.has(errorInfo.type)) {
            const retryCount = this.getRetryCount(errorInfo.type);
            if (retryCount < this.maxRetries) {
                return this.attemptRecovery(errorInfo);
            } else {
                console.warn(`🔄 Max retries (${this.maxRetries}) exceeded for ${errorInfo.type}`);
            }
        }
        
        // ユーザーにエラーを表示
        this.displayUserFriendlyError(errorInfo);
        
        return false;
    }

    /**
     * エラーの分類
     */
    classifyError(error, suggestedType) {
        let type = suggestedType;
        let message = error?.message || '不明なエラーが発生しました';
        let severity = 'medium';
        
        // エラータイプの自動判定
        if (error?.name === 'TypeError' && message.includes('fetch')) {
            type = ERROR_TYPES.NETWORK;
            severity = 'low';
        } else if (message.includes('card') || message.includes('カード')) {
            type = ERROR_TYPES.CARD_NOT_FOUND;
        } else if (message.includes('state') || message.includes('状態')) {
            type = ERROR_TYPES.GAME_STATE;
            severity = 'high';
        } else if (message.includes('setup') || message.includes('セットアップ')) {
            type = ERROR_TYPES.SETUP_FAILED;
        }
        
        return {
            type,
            message,
            severity,
            timestamp: Date.now(),
            originalError: error,
            stack: error?.stack
        };
    }

    /**
     * エラーログ記録
     */
    logError(errorInfo) {
        this.errorHistory.push(errorInfo);
        
        // 最大履歴数を制限
        if (this.errorHistory.length > 50) {
            this.errorHistory.shift();
        }
        
        // コンソールログ
        const emoji = this.getSeverityEmoji(errorInfo.severity);
        console.error(`${emoji} [${errorInfo.type.toUpperCase()}] ${errorInfo.message}`, errorInfo);
    }

    /**
     * 深刻度に応じた絵文字
     */
    getSeverityEmoji(severity) {
        switch (severity) {
            case 'low': return '⚠️';
            case 'medium': return '🚨';
            case 'high': return '💥';
            default: return '❌';
        }
    }

    /**
     * 回復処理の試行
     */
    async attemptRecovery(errorInfo) {
        const retryCount = this.getRetryCount(errorInfo.type);
        
        if (retryCount >= this.maxRetries) {
            console.warn(`🔄 Max retries exceeded for ${errorInfo.type}`);
            this.displayUserFriendlyError(errorInfo);
            return false;
        }
        
        noop(`🔄 Attempting recovery for ${errorInfo.type} (attempt ${retryCount + 1})`);
        
        // リトライ遅延
        const delay = this.retryDelays[Math.min(retryCount, this.retryDelays.length - 1)];
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // エラータイプ別の回復処理
        return this.executeRecovery(errorInfo);
    }

    /**
     * リトライ回数取得（過去10分以内のエラーのみカウント）
     */
    getRetryCount(errorType) {
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        return this.errorHistory.filter(e => 
            e.type === errorType && e.timestamp > tenMinutesAgo
        ).length;
    }

    /**
     * エラータイプ別回復処理実行
     */
    async executeRecovery(errorInfo) {
        try {
            switch (errorInfo.type) {
                case ERROR_TYPES.NETWORK:
                    return this.recoverFromNetworkError();
                    
                case ERROR_TYPES.SETUP_FAILED:
                    return this.recoverFromSetupError();
                    
                case ERROR_TYPES.ANIMATION_FAILED:
                    return this.recoverFromAnimationError();
                    
                default:
                    return false;
            }
        } catch (recoveryError) {
            console.error('🔄 Recovery failed:', recoveryError);
            return false;
        }
    }

    /**
     * ネットワークエラー回復
     */
    async recoverFromNetworkError() {
        // 簡単な接続テスト
        try {
            await fetch(window.location.origin, { method: 'HEAD' });
            noop('🔄 Network recovery successful');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * セットアップエラー回復
     */
    async recoverFromSetupError() {
        // DOM要素の再取得を試行
        noop('🔄 Attempting DOM re-initialization for setup recovery');
        try {
            // ページリロードを推奨
            if (confirm('ゲーム初期化に失敗しました。ページをリロードしますか？')) {
                window.location.reload();
                return true;
            }
            return false;
        } catch (error) {
            console.error('🔄 Setup recovery failed:', error);
            return false;
        }
    }

    /**
     * アニメーションエラー回復
     */
    async recoverFromAnimationError() {
        // アニメーションをスキップして続行
        noop('🔄 Skipping animation and continuing');
        return true;
    }

    /**
     * ユーザーフレンドリーなエラー表示
     */
    displayUserFriendlyError(errorInfo) {
        const userMessage = this.getUserFriendlyMessage(errorInfo);
        const suggestions = this.getErrorSuggestions(errorInfo);
        
        if (window.gameInstance?.view) {
            // 致命的エラーは中央モーダルで表示（新システム）
            window.gameInstance.view.displayModal({
                title: '⚠️ エラーが発生しました',
                message: `
                    <div class="error-display">
                        <p class="text-lg mb-4">${userMessage}</p>
                        ${suggestions.length > 0 ? `
                            <div class="suggestions">
                                <h4 class="font-semibold mb-2">推奨アクション:</h4>
                                <ul class="list-disc list-inside space-y-1">
                                    ${suggestions.map(s => `<li>${s}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                `,
                actions: [
                    {
                        text: '🔄 リトライ',
                        callback: () => this.retryLastAction(),
                        className: 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg'
                    },
                    {
                        text: '🎮 新しいゲーム',
                        callback: () => window.gameInstance?.init(),
                        className: 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg'
                    },
                    {
                        text: '📋 エラー詳細',
                        callback: () => this.showErrorDetails(errorInfo),
                        className: 'px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg'
                    }
                ]
            });
        } else {
            // フォールバック：alert表示
            alert(`エラーが発生しました: ${userMessage}`);
        }
    }

    /**
     * ユーザーフレンドリーなメッセージに変換
     */
    getUserFriendlyMessage(errorInfo) {
        const messages = {
            [ERROR_TYPES.NETWORK]: 'ネットワーク接続に問題があります。インターネット接続を確認してください。',
            [ERROR_TYPES.GAME_STATE]: 'ゲームの状態に問題が発生しました。新しいゲームを開始することをお勧めします。',
            [ERROR_TYPES.INVALID_ACTION]: 'この操作は現在実行できません。別のアクションを試してください。',
            [ERROR_TYPES.CARD_NOT_FOUND]: 'カードが見つかりませんでした。ゲームをリセットしてください。',
            [ERROR_TYPES.SETUP_FAILED]: 'ゲームの初期化に失敗しました。再度お試しください。',
            [ERROR_TYPES.ANIMATION_FAILED]: 'アニメーションの実行に失敗しました。ゲームは続行できます。',
            [ERROR_TYPES.UNKNOWN]: '予期しないエラーが発生しました。'
        };
        
        return messages[errorInfo.type] || messages[ERROR_TYPES.UNKNOWN];
    }

    /**
     * エラー別の推奨アクション
     */
    getErrorSuggestions(errorInfo) {
        const suggestions = {
            [ERROR_TYPES.NETWORK]: [
                'インターネット接続を確認してください',
                'ページをリロードしてください',
                'しばらく時間をおいて再試行してください'
            ],
            [ERROR_TYPES.SETUP_FAILED]: [
                '新しいゲームを開始してください',
                'ブラウザのキャッシュをクリアしてください',
                'ページをリロードしてください'
            ],
            [ERROR_TYPES.CARD_NOT_FOUND]: [
                'ゲームをリセットしてください',
                '操作を一つ前に戻してください'
            ]
        };
        
        return suggestions[errorInfo.type] || [];
    }

    /**
     * 最後のアクションをリトライ
     */
    async retryLastAction() {
        // 実装は具体的なアクション履歴システムに依存
        noop('🔄 Retrying last action...');
        
        if (window.gameInstance?.view) {
            window.gameInstance.view.hideModal();
        }
        
        // 基本的なリトライとして、現在のフェーズを再実行
        if (window.gameInstance?.state) {
            await window.gameInstance._updateUI();
        }
    }

    /**
     * エラー詳細表示
     */
    showErrorDetails(errorInfo) {
        if (window.gameInstance?.view) {
            // エラー詳細も中央モーダルで表示（新システム）
            window.gameInstance.view.displayModal({
                title: '🔍 エラー詳細情報',
                message: `
                    <div class="error-details">
                        <p><strong>タイプ:</strong> ${errorInfo.type}</p>
                        <p><strong>メッセージ:</strong> ${errorInfo.message}</p>
                        <p><strong>時刻:</strong> ${new Date(errorInfo.timestamp).toLocaleString()}</p>
                        <p><strong>深刻度:</strong> ${errorInfo.severity}</p>
                        ${errorInfo.stack ? `<details class="mt-2"><summary>スタックトレース</summary><pre class="text-xs mt-2">${errorInfo.stack}</pre></details>` : ''}
                    </div>
                `,
                actions: [
                    {
                        text: '戻る',
                        callback: () => window.gameInstance.view.hideModal(),
                        className: 'px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg'
                    }
                ]
            });
        }
    }

    /**
     * エラー履歴取得
     */
    getErrorHistory() {
        return [...this.errorHistory];
    }

    /**
     * エラー履歴クリア
     */
    clearErrorHistory() {
        this.errorHistory = [];
    }
}

// グローバルインスタンス作成
export const errorHandler = new ErrorHandler();