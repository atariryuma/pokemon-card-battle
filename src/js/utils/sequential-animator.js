/**
 * SEQUENTIAL-ANIMATOR.JS - 順次アニメーション実行ユーティリティ
 *
 * 目的:
 * - setInterval + async の危険な組み合わせを排除
 * - Promise チェーンの平坦化
 * - タイミング制御の改善
 *
 * 設計原則:
 * - async/await ベースの明示的な制御フロー
 * - タイムアウト処理の組み込み
 * - エラーハンドリングの強化
 * - キャンセル可能なアニメーション
 */

/**
 * アニメーションタスク
 */
class AnimationTask {
    constructor(id, executor, options = {}) {
        this.id = id;
        this.executor = executor;
        this.delay = options.delay || 0;
        this.timeout = options.timeout || 30000; // デフォルト30秒
        this.retries = options.retries || 0;
        this.onError = options.onError || null;
        this.status = 'pending'; // pending, running, completed, failed, cancelled
        this.result = null;
        this.error = null;
    }

    async execute() {
        this.status = 'running';

        // 遅延があれば待機
        if (this.delay > 0) {
            await this._sleep(this.delay);
        }

        // タイムアウト付きで実行
        try {
            this.result = await this._executeWithTimeout();
            this.status = 'completed';
            return this.result;
        } catch (error) {
            this.error = error;
            this.status = 'failed';

            // エラーハンドラがあれば実行
            if (this.onError) {
                try {
                    await this.onError(error);
                } catch (handlerError) {
                    console.error(`Error in error handler for task ${this.id}:`, handlerError);
                }
            }

            throw error;
        }
    }

    async _executeWithTimeout() {
        return Promise.race([
            this.executor(),
            this._timeoutPromise()
        ]);
    }

