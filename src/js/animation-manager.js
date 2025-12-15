/**
 * ANIMATION-MANAGER.JS - 統合アニメーションマネージャー
 * 
 * すべてのアニメーションを統一管理
 * シンプルなAPIで各種アニメーションにアクセス
 */

import { CardMoveAnimations } from './animations/card-moves.js';
import { CombatAnimations } from './animations/combat.js';
import { EffectAnimations } from './animations/effects.js';
import { UIAnimations } from './animations/ui.js';
import { getCardImagePath } from './data-manager.js';
import { areValidElements } from './dom-utils.js';

/**
 * 統合アニメーションマネージャー
 */
class AnimationManager {
    constructor() {
        // 各アニメーションクラスのインスタンス
        this.card = new CardMoveAnimations();
        this.combat = new CombatAnimations();
        this.effect = new EffectAnimations();
        this.ui = new UIAnimations();
        
        // パフォーマンス設定
        this.settings = {
            enabled: true,
            quality: 'high', // 'low', 'medium', 'high'
            reduceMotion: this.detectReduceMotion()
        };
    }

    /**
     * エネルギータイプを抽出
     * @param {string} energyId - エネルギーカードID
     * @returns {string} エネルギータイプ
     */
    extractEnergyType(energyId) {
        try {
            // data-manager.js から cardMasterList を取得
            const cardMasterList = window.getCardMasterList?.() || [];
            const card = cardMasterList.find(c => c?.id === energyId);
            
            if (card?.energy_type) {
                // エネルギータイプの正規化
                const typeMap = {
                    'fighting': 'fighting',
                    'fire': 'fire', 
                    'water': 'water',
                    'grass': 'grass',
                    'lightning': 'lightning',
                    'psychic': 'psychic',
                    'darkness': 'darkness',
                    'metal': 'metal',
                    'colorless': 'colorless'
                };
                
                const energyType = card.energy_type.toLowerCase();
                return typeMap[energyType] || 'colorless';
            }
            
            return 'colorless';
        } catch (error) {
            console.error('Error extracting energy type:', error);
            return 'colorless';
        }
    }

    /**
     * アニメーション有効/無効切り替え
     * @param {boolean} enabled - 有効フラグ
     */
    setEnabled(enabled) {
        this.settings.enabled = enabled;
    }

    /**
     * アニメーション品質設定
     * @param {string} quality - 品質レベル ('low', 'medium', 'high')
     */
    setQuality(quality) {
        this.settings.quality = quality;
        this.updateQualitySettings();
    }

    /**
     * 品質設定の適用
     */
    updateQualitySettings() {
        const root = document.documentElement;
        
        switch (this.settings.quality) {
            case 'low':
                root.style.setProperty('--anim-enabled', '0');
                break;
            case 'medium':
                root.style.setProperty('--anim-enabled', '1');
                root.style.setProperty('--anim-particles', '0');
                break;
            case 'high':
                root.style.setProperty('--anim-enabled', '1');
                root.style.setProperty('--anim-particles', '1');
                break;
        }
    }

    /**
     * Reduce Motionの検出
     */
    detectReduceMotion() {
        return window.matchMedia && 
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }


    // ※コンバットアニメーションはcombat.jsとeffects.jsに移管しました

    /**
     * カードハイライト表示（UIアニメーションと統合）
     */
    highlightCard(cardElement) {
        if (!cardElement) return;
        return this.execute(() => this.ui.highlight(cardElement, true));
    }

    /**
     * カードハイライト解除（UIアニメーションと統合）
     */
    unhighlightCard(cardElement) {
        if (!cardElement) return;
        return this.execute(() => this.ui.highlight(cardElement, false));
    }

    /**
     * ポケモン要素の検索
     */
    findPokemonElement(pokemonId) {
        // runtimeId を最優先に、互換で master id も探索
        return document.querySelector(`[data-runtime-id="${pokemonId}"]`) ||
               document.querySelector(`[data-card-id="${pokemonId}"]`) ||
               document.querySelector(`[data-pokemon-id="${pokemonId}"]`);
    }

    /**
     * 全アニメーションの停止・クリーンアップ
     */
    async stopAll() {
        await Promise.all([
            this.card.cleanup(),
            this.combat.cleanup(),
            this.effect.cleanup(),
            this.ui.cleanup()
        ]);
    }

