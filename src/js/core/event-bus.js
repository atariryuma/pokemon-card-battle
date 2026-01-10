/**
 * イベントバス - Observer Pattern実装
 * Hearthstone/Pokemon TCG Onlineのイベント駆動アーキテクチャを採用
 *
 * 参考:
 * - https://betterprogramming.pub/design-patterns-for-games-state-pattern-97519e0b9165
 * - https://gameprogrammingpatterns.com/observer.html
 */

export const GameEventTypes = {
    // ゲーム lifecycle
    GAME_INITIALIZED: 'game:initialized',
    GAME_STARTED: 'game:started',
    GAME_ENDED: 'game:ended',
    GAME_PAUSED: 'game:paused',
    GAME_RESUMED: 'game:resumed',

    // ターン・フェーズ
    TURN_STARTED: 'turn:started',
    TURN_ENDED: 'turn:ended',
    PHASE_CHANGED: 'phase:changed',

    // カードアクション
    CARD_DRAWN: 'card:drawn',
    CARD_PLAYED: 'card:played',
    CARD_DISCARDED: 'card:discarded',
    CARD_MOVED: 'card:moved',

    // 戦闘
    ATTACK_DECLARED: 'battle:attack_declared',
    DAMAGE_DEALT: 'battle:damage_dealt',
    POKEMON_KNOCKED_OUT: 'battle:pokemon_knocked_out',

    // エネルギー
    ENERGY_ATTACHED: 'energy:attached',
    ENERGY_REMOVED: 'energy:removed',

    // 状態変更
    STATE_UPDATED: 'state:updated',
    STATE_VALIDATED: 'state:validated',

    // UI
    UI_BUTTON_CLICKED: 'ui:button_clicked',
    UI_CARD_SELECTED: 'ui:card_selected',
    UI_CARD_HOVERED: 'ui:card_hovered',

    // アニメーション
    ANIMATION_STARTED: 'animation:started',
    ANIMATION_COMPLETED: 'animation:completed',

    // エラー
    ERROR_OCCURRED: 'error:occurred',
    WARNING_RAISED: 'warning:raised',
};

