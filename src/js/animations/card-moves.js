/**
 * CARD-MOVES.JS - カード移動アニメーション
 * 
 * すべてのカード移動を統一管理
 * 手札 ↔ フィールド ↔ トラッシュ
 */

import { AnimationCore, ANIMATION_TIMING } from './core.js';
import { CardOrientationManager } from '../card-orientation.js';
import { findZoneElement, findCardElement, findBenchSlot, areValidElements } from '../dom-utils.js';

export class CardMoveAnimations extends AnimationCore {
    constructor() {
        super();
    }

    /**
     * カード移動メイン関数
     * @param {string} playerId - プレイヤーID
     * @param {string} cardId - カードID
     * @param {string} transition - 遷移タイプ ('hand->active', 'active->discard', etc.)
     * @param {Object} options - オプション
     */
    async move(playerId, cardId, transition, options = {}) {
        const [from, to] = transition.split('->');
        
        switch (transition) {
            case 'hand->active':
                return this.handToActive(playerId, cardId, options);
            case 'hand->bench':
                return this.handToBench(playerId, cardId, options);
            case 'active->discard':
                return this.activeToDiscard(playerId, cardId, options);
            case 'bench->active':
                return this.benchToActive(playerId, cardId, options);
            case 'deck->hand':
                return this.deckToHand(playerId, cardId, options);
            default:
                return this.genericMove(playerId, cardId, from, to, options);
        }
    }

    /**
     * 手札からアクティブへの移動
     */
    async handToActive(playerId, cardId, options = {}) {
        const sourceElement = findCardElement(playerId, cardId, 'hand');
        const targetElement = findZoneElement(playerId, 'active');
        
        if (!areValidElements(sourceElement, targetElement)) {
            console.warn(`Cannot animate hand to active: playerId=${playerId}, cardId=${cardId}`);
            return;
        }

        // アニメーション実行
        await this.animate(sourceElement, 'anim-card-to-active', ANIMATION_TIMING.normal);
    }

    /**
     * 手札からベンチへの移動
     */
    async handToBench(playerId, cardId, options = {}) {
        const { benchIndex = 0 } = options;
        const sourceElement = findCardElement(playerId, cardId, 'hand');
        const targetElement = findBenchSlot(playerId, benchIndex);
        
        if (!areValidElements(sourceElement, targetElement)) {
            console.warn(`Cannot animate hand to bench: playerId=${playerId}, cardId=${cardId}, benchIndex=${benchIndex}`);
            return;
        }

        await this.animate(sourceElement, 'anim-card-to-bench', ANIMATION_TIMING.normal);
    }

    /**
     * アクティブからトラッシュへ（気絶時）
     */
    async activeToDiscard(playerId, cardId, options = {}) {
        const sourceElement = findCardElement(playerId, cardId, 'active');
        
        if (!sourceElement) {
            console.warn(`Cannot animate active to discard: playerId=${playerId}, cardId=${cardId}`);
            return;
        }

        // 気絶アニメーション
        await this.animate(sourceElement, 'anim-card-knockout', ANIMATION_TIMING.slow);
    }

    /**
     * ベンチからアクティブへの昇格
     */
    async benchToActive(playerId, cardId, options = {}) {
        const { benchIndex = 0 } = options;
        const sourceElement = findBenchSlot(playerId, benchIndex);
        const targetElement = findZoneElement(playerId, 'active');
        
        if (!sourceElement || !targetElement) return;

        await this.animate(sourceElement, 'anim-card-promote', ANIMATION_TIMING.normal);
    }

    /**
     * デッキから手札へ（ドロー）
     */
    async deckToHand(playerId, cardId, options = {}) {
        const deckElement = findZoneElement(playerId, 'deck');
        const handElement = findZoneElement(playerId, 'hand');
        
        if (!deckElement || !handElement) return;

        // デッキリフト → 手札スライド
        await this.animate(deckElement, 'anim-deck-lift', ANIMATION_TIMING.fast);
        await this.delay(100);
        await this.animate(handElement, 'anim-card-draw', ANIMATION_TIMING.normal);
    }

    /**
     * 汎用移動（フォールバック）
     */
    async genericMove(playerId, cardId, from, to, options = {}) {
        const sourceElement = findCardElement(playerId, cardId, from);
        
        if (!sourceElement) return;

        await this.animate(sourceElement, 'anim-card-move', ANIMATION_TIMING.normal);
    }

    /**
     * 複数カード同時配布（セットアップ時）
     */
    async dealMultiple(cards, options = {}) {
        const { staggerDelay = 100 } = options;
        const promises = cards.map((card, index) => {
            return new Promise(resolve => {
                setTimeout(() => {
                    this.move(card.playerId, card.cardId, card.transition).then(resolve);
                }, index * staggerDelay);
            });
        });
        
        await Promise.all(promises);
    }