    /**
     * アニメーション実行のラッパー（設定チェック付き）
     * @param {Function} animationFunction - アニメーション関数
     * @param {...any} args - 引数
     */
    async execute(animationFunction, ...args) {
        // アニメーション無効時はスキップ
        if (!this.settings.enabled || this.settings.reduceMotion) {
            return;
        }

        try {
            // DOM の準備を確認
            await this.waitForDOM();
            return await animationFunction.apply(this, args);
        } catch (error) {
            console.warn('Animation execution error:', error);
        }
    }

    /**
     * DOMの準備完了を待つ
     */
    async waitForDOM() {
        return new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                requestAnimationFrame(() => resolve());
            }
        });
    }

    // 便利メソッド（よく使われるアニメーションのショートカット）
    
    /**
     * カード移動（統一API）
     */
    async cardMove(playerId, cardId, transition, options = {}) {
        return this.execute(() => this.card.move(playerId, cardId, transition, options));
    }
    
    /**
     * エネルギー付与
     */
    async energyAttach(energyId, pokemonId, gameState) {
        const energyType = this.extractEnergyType(energyId);
        return this.execute(() => this.effect.energy(energyType, pokemonId));
    }
    
    /**
     * エネルギー廃棄
     */
    async energyDiscard(discardedEnergy, sourceEl, targetEl) {
        return this.execute(() => this.effect.energyDiscard(discardedEnergy, sourceEl, targetEl));
    }
    
    /**
     * 手札配布
     */
    async handDeal(cards, playerId) {
        return this.execute(() => this.card.dealHand(cards, playerId));
    }
    
    /**
     * サイド配布
     */
    async prizeDeal(elements, playerId) {
        return this.execute(() => this.card.dealPrize(elements, playerId));
    }

    /**
     * カードドロー（山札から手札へ）
     */
    async cardDraw(playerId, cardElement, options = {}) {
        return this.execute(() => this.card.drawCardFromDeck(playerId, cardElement, options));
    }

    /**
     * 攻撃アニメーション（統一API）
     * combat.jsの高度なアニメーションを使用
     */
    async attack(attackerType, damage, targetId, options = {}) {
        return await this.execute(() => this.combat.attack(attackerType, damage, targetId, options));
    }

    /**
     * ダメージアニメーション（統一API）
     * combat.jsの高度なアニメーションを使用
     */
    async damage(damage, targetId, options = {}) {
        return await this.execute(() => this.combat.damage(damage, targetId));
    }

    /**
     * スクリーンシェイク（統一API）
     */
    async screenShake(damage = 0) {
        const intensity = Math.min(Math.max(damage / 50, 0.5), 3.0);
        return this.execute(() => this.combat.screenShake(intensity));
    }

    /**
     * タイプ別攻撃エフェクト（統一API）
     */
    async typeAttack(attackerElement, defenderElement, energyType = 'Colorless') {
        return this.execute(() => this.combat.typeEffect(energyType.toLowerCase(), defenderElement, attackerElement));
    }

    /**
     * カードハイライト（統一API）
     */
    async highlight(cardElement) {
        return this.execute(() => this.highlightCard(cardElement));
    }

    /**
     * カードハイライト解除（統一API）
     */
    async unhighlight(cardElement) {
        return this.execute(() => this.unhighlightCard(cardElement));
    }
    
    /**
     * カードを手札からフィールドに移動
     */
    async playCard(playerId, cardId, targetZone, options = {}) {
        const transition = `hand->${targetZone}`;
        return this.execute(() => this.card.move(playerId, cardId, transition, options));
    }

    /**
     * 攻撃の完全なシーケンス
     */
    async attackSequence(attackerType, damage, targetId, options = {}) {
        return this.execute(() => this.combat.attack(attackerType, damage, targetId, options));
    }

    /**
     * エネルギー付与の完全なシーケンス
     */
    async attachEnergy(energyType, pokemonId, options = {}) {
        return this.execute(() => this.effect.energy(energyType, pokemonId, options));
    }

    /**
     * 特殊状態の適用
     */
    async applySpecialCondition(pokemonId, condition) {
        return this.execute(() => this.effect.condition(condition, pokemonId));
    }

    /**
     * フェーズ遷移
     */
    async changePhase(fromPhase, toPhase, options = {}) {
        return this.execute(() => this.ui.phase(fromPhase, toPhase, options));
    }

    /**
     * 成功/エラー通知
     */
    async notify(message, type = 'info') {
        return this.execute(() => this.ui.notification(message, type));
    }

    /**
     * 複数カードの同時配布（セットアップ用）
     */
    async dealCards(cards, options = {}) {
        return this.execute(() => this.card.dealMultiple(cards, options));
    }

    /**
     * ノックアウトアニメーション
     */
    async knockout(pokemonId, options = {}) {
        return this.execute(() => this.combat.knockout(pokemonId, options));
    }

    /**
     * 戦闘の完全なシーケンス（攻撃→ダメージ→気絶判定）
     */
    async battleSequence(attackData) {
        if (!this.settings.enabled) return;

        const { attackerType, damage, targetId, isKnockout, options = {} } = attackData;

        // 攻撃アニメーション
        await this.attackSequence(attackerType, damage, targetId, options);

        // 気絶処理
        if (isKnockout) {
            await this.execute(() => this.combat.knockout(targetId, options));
        }
    }

    /**
     * デバッグ用：アニメーション状態表示
     */
    getStatus() {
        return {
            enabled: this.settings.enabled,
            quality: this.settings.quality,
            reduceMotion: this.settings.reduceMotion,
            activeAnimations: {
                card: this.card.activeAnimations.size,
                combat: this.combat.activeAnimations.size,
                effect: this.effect.activeAnimations.size,
                ui: this.ui.activeAnimations.size
            }
        };
    }
}