/**
 * EventBusクラス - シングルトンパターン
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
        this.onceListeners = new Map();
        this.eventHistory = [];
        this.maxHistorySize = 100;
        this.debugMode = false;
    }

    /**
     * イベントリスナーを登録
     * @param {string} eventType - イベントタイプ
     * @param {Function} callback - コールバック関数
     * @param {Object} options - オプション { priority: number }
     * @returns {Function} unsubscribe関数
     */
    on(eventType, callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('EventBus.on: Callback must be a function');
        }

        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }

        const listener = {
            callback,
            priority: options.priority || 0,
            id: Symbol('listener'),
        };

        const listeners = this.listeners.get(eventType);
        listeners.push(listener);

        // 優先度順にソート（高い方が先）
        listeners.sort((a, b) => b.priority - a.priority);

        if (this.debugMode) {
            console.log(`[EventBus] Registered listener for ${eventType}`, { priority: listener.priority });
        }

        // unsubscribe関数を返す
        return () => this.off(eventType, listener.id);
    }

    /**
     * 一度だけ実行されるリスナーを登録
     */
    once(eventType, callback, options = {}) {
        if (!this.onceListeners.has(eventType)) {
            this.onceListeners.set(eventType, []);
        }

        const listener = {
            callback,
            priority: options.priority || 0,
            id: Symbol('once-listener'),
        };

        this.onceListeners.get(eventType).push(listener);

        return () => this.offOnce(eventType, listener.id);
    }

    /**
     * リスナーを解除
     */
    off(eventType, listenerId) {
        if (!this.listeners.has(eventType)) return;

        const listeners = this.listeners.get(eventType);
        const index = listeners.findIndex(l => l.id === listenerId);

        if (index !== -1) {
            listeners.splice(index, 1);

            if (this.debugMode) {
                console.log(`[EventBus] Removed listener for ${eventType}`);
            }
        }
    }

    /**
     * onceリスナーを解除
     */
    offOnce(eventType, listenerId) {
        if (!this.onceListeners.has(eventType)) return;

        const listeners = this.onceListeners.get(eventType);
        const index = listeners.findIndex(l => l.id === listenerId);

        if (index !== -1) {
            listeners.splice(index, 1);
        }
    }

    /**
     * イベントを発行
     * @param {string} eventType - イベントタイプ
     * @param {*} data - イベントデータ
     */
    emit(eventType, data = {}) {
        const event = {
            type: eventType,
            data,
            timestamp: Date.now(),
        };

        // ✅ FIX #3: イベント履歴の軽量化 - 大きなオブジェクトの代わりにサマリーを保存
        const eventSummary = {
            type: eventType,
            timestamp: Date.now(),
            // 大きなstateオブジェクトの代わりに必要最小限の情報のみ記録
            summary: this._summarizeEventData(eventType, data)
        };

        this.eventHistory.push(eventSummary);
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }

        if (this.debugMode) {
            console.log(`[EventBus] Emit: ${eventType}`, data);
        }

        // 通常のリスナーを実行
        if (this.listeners.has(eventType)) {
            const listeners = this.listeners.get(eventType);
            for (const listener of listeners) {
                try {
                    listener.callback(data, event);
                } catch (error) {
                    console.error(`[EventBus] Error in listener for ${eventType}:`, error);
                }
            }
        }

        // onceリスナーを実行して削除
        if (this.onceListeners.has(eventType)) {
            const onceListeners = [...this.onceListeners.get(eventType)];
            this.onceListeners.delete(eventType);

            for (const listener of onceListeners) {
                try {
                    listener.callback(data, event);
                } catch (error) {
                    console.error(`[EventBus] Error in once-listener for ${eventType}:`, error);
                }
            }
        }

        // ワイルドカードリスナー（全イベント購読）
        if (this.listeners.has('*')) {
            const wildcardListeners = this.listeners.get('*');
            for (const listener of wildcardListeners) {
                try {
                    listener.callback(data, event);
                } catch (error) {
                    console.error(`[EventBus] Error in wildcard listener:`, error);
                }
            }
        }
    }

    /**
     * 非同期イベント発行
     */
    async emitAsync(eventType, data = {}) {
        const event = {
            type: eventType,
            data,
            timestamp: Date.now(),
        };

        this.eventHistory.push(event);
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }

        if (this.debugMode) {
            console.log(`[EventBus] EmitAsync: ${eventType}`, data);
        }

        const promises = [];

        // 通常のリスナー
        if (this.listeners.has(eventType)) {
            const listeners = this.listeners.get(eventType);
            for (const listener of listeners) {
                promises.push(
                    (async () => {
                        try {
                            await listener.callback(data, event);
                        } catch (error) {
                            console.error(`[EventBus] Error in async listener for ${eventType}:`, error);
                        }
                    })()
                );
            }
        }

        // onceリスナー
        if (this.onceListeners.has(eventType)) {
            const onceListeners = [...this.onceListeners.get(eventType)];
            this.onceListeners.delete(eventType);

            for (const listener of onceListeners) {
                promises.push(
                    (async () => {
                        try {
                            await listener.callback(data, event);
                        } catch (error) {
                            console.error(`[EventBus] Error in async once-listener for ${eventType}:`, error);
                        }
                    })()
                );
            }
        }

        await Promise.all(promises);
    }

    /**
     * 特定イベントタイプの全リスナーを削除
     */
    clear(eventType) {
        this.listeners.delete(eventType);
        this.onceListeners.delete(eventType);

        if (this.debugMode) {
            console.log(`[EventBus] Cleared all listeners for ${eventType}`);
        }
    }

    /**
     * 全リスナーを削除
     */
    clearAll() {
        this.listeners.clear();
        this.onceListeners.clear();
        this.eventHistory = [];

        if (this.debugMode) {
            console.log('[EventBus] Cleared all listeners');
        }
    }

    /**
     * イベント履歴を取得
     */
    getHistory(eventType = null) {
        if (eventType) {
            return this.eventHistory.filter(e => e.type === eventType);
        }
        return [...this.eventHistory];
    }

    /**
     * デバッグモードの切り替え
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    /**
     * 登録されているリスナー数を取得
     */
    getListenerCount(eventType) {
        const count = (this.listeners.get(eventType)?.length || 0) +
            (this.onceListeners.get(eventType)?.length || 0);
        return count;
    }

    /**
     * イベントデータを軽量なサマリーに変換
     * @private
     * @param {string} eventType - イベントタイプ
     * @param {*} data - 元のイベントデータ
     * @returns {string|Object} サマリー情報
     */
    _summarizeEventData(eventType, data) {
        // イベントタイプ別に必要最小限の情報のみを抽出
        switch (eventType) {
            case GameEventTypes.STATE_UPDATED:
                return {
                    phase: data.state?.phase,
                    turnPlayer: data.state?.turnPlayer,
                    context: data.context
                };
            case GameEventTypes.CARD_DRAWN:
            case GameEventTypes.CARD_PLAYED:
                return {
                    cardId: data.cardId,
                    playerId: data.playerId
                };
            case GameEventTypes.DAMAGE_DEALT:
                return {
                    targetId: data.targetId,
                    damage: data.damage
                };
            case GameEventTypes.TURN_STARTED:
            case GameEventTypes.TURN_ENDED:
                return {
                    turnPlayer: data.turnPlayer,
                    turnNumber: data.turnNumber
                };
            default:
                // その他のイベントは型のみ記録
                return typeof data === 'object' ? Object.keys(data).join(',') : String(data);
        }
    }
}

// シングルトンインスタンス
export const eventBus = new EventBus();

// デバッグ用にグローバルに公開（開発環境のみ）
if (typeof window !== 'undefined') {
    window.__eventBus = eventBus;
    // ✅ EventBusデバッグモードを無効化（本番モード）
    eventBus.setDebugMode(false);
}
