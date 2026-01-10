/**
 * CARD-MOVES.JS - カード移動アニメーション
 * 
 * すべてのカード移動を統一管理
 * 手札 ↔ フィールド ↔ トラッシュ
 */

import { AnimationCore } from './core.js';
import { ANIMATION_TIMING, CARD_ANIMATION_CONSTANTS } from './constants.js';
import { CardOrientationManager } from '../card-orientation.js';
import { findZoneElement, findCardElement, findBenchSlot, areValidElements } from '../dom-utils.js';
import { createLogger } from '../logger.js';

// ✅ ロガー初期化
const logger = createLogger('CardMoveAnimations');

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
            logger.warn('Cannot animate hand to active', { playerId, cardId });
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
            logger.warn('Cannot animate hand to bench', { playerId, cardId, benchIndex });
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
            logger.warn('Cannot animate active to discard', { playerId, cardId });
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
     * ✅ タイマーリーク修正: setTimeoutからシーケンシャル実行に変更
     */
    async dealMultiple(cards, options = {}) {
        const { staggerDelay = 100, parallel = false } = options;

        if (!Array.isArray(cards) || cards.length === 0) {
            return;
        }

        // ✅ 並列実行オプション（従来の動作）
        if (parallel) {
            const promises = cards.map((card, index) => {
                return this.delay(index * staggerDelay).then(() =>
                    this.move(card.playerId, card.cardId, card.transition)
                );
            });
            await Promise.all(promises);
            return;
        }

        // ✅ デフォルト: シーケンシャル実行（タイマーリークなし）
        for (let i = 0; i < cards.length; i++) {
            await this.move(cards[i].playerId, cards[i].cardId, cards[i].transition);
            if (i < cards.length - 1) {
                await this.delay(staggerDelay);
            }
        }
    }

    /**
     * 手札配布アニメーション（高度版）
     * ✅ タイマーリーク修正: シーケンシャル実行に変更
     */
    async dealHand(cards, playerId, options = {}) {
        const { staggerDelay = 80, withFlip = false, parallel = false } = options;

        if (!Array.isArray(cards)) {
            logger.warn('dealHand: cards should be an array');
            return;
        }

        // 手札エリアを取得
        const handElement = findZoneElement(playerId, 'hand');
        if (!handElement) {
            logger.warn('Hand element not found', { playerId });
            return;
        }

        // ✅ アニメーション実行関数
        const animateCard = async (card, index) => {
            const cardElement = handElement.children[index];
            if (!cardElement) return;

            // フリップまたは標準アニメーション
            if (withFlip) {
                cardElement.style.transform = 'rotateY(90deg) translateY(-30px) scale(0.8)';
                cardElement.style.opacity = '0';
            } else {
                cardElement.style.opacity = '0';
                cardElement.style.transform = 'translateY(-30px) scale(0.8)';
            }

            await this.delay(50);

            // フェードインアニメーション
            const fadeDuration = CARD_ANIMATION_CONSTANTS.DEAL_FADE_DURATION;
            const flipDuration = CARD_ANIMATION_CONSTANTS.DEAL_FLIP_DURATION;
            cardElement.style.transition = withFlip
                ? `opacity ${fadeDuration}ms ease, transform ${flipDuration}ms ease`
                : `opacity ${fadeDuration}ms ease, transform ${fadeDuration}ms ease`;
            cardElement.style.opacity = '1';
            cardElement.style.transform = 'translateY(0) scale(1) rotateY(0deg)';

            // アニメーション完了を待つ
            await this.delay(withFlip ? flipDuration : fadeDuration);

            // クリーンアップ
            cardElement.style.transition = '';
            cardElement.classList.remove('is-preparing-animation');
            cardElement.style.opacity = '1';
            cardElement.style.visibility = 'visible';
            cardElement.style.display = 'flex';

            // ✅ 振動フィードバック（安全な使用）
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                try {
                    navigator.vibrate(CARD_ANIMATION_CONSTANTS.VIBRATION_DURATION);
                } catch (e) {
                    // 振動失敗は無視
                }
            }
        };

        // ✅ 並列実行オプション（高速だが競合リスクあり）
        if (parallel) {
            const promises = cards.map((card, index) =>
                this.delay(index * staggerDelay).then(() => animateCard(card, index))
            );
            await Promise.all(promises);
            return;
        }

        // ✅ デフォルト: シーケンシャル実行（安全）
        for (let i = 0; i < cards.length; i++) {
            await animateCard(cards[i], i);
            if (i < cards.length - 1) {
                await this.delay(staggerDelay);
            }
        }
    }

    /**
     * サイド配布アニメーション（シンプル・座標不変）
     * 与えられた elements（各スロット内のカード要素）をその場でフェードイン。
     * 座標・サイズはCSS（%指定）に完全委譲し、JSでは変更しない。
     */
    async dealPrize(elements, playerId, options = {}) {
        const { staggerDelay = 80 } = options;

        if (!Array.isArray(elements)) {
            logger.warn('dealPrize: elements should be an array');
            return;
        }

        const promises = elements.map((el, index) => {
            return new Promise(resolve => {
                setTimeout(async () => {
                    const target = el; // そのまま使用（子要素やslot自体に対応）
                    if (target) {
                        // 注: 向き制御は親スロットの data-orientation を CSS が継承

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
     * ✅ ハイブリッドモード対応: デッキがDOM に存在しない場合はシンプルなフェードイン
     * ✅ メモリリーク修正: try-finallyでDOM要素のクリーンアップを保証
     */
    async drawCardFromDeck(playerId, cardElement, options = {}) {
        const duration = options.duration || CARD_ANIMATION_CONSTANTS.DRAW_DURATION;

        const deckElement = findZoneElement(playerId, 'deck');
        const handElement = findZoneElement(playerId, 'hand');

        // ✅ ハイブリッドモード: デッキが3D版のみの場合、シンプルなフェードインに切り替え
        if (!deckElement || !handElement || !cardElement) {
            // デッキがThree.jsで管理されている場合、カードは既に手札にあるのでフェードインのみ
            if (cardElement) {
                cardElement.style.opacity = '0';
                cardElement.style.transform = 'translateY(-30px) scale(0.8)';
                await this.delay(50);
                cardElement.style.transition = 'opacity 300ms ease, transform 300ms ease';
                cardElement.style.opacity = '1';
                cardElement.style.transform = 'translateY(0) scale(1)';
            }
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

        // ✅ メモリリーク修正: try-finallyでクリーンアップを保証
        try {
            // DOMに追加
            document.body.appendChild(animCard);

            // 強制リフロー（CSSトランジションのトリガー用）
            animCard.offsetHeight;

            // アニメーション実行
            await new Promise(resolve => {
                animCard.style.transition = `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
                animCard.style.left = `${handRect.right - cardElement.offsetWidth}px`;
                animCard.style.top = `${handRect.top}px`;
                animCard.style.transform = 'scale(1.05) rotate(3deg)';

                setTimeout(() => {
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
        } finally {
            // ✅ エラー発生時も確実にクリーンアップ
            if (animCard && animCard.parentNode) {
                animCard.parentNode.removeChild(animCard);
            }
        }
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
