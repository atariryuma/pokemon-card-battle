/**
 * MODAL-MANAGER.JS - 統一モーダルシステム
 *
 * ゲームのUI体験を向上させるための統一されたモーダル管理システム
 * 4つのモーダルタイプを管理：中央モーダル、通知トースト、アクションHUD、状況パネル
 */

import { ZIndexManager } from './z-index-constants.js';
import { getCardImagePath } from './data-manager.js';
import { noop } from './utils.js';

/**
 * モーダルタイプの定義
 */
export const MODAL_TYPES = {
    CENTRAL: 'central',               // 画面中央、重要な意思決定
    TOAST: 'toast',                   // 右上通知、自動消失
    ACTION_HUD: 'action_hud',         // 手札上フローティング（廃止予定）
    FLOATING_ACTION_HUD: 'floating_action_hud',  // 左下フローティングHUD（メイン）
    STATUS_PANEL: 'status_panel'      // 右側パネル（既存）
};

/**
 * モーダル優先度（Z-Index管理用）
 * ZIndexManagerに渡すキーを定義
 */
export const MODAL_PRIORITY = {
    BACKGROUND: 'BOARD',
    CARDS: 'SELECTED',
    HUD: 'HUD_BASE',
    ACTION_HUD: 'FLOATING_HUD',
    FLOATING_HUD: 'FLOATING_HUD',
    TOAST: 'TOAST',
    CENTRAL: 'MODALS',
    CRITICAL: 'CRITICAL'
};

/**
 * 統一モーダルマネージャー
 */
export class ModalManager {
    constructor() {
        this.activeModals = new Map(); // アクティブなモーダルを追跡
        this.modalStack = [];          // モーダルのスタック管理
        this.toastQueue = [];          // トースト通知のキュー
        this.toastTimeout = null;      // トースト自動消失タイマー
        
        this.initialized = false;
    }

    /**
     * DOM要素の初期化
     */
    init() {
        if (this.initialized) return;
        
        this.createModalElements();
        this.setupEventListeners();
        this.initialized = true;
        
        noop('🎭 ModalManager initialized');
    }

    /**
     * 必要なモーダル要素をDOMに作成
     */
    createModalElements() {
        // 中央モーダル要素を新規作成（既存のaction-modalとは別）
        this.centralModal = this.createCentralModalElement();

        // 通知トースト要素を作成
        this.toastContainer = this.createToastContainer();

        // アクションHUD要素を作成
        this.actionHUD = this.createActionHUD();

        noop('📦 Modal elements created');
    }

    /**
     * 中央モーダル要素作成
     */
    createCentralModalElement() {
        const modal = document.createElement('div');
        modal.id = 'central-modal';
        modal.className = 'hidden fixed inset-0 central-modal flex items-center justify-center';

        const content = document.createElement('div');
        // widen modal for rich card details layout (image + info)
        content.className = 'central-modal-content rounded-lg shadow-2xl p-6 w-fit max-w-5xl m-4 transform transition-all duration-300 ease-out scale-95 opacity-0';

        modal.appendChild(content);
        document.body.appendChild(modal);
        ZIndexManager.apply(modal, MODAL_PRIORITY.CENTRAL);

        return modal;
    }

    /**
     * トースト通知コンテナ作成
     */
    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        // クラス指定を追加してスタイル適用を統一
        container.className = 'space-y-2 pointer-events-none toast-container';
        
        // 手札中央上部に配置（注意喚起・警告用）
        container.style.position = 'fixed';
        container.style.bottom = '180px'; // 手札エリア（bottom: 10px + 約170px高さ）の上
        container.style.left = '50%'; // 水平中央
        container.style.transform = 'translateX(-50%)'; // 中央揃え
        container.style.willChange = 'auto';
        container.style.perspective = 'none';
        container.style.maxWidth = '400px'; // 最大幅制限
        container.style.width = 'fit-content';

