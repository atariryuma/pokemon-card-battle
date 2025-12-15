/**
 * GAME-LOGGER.JS - 統一ゲームログシステム
 * シンプルで分かりやすいゲーム情報のみをログ出力
 */

export class GameLogger {
    constructor() {
        this.isEnabled = true;
    }

    /**
     * ゲーム基本情報をログ出力
     */
    logGameEvent(eventType, message, data = null) {
        if (!this.isEnabled) return;

        const timestamp = new Date().toISOString().slice(11, 19);
        const icon = this.getEventIcon(eventType);
        
        if (data) {
            console.log(`[${timestamp}] ${icon} ${message}`, data);
        } else {
            console.log(`[${timestamp}] ${icon} ${message}`);
        }
    }

    /**
     * コンテナ位置情報をログ出力
     */
    logContainerInfo(containerName, element) {
        // if (!this.isEnabled || !element) return;

        // const rect = element.getBoundingClientRect();
        // const styles = window.getComputedStyle(element);
        
        // const info = {
        //     位置: `${Math.round(rect.left)}x${Math.round(rect.top)}`,
        //     サイズ: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
        //     表示: styles.display !== 'none' ? '表示中' : '非表示',
        //     クリック: styles.pointerEvents === 'none' ? '無効' : '有効'
        // };

        // this.logGameEvent('LAYOUT', `📍 ${containerName}`, info);
    }

    /**
     * イベント別アイコン取得
     */
    getEventIcon(eventType) {
        const icons = {
            GAME: '🎮',
            TURN: '🔄', 
            CARD: '🎴',
            ANIMATION: '✨',
            LAYOUT: '📍',
            CLICK: '👆',
            HOVER: '👉',
            ERROR: '❌',
            SUCCESS: '✅',
            INFO: 'ℹ️'
        };
        return icons[eventType] || 'ℹ️';
    }

    /**
     * カード移動をログ出力
     */
    logCardMove(cardName, from, to) {
        this.logGameEvent('CARD', `${cardName} が ${from} から ${to} に移動`);
    }

    /**
     * フェーズ変更をログ出力
     */
    logPhaseChange(oldPhase, newPhase, player) {
        this.logGameEvent('TURN', `${player} の ${oldPhase} → ${newPhase} に変更`);
    }

    /**
     * コンテナ一覧を取得してログ出力
     */
    logAllContainers() {
        const containers = [
            { name: 'プレイヤー手札', id: 'player-hand' },
            { name: 'プレイヤーフィールド', id: 'player-board' },
            { name: 'CPU手札', id: 'cpu-hand' },
            { name: 'CPUフィールド', id: 'cpu-board' },
            { name: 'プレイマット', id: 'game-board' },
            { name: 'アクションHUD', id: 'floating-action-hud' }
        ];

        this.logGameEvent('LAYOUT', '=== コンテナ位置情報 ===');
        
        containers.forEach(container => {
            const element = document.getElementById(container.id);
            if (element) {
                this.logContainerInfo(container.name, element);
            }
        });
    }

    /**
     * クリック判定をログ出力
     */
    logClickEvent(element, eventType = 'クリック') {
        // if (!element) return;
        
        // const elementName = element.id || element.className || 'Unknown';
        // this.logGameEvent('CLICK', `${eventType}: ${elementName}`);
    }

    /**
     * ホバー判定をログ出力
     */
    logHoverEvent(element, isEnter = true) {
        // if (!element) return;
        
        // const elementName = element.id || element.className || 'Unknown';
        // const action = isEnter ? 'ホバー開始' : 'ホバー終了';
        // this.logGameEvent('HOVER', `${action}: ${elementName}`);
    }

    /**
     * 全ゲームエリアの相互作用テスト
     */
    testAllGameAreaInteractions() {
        this.logGameEvent('INFO', '🧪 === 全ゲームエリア相互作用テスト開始 ===');
        
        // テスト対象エリア
        const testAreas = [
            { name: 'プレイヤー手札', selector: '#player-hand' },
            { name: 'プレイヤーフィールド', selector: '.player-board.player-self' },
            { name: 'CPU手札エリア', selector: '#cpu-hand-area-new, #cpu-hand' },
            { name: '相手フィールド', selector: '.player-board.opponent-board' },
            { name: 'CPUボード', selector: '#cpu-board' },
            { name: 'プレイマット', selector: '#game-board' }
        ];

        testAreas.forEach(area => {
            const element = document.querySelector(area.selector);
            if (element) {
                const rect = element.getBoundingClientRect();
                const styles = window.getComputedStyle(element);
                const zIndex = parseInt(styles.zIndex) || 0;
                
                this.logGameEvent('INFO', `📍 ${area.name}テスト`, {
                    位置: `${Math.round(rect.left)}×${Math.round(rect.top)}`,
                    サイズ: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
                    'z-index': zIndex,
                    'position': styles.position,
                    'pointer-events': styles.pointerEvents,
                    表示状態: rect.width > 0 && rect.height > 0 ? '✅ 表示中' : '❌ 非表示'
                });

                // クリック可能性テスト（座標ベース）
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const elementAtPoint = document.elementFromPoint(centerX, centerY);
                const isClickable = elementAtPoint === element || element.contains(elementAtPoint);
                
                this.logGameEvent('CLICK', `${area.name}クリック判定`, {
                    座標: `(${Math.round(centerX)}, ${Math.round(centerY)})`,
                    '最上位要素': elementAtPoint?.tagName + (elementAtPoint?.id ? '#' + elementAtPoint.id : '') + (elementAtPoint?.className ? '.' + elementAtPoint.className.split(' ').join('.') : ''),
                    'ブロック要素のz-index': elementAtPoint ? window.getComputedStyle(elementAtPoint).zIndex : 'N/A',
                    クリック可能: isClickable ? '✅ 可能' : '❌ ブロック中'
                });
            } else {
                this.logGameEvent('ERROR', `${area.name}: 要素が見つかりません`);
            }
        });

        this.logGameEvent('INFO', '🧪 === テスト完了 ===');
    }
}

// シングルトンインスタンス
export const gameLogger = new GameLogger();