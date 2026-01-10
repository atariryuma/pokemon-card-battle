/**
 * INPUT-MANAGER.JS - キーボード＆ゲームパッド入力管理
 * キーボードショートカットとゲームパッドコントロールを統合管理
 */

class InputManager {
    constructor() {
        this.keyboardEnabled = true;
        this.gamepadEnabled = true;
        this.gamepadIndex = null;
        this.gamepadPolling = false;
        this.lastGamepadState = {};

        // キーバインディング設定
        this.keyBindings = {
            // カード選択（手札の位置）
            selectCard1: ['1', 'Digit1'],
            selectCard2: ['2', 'Digit2'],
            selectCard3: ['3', 'Digit3'],
            selectCard4: ['4', 'Digit4'],
            selectCard5: ['5', 'Digit5'],
            selectCard6: ['6', 'Digit6'],
            selectCard7: ['7', 'Digit7'],

            // アクション
            confirm: ['Enter', 'Space'],
            cancel: ['Escape', 'Backspace'],
            endTurn: ['KeyE', 'e'],

            // ナビゲーション
            navigateLeft: ['ArrowLeft', 'KeyA', 'a'],
            navigateRight: ['ArrowRight', 'KeyD', 'd'],
            navigateUp: ['ArrowUp', 'KeyW', 'w'],
            navigateDown: ['ArrowDown', 'KeyS', 's'],

            // UI
            toggleSound: ['KeyM', 'm'],
            toggleFullscreen: ['KeyF', 'f'],
            showHelp: ['KeyH', 'h', 'F1']
        };

        // ゲームパッドボタンマッピング（標準的なコントローラー）
        this.gamepadBindings = {
            confirm: 0,      // A button (Xbox) / Cross (PS)
            cancel: 1,       // B button (Xbox) / Circle (PS)
            endTurn: 2,      // X button (Xbox) / Square (PS)
            showInfo: 3,     // Y button (Xbox) / Triangle (PS)
            navigateLeft: 14,  // D-pad Left
            navigateRight: 15, // D-pad Right
            navigateUp: 12,    // D-pad Up
            navigateDown: 13   // D-pad Down
        };

        // アクションコールバック
        this.callbacks = {};

        // 選択可能な要素の管理
        this.currentSelection = 0;
        this.selectableElements = [];

        this.init();
    }

    /**
     * 初期化
     */
    init() {
        // ✅ Warning #8修正: バインド済み関数を保存してcleanupで削除できるようにする
        this._boundHandleKeyboard = (e) => this.handleKeyboard(e);
        this._boundGamepadConnected = (e) => {
            this.gamepadIndex = e.gamepad.index;
            if (!this.gamepadPolling) {
                this.startGamepadPolling();
            }
        };
        this._boundGamepadDisconnected = (e) => {
            this.gamepadIndex = null;
            this.gamepadPolling = false;
        };

        // キーボードイベントリスナー
        window.addEventListener('keydown', this._boundHandleKeyboard);

        // ゲームパッド接続イベント
        window.addEventListener('gamepadconnected', this._boundGamepadConnected);
        window.addEventListener('gamepaddisconnected', this._boundGamepadDisconnected);
    }

    /**
     * キーボード入力処理
     * @param {KeyboardEvent} event
     */
    handleKeyboard(event) {
        if (!this.keyboardEnabled) return;

        // 入力フィールドでの入力は無視
        const target = event.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }

        const key = event.key;
        const code = event.code;