    /**
     * 手札配布アニメーション（高度版）
     */
    async dealHand(cards, playerId, options = {}) {
        const { staggerDelay = 80 } = options;
        
        if (!Array.isArray(cards)) {
            console.warn('dealHand: cards should be an array');
            return;
        }

        // 手札エリアを取得
        const handElement = findZoneElement(playerId, 'hand');
        if (!handElement) {
            console.warn(`Hand element not found for ${playerId}`);
            return;
        }

        // 各カードを順番に配布
        const promises = cards.map((card, index) => {
            return new Promise(resolve => {
                setTimeout(async () => {
                    const cardElement = handElement.children[index];
                    if (cardElement) {
                        // カードを最初は非表示にして
                        cardElement.style.opacity = '0';
                        cardElement.style.transform = 'translateY(-30px) scale(0.8)';
                        
                        // フェードインアニメーション
                        await this.delay(50);
                        cardElement.style.transition = 'opacity 300ms ease, transform 300ms ease';
                        cardElement.style.opacity = '1';
                        cardElement.style.transform = 'translateY(0) scale(1)';
                        
                        // 配布効果音の代わりに軽い振動
                        if (navigator.vibrate) {
                            navigator.vibrate(50);
                        }
                    }
                    resolve();
                }, index * staggerDelay);
            });
        });

        await Promise.all(promises);
    }

    /**
     * サイド配布アニメーション（シンプル・座標不変）
     * 与えられた elements（各スロット内のカード要素）をその場でフェードイン。
     * 座標・サイズはCSS（%指定）に完全委譲し、JSでは変更しない。
     */
    async dealPrize(elements, playerId, options = {}) {
        const { staggerDelay = 80 } = options;

        if (!Array.isArray(elements)) {
            console.warn('dealPrize: elements should be an array');
            return;
        }

        const promises = elements.map((el, index) => {
            return new Promise(resolve => {
                setTimeout(async () => {
                    const target = el; // そのまま使用（子要素やslot自体に対応）
                    if (target) {
                        // 向きを適用（CPU/プレイヤー、ゾーン=prize）
                        CardOrientationManager.applyCardOrientation(target, playerId, 'prize');

                        // 既存の移動系スタイルをクリア（座標ズレ防止）
                        target.style.transition = '';
                        target.style.transform = '';
                        target.style.left = '';
                        target.style.top = '';
                        target.style.opacity = '0';

                        await this.delay(20);
                        // 位置は変えずにフェードインのみ
                        target.style.transition = 'opacity 220ms ease';
                        target.style.opacity = '1';
                    }
                    resolve();
                }, index * staggerDelay);
            });
        });

        await Promise.all(promises);
    }

    /**
     * 高度なカードドローアニメーション（山札から手札へ）
     */
    async drawCardFromDeck(playerId, cardElement, options = {}) {
        const { duration = 600 } = options;
        
        const deckElement = findZoneElement(playerId, 'deck');
        const handElement = findZoneElement(playerId, 'hand');
        
        if (!deckElement || !handElement || !cardElement) {
            console.warn('Missing elements for card draw animation');
            return;
        }

        // デッキの位置を取得
        const deckRect = deckElement.getBoundingClientRect();
        const handRect = handElement.getBoundingClientRect();

        // アニメーション用のクローンカードを作成
        const animCard = cardElement.cloneNode(true);
        animCard.style.cssText = `
            position: fixed;
            left: ${deckRect.left}px;
            top: ${deckRect.top}px;
            width: ${cardElement.offsetWidth}px;
            height: ${cardElement.offsetHeight}px;
            z-index: var(--z-critical);
            transform: scale(1) rotate(0deg);
            opacity: 1;
            pointer-events: none;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            transition: none;
        `;

        // 元のカードを一時的に隠す
        cardElement.style.opacity = '0';

        // DOMに追加
        document.body.appendChild(animCard);

        // 強制リフロー
        animCard.offsetHeight;

        // アニメーション実行
        return new Promise(resolve => {
            animCard.style.transition = `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
            animCard.style.left = `${handRect.right - cardElement.offsetWidth}px`;
            animCard.style.top = `${handRect.top}px`;
            animCard.style.transform = 'scale(1.05) rotate(3deg)';

            setTimeout(() => {
                // 後処理
                if (animCard.parentNode) {
                    animCard.parentNode.removeChild(animCard);
                }
                
                // 元のカードを表示
                cardElement.style.opacity = '1';
                cardElement.style.transform = 'scale(1.1)';
                
                // 配置完了効果
                setTimeout(() => {
                    cardElement.style.transition = 'transform 200ms ease';
                    cardElement.style.transform = '';
                    setTimeout(() => {
                        cardElement.style.transition = '';
                        resolve();
                    }, 200);
                }, 100);
            }, duration);
        });
    }

    /**
     * カードフリップアニメーション
     * @param {Element} element - カード要素
     * @param {Object} options - オプション
     */
    async flip(element, options = {}) {
        if (!element) return;

        const { imageUrl } = options;
        
        // フリップアニメーション実行
        await this.animate(element, 'anim-card-flip', ANIMATION_TIMING.normal);
        
        // 画像切り替え（指定された場合）
        if (imageUrl) {
            const img = element.querySelector('img');
            if (img) {
                img.src = imageUrl;
            }
        }
    }

}
