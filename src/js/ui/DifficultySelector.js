/**
 * DIFFICULTY SELECTOR UI
 * 
 * AI難易度選択モーダル
 * ゲーム開始前にEasy/Medium/Hardを選択
 * 
 * PRODUCTION VERSION with proper memory management
 */

export class DifficultySelector {
  constructor() {
    this.selectedDifficulty = 'medium'; // Default
    this.resolveCallback = null;
    this.modal = null;
    this.boundHandlers = null; // Store bound handlers for cleanup
  }

  /**
   * 難易度選択モーダルを表示
   * @returns {Promise<string|null>} 選択された難易度 (null if cancelled)
   */
  show() {
    return new Promise((resolve) => {
      this.resolveCallback = resolve;
      this._createModal();
      this._bindEvents();
    });
  }

  /**
   * モーダルを非表示し、リソースをクリーンアップ
   */
  hide() {
    if (this.modal) {
      this.modal.classList.add('hidden');
      // アニメーション後に完全にクリーンアップ
      setTimeout(() => {
        this._cleanup();
      }, 300);
    }
  }

  /**
   * 完全なクリーンアップ - メモリリーク防止
   */
  _cleanup() {
    // Remove event listeners
    if (this.boundHandlers && this.modal) {
      const difficultyButtons = this.modal.querySelectorAll('.difficulty-btn');
      difficultyButtons.forEach((btn, index) => {
        if (this.boundHandlers.difficultyClicks[index]) {
          btn.removeEventListener('click', this.boundHandlers.difficultyClicks[index]);
        }
      });

      const cancelBtn = this.modal.querySelector('.cancel-btn');
      if (cancelBtn && this.boundHandlers.cancelClick) {
        cancelBtn.removeEventListener('click', this.boundHandlers.cancelClick);
      }

      if (this.boundHandlers.backdropClick) {
        this.modal.removeEventListener('click', this.boundHandlers.backdropClick);
      }
    }

    // Remove DOM elements
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
    }