        document.body.appendChild(container);
        ZIndexManager.apply(container, MODAL_PRIORITY.TOAST);
        return container;
    }

    /**
     * アクションHUD作成
     */
    createActionHUD() {
        const hud = document.createElement('div');
        hud.id = 'action-hud';
        hud.className = 'fixed pointer-events-none';

        document.body.appendChild(hud);
        ZIndexManager.apply(hud, MODAL_PRIORITY.ACTION_HUD);
        return hud;
    }

    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        // 中央モーダルは明示的なボタンクリックでのみ閉じる
        // 外的要因（ESC、背景クリック等）では閉じない
    }

    /**
     * 中央モーダル表示（ゲーム進行停止）
     * @param {Object} options - モーダル設定
     */
    async showCentralModal({
        title,
        message,
        actions = [],
        closable = false,
        priority = MODAL_PRIORITY.CENTRAL,
        cardData = null,
        allowHtml = false
    }) {
        if (!this.centralModal) return;

        const content = this.centralModal.querySelector('div');
        content.innerHTML = '';

        // タイトル
        if (title) {
            const titleEl = document.createElement('h3');
            titleEl.className = 'text-2xl font-bold text-white mb-4';
            titleEl.textContent = title;
            content.appendChild(titleEl);
        }

        // メッセージ
        if (message) {
            const messageEl = document.createElement('div');
            messageEl.className = 'text-gray-300 mb-6';
            // Support rich HTML strings and element nodes
            if (typeof message === 'string') {
                if (allowHtml) {
                    messageEl.innerHTML = message;
                } else {
                    messageEl.textContent = message;
                }
            } else if (message instanceof HTMLElement) {
                messageEl.appendChild(message);
            } else {
                messageEl.textContent = String(message);
            }
            content.appendChild(messageEl);
        }

        // カード選択グリッド
        if (cardData && cardData.cards) {
            const gridEl = this.createCardSelectionGrid(cardData.cards, cardData.onCardSelect);
            content.appendChild(gridEl);
        }

        // アクションボタン
        if (actions.length > 0) {
            const actionsEl = document.createElement('div');
            actionsEl.className = 'flex justify-end gap-4';
            
            actions.forEach(action => {
                const btn = document.createElement('button');
                btn.className = action.className || 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg';
                btn.textContent = action.text;
                btn.onclick = () => {
                    if (action.callback) action.callback();
                    if (action.autoClose !== false) this.closeCentralModal();
                };
                actionsEl.appendChild(btn);
            });
            
            content.appendChild(actionsEl);
        }

        // 表示
        ZIndexManager.apply(this.centralModal, priority);
        this.centralModal.classList.remove('hidden');
        this.centralModal.style.display = 'flex';
        
        // コンテンツを表示状態にする
        const contentEl = this.centralModal.querySelector('div');
        if (contentEl) {
            contentEl.classList.remove('scale-95', 'opacity-0');
            contentEl.classList.add('scale-100', 'opacity-100');
            contentEl.style.opacity = '1';
            contentEl.style.transform = 'scale(1)';
        }
        
        this.activeModals.set(MODAL_TYPES.CENTRAL, { element: this.centralModal, options: arguments[0] });
    }

    /**
     * 中央モーダルを閉じる
     */
    async closeCentralModal() {
        if (!this.activeModals.has(MODAL_TYPES.CENTRAL)) return;

        // コンテンツを非表示状態に戻す
        const contentEl = this.centralModal.querySelector('div');
        if (contentEl) {
            contentEl.classList.remove('scale-100', 'opacity-100');
            contentEl.classList.add('scale-95', 'opacity-0');
        }

        this.centralModal.classList.add('hidden');
        this.centralModal.style.display = 'none';
        this.activeModals.delete(MODAL_TYPES.CENTRAL);
    }

    /**
     * 通知トースト表示（自動消失）
     * @param {Object} options - 通知設定
     */
    showToast({
        message,
        type = 'info', // 'success', 'warning', 'error', 'info'
        duration = 3000,
        position = 'top-right'
    }) {
        const toast = this.createToastElement({ message, type });
        
        // 位置に応じたコンテナを取得/作成
        const container = this.getToastContainer(position);
        container.appendChild(toast);

        // 表示アニメーション（CSSアニメーションクラスを使用）
        requestAnimationFrame(() => {
            toast.classList.add('toast-enter');
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        });

        // 自動削除
        const autoRemove = setTimeout(() => {
            this.removeToast(toast);
        }, duration);

        // クリックで即削除
        toast.addEventListener('click', () => {
            clearTimeout(autoRemove);
            this.removeToast(toast);
        });

        noop(`📢 Toast shown: ${message} (${type})`);
    }

    /**
     * トースト要素作成
     */
    createToastElement({ message, type }) {
        const toast = document.createElement('div');
        const typeStyles = {
            success: 'bg-green-600 border-green-500',
            warning: 'bg-yellow-600 border-yellow-500',
            error: 'bg-red-600 border-red-500',
            info: 'bg-blue-600 border-blue-500'
        };
        
        toast.className = `
            ${typeStyles[type] || typeStyles.info}
            text-white px-4 py-3 rounded-lg shadow-lg border-l-4 
            cursor-pointer transform opacity-0 
            transition-all duration-300 ease-out pointer-events-auto
            max-w-sm backdrop-filter backdrop-blur-sm toast-item
        `.trim();
        
        toast.style.transform = 'translateY(-20px)';
        toast.style.opacity = '0';
        
        const messageEl = document.createElement('div');
        messageEl.className = 'text-sm font-medium';
        messageEl.textContent = message;
        
        toast.appendChild(messageEl);
        
        return toast;
    }

    /**
     * トースト削除
     */
    async removeToast(toast) {
        toast.classList.add('toast-exit');
        toast.style.transform = 'translateY(-10px)';
        toast.style.opacity = '0';
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }

    /**
     * 位置に応じたトーストコンテナ取得
     */
    getToastContainer(position) {
        // 現在は右上のみサポート、将来的に拡張可能
        return this.toastContainer;
    }

    /**
     * アクションHUD表示（コンテキスト依存UI）
     * @param {Object} options - HUD設定
     */
    showActionHUD({
        actions = [],
        title = null
    }) {
        const hudContainer = this.actionHUD;
        hudContainer.innerHTML = ''; // Clear previous content

        // スタイルをリセットし、パネル内のレイアウトに追従させる
        hudContainer.className = 'action-hud-container w-full';
        hudContainer.style.position = 'relative';
        hudContainer.style.top = 'auto';
        hudContainer.style.left = 'auto';
        hudContainer.style.transform = 'none';
        hudContainer.style.marginTop = 'auto'; // パネル下部に配置
        hudContainer.style.padding = '12px 0px'; // 上下のパディング

        const hudContent = document.createElement('div');
        hudContent.className = 'action-hud flex flex-col items-center gap-2';

        if (actions.length > 0) {
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'flex items-center justify-center flex-wrap gap-2';
            
            actions.forEach(action => {
                const btn = document.createElement('button');
                btn.className = action.className || 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg';
                btn.textContent = action.text;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    if (action.callback) action.callback();
                    this.hideActionHUD(); // アクション実行後にHUDを隠す
                };
                actionsContainer.appendChild(btn);
            });
            hudContent.appendChild(actionsContainer);
        }

        hudContainer.appendChild(hudContent);

        // ステータスパネルのコンテンツエリアにHUDを追加
        const panelContent = document.querySelector('#game-status-panel .status-panel-content');
        if (panelContent) {
            panelContent.appendChild(hudContainer);
        } else {
            console.error('Status panel content not found!');
            // フォールバックとしてbodyに直接追加
            document.body.appendChild(hudContainer);
        }

        // Make it visible
        hudContainer.style.opacity = '1';
        hudContainer.style.pointerEvents = 'auto';
        hudContainer.style.display = 'block';
        this.activeModals.set(MODAL_TYPES.ACTION_HUD, { element: hudContainer });
    }


    /**
     * アクションHUDを非表示
     */
    hideActionHUD() {
        const hud = this.actionHUD;
        hud.style.opacity = '0';
        hud.style.pointerEvents = 'none';
        hud.innerHTML = '';
    }

    /**
     * カード選択グリッド作成
     */
    createCardSelectionGrid(cards, onCardSelect) {
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-3 gap-4 p-4 bg-gray-700 rounded-lg max-h-80 overflow-y-auto mb-4';

        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'relative w-20 h-28 rounded-lg overflow-hidden shadow-md cursor-pointer hover:scale-105 transition-transform';
            
            if (card) {
                const img = document.createElement('img');
                img.className = 'w-full h-full object-contain';
                img.src = card.imagePath || getCardImagePath(card.name_en, card);
                img.alt = card.name_ja;
                
                cardEl.appendChild(img);
                
                const nameEl = document.createElement('div');
                nameEl.className = 'absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs text-center py-1';
                nameEl.textContent = card.name_ja;
                cardEl.appendChild(nameEl);
                
                cardEl.onclick = (e) => {
                    e.stopPropagation(); // イベントバブリングを停止
                    if (onCardSelect) onCardSelect(card.id);
                };
            } else {
                cardEl.className += ' border-2 border-dashed border-gray-500';
                cardEl.textContent = 'Empty';
            }
            
            grid.appendChild(cardEl);
        });

        return grid;
    }

    /**
     * すべてのモーダルを閉じる
     */
    closeAllModals() {
        // 中央モーダル
        if (this.activeModals.has(MODAL_TYPES.CENTRAL)) {
            this.closeCentralModal();
        }
        
        // アクションHUD
        if (this.activeModals.has(MODAL_TYPES.ACTION_HUD)) {
            this.hideActionHUD();
        }
        
        // フローティングアクションHUD
        if (this.activeModals.has(MODAL_TYPES.FLOATING_ACTION_HUD)) {
            this.hideAllFloatingActionButtons();
        }
        
        // トースト削除
        const toasts = this.toastContainer.querySelectorAll('div');
        toasts.forEach(toast => this.removeToast(toast));

        // スタッククリア
        this.modalStack = [];
        
        noop('🎭 All modals closed');
    }

    /**
     * 最上位モーダルを閉じる
     */
    closeTopModal() {
        if (this.activeModals.has(MODAL_TYPES.CENTRAL)) {
            this.closeCentralModal();
        } else if (this.activeModals.has(MODAL_TYPES.ACTION_HUD)) {
            this.hideActionHUD();
        }
    }

    /**
     * 現在のアクティブモーダル情報を取得
     */
    getActiveModals() {
        return Array.from(this.activeModals.keys());
    }

    /**
     * 特定タイプのモーダルがアクティブかチェック
     */
    isModalActive(type) {
        return this.activeModals.has(type);
    }

    /**
     * フローティングアクションボタン表示
     * @param {string} buttonId - ボタンのDOM ID
     * @param {function} callback - クリック時のコールバック
     */
    showFloatingActionButton(buttonId, callback) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.classList.remove('hidden');
            button.classList.add('show');
            button.onclick = callback;
            
            // アクティブなフローティングボタンとして追跡
            if (!this.activeModals.has(MODAL_TYPES.FLOATING_ACTION_HUD)) {
                this.activeModals.set(MODAL_TYPES.FLOATING_ACTION_HUD, { buttons: new Set() });
            }
            this.activeModals.get(MODAL_TYPES.FLOATING_ACTION_HUD).buttons.add(buttonId);
            
            noop(`🎯 Floating action button shown: ${buttonId}`);
        } else {
            noop(`⚠️ Floating action button not found: ${buttonId}`);
        }
    }

    /**
     * フローティングアクションボタン非表示
     * @param {string} buttonId - ボタンのDOM ID
     */
    hideFloatingActionButton(buttonId) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.classList.add('hidden');
            button.classList.remove('show');
            button.onclick = null;
            
            // アクティブ追跡から削除
            if (this.activeModals.has(MODAL_TYPES.FLOATING_ACTION_HUD)) {
                const hudData = this.activeModals.get(MODAL_TYPES.FLOATING_ACTION_HUD);
                hudData.buttons.delete(buttonId);
                
                // すべてのボタンが非表示になった場合、HUDを非アクティブにする
                if (hudData.buttons.size === 0) {
                    this.activeModals.delete(MODAL_TYPES.FLOATING_ACTION_HUD);
                }
            }
            
            noop(`🎯 Floating action button hidden: ${buttonId}`);
        }
    }

    /**
     * すべてのフローティングアクションボタンを非表示
     */
    hideAllFloatingActionButtons() {
        const floatingButtonIds = [
            'confirm-setup-button-float',
            'retreat-button-float',
            'attack-button-float',
            'end-turn-button-float'
        ];
        
        floatingButtonIds.forEach(buttonId => {
            this.hideFloatingActionButton(buttonId);
        });
        
        // フローティングHUDを非アクティブにする
        this.activeModals.delete(MODAL_TYPES.FLOATING_ACTION_HUD);
        
        noop('🎯 All floating action buttons hidden');
    }
}

// デフォルトインスタンス
export const modalManager = new ModalManager();

// DOM準備完了後に初期化（重複初期化を防ぐ）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!modalManager.initialized) {
            modalManager.init();
        }
    });
} else {
    if (!modalManager.initialized) {
        modalManager.init();
    }
}


