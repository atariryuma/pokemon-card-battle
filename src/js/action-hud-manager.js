/**
 * ActionHUDManager - フローティングアクションボタンの統一管理クラス
 *
 * すべてのHUDボタンの表示/非表示、イベントハンドラ管理を一元化
 */

import { BUTTON_IDS, CONTAINER_IDS, CSS_CLASSES } from './ui-constants.js';
import { noop } from './utils.js';

export class ActionHUDManager {
    constructor() {
        // ボタンの状態管理
        this.buttonStates = new Map();
        this.buttonHandlers = new Map();
        
        // 処理中フラグとdebounce管理
        this.processingButtons = new Set();
        this.debounceTimers = new Map();
        this.lastClickTimes = new Map();
        
        // HUDコンテナの参照
        this.hudContainer = null;
        
        // 初期化フラグ
        this.isInitialized = false;
        
        // デバッグログ設定（本番ではfalse推奨）
        this.debugEnabled = false;
    }

    /**
     * HUDマネージャーを初期化
     */
    init() {
        if (this.isInitialized) return;

        this.hudContainer = document.getElementById(CONTAINER_IDS.FLOATING_ACTION_HUD);
        if (!this.hudContainer) {
            console.error('❌ Floating Action HUD container not found');
            return;
        }

        // 全ボタンの初期状態を設定
        this._initializeButtonStates();
        
        this.isInitialized = true;
        noop('✅ ActionHUDManager initialized');
    }

    /**
     * ボタンの初期状態を設定
     */
    _initializeButtonStates() {
        const allButtons = [
            'start-game-button-float',
            'card-editor-button-float', 
            'confirm-setup-button-float',
            BUTTON_IDS.RETREAT,
            BUTTON_IDS.ATTACK,
            BUTTON_IDS.EVOLVE,
            BUTTON_IDS.END_TURN
        ];

        allButtons.forEach(buttonId => {
            this.buttonStates.set(buttonId, {
                visible: false,
                enabled: true,
                text: '',
                icon: ''
            });
        });
    }

    /**
     * ボタンを表示してイベントハンドラを設定
     * @param {string} buttonId - ボタンID
     * @param {Function} callback - クリック時のコールバック
     * @param {Object} options - 追加オプション (text, icon, enabled)
     */
    showButton(buttonId, callback = null, options = {}) {
        // デバッグ時のみログ出力
        if (this.debugEnabled) console.log(`🔘 Showing button: ${buttonId}`, options);
        
        if (!this.isInitialized) {
            console.warn('⚠️ ActionHUDManager not initialized');
            return;
        }

        const button = document.getElementById(buttonId);
        if (!button) {
            console.warn(`⚠️ Button not found: ${buttonId}`);
            return;
        }
        
        if (this.debugEnabled) {
            console.log(`🔍 Button ${buttonId} found:`, button);
            console.log(`🔍 Button ${buttonId} current classes:`, button.className);
        }

        // 既存のハンドラーをクリア
        this._clearButtonHandler(buttonId);

        // 新しいハンドラーを設定
        if (callback) {
            this._setButtonHandler(buttonId, callback);
        }

        // ボタンテキストとアイコンを更新
        this._updateButtonContent(button, options);

        // ボタンを表示
        if (this.debugEnabled) {
            console.log(`🔍 Removing hidden class from ${buttonId}. CSS_CLASSES.HIDDEN:`, CSS_CLASSES.HIDDEN);
        }
        button.classList.remove(CSS_CLASSES.HIDDEN);
        if (this.debugEnabled) {
            console.log(`🔍 Button ${buttonId} classes after removing hidden:`, button.className);
        }
        
        // 状態を更新
        this.buttonStates.set(buttonId, {
            visible: true,
            enabled: options.enabled !== false,
            text: options.text || '',
            icon: options.icon || '',
            callback: callback
        });

        if (this.debugEnabled) console.log(`✅ Button ${buttonId} shown successfully. Final state:`, this.buttonStates.get(buttonId));
    }

    /**
     * ボタンを非表示
     * @param {string} buttonId - ボタンID
     */
    hideButton(buttonId) {
        if (!this.isInitialized) {
            console.warn('⚠️ ActionHUDManager not initialized');
            return;
        }

        const button = document.getElementById(buttonId);
        if (!button) {
            console.warn(`⚠️ Button not found: ${buttonId}`);
            return;
        }

        // ハンドラーをクリア
        this._clearButtonHandler(buttonId);

        // ボタンを非表示
        button.classList.add(CSS_CLASSES.HIDDEN);

        // 状態を更新
        const state = this.buttonStates.get(buttonId) || {};
        state.visible = false;
        state.callback = null;
        this.buttonStates.set(buttonId, state);

        noop(`🙈 Button hidden: ${buttonId}`);
    }

    /**
     * 複数のボタンを一括表示
     * @param {Array<Object>} buttonConfigs - ボタン設定の配列 [{id, callback, options}, ...]
     */
    showButtons(buttonConfigs) {
        buttonConfigs.forEach(config => {
            this.showButton(config.id, config.callback, config.options || {});
        });
    }

    /**
     * 複数のボタンを一括非表示
     * @param {Array<string>} buttonIds - ボタンIDの配列
     */
    hideButtons(buttonIds) {
        buttonIds.forEach(buttonId => {
            this.hideButton(buttonId);
        });
    }

    /**
     * すべてのボタンを非表示
     */
    hideAllButtons() {
        const allButtonIds = Array.from(this.buttonStates.keys());
        this.hideButtons(allButtonIds);
        noop('🙈 All buttons hidden');
    }

    /**
     * ボタンの表示状態を取得
     * @param {string} buttonId - ボタンID
     * @returns {boolean} 表示されているかどうか
     */
    isButtonVisible(buttonId) {
        const state = this.buttonStates.get(buttonId);
        return state ? state.visible : false;
    }

    /**
     * ボタンの有効/無効を切り替え
     * @param {string} buttonId - ボタンID
     * @param {boolean} enabled - 有効かどうか
     */
    setButtonEnabled(buttonId, enabled) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        if (enabled) {
            button.classList.remove(CSS_CLASSES.DISABLED);
            button.disabled = false;
        } else {
            button.classList.add(CSS_CLASSES.DISABLED);
            button.disabled = true;
        }

