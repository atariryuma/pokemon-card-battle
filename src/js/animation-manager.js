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
import { threeViewBridge } from './three-view-bridge.js';
import { eventBus, GameEventTypes } from './core/event-bus.js';

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
     * Three.js 3Dビューが有効かどうか
     * @returns {boolean}
     */
    isThreeJSActive() {
        return threeViewBridge?.isActive() ?? false;
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
     * Three.js有効時はDOM版アニメーションをスキップ（3Dレンダリングで更新）
     */
    async cardMove(playerId, cardId, transition, options = {}) {
        // Three.js有効時はDOMアニメーションをスキップ
        if (this.isThreeJSActive()) {
            console.log(`🃏 Card move: ${cardId} (${transition})`);
            return Promise.resolve();
        }
        return this.execute(() => this.card.move(playerId, cardId, transition, options));
    }
    
    /**
     * エネルギー付与
     */
    async energyAttach(energyId, pokemonId, gameState) {
        // ✅ イベント駆動: エネルギー付与イベント
        eventBus.emit(GameEventTypes.ENERGY_ATTACHED, {
            energyId: energyId,
            pokemonId: pokemonId,
            timestamp: Date.now()
        });

        // ✅ Three.js専用: エネルギー付与アニメーション
        if (threeViewBridge?.isActive()) {
            console.log(`⚡ Energy attach: ${energyId} → ${pokemonId}`);
            await threeViewBridge.animateEnergyAttach?.(pokemonId, 600);
        }
        return Promise.resolve();
    }

    /**
     * エネルギー廃棄（Three.js専用）
     */
    async energyDiscard(discardedEnergy, sourceEl, targetEl) {
        // ✅ Three.js専用: エネルギー廃棄はThree.jsが処理
        return Promise.resolve();
    }

    /**
     * 手札配布（ハイブリッド方式：DOM版）
     */
    async handDeal(cards, playerId) {
        // ✅ ハイブリッド方式: 手札はDOM版なのでDOM版アニメーションを使用
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
     * 攻撃の完全なシーケンス（Three.js専用）
     */
    async attackSequence(attackerType, damage, targetId, options = {}) {
        // ✅ イベント駆動: 攻撃宣言イベント
        eventBus.emit(GameEventTypes.ATTACK_DECLARED, {
            attackerId: options.attackerId,
            targetId: targetId,
            damage: damage,
            attackerType: attackerType,
            timestamp: Date.now()
        });

        // ✅ Three.js専用: 攻撃アニメーション
        if (threeViewBridge?.isActive()) {
            console.log(`🎬 Attack sequence: ${options.attackerId} → ${targetId}, damage=${damage}`);

            // 攻撃側のアニメーション
            const attackerId = options.attackerId;
            if (attackerId) {
                await threeViewBridge.animateAttack?.(attackerId, 400);
            }

            // ダメージアニメーション
            if (targetId && damage > 0) {
                await threeViewBridge.animateDamage?.(targetId, 500, Math.min(damage / 10, 10));
                await threeViewBridge.animateHPFlash?.(targetId, 400);

                // ✅ イベント駆動: ダメージ適用イベント
                eventBus.emit(GameEventTypes.DAMAGE_DEALT, {
                    targetId: targetId,
                    damage: damage,
                    attackerId: options.attackerId,
                    timestamp: Date.now()
                });
            }

            // 画面シェイク
            if (damage > 0) {
                const shakeIntensity = Math.min(damage / 20, 8);
                await threeViewBridge.animateScreenShake?.(300, shakeIntensity);
            }
        }
        return Promise.resolve();
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
     * フェーズ遷移（Three.js専用）
     */
    async changePhase(fromPhase, toPhase, options = {}) {
        // ✅ Three.js専用: フェーズ遷移はUI通知で表示
        // Three.jsでの特別なアニメーションは不要
        return Promise.resolve();
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
     * ノックアウトアニメーション（Three.js専用）
     */
    async knockout(pokemonId, options = {}) {
        // ✅ イベント駆動: ノックアウトイベント
        eventBus.emit(GameEventTypes.POKEMON_KNOCKED_OUT, {
            pokemonId: pokemonId,
            ownerId: options.ownerId,
            timestamp: Date.now()
        });

        // ✅ Three.js専用: ノックアウトアニメーション
        if (threeViewBridge?.isActive()) {
            console.log(`💀 Knockout animation: ${pokemonId}`);
            await threeViewBridge.animateKnockout?.(pokemonId, 800);
        }
        return Promise.resolve();
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

