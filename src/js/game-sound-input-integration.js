/**
 * game-sound-input-integration.js
 * Sound and Input Manager integration methods for Game class
 * These methods should be added to the Game class in game.js
 */

// Add these methods to the Game class:

/**
 * サウンドとインプットマネージャーの初期化
 */
export function _setupSoundAndInputManagers() {
    try {
        // サウンドマネージャーの初期化
        // バトルBGMを再生（音源ファイルがない場合は無視される）
        import('./sound-manager.js').then(({ soundManager }) => {
            soundManager.playMusic('battle');
        });

        // インプットマネージャーのキーボードショートカット設定
        import('./input-manager.js').then(({ inputManager }) => {
            // ターン終了
            inputManager.on('endTurn', () => {
                if (this.phaseManager.getCurrentPhase() !== 'SETUP') {
                    this._handleEndTurn();
                }
            });

            // サウンドトグル
            inputManager.on('toggleSound', () => {
                import('./sound-manager.js').then(({ soundManager }) => {
                    const enabled = soundManager.toggle();
                    this.view.showCustomToast(
                        'サウンド: ' + (enabled ? 'ON' : 'OFF'),
                        enabled ? 'success' : 'info'
                    );
                });
            });

            // 確定アクション（選択中の要素をクリック）
            inputManager.on('confirm', () => {
                inputManager.confirmSelection();
            });

            // キャンセルアクション
            inputManager.on('cancel', () => {
                // モーダルが開いている場合は閉じる
                import('./modal-manager.js').then(({ modalManager }) => {
                    if (modalManager.isModalOpen()) {
                        modalManager.closeModal();
                    }
                });
            });

            // ヘルプ表示
            inputManager.on('showHelp', () => {
                this._showKeyboardHelp();
            });

            // 手札の選択可能な要素を更新
            this._updateSelectableElements();
        });
    } catch (error) {
        console.warn('Failed to initialize sound/input managers:', error);
    }
}

/**
 * 選択可能な要素を更新
 */
export function _updateSelectableElements() {
    import('./input-manager.js').then(({ inputManager }) => {
        const handSlots = Array.from(document.querySelectorAll('#player-hand .hand-slot'));
        const buttons = Array.from(document.querySelectorAll('.pokemon-action-btn:not(.hidden)'));
        const selectableElements = [...handSlots, ...buttons];
        inputManager.updateSelectableElements(selectableElements);
    });
}

/**
 * キーボードヘルプを表示
 */
export function _showKeyboardHelp() {
    const helpContent = `
        <div class="keyboard-help-panel">
            <div class="keyboard-help-title">キーボードショートカット</div>

            <div class="keyboard-help-section">
                <h3>基本操作</h3>
                <div class="keyboard-help-item">
                    <span class="keyboard-help-key">Enter / Space</span>
                    <span class="keyboard-help-description">選択を確定</span>
                </div>
                <div class="keyboard-help-item">
                    <span class="keyboard-help-key">Esc</span>
                    <span class="keyboard-help-description">キャンセル</span>
                </div>
                <div class="keyboard-help-item">
                    <span class="keyboard-help-key">E</span>
                    <span class="keyboard-help-description">ターン終了</span>
                </div>
            </div>

            <div class="keyboard-help-section">
                <h3>ナビゲーション</h3>
                <div class="keyboard-help-item">
                    <span class="keyboard-help-key">← / A</span>
                    <span class="keyboard-help-description">左に移動</span>
                </div>
                <div class="keyboard-help-item">
                    <span class="keyboard-help-key">→ / D</span>
                    <span class="keyboard-help-description">右に移動</span>
                </div>
                <div class="keyboard-help-item">
                    <span class="keyboard-help-key">↑ / W</span>
                    <span class="keyboard-help-description">上に移動</span>
                </div>
                <div class="keyboard-help-item">
                    <span class="keyboard-help-key">↓ / S</span>
                    <span class="keyboard-help-description">下に移動</span>
                </div>
            </div>

            <div class="keyboard-help-section">
                <h3>カード選択</h3>
                <div class="keyboard-help-item">
                    <span class="keyboard-help-key">1-7</span>
                    <span class="keyboard-help-description">手札のカードを選択</span>
                </div>
            </div>

            <div class="keyboard-help-section">
                <h3>UI操作</h3>
                <div class="keyboard-help-item">
                    <span class="keyboard-help-key">M</span>
                    <span class="keyboard-help-description">サウンドON/OFF</span>
                </div>
                <div class="keyboard-help-item">
                    <span class="keyboard-help-key">H / F1</span>
                    <span class="keyboard-help-description">ヘルプ表示</span>
                </div>
                <div class="keyboard-help-item">
                    <span class="keyboard-help-key">F</span>
                    <span class="keyboard-help-description">フルスクリーン切替</span>
                </div>
            </div>

            <button class="keyboard-help-close" onclick="document.querySelector('.keyboard-help-overlay').remove()">
                閉じる (Esc)
            </button>
        </div>
    `;

    const overlay = document.createElement('div');
    overlay.className = 'keyboard-help-overlay';
    overlay.innerHTML = helpContent;

    // Escキーで閉じる
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    document.body.appendChild(overlay);
}

// Helper: Play sound effect
export function playSoundEffect(soundName) {
    import('./sound-manager.js').then(({ soundManager }) => {
        soundManager.play(soundName);
    });
}
