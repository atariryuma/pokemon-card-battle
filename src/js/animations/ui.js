/**
 * UI.JS - UI遷移アニメーション
 * 
 * フェーズ遷移・通知・モーダルのUI演出
 */

import { AnimationCore, ANIMATION_TIMING } from './core.js';

export class UIAnimations extends AnimationCore {
    constructor() {
        super();
    }

    /**
     * フェーズ遷移アニメーション
     * @param {string} fromPhase - 遷移前フェーズ
     * @param {string} toPhase - 遷移後フェーズ  
     * @param {Object} options - オプション
     */
    async phase(fromPhase, toPhase, options = {}) {
        // 特定の遷移パターンに対応
        switch (`${fromPhase}->${toPhase}`) {
            case 'setup->playing':
                return this.gameStart();
            case 'playerMain->playerAttack':
                return this.attackPhase();
            case 'playerTurn->cpuTurn':
                return this.turnTransition('player', 'cpu');
            case 'cpuTurn->playerTurn':
                return this.turnTransition('cpu', 'player');
            default:
                return this.genericTransition();
        }
    }

    /**
     * ゲーム開始演出
     */
    async gameStart() {
        const gameBoard = document.getElementById('game-board');
        
        if (!gameBoard) return;

        // 盤面フラッシュ
        await this.animate(gameBoard, 'anim-game-start', ANIMATION_TIMING.slow);
    }

    /**
     * 攻撃フェーズ演出
     */
    async attackPhase() {
        const activeCard = document.querySelector('[data-owner="player"][data-zone="active"] .card');
        
        if (!activeCard) return;

        // アクティブポケモンのハイライト
        await this.animate(activeCard, 'anim-attack-ready', ANIMATION_TIMING.normal);
    }

    /**
     * ターン遷移演出
     * @param {string} fromPlayer - 前のプレイヤー
     * @param {string} toPlayer - 次のプレイヤー
     */
    async turnTransition(fromPlayer, toPlayer) {
        const fromBoard = document.querySelector(`[data-owner="${fromPlayer}"]`);
        const toBoard = document.querySelector(`[data-owner="${toPlayer}"]`);

        // 前プレイヤーのフェードアウト
        if (fromBoard) {
            await this.animate(fromBoard, 'anim-turn-end', ANIMATION_TIMING.normal);
        }

        // 短い間隔
        await this.delay(200);

        // 次プレイヤーのフェードイン
        if (toBoard) {
            await this.animate(toBoard, 'anim-turn-start', ANIMATION_TIMING.normal);
        }

        // ターン通知表示
        await this.notification(`${toPlayer === 'player' ? 'あなた' : '相手'}のターン`);
    }

    /**
     * 汎用遷移
     */
    async genericTransition() {
        await this.delay(ANIMATION_TIMING.fast);
    }

    /**
     * 通知アニメーション
     * @param {string} message - 通知メッセージ
     * @param {string} type - 通知タイプ ('info', 'success', 'warning', 'error')
     */
    async notification(message, type = 'info') {
        // 通知要素を作成または取得
        let notificationEl = document.getElementById('game-notification');
        
        if (!notificationEl) {
            notificationEl = this.createNotificationElement();
        }

        // メッセージとスタイル設定
        notificationEl.textContent = message;
        notificationEl.className = `notification anim-notification-${type}`;

        // アニメーション実行
        await this.animate(notificationEl, 'anim-notification-show', ANIMATION_TIMING.normal);
        
        // 表示時間
        await this.delay(2000);
        
        // フェードアウト
        await this.animate(notificationEl, 'anim-notification-hide', ANIMATION_TIMING.normal);
    }

    /**
     * モーダル表示アニメーション
     * @param {Element} modal - モーダル要素
     */
    async modal(modal) {
        if (!modal) return;

        modal.style.display = 'flex';
        await this.animate(modal, 'anim-modal-show', ANIMATION_TIMING.normal);
    }

    /**
     * モーダル非表示アニメーション
     * @param {Element} modal - モーダル要素
     */
    async modalHide(modal) {
        if (!modal) return;

        await this.animate(modal, 'anim-modal-hide', ANIMATION_TIMING.normal);
        modal.style.display = 'none';
    }

    /**
     * 成功メッセージ
     * @param {string} message - メッセージ
     */
    async success(message) {
        await this.notification(message, 'success');
    }

    /**
     * エラーメッセージ
     * @param {string} message - メッセージ
     */
    async error(message) {
        await this.notification(message, 'error');
    }

    /**
     * 警告メッセージ
     * @param {string} message - メッセージ
     */
    async warning(message) {
        await this.notification(message, 'warning');
    }

    /**
     * ローディング表示
     * @param {boolean} show - 表示/非表示
     */
    async loading(show = true) {
        let loadingEl = document.getElementById('game-loading');
        
        if (!loadingEl && show) {
            loadingEl = this.createLoadingElement();
        }

        if (!loadingEl) return;

        if (show) {
            loadingEl.style.display = 'flex';
            await this.animate(loadingEl, 'anim-loading-show', ANIMATION_TIMING.fast);
        } else {
            await this.animate(loadingEl, 'anim-loading-hide', ANIMATION_TIMING.fast);
            loadingEl.style.display = 'none';
        }
    }

    /**
     * ハイライト表示/非表示
     * @param {Element} element - 対象要素
     * @param {boolean} show - 表示/非表示
     */
    async highlight(element, show = true) {
        if (!element) return;

        if (show) {
            element.classList.add('highlighted');
            await this.animate(element, 'anim-highlight-show', ANIMATION_TIMING.fast);
        } else {
            await this.animate(element, 'anim-highlight-hide', ANIMATION_TIMING.fast);
            element.classList.remove('highlighted');
        }
    }

    // ヘルパー関数
    createNotificationElement() {
        const notification = document.createElement('div');
        notification.id = 'game-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: var(--z-critical);
            display: none;
        `;
        document.body.appendChild(notification);
        return notification;
    }

    createLoadingElement() {
        const loading = document.createElement('div');
        loading.id = 'game-loading';
        loading.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">読み込み中...</div>
        `;
        loading.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: var(--z-critical);
            display: none;
        `;
        document.body.appendChild(loading);
        return loading;
    }
}