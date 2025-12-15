/**
 * EFFECTS.JS - 特殊エフェクトアニメーション
 * 
 * エネルギー付与・進化・特殊状態の演出
 */

import { AnimationCore, ANIMATION_TIMING } from './core.js';
import { findZoneElement, areValidElements } from '../dom-utils.js';

// エネルギータイプ色定数
const ENERGY_COLORS = {
    fire: '#ff4444',
    water: '#4285f4', 
    grass: '#34a853',
    lightning: '#fbbc04',
    psychic: '#9c27b0',
    fighting: '#ff6d00',
    darkness: '#424242',
    metal: '#607d8b',
    colorless: '#9e9e9e'
};

export class EffectAnimations extends AnimationCore {
    constructor() {
        super();
    }

    /**
     * エネルギー付与アニメーション
     * @param {string} energyType - エネルギータイプ ('fire', 'water', etc.)
     * @param {string} pokemonId - 対象ポケモンID
     */
    async energy(energyType, pokemonId) {
        const pokemonElement = this.findPokemonElement(pokemonId);
        
        if (!pokemonElement) return;

        const color = ENERGY_COLORS[energyType.toLowerCase()] || ENERGY_COLORS.colorless;
        const glowClass = `anim-energy-glow-${energyType.toLowerCase()}`;
        
        // 1. 初期グロー設定
        pokemonElement.style.boxShadow = `0 0 30px ${color}, 0 0 60px ${color}40`;
        pokemonElement.style.border = `3px solid ${color}`;
        pokemonElement.style.borderRadius = '12px';
        
        // 2. パルスアニメーション
        pokemonElement.classList.add('energy-effect', `energy-effect-${energyType}`);
        await this.animate(pokemonElement, glowClass, ANIMATION_TIMING.slow);
        
        // 3. フェードアウト
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // クリーンアップ（ゆっくりとフェード）
        pokemonElement.style.transition = 'all 800ms ease-out';
        pokemonElement.style.boxShadow = `0 0 10px ${color}60`;
        pokemonElement.style.border = `2px solid ${color}80`;
        
        this.scheduleCleanup(() => {
            pokemonElement.style.transition = '';
            pokemonElement.style.boxShadow = '';
            pokemonElement.style.border = '';
            pokemonElement.style.borderRadius = '';
            pokemonElement.classList.remove('energy-effect', `energy-effect-${energyType}`);
        }, 1000);
    }

    /**
     * 進化アニメーション
     * @param {string} fromPokemonId - 進化前ポケモンID
     * @param {string} toPokemonId - 進化後ポケモンID
     */
    async evolution(fromPokemonId, toPokemonId) {
        const fromElement = this.findPokemonElement(fromPokemonId);
        const toElement = this.findPokemonElement(toPokemonId);
        
        if (!fromElement || !toElement) return;

        // 1. 進化前ポケモンの光る演出
        await this.animate(fromElement, 'anim-evolution-glow', ANIMATION_TIMING.slow);

        // 2. フラッシュ効果
        await this.screenFlash();

        // 3. 進化後ポケモンの登場
        toElement.style.opacity = '0';
        await this.animate(toElement, 'anim-evolution-emerge', ANIMATION_TIMING.slow);
    }

    /**
     * 特殊状態アニメーション
     * @param {string} condition - 特殊状態 ('poisoned', 'burned', etc.)
     * @param {string} pokemonId - 対象ポケモンID
     */
    async condition(condition, pokemonId) {
        const pokemonElement = this.findPokemonElement(pokemonId);
        
        if (!pokemonElement) return;

        const conditionEffects = {
            poisoned: { color: '#9c27b0', intensity: 'medium', duration: 2000 },
            burned: { color: '#ff5722', intensity: 'high', duration: 1500 },
            asleep: { color: '#3f51b5', intensity: 'low', duration: 3000 },
            paralyzed: { color: '#ffeb3b', intensity: 'medium', duration: 1000 },
            confused: { color: '#e91e63', intensity: 'high', duration: 2500 }
        };
        
        const effect = conditionEffects[condition.toLowerCase()];
        if (!effect) return;
        
        // 特殊状態の視覚効果
        pokemonElement.style.boxShadow = `0 0 15px ${effect.color}`;
        pokemonElement.classList.add('special-condition', `condition-${condition}`);
        
        const conditionClass = `anim-condition-${condition}`;
        await this.animate(pokemonElement, conditionClass, ANIMATION_TIMING.normal);
        
        // 持続的エフェクトのスケジュール
        this.scheduleCleanup(() => {
            pokemonElement.style.boxShadow = '';
            pokemonElement.classList.remove('special-condition', `condition-${condition}`);
        }, effect.duration);
    }

    /**
     * 回復アニメーション
     * @param {number} healAmount - 回復量
     * @param {string} pokemonId - 対象ポケモンID
     */
    async heal(healAmount, pokemonId) {
        const pokemonElement = this.findPokemonElement(pokemonId);
        
        if (!pokemonElement) return;

        // 緑色の回復グロー（healAmountは将来の拡張用）
        await this.animate(pokemonElement, 'anim-heal-glow', ANIMATION_TIMING.normal);

        // HP数値の更新エフェクト
        const hpElement = this.findHPElement(pokemonId);
        if (hpElement) {
            await this.animate(hpElement, 'anim-hp-recover', ANIMATION_TIMING.normal);
        }
    }

    /**
     * カードドロー演出
     * @param {string} playerId - プレイヤーID
     * @param {number} cardCount - ドロー枚数
     */
    async draw(playerId, cardCount = 1) {
        const deckElement = findZoneElement(playerId, 'deck');
        const handElement = findZoneElement(playerId, 'hand');
        
        if (!deckElement || !handElement) return;

        for (let i = 0; i < cardCount; i++) {
            // デッキからカードが浮上
            await this.animate(deckElement, 'anim-deck-lift', ANIMATION_TIMING.fast);
            await this.delay(100);
            
            // 手札への移動
            await this.animate(handElement, 'anim-card-draw', ANIMATION_TIMING.normal);
            
            if (i < cardCount - 1) {
                await this.delay(150); // カード間の間隔
            }
        }
    }

    /**
     * サイドカード取得演出
     * @param {string} playerId - プレイヤーID
     * @param {number} prizeIndex - サイドカードインデックス
     */
    async prize(playerId, prizeIndex) {
        const prizeElement = this.findPrizeCard(playerId, prizeIndex);
        
        if (!prizeElement) return;

        // 1. サイドカードの光る演出
        await this.animate(prizeElement, 'anim-prize-glow', ANIMATION_TIMING.normal);

        // 2. 手札への移動
        await this.animate(prizeElement, 'anim-prize-take', ANIMATION_TIMING.normal);

        // 3. 勝利に近づく演出（残りサイド数に応じて）
        const remainingPrizes = this.getRemainingPrizes(playerId);
        if (remainingPrizes <= 2) {
            await this.victoryApproach();
        }
    }

    /**
     * 勝利接近演出
     */
    async victoryApproach() {
        const gameBoard = document.getElementById('game-board') || document.body;
        
        if (!gameBoard) return;

        await this.animate(gameBoard, 'anim-victory-approach', ANIMATION_TIMING.normal);
    }

    /**
     * フラッシュ効果（進化時など）
     */
    async screenFlash() {
        const gameBoard = document.getElementById('game-board') || document.body;
        
        if (!gameBoard) return;

        await this.animate(gameBoard, 'anim-screen-flash', ANIMATION_TIMING.fast);
    }

    /**
     * エネルギーカードスライドエフェクト
     * @private
     */

    // ヘルパー関数
    findPokemonElement(pokemonId) {
        return document.querySelector(`[data-runtime-id="${pokemonId}"]`) ||
               document.querySelector(`[data-card-id="${pokemonId}"]`) ||
               document.querySelector(`[data-pokemon-id="${pokemonId}"]`);
    }

    findEnergyCard(cardId) {
        return document.querySelector(`[data-runtime-id="${cardId}"]`) ||
               document.querySelector(`[data-card-id="${cardId}"]`);
    }


    findHPElement(pokemonId) {
        const pokemon = this.findPokemonElement(pokemonId);
        return pokemon?.querySelector('.hp-display, .damage-counter');
    }

    findPrizeCard(playerId, index) {
        return document.querySelector(`[data-owner="${playerId}"][data-zone="prize"][data-index="${index}"]`);
    }

    getRemainingPrizes(playerId) {
        const prizeCards = document.querySelectorAll(`[data-owner="${playerId}"][data-zone="prize"] .card`);
        return prizeCards.length;
    }
}