    // Clear references
    this.modal = null;
    this.boundHandlers = null;
    this.resolveCallback = null;
  }

  /**
   * モーダルHTML作成
   */
  _createModal() {
    // 既存のモーダルがあれば完全にクリーンアップ
    const existing = document.getElementById('difficulty-selector-modal');
    if (existing) {
      this._cleanup();
    }

    // モーダル作成
    const modal = document.createElement('div');
    modal.id = 'difficulty-selector-modal';
    modal.className = 'fixed inset-0 flex items-center justify-center z-50';
    modal.style.cssText = `
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(10px);
      animation: fadeIn 0.3s ease-out;
    `;

    modal.innerHTML = `
      <div class="difficulty-modal-content" style="
        background: linear-gradient(135deg, rgba(30, 30, 50, 0.95), rgba(15, 15, 35, 0.95));
        border: 2px solid rgba(255, 215, 0, 0.3);
        border-radius: 20px;
        padding: 40px;
        max-width: 600px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        animation: slideUp 0.4s ease-out;
      ">
        <h2 style="
          font-size: 32px;
          font-weight: bold;
          text-align: center;
          margin-bottom: 10px;
          background: linear-gradient(to right, #ffd700, #ffed4e);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: 0 2px 10px rgba(255, 215, 0, 0.3);
        ">AI Difficulty</h2>
        
        <p style="
          text-align: center;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 30px;
          font-size: 14px;
        ">Select your opponent's challenge level</p>

        <div class="difficulty-buttons" style="
          display: grid;
          grid-template-columns: 1fr;
          gap: 15px;
        ">
          <button class="difficulty-btn" data-difficulty="easy" style="
            background: linear-gradient(135deg, #4ade80, #22c55e);
            border: 2px solid rgba(74, 222, 128, 0.5);
            border-radius: 12px;
            padding: 20px;
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
          ">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="text-align: left;">
                <div style="font-size: 20px; font-weight: bold; margin-bottom: 5px;">😊 Easy</div>
                <div style="font-size: 12px; opacity: 0.9;">For beginners • Random moves • 30% mistakes</div>
              </div>
              <div style="font-size: 32px;">🎯</div>
            </div>
          </button>

          <button class="difficulty-btn" data-difficulty="medium" style="
            background: linear-gradient(135deg, #60a5fa, #3b82f6);
            border: 2px solid rgba(96, 165, 250, 0.5);
            border-radius: 12px;
            padding: 20px;
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
          ">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="text-align: left;">
                <div style="font-size: 20px; font-weight: bold; margin-bottom: 5px;">😐 Medium</div>
                <div style="font-size: 12px; opacity: 0.9;">Balanced challenge • Strategic play • 10% mistakes</div>
              </div>
              <div style="font-size: 32px;">⚖️</div>
            </div>
            <div style="
              position: absolute;
              top: 10px;
              right: 10px;
              background: rgba(255, 215, 0, 0.9);
              color: #1a1a2e;
              padding: 3px 8px;
              border-radius: 12px;
              font-size: 10px;
              font-weight: bold;
            ">RECOMMENDED</div>
          </button>

          <button class="difficulty-btn" data-difficulty="hard" style="
            background: linear-gradient(135deg, #f87171, #dc2626);
            border: 2px solid rgba(248, 113, 113, 0.5);
            border-radius: 12px;
            padding: 20px;
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
          ">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="text-align: left;">
                <div style="font-size: 20px; font-weight: bold; margin-bottom: 5px;">😈 Hard</div>
                <div style="font-size: 12px; opacity: 0.9;">Expert AI • Optimal play • No mistakes</div>
              </div>
              <div style="font-size: 32px;">🔥</div>
            </div>
          </button>
        </div>

        <button class="cancel-btn" style="
          width: 100%;
          margin-top: 20px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 12px;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.3s ease;
        ">Cancel</button>
      </div>

      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .difficulty-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          filter: brightness(1.1);
        }

        .difficulty-btn:active {
          transform: translateY(-1px);
        }

        .cancel-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: white;
        }
        
        #difficulty-selector-modal.hidden {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease-out;
        }
      </style>
    `;

    document.body.appendChild(modal);
    this.modal = modal;
  }

  /**
   * イベントバインド with proper cleanup tracking
   */
  _bindEvents() {
    if (!this.modal) return;

    // Store bound handlers for cleanup
    this.boundHandlers = {
      difficultyClicks: [],
      cancelClick: null,
      backdropClick: null
    };

    // 難易度ボタン
    const difficultyButtons = this.modal.querySelectorAll('.difficulty-btn');
    difficultyButtons.forEach((btn, index) => {
      const handler = () => {
        const difficulty = btn.dataset.difficulty;
        this.selectedDifficulty = difficulty;
        this.hide();
        if (this.resolveCallback) {
          this.resolveCallback(difficulty);
        }
      };
      this.boundHandlers.difficultyClicks[index] = handler;
      btn.addEventListener('click', handler);
    });

    // キャンセルボタン
    const cancelBtn = this.modal.querySelector('.cancel-btn');
    if (cancelBtn) {
      const handler = () => {
        this.hide();
        if (this.resolveCallback) {
          this.resolveCallback(null); // Return null on cancel
        }
      };
      this.boundHandlers.cancelClick = handler;
      cancelBtn.addEventListener('click', handler);
    }

    // 背景クリックで閉じる
    const backdropHandler = (e) => {
      if (e.target === this.modal) {
        this.hide();
        if (this.resolveCallback) {
          this.resolveCallback(null); // Return null on cancel
        }
      }
    };
    this.boundHandlers.backdropClick = backdropHandler;
    this.modal.addEventListener('click', backdropHandler);
  }
}

// シングルトンインスタンス
export const difficultySelector = new DifficultySelector();
