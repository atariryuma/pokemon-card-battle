/**
 * STATE-QUEUE.JS - 非同期状態更新キューシステム
 *
 * 問題点:
 * - 複数の非同期処理が同時にwindow.gameInstance.stateを変更すると競合が発生
 * - CPUのセットアップ中にプレイヤーが操作すると配置が消える
 *
 * 解決策:
 * - すべての状態更新をキューに追加し、順次実行
 * - 最新の状態を常に保証
 * - Immutability原則を厳守（状態の直接変更を防止）
 */

export class StateQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.currentState = null;
        this.stateUpdateCallback = null;
    }

    /**
     * 状態更新コールバックを設定
     * @param {Function} callback - 状態を受け取って更新する関数
     */
    setStateUpdateCallback(callback) {
        this.stateUpdateCallback = callback;
    }

    /**
     * 現在の状態を設定
     * @param {Object} state - ゲーム状態
     */
    setCurrentState(state) {
        this.currentState = state;
    }

    /**
     * 状態更新タスクをキューに追加
     * @param {Function} updateFunction - 状態を受け取って新しい状態を返す非同期関数
     * @param {string} description - タスクの説明（デバッグ用）
     * @returns {Promise<Object>} 更新後の状態
     */
    async enqueue(updateFunction, description = 'State update') {
        return new Promise((resolve, reject) => {
            this.queue.push({
                updateFunction,
                description,
                resolve,
                reject
            });

            // キュー処理開始
            if (!this.isProcessing) {
                this.processQueue();
            }
        });
    }

    /**
     * キューを順次処理
     */
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const task = this.queue.shift();

            try {
                // ✅ FIX #4: 非同期処理の競合対応
                // 状態の不変性を保証するため、ディープコピーを使用
                const latestState = this._deepCloneState(this.currentState);

                // 更新関数を実行
                const newState = await task.updateFunction(latestState);

                // 状態を更新（イミュータブル）
                this.currentState = this._deepCloneState(newState);

                // コールバック経由でゲームに状態を反映（非同期化）
                if (this.stateUpdateCallback) {
                    // 次のマイクロタスクで実行し、キュー処理をブロックしない
                    Promise.resolve().then(() => {
                        this.stateUpdateCallback(newState);
                    });
                }

                // Promiseを解決
                task.resolve(newState);
            } catch (error) {
                console.error(`❌ StateQueue: Error in "${task.description}":`, error);
                task.reject(error);
            }
        }

        this.isProcessing = false;
    }

    /**
     * 状態のディープクローンを作成
     * @private
     * @param {Object} state - クローンする状態
     * @returns {Object} クローンされた状態
     */
    _deepCloneState(state) {
        if (!state) return null;

        // オブジェクトのディープクローン（パフォーマンスと信頼性のバランス）
        try {
            return JSON.parse(JSON.stringify(state));
        } catch (error) {
            console.warn('⚠️ StateQueue: Failed to deep clone state, using shallow copy', error);
            return { ...state };
        }
    }

    /**
     * キューをクリア（緊急時用）
     */
    clear() {
        console.warn('⚠️ StateQueue: Clearing all pending tasks');
        this.queue.forEach(task => {
            task.reject(new Error('Queue cleared'));
        });
        this.queue = [];
        this.isProcessing = false;
    }

    /**
     * キューの状態を取得（デバッグ用）
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
            pendingTasks: this.queue.map(t => t.description)
        };
    }
}

// シングルトンインスタンスをエクスポート
export const stateQueue = new StateQueue();

export default stateQueue;
