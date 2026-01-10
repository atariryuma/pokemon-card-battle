/**
 * GAME OVER HANDLER
 * 
 * Manages the "Game Over" state presentation and "Play Again" flow.
 */
export class GameOverHandler {
    constructor() {
        this.overlay = document.getElementById('game-over-overlay');
        this.title = document.getElementById('game-result-title');
        this.reason = document.getElementById('game-result-reason');
        this.playAgainBtn = document.getElementById('play-again-btn');

        this._bindEvents();
    }

    _bindEvents() {
        if (this.playAgainBtn) {
            this.playAgainBtn.addEventListener('click', () => {
                this.hide();
                // Trigger global reset event
                window.dispatchEvent(new CustomEvent('gameResetRequest'));
            });
        }
    }

    /**
     * Shows the Game Over screen
     * @param {boolean} isVictory - True if player won
     * @param {string} reasonText - The reason for game end (e.g. "Prize Cards", "Deck Out")
     */
    show(isVictory, reasonText) {
        if (!this.overlay || !this.title || !this.reason) return;

        // Reset classes
        this.title.classList.remove('victory', 'defeat');

        // Set content
        if (isVictory) {
            this.title.textContent = 'VICTORY';
            this.title.classList.add('victory');
            // Sound effect could be played here
            this._playSound('victory');
        } else {
            this.title.textContent = 'DEFEAT';
            this.title.classList.add('defeat');
            this._playSound('defeat');
        }

        this.reason.textContent = reasonText || '';

        // Show overlay with animation
        this.overlay.classList.remove('hidden');
        // Force reflow
        void this.overlay.offsetWidth;
        this.overlay.classList.add('visible');
    }

    hide() {
        if (!this.overlay) return;
        this.overlay.classList.remove('visible');
        setTimeout(() => {
            this.overlay.classList.add('hidden');
        }, 500);
    }

    _playSound(type) {
        if (window.Howler && window.soundManager) {
            // Placeholder: Assume soundManager has these methods or play directly
            console.log(`🎵 Playing ${type} sound`);
        }
    }
}

// Singleton instance
export const gameOverHandler = new GameOverHandler();