// シングルトンインスタンス
export const animate = new AnimationManager();

// 後方互換性のための旧API
export const animationManager = {
    // 旧メソッドを新APIにリダイレクト
    animateDrawCard: (element) => animate.card.deckToHand('player', null, { element }),
    animateDamage: (element) => animate.combat.damage(50, null, { element }),
    createUnifiedKnockoutAnimation: (playerId, pokemonId) => animate.knockout(pokemonId),
    animateScreenShake: (intensity) => animate.combat.screenShake(intensity),
    
    // 手札エントリー
    animateHandEntry: (cards) => animate.handDeal(cards, 'player'),
    
    // 手札配布
    animateHandDeal: (cards, playerId) => animate.handDeal(cards, playerId),
    
    // カードドロー
    animateDrawCard: (element) => {
        if (element) {
            return animate.cardDraw('player', element);
        }
        return animate.card.deckToHand('player', null, { element });
    },
    
    // メッセージアニメーション
    animateMessage: (element) => animate.ui.notification(element?.textContent || 'メッセージ', 'info'),
    animateError: (element, severity = 'warning') => {
        const type = severity === 'error' ? 'error' : (severity === 'warning' ? 'warning' : 'info');
        return animate.ui.notification(element?.textContent || 'エラー', type);
    },
    
    // 統一カードアニメーション
    createUnifiedCardAnimation: (playerId, cardId, from, to, index, options) => {
        const transition = `${from}->${to}`;
        return animate.cardMove(playerId, cardId, transition, { ...options, index });
    },
    
    // 統一攻撃アニメーション
    createUnifiedAttackAnimation: (attackerId, defenderId) => 
        animate.attackSequence('normal', 50, defenderId, { attackerId }),
    
    // カード表示切り替え
    flipCardFaceUp: (element, imageUrl) => animate.card.flip(element, { imageUrl }),
    
    // カードハイライト
    highlightCard: (element) => animate.ui.highlight(element, true),
    unhighlightCard: (element) => animate.ui.highlight(element, false)
};