        const state = this.buttonStates.get(buttonId) || {};
        state.enabled = enabled;
        this.buttonStates.set(buttonId, state);
    }

    /**
     * ボタンを有効化（便利メソッド）
     * @param {string} buttonId - ボタンID
     */
    enableButton(buttonId) {
        this.setButtonEnabled(buttonId, true);
    }

    /**
     * ボタンを無効化（便利メソッド）
     * @param {string} buttonId - ボタンID
     */
    disableButton(buttonId) {
        this.setButtonEnabled(buttonId, false);
    }

    /**
     * ボタンのテキストを更新
     * @param {string} buttonId - ボタンID
     * @param {string} text - 新しいテキスト
     */
    updateButtonText(buttonId, text) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        const textElement = button.querySelector('.pokemon-btn-text');
        if (textElement) {
            textElement.textContent = text;
        }

        const state = this.buttonStates.get(buttonId) || {};
        state.text = text;
        this.buttonStates.set(buttonId, state);
    }

    /**
     * ボタンのアイコンを更新
     * @param {string} buttonId - ボタンID
     * @param {string} icon - 新しいアイコン
     */
    updateButtonIcon(buttonId, icon) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        const iconElement = button.querySelector('.pokemon-btn-icon');
        if (iconElement) {
            iconElement.textContent = icon;
        }

        const state = this.buttonStates.get(buttonId) || {};
        state.icon = icon;
        this.buttonStates.set(buttonId, state);
    }

    /**
     * 特定フェーズ用のボタン群を表示
     * @param {string} phase - フェーズ名
     * @param {Object} callbacks - ボタンIDとコールバックの対応
     */
    showPhaseButtons(phase, callbacks = {}) {
        if (this.debugEnabled) console.log(`🎯 Showing phase buttons: ${phase}`, callbacks);
        
        // 既存のボタンをすべて非表示
        this.hideAllButtons();

        switch (phase) {
            case 'initial':
                // 初期状態: ゲーム開始ボタンとカードエディタボタン
                if (this.debugEnabled) console.log('🎮 Setting up initial phase buttons');
                this.showButton('start-game-button-float', callbacks.startGame, {
                    text: '手札を7枚引く',
                    icon: '🎴'
                });
                this.showButton('card-editor-button-float', callbacks.cardEditor, {
                    text: 'カードエディタ',
                    icon: '🎴'
                });
                if (this.debugEnabled) console.log('🎮 Initial buttons configured');
                break;

            case 'setup':
                // セットアップフェーズ: 確定ボタン
                this.showButton('confirm-setup-button-float', callbacks.confirmSetup, {
                    text: 'ポケモン配置を確定',
                    icon: '✅'
                });
                break;

            case 'gameStart':
                // ゲーム開始前: ゲームスタートボタン
                this.showButton('start-game-button-float', callbacks.startActualGame, {
                    text: 'ゲームスタート',
                    icon: '🎮'
                });
                break;

            case 'playerMain':
                // プレイヤーメインフェーズ: にげる、攻撃、進化、ターン終了
                const mainButtons = [
                    { id: BUTTON_IDS.RETREAT, callback: callbacks.retreat, options: { text: 'にげる', icon: '🏃' } },
                    { id: BUTTON_IDS.ATTACK, callback: callbacks.attack, options: { text: '攻撃', icon: '⚔️' } },
                    { id: BUTTON_IDS.EVOLVE, callback: callbacks.evolve, options: { text: '進化', icon: '🔄' } },
                    { id: BUTTON_IDS.END_TURN, callback: callbacks.endTurn, options: { text: 'ターン終了', icon: '➡️' } }
                ];
                this.showButtons(mainButtons);
                break;

            default:
                console.warn(`⚠️ Unknown phase: ${phase}`);
        }

        noop(`🎯 Phase buttons shown: ${phase}`);
    }

    /**
     * ボタンの状態をデバッグ出力
     */
    debugButtonStates() {
        noop('🔍 Button States Debug:');
        this.buttonStates.forEach((state, buttonId) => {
            noop(`  ${buttonId}:`, {
                visible: state.visible,
                enabled: state.enabled,
                text: state.text,
                hasCallback: !!state.callback
            });
        });
    }

    /**
     * ボタンのイベントハンドラをクリア
     * @param {string} buttonId - ボタンID
     */
    _clearButtonHandler(buttonId) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        // 処理中の場合は強制終了
        if (this.processingButtons.has(buttonId)) {
            this.processingButtons.delete(buttonId);
            this._setButtonProcessingState(buttonId, false);
            if (this.debugEnabled) {
                console.warn(`⚠️ Force cleared processing button: ${buttonId}`);
            }
        }

        // debounce timer クリア
        if (this.debounceTimers.has(buttonId)) {
            clearTimeout(this.debounceTimers.get(buttonId));
            this.debounceTimers.delete(buttonId);
        }

        // 既存のハンドラーを削除
        if (this.buttonHandlers.has(buttonId)) {
            const oldHandler = this.buttonHandlers.get(buttonId);
            button.removeEventListener('click', oldHandler);
            this.buttonHandlers.delete(buttonId);
        }

        // onclickもクリア
        button.onclick = null;
        
        // 最後のクリック時間もクリア
        this.lastClickTimes.delete(buttonId);
    }

    /**
     * ボタンのイベントハンドラを設定
     * @param {string} buttonId - ボタンID
     * @param {Function} callback - コールバック関数
     */
    _setButtonHandler(buttonId, callback) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        const wrappedCallback = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // デバッグログ
            if (this.debugEnabled) {
                if (this.debugEnabled) console.log(`🔘 Button clicked: ${buttonId}`);
            }
            
            // 処理中チェック
            if (this.processingButtons.has(buttonId)) {
                if (this.debugEnabled) {
                    console.warn(`⚠️ Button ${buttonId} is already processing, ignoring click`);
                }
                return;
            }
            
            // Debounce チェック（500ms間隔）
            const now = Date.now();
            const lastClick = this.lastClickTimes.get(buttonId) || 0;
            if (now - lastClick < 500) {
                if (this.debugEnabled) {
                    console.warn(`⚠️ Button ${buttonId} debounced, ignoring rapid click`);
                }
                return;
            }
            
            // 処理開始
            this.processingButtons.add(buttonId);
            this.lastClickTimes.set(buttonId, now);
            this._setButtonProcessingState(buttonId, true);
            
            try {
                await callback();
            } catch (error) {
                console.error(`❌ Error in button ${buttonId} callback:`, error);
            } finally {
                // 処理完了
                this.processingButtons.delete(buttonId);
                this._setButtonProcessingState(buttonId, false);
                
                if (this.debugEnabled) {
                    console.log(`✅ Button ${buttonId} processing completed`);
                }
            }
        };

        button.addEventListener('click', wrappedCallback);
        this.buttonHandlers.set(buttonId, wrappedCallback);
    }

    /**
     * ボタンの内容（テキスト・アイコン）を更新
     * @param {HTMLElement} button - ボタン要素
     * @param {Object} options - 更新オプション
     */
    _updateButtonContent(button, options) {
        if (options.text) {
            this.updateButtonText(button.id, options.text);
        }
        if (options.icon) {
            this.updateButtonIcon(button.id, options.icon);
        }
    }

    /**
     * ボタンの処理中状態を設定
     * @param {string} buttonId - ボタンID
     * @param {boolean} isProcessing - 処理中フラグ
     */
    _setButtonProcessingState(buttonId, isProcessing) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        if (isProcessing) {
            // 処理中のUIフィードバック
            button.style.opacity = '0.6';
            button.style.cursor = 'wait';
            button.disabled = true;
            
            // スピナーアイコンの追加（オプション）
            const existingSpinner = button.querySelector('.processing-spinner');
            if (!existingSpinner) {
                const spinner = document.createElement('div');
                spinner.className = 'processing-spinner inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2';
                const textElement = button.querySelector('.pokemon-btn-text');
                if (textElement) {
                    textElement.parentNode.insertBefore(spinner, textElement);
                }
            }
        } else {
            // 処理完了のUIリセット
            button.style.opacity = '';
            button.style.cursor = '';
            button.disabled = false;
            
            // スピナーアイコンの削除
            const spinner = button.querySelector('.processing-spinner');
            if (spinner) {
                spinner.remove();
            }
        }

        // 状態の更新
        const state = this.buttonStates.get(buttonId) || {};
        state.processing = isProcessing;
        this.buttonStates.set(buttonId, state);
    }

    /**
     * 全ボタンの処理状態をリセット（エラー回復用）
     */
    resetAllButtonStates() {
        this.processingButtons.clear();
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        this.lastClickTimes.clear();
        
        // 全ボタンの視覚状態もリセット
        this.buttonStates.forEach((state, buttonId) => {
            if (state.processing) {
                this._setButtonProcessingState(buttonId, false);
            }
        });
        
        if (this.debugEnabled) {
            console.log('🔄 All button states reset');
        }
    }
}

// シングルトンインスタンスをエクスポート
export const actionHUDManager = new ActionHUDManager();