        // キーバインディングをチェック
        for (const [action, keys] of Object.entries(this.keyBindings)) {
            if (keys.includes(key) || keys.includes(code)) {
                event.preventDefault();
                this.triggerAction(action, { source: 'keyboard', key, code });
                return;
            }
        }
    }

    /**
     * ゲームパッドポーリング開始
     */
    startGamepadPolling() {
        if (this.gamepadPolling) return;

        this.gamepadPolling = true;
        const pollGamepad = () => {
            if (!this.gamepadPolling || this.gamepadIndex === null) {
                this.gamepadPolling = false;
                return;
            }

            const gamepads = navigator.getGamepads();
            const gamepad = gamepads[this.gamepadIndex];

            if (!gamepad) {
                requestAnimationFrame(pollGamepad);
                return;
            }

            // ボタン入力チェック（押された瞬間のみ反応）
            gamepad.buttons.forEach((button, index) => {
                const wasPressed = this.lastGamepadState[index] || false;
                const isPressed = button.pressed;

                // ボタンが押された瞬間
                if (isPressed && !wasPressed) {
                    for (const [action, buttonIndex] of Object.entries(this.gamepadBindings)) {
                        if (index === buttonIndex) {
                            this.triggerAction(action, { source: 'gamepad', button: index });
                        }
                    }
                }

                this.lastGamepadState[index] = isPressed;
            });

            requestAnimationFrame(pollGamepad);
        };

        pollGamepad();
    }

    /**
     * アクションをトリガー
     * @param {string} action - アクション名
     * @param {object} context - コンテキスト情報
     */
    triggerAction(action, context = {}) {
        // ナビゲーションアクションの特別処理
        if (action.startsWith('navigate')) {
            const direction = action.replace('navigate', '').toLowerCase();
            this.navigateSelection(direction);
        }

        // カード選択アクションの特別処理
        if (action.startsWith('selectCard')) {
            const cardIndex = parseInt(action.replace('selectCard', '')) - 1;
            this.selectCardByIndex(cardIndex);
        }

        // コールバックを実行
        if (this.callbacks[action]) {
            this.callbacks[action](context);
        }
    }

    /**
     * アクションコールバックを登録
     * @param {string} action - アクション名
     * @param {Function} callback - コールバック関数
     */
    on(action, callback) {
        this.callbacks[action] = callback;
    }

    /**
     * 選択可能な要素を更新
     * @param {Array<HTMLElement>} elements - 選択可能な要素の配列
     */
    updateSelectableElements(elements) {
        this.selectableElements = elements;
        this.currentSelection = Math.min(this.currentSelection, elements.length - 1);
        this.highlightSelected();
    }

    /**
     * 選択をナビゲート
     * @param {string} direction - 'left', 'right', 'up', 'down'
     */
    navigateSelection(direction) {
        if (this.selectableElements.length === 0) return;

        const previousSelection = this.currentSelection;

        switch (direction) {
            case 'left':
            case 'up':
                this.currentSelection = Math.max(0, this.currentSelection - 1);
                break;
            case 'right':
            case 'down':
                this.currentSelection = Math.min(this.selectableElements.length - 1, this.currentSelection + 1);
                break;
        }

        if (previousSelection !== this.currentSelection) {
            this.highlightSelected();
        }
    }

    /**
     * インデックスでカードを選択
     * @param {number} index - カードインデックス
     */
    selectCardByIndex(index) {
        if (index >= 0 && index < this.selectableElements.length) {
            this.currentSelection = index;
            this.highlightSelected();

            // カードをクリック
            const element = this.selectableElements[index];
            if (element) {
                element.click();
            }
        }
    }

    /**
     * 選択されている要素をハイライト
     */
    highlightSelected() {
        this.selectableElements.forEach((el, index) => {
            if (index === this.currentSelection) {
                el.classList.add('keyboard-selected');
                // 選択要素をビューポートにスクロール
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                el.classList.remove('keyboard-selected');
            }
        });
    }

    /**
     * 現在選択されている要素を取得
     * @returns {HTMLElement|null}
     */
    getSelectedElement() {
        return this.selectableElements[this.currentSelection] || null;
    }

    /**
     * 現在選択されている要素を確定
     */
    confirmSelection() {
        const selected = this.getSelectedElement();
        if (selected) {
            selected.click();
        }
    }

    /**
     * キーボード入力を有効/無効化
     * @param {boolean} enabled
     */
    setKeyboardEnabled(enabled) {
        this.keyboardEnabled = enabled;
    }

    /**
     * ゲームパッド入力を有効/無効化
     * @param {boolean} enabled
     */
    setGamepadEnabled(enabled) {
        this.gamepadEnabled = enabled;
        if (!enabled) {
            this.gamepadPolling = false;
        }
    }

    /**
     * すべての入力を有効/無効化
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this.setKeyboardEnabled(enabled);
        this.setGamepadEnabled(enabled);
    }

    /**
     * 選択をリセット
     */
    resetSelection() {
        this.currentSelection = 0;
        this.selectableElements.forEach(el => {
            el.classList.remove('keyboard-selected');
        });
    }

    /**
     * ✅ Warning #8修正: クリーンアップ処理
     * メモリリークを防ぐためにイベントリスナーを削除
     */
    destroy() {
        // イベントリスナーを削除
        if (this._boundHandleKeyboard) {
            window.removeEventListener('keydown', this._boundHandleKeyboard);
        }
        if (this._boundGamepadConnected) {
            window.removeEventListener('gamepadconnected', this._boundGamepadConnected);
        }
        if (this._boundGamepadDisconnected) {
            window.removeEventListener('gamepaddisconnected', this._boundGamepadDisconnected);
        }

        // ゲームパッドポーリング停止
        this.gamepadPolling = false;

        // 参照をクリア
        this._boundHandleKeyboard = null;
        this._boundGamepadConnected = null;
        this._boundGamepadDisconnected = null;
        this.callbacks = {};
        this.selectableElements = [];
    }
}

// シングルトンインスタンスをエクスポート
export const inputManager = new InputManager();