// 新しい統一マネージャー（旧unified-animations.jsの置き換え）
export const unifiedAnimationManager = {
    // 高度なカード移動アニメーション（手札からプレイマットへの移動など）
    async createUnifiedCardAnimation(playerId, cardId, sourceZone, targetZone, targetIndex, options = {}) {
        const {
            isSetupPhase = false,
            duration = 600,
            card = null,
            initialSourceRect = null
        } = options;

        try {
            // 移動元要素の取得
            const sourceElement = this.getSourceElement(playerId, sourceZone, cardId);
            if (!sourceElement) {
                console.warn(`⚠️ Source element not found: ${playerId} ${sourceZone} ${cardId}`);
                return;
            }

            // 移動先要素の取得
            const targetElement = this.getTargetElement(playerId, targetZone, targetIndex);
            if (!targetElement) {
                console.warn(`⚠️ Target element not found: ${playerId} ${targetZone}[${targetIndex}]`);
                return Promise.resolve();
            }

            // 移動先に配置されたカード要素を取得
            const placedCardElement = targetElement.children[0];
            if (!placedCardElement) {
                console.warn(`⚠️ No card found in target: ${playerId} ${targetZone}[${targetIndex}]`);
                return;
            }

            // アニメーション実行
            await this.executeCardMoveAnimation(
                sourceElement, 
                targetElement, 
                placedCardElement, 
                card, 
                { playerId, isSetupPhase, duration, initialSourceRect, targetZone }
            );

        } catch (error) {
            console.error('❌ Error in unified card animation:', error);
        }
    },

    // セレクタヘルパー
    getPlayerSelector(playerId) {
        return playerId === 'player' ? '.player-self' : '.opponent-board';
    },

    getActiveSelector(playerId) {
        return playerId === 'player' ? '.active-bottom' : '.active-top';
    },

    getBenchSelector(playerId, index) {
        const prefix = playerId === 'player' ? 'bottom' : 'top';
        return `.${prefix}-bench-${index + 1}`;
    },

    getHandSelector(playerId) {
        return playerId === 'player' ? '#player-hand' : '#cpu-hand';
    },

    // 移動元要素の取得
    getSourceElement(playerId, sourceZone, cardId) {
        const playerSelector = this.getPlayerSelector(playerId);
        const selectByCard = (scopeSelector) => {
            if (!cardId) return null;
            // runtimeId 優先で探索し、互換で master id も試行
            return document.querySelector(`${playerSelector} ${scopeSelector} [data-runtime-id="${cardId}"]`)
                || document.querySelector(`${playerSelector} ${scopeSelector} .relative[data-runtime-id="${cardId}"]`)
                || document.querySelector(`${playerSelector} ${scopeSelector} [data-card-id="${cardId}"]`)
                || document.querySelector(`${playerSelector} ${scopeSelector} .relative[data-card-id="${cardId}"]`);
        };

        switch (sourceZone) {
            case 'hand': {
                // 具体的なカード要素を優先し、無ければ手札コンテナ
                const fromHand = selectByCard('#player-hand, #cpu-hand');
                return fromHand || document.querySelector(this.getHandSelector(playerId));
            }
            case 'bench': {
                const benchClassPrefix = playerId === 'player' ? 'bottom-bench-' : 'top-bench-';
                const fromBench = selectByCard(`[class*="${benchClassPrefix}"]`);
                return fromBench || document.querySelector(`${playerSelector} [class*="${benchClassPrefix}"]`);
            }
            case 'active': {
                const fromActive = selectByCard(this.getActiveSelector(playerId));
                return fromActive || document.querySelector(`${playerSelector} ${this.getActiveSelector(playerId)}`);
            }
            case 'deck':
                return document.querySelector(`${playerSelector} .deck-container`);
            default:
                // 未対応のゾーンは静かにnullを返す（ノイズ削減）
                return null;
        }
    },

    // 移動先要素の取得
    getTargetElement(playerId, targetZone, targetIndex) {
        const playerSelector = this.getPlayerSelector(playerId);
        
        switch (targetZone) {
            case 'active':
            case 'Active':
                return document.querySelector(`${playerSelector} ${this.getActiveSelector(playerId)}`);
            case 'bench':
            case 'Bench':
                return document.querySelector(`${playerSelector} ${this.getBenchSelector(playerId, targetIndex)}`);
            case 'hand':
            case 'Hand':
                return document.querySelector(this.getHandSelector(playerId));
            case 'discard':
            case 'Discard':
                return document.querySelector(`${playerSelector} .discard-container`);
            default:
                console.warn(`Unknown target zone: ${targetZone}`);
                return null;
        }
    },

    // 要素の位置とサイズを取得
    getElementRect(element) {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2
        };
    },

    // カード移動アニメーションの実行
    async executeCardMoveAnimation(sourceElement, targetElement, placedCardElement, card, options) {
        const { playerId, isSetupPhase, duration, initialSourceRect, targetZone } = options;

        // 位置情報取得
        const sourceRect = initialSourceRect || this.getElementRect(sourceElement);
        const targetRect = this.getElementRect(targetElement);
        
        if (!sourceRect || !targetRect) {
            console.warn('⚠️ Could not get element positions for animation');
            return;
        }

        // アニメーション用のクローン要素を作成
        const animCard = this.createAnimationCard(placedCardElement, sourceRect, playerId, targetZone, options);
        
        // 元のカードを一時的に隠す
        placedCardElement.style.opacity = '0';
        
        // DOM に追加
        document.body.appendChild(animCard);
        
        // 強制リフロー
        animCard.offsetHeight;
        
        // アニメーション実行
        await this.performCardTransition(animCard, targetRect, duration);
        
        // 後処理
        this.cleanupAnimation(animCard, placedCardElement);
    },

    // アニメーション用カード要素の作成
    createAnimationCard(originalCard, sourceRect, playerId, targetZone, options) {
        const animCard = originalCard.cloneNode(true);
        
        // アニメーション用スタイル設定
        const finalSourceLeft = sourceRect.left + (options.initialSourceRect ? 0 : (playerId === 'cpu' ? 20 : 50));
        const finalSourceTop = sourceRect.top + (options.initialSourceRect ? 0 : 20);
        
        animCard.style.cssText = `
            position: fixed;
            left: ${finalSourceLeft}px;
            top: ${finalSourceTop}px;
            width: ${originalCard.offsetWidth}px;
            height: ${originalCard.offsetHeight}px;
            z-index: var(--z-critical);
            transform: scale(0.8) rotate(-3deg);
            opacity: 0.9;
            pointer-events: none;
            border-radius: 8px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
            transition: none;
        `;

        return animCard;
    },

    // カード遷移アニメーション実行
    async performCardTransition(animCard, targetRect, duration) {
        return new Promise(resolve => {
            // トランジション設定
            animCard.style.transition = `all ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
            
            // 目標位置へ移動
            animCard.style.left = `${targetRect.left}px`;
            animCard.style.top = `${targetRect.top}px`;
            animCard.style.transform = 'scale(1) rotate(0deg)';
            animCard.style.opacity = '1';

            // アニメーション完了待機
            const handleTransitionEnd = () => {
                animCard.removeEventListener('transitionend', handleTransitionEnd);
                resolve();
            };

            animCard.addEventListener('transitionend', handleTransitionEnd, { once: true });

            // フォールバック
            setTimeout(handleTransitionEnd, duration + 100);
        });
    },

    // アニメーション後処理
    cleanupAnimation(animCard, originalCard) {
        // アニメーション用カードを削除
        if (animCard.parentNode) {
            animCard.parentNode.removeChild(animCard);
        }

        // 元のカードを表示
        originalCard.style.opacity = '1';

        // 配置完了効果
        originalCard.style.transform = 'scale(1.1)';
        setTimeout(() => {
            originalCard.style.transition = 'transform 200ms ease';
            originalCard.style.transform = '';
            setTimeout(() => {
                originalCard.style.transition = '';
            }, 200);
        }, 150);
    },
    
    // エネルギー系
    createLightweightEnergyEffect: (energyId, pokemonId) => {
        const energyType = unifiedAnimationManager.extractEnergyType(energyId);
        return unifiedAnimationManager.execute(() => 
            animate.effect.energy(energyType, pokemonId)
        );
    },
    
    // 廃棄エネルギー
    animateDiscardedEnergy: (playerId, discardedEnergy, sourceEl, targetEl) => {
        return animate.energyDiscard(discardedEnergy, sourceEl, targetEl);
    },
    
    // 手札配布
    animateHandDeal: (cards, playerId) => animate.handDeal(cards, playerId),
    
    // サイド配布  
    animatePrizeDeal: (elements, playerId) => animate.prizeDeal(elements, playerId),
    
    // 戦闘系
    animateTypeBasedAttack: (attackerEl, defenderEl, type) => {
        const targetId = defenderEl?.dataset?.cardId;
        return animate.combat.typeEffect(type.toLowerCase(), defenderEl, attackerEl);
    },
    
    animateScreenShake: (damage) => {
        const intensity = Math.min(Math.max(damage / 50, 0.5), 3.0);
        return animate.combat.screenShake(intensity);
    },
    
    // 特殊状態系
    animateSpecialCondition: (condition, pokemonId) => {
        return animate.effect.condition(condition, pokemonId);
    },
    
    // UI系
    animatePhaseTransition: (from, to) => animate.ui.phase(from, to),
    
    // エネルギー系
    animateEnergyAttach: (energyCardElement, pokemonElement) => {
        if (!energyCardElement || !pokemonElement) return Promise.resolve();
        
        const energyType = energyCardElement.dataset?.energyType || 'colorless';
        const pokemonId = pokemonElement.dataset?.cardId;
        
        if (pokemonId) {
            return animate.effect.energy(energyType, pokemonId, {
                energyCardId: energyCardElement.dataset?.cardId
            });
        }
        
        // フォールバック: 旧アニメーション
        return new Promise(resolve => {
            const img = energyCardElement.querySelector('img') || energyCardElement;
            img.classList.add('animate-energy-attach');
            pokemonElement.classList.add('slot-highlight');
            
            setTimeout(() => {
                img.classList.remove('animate-energy-attach');
                pokemonElement.classList.remove('slot-highlight');
                resolve();
            }, 700);
        });
    },

    // スロット・カードハイライト
    highlightSlot: (element, type = 'bench') => {
        if (element) {
            element.classList.add('slot-highlight');
            element.dataset.highlightType = type;
        }
    },

    unhighlightSlot: (element) => {
        if (element) {
            element.classList.remove('slot-highlight');
            delete element.dataset.highlightType;
        }
    }
};