    _timeoutPromise() {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Animation task ${this.id} timed out after ${this.timeout}ms`));
            }, this.timeout);
        });
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    cancel() {
        if (this.status === 'pending' || this.status === 'running') {
            this.status = 'cancelled';
        }
    }
}

/**
 * 順次アニメーション実行クラス
 */
export class SequentialAnimator {
    constructor(options = {}) {
        this.tasks = [];
        this.currentTaskIndex = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.isCancelled = false;

        // デフォルトオプション
        this.defaultDelay = options.defaultDelay || 0;
        this.defaultTimeout = options.defaultTimeout || 30000;
        this.stopOnError = options.stopOnError !== false; // デフォルトはtrue

        // イベントハンドラ
        this.onTaskStart = options.onTaskStart || null;
        this.onTaskComplete = options.onTaskComplete || null;
        this.onTaskError = options.onTaskError || null;
        this.onComplete = options.onComplete || null;
        this.onError = options.onError || null;

        // 統計情報
        this.stats = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            cancelledTasks: 0,
            totalDuration: 0
        };
    }

    /**
     * アニメーションタスクを追加
     * @param {string} id - タスクID
     * @param {Function} executor - アニメーション実行関数
     * @param {Object} options - オプション
     * @returns {SequentialAnimator} チェーン用に自身を返す
     */
    add(id, executor, options = {}) {
        const task = new AnimationTask(id, executor, {
            delay: options.delay ?? this.defaultDelay,
            timeout: options.timeout ?? this.defaultTimeout,
            retries: options.retries ?? 0,
            onError: options.onError ?? this.onTaskError
        });

        this.tasks.push(task);
        this.stats.totalTasks++;

        return this; // メソッドチェーン用
    }

    /**
     * すべてのタスクを順次実行
     * @returns {Promise<Object>} 実行結果
     */
    async run() {
        if (this.isRunning) {
            throw new Error('SequentialAnimator is already running');
        }

        this.isRunning = true;
        this.isCancelled = false;
        this.currentTaskIndex = 0;
        const startTime = performance.now();

        const results = [];

        try {
            for (let i = 0; i < this.tasks.length; i++) {
                // キャンセルチェック
                if (this.isCancelled) {
                    console.log('SequentialAnimator: Execution cancelled');
                    break;
                }

                // 一時停止チェック
                while (this.isPaused && !this.isCancelled) {
                    await this._sleep(100);
                }

                const task = this.tasks[i];
                this.currentTaskIndex = i;

                // タスク開始イベント
                if (this.onTaskStart) {
                    this.onTaskStart(task);
                }

                try {
                    const result = await task.execute();
                    results.push({ id: task.id, result, success: true });
                    this.stats.completedTasks++;

                    // タスク完了イベント
                    if (this.onTaskComplete) {
                        this.onTaskComplete(task, result);
                    }

                } catch (error) {
                    console.error(`Task ${task.id} failed:`, error);
                    results.push({ id: task.id, error, success: false });
                    this.stats.failedTasks++;

                    // タスクエラーイベント
                    if (this.onTaskError) {
                        this.onTaskError(task, error);
                    }

                    // エラーで停止する設定の場合
                    if (this.stopOnError) {
                        throw error;
                    }
                }
            }

            this.stats.totalDuration = performance.now() - startTime;

            // 全体完了イベント
            if (this.onComplete) {
                this.onComplete(this.stats, results);
            }

            return {
                success: this.stats.failedTasks === 0,
                stats: this.stats,
                results
            };

        } catch (error) {
            this.stats.totalDuration = performance.now() - startTime;

            // 全体エラーイベント
            if (this.onError) {
                this.onError(error, this.stats, results);
            }

            throw error;

        } finally {
            this.isRunning = false;
            this.isPaused = false;
        }
    }

    /**
     * 実行を一時停止
     */
    pause() {
        if (this.isRunning && !this.isPaused) {
            this.isPaused = true;
            console.log('SequentialAnimator: Paused');
        }
    }

    /**
     * 一時停止を解除
     */
    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            console.log('SequentialAnimator: Resumed');
        }
    }

    /**
     * 実行をキャンセル
     */
    cancel() {
        this.isCancelled = true;
        this.isPaused = false;

        // すべての未実行タスクをキャンセル
        for (let i = this.currentTaskIndex; i < this.tasks.length; i++) {
            this.tasks[i].cancel();
            this.stats.cancelledTasks++;
        }

        console.log('SequentialAnimator: Cancelled');
    }

    /**
     * タスクをクリア
     */
    clear() {
        if (this.isRunning) {
            this.cancel();
        }

        this.tasks = [];
        this.currentTaskIndex = 0;
        this.stats = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            cancelledTasks: 0,
            totalDuration: 0
        };
    }

    /**
     * 現在の状態を取得
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            isCancelled: this.isCancelled,
            currentTaskIndex: this.currentTaskIndex,
            totalTasks: this.tasks.length,
            progress: this.tasks.length > 0 ? this.currentTaskIndex / this.tasks.length : 0,
            stats: { ...this.stats }
        };
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 便利な静的メソッド
 */

/**
 * 配列を順次処理（setIntervalの代替）
 * @param {Array} items - 処理する項目の配列
 * @param {Function} processor - 各項目を処理する関数 (item, index) => Promise
 * @param {Object} options - オプション
 * @returns {Promise<Array>} 処理結果の配列
 */
export async function processSequentially(items, processor, options = {}) {
    const animator = new SequentialAnimator(options);

    items.forEach((item, index) => {
        animator.add(
            `item-${index}`,
            () => processor(item, index),
            options
        );
    });

    const result = await animator.run();
    return result.results.map(r => r.result);
}

/**
 * 指定間隔で関数を繰り返し実行（setIntervalの安全な代替）
 * @param {Function} fn - 実行する関数
 * @param {number} count - 実行回数
 * @param {number} interval - 間隔（ミリ秒）
 * @param {Object} options - オプション
 * @returns {Promise<Array>} 実行結果の配列
 */
export async function repeatWithInterval(fn, count, interval, options = {}) {
    const animator = new SequentialAnimator({
        defaultDelay: interval,
        ...options
    });

    for (let i = 0; i < count; i++) {
        animator.add(
            `iteration-${i}`,
            () => fn(i),
            { delay: i === 0 ? 0 : interval }
        );
    }

    const result = await animator.run();
    return result.results.map(r => r.result);
}

/**
 * タイムアウト付きアニメーション実行
 * @param {Function} fn - アニメーション関数
 * @param {number} timeout - タイムアウト（ミリ秒）
 * @returns {Promise} 実行結果
 */
export async function executeWithTimeout(fn, timeout = 30000) {
    return Promise.race([
        fn(),
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Animation timed out after ${timeout}ms`)), timeout);
        })
    ]);
}

/**
 * デフォルトエクスポート
 */
export default SequentialAnimator;
