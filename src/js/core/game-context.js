/**
 * ゲームコンテキスト - 依存性注入のためのコンテナ
 * グローバル変数への依存を排除し、テスト容易性を向上
 */

export class GameContext {
    constructor() {
        this._gameInstance = null;
        this._stateQueue = null;
        this._animationManager = null;
        this._setupManager = null;
    }

    /**
     * ゲームインスタンスを登録
     */
    registerGameInstance(gameInstance) {
        this._gameInstance = gameInstance;
        // 後方互換性のため window.gameInstance も設定
        if (typeof window !== 'undefined') {
            window.gameInstance = gameInstance;
        }
    }

    /**
     * ステートキューを登録
     */
    registerStateQueue(stateQueue) {
        this._stateQueue = stateQueue;
    }

    /**
     * アニメーションマネージャーを登録
     */
    registerAnimationManager(animationManager) {
        this._animationManager = animationManager;
    }

    /**
     * セットアップマネージャーを登録
     */
    registerSetupManager(setupManager) {
        this._setupManager = setupManager;
    }

    /**
     * ゲームインスタンスを取得
     */
    getGameInstance() {
        return this._gameInstance;
    }

    /**
     * ゲームインスタンスが存在するか
     */
    hasGameInstance() {
        return this._gameInstance !== null;
    }

    /**
     * 現在のゲーム状態を取得
     */
    getState() {
        if (!this._gameInstance) {
            throw new Error('GameContext: Game instance not registered');
        }
        return this._gameInstance.state;
    }

    /**
     * 状態を更新
     */
    updateState(newState, context = 'gameContext') {
        if (!this._gameInstance) {
            throw new Error('GameContext: Game instance not registered');
        }
        this._gameInstance._updateState(newState, context);
    }

    /**
     * ステートキューにタスクを追加
     */
    async enqueueStateUpdate(updateFunction, description) {
        if (!this._stateQueue) {
            throw new Error('GameContext: State queue not registered');
        }
        return await this._stateQueue.enqueue(updateFunction, description);
    }

    /**
     * ビューを取得
     */
    getView() {
        if (!this._gameInstance) {
            throw new Error('GameContext: Game instance not registered');
        }
        return this._gameInstance.view;
    }

    /**
     * アニメーションを実行
     */
    async runAnimation(animationType, ...args) {
        if (!this._animationManager) {
            console.warn('GameContext: Animation manager not registered');
            return Promise.resolve();
        }
        return await this._animationManager[animationType]?.(...args);
    }

    /**
     * セットアップマネージャーを取得
     */
    getSetupManager() {
        return this._setupManager;
    }

    /**
     * クリーンアップ（テスト用）
     */
    cleanup() {
        this._gameInstance = null;
        this._stateQueue = null;
        this._animationManager = null;
        this._setupManager = null;
        if (typeof window !== 'undefined') {
            window.gameInstance = null;
        }
    }
}

// シングルトンインスタンス
export const gameContext = new GameContext();
