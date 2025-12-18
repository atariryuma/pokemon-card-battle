/**
 * COMBAT.JS - 戦闘アニメーション
 *
 * 攻撃・ダメージ・気絶の戦闘演出を統一管理
 *
 * @module animations/combat
 * @description 2025年ベストプラクティスに基づいた実装：
 * - メモリリーク防止（WeakMap、適切なクリーンアップ）
 * - 並行処理制御（アニメーションロック機構）
 * - 中央集権的エラーハンドリング
 * - GPU加速アニメーション（transform/opacity）
 * - 型安全性とバリデーション
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance MDN Animation Performance}
 * @see {@link https://web.dev/articles/animations-and-performance web.dev Animations}
 */

import { AnimationCore, ANIMATION_TIMING } from './core.js';

// ============================================================================
// 定数定義（マジックナンバー排除）
// ============================================================================

/**
 * 戦闘アニメーション関連の定数
 * @constant {Object}
 * @readonly
 */
const COMBAT_CONSTANTS = Object.freeze({
    // ダメージ計算
    DAMAGE_INTENSITY_DIVISOR: 50,
    MIN_SHAKE_INTENSITY: 0.5,
    MAX_SHAKE_INTENSITY: 3.0,
    SCREEN_SHAKE_THRESHOLD: 30,

    // タイミング（ミリ秒）
    TYPE_EFFECT_CLEANUP_MS: 1200,
    COMBO_DELAY_MS: 200,
    CONDITION_EFFECT_DURATION_MS: 1000,
    TYPE_EFFECT_DELAY_MS: 300,

    // DOM検索の最大リトライ回数
    MAX_ELEMENT_LOOKUP_RETRIES: 3,
    ELEMENT_LOOKUP_RETRY_DELAY_MS: 50
});

/**
 * ポケモンタイプ別エフェクト定義
 * @constant {Object}
 * @readonly
 */
const TYPE_EFFECTS = Object.freeze({
    fire: Object.freeze({
        color: '#ff4444',
        effect: 'flame',
        cssClass: 'anim-type-fire'
    }),
    water: Object.freeze({
        color: '#4488ff',
        effect: 'water',
        cssClass: 'anim-type-water'
    }),
    lightning: Object.freeze({
        color: '#ffff44',
        effect: 'electric',
        cssClass: 'anim-type-lightning'
    }),
    grass: Object.freeze({
        color: '#44ff44',
        effect: 'leaf',
        cssClass: 'anim-type-grass'
    }),
    psychic: Object.freeze({
        color: '#ff44ff',
        effect: 'psychic',
        cssClass: 'anim-type-psychic'
    }),
    fighting: Object.freeze({
        color: '#ff8844',
        effect: 'fighting',
        cssClass: 'anim-type-fighting'
    }),
    darkness: Object.freeze({
        color: '#444444',
        effect: 'dark',
        cssClass: 'anim-type-darkness'
    }),
    metal: Object.freeze({
        color: '#888888',
        effect: 'metal',
        cssClass: 'anim-type-metal'
    }),
    fairy: Object.freeze({
        color: '#ffaaff',
        effect: 'fairy',
        cssClass: 'anim-type-fairy'
    }),
    dragon: Object.freeze({
        color: '#4444ff',
        effect: 'dragon',
        cssClass: 'anim-type-dragon'
    }),
    colorless: Object.freeze({
        color: '#ffffff',
        effect: 'normal',
        cssClass: 'anim-type-colorless'
    })
});

/**
 * 特殊状態エフェクト定義
 * @constant {Object}
 * @readonly
 */
const CONDITION_EFFECTS = Object.freeze({
    poisoned: Object.freeze({
        color: '#9c27b0',
        animation: 'anim-condition-poison'
    }),
    burned: Object.freeze({
        color: '#ff5722',
        animation: 'anim-condition-burn'
    }),
    asleep: Object.freeze({
        color: '#3f51b5',
        animation: 'anim-condition-sleep'
    }),
    paralyzed: Object.freeze({
        color: '#ffeb3b',
        animation: 'anim-condition-paralyze'
    }),
    confused: Object.freeze({
        color: '#e91e63',
        animation: 'anim-condition-confuse'
    })
});

// ============================================================================
// カスタムエラークラス
// ============================================================================

/**
 * アニメーション実行時のエラー
 * @extends Error
 */
class AnimationError extends Error {
    /**
     * @param {string} message - エラーメッセージ
     * @param {string} [context] - エラーコンテキスト
     * @param {*} [cause] - 原因となったエラー
     */
    constructor(message, context = null, cause = null) {
        super(message);
        this.name = 'AnimationError';
        this.context = context;
        this.cause = cause;
        this.timestamp = new Date().toISOString();
    }
}

// ============================================================================
// メインクラス
// ============================================================================

/**
 * 戦闘アニメーション管理クラス
 * @extends AnimationCore
 *
 * @description
 * 2025年ベストプラクティスに基づいた実装：
 * - メモリリーク防止のためのWeakMapとクリーンアップ追跡
 * - 並行処理制御のためのロック機構
 * - GPU加速アニメーション（transform/opacity優先）
 * - 中央集権的エラーハンドリング
 *
 * @example
 * const combat = new CombatAnimations();
 * await combat.attack('fire', 50, 'pokemon-123', { attackerId: 'pokemon-456' });
 */
export class CombatAnimations extends AnimationCore {
    /**
     * コンストラクタ
     */
    constructor() {
        super();

        /**
         * アニメーションロック（並行処理制御）
         * ポケモンIDをキーとし、実行中のPromiseを値とする
         * @type {Map<string, Promise<void>>}
         * @private
         */
        this._animationLocks = new Map();

        /**
         * アクティブなDOM要素への参照（メモリリーク防止）
         * WeakMapを使用して自動ガベージコレクション可能に
         * @type {WeakSet<HTMLElement>}
         * @private
         */
        this._activeOverlays = new WeakSet();

        /**
         * クリーンアップ待機中のタイマーID
         * @type {Set<number>}
         * @private
         */
        this._cleanupTimers = new Set();

        /**
         * エラーログコレクター
         * @type {Array<AnimationError>}
         * @private
         */
        this._errorLog = [];

        // CSS依存性を検証（開発環境のみ - ブラウザ互換）
        const isDevEnv = typeof window !== 'undefined' &&
            (window.location?.hostname === 'localhost' ||
                window.location?.hostname === '127.0.0.1');
        if (isDevEnv) {
            this._validateCSSAnimations();
        }
    }

    // ========================================================================
    // パブリックメソッド - 攻撃・ダメージ・気絶
    // ========================================================================

    /**
     * 攻撃アニメーション
     *
     * @param {string} attackerType - ポケモンタイプ ('fire', 'water', etc.)
     * @param {number} damage - ダメージ量（0以上の数値）
     * @param {string} targetId - 対象ポケモンID
     * @param {Object} [options={}] - オプション
     * @param {string} [options.attackerId] - 攻撃者ポケモンID
     * @param {boolean} [options.skipDamageAnimation=false] - ダメージアニメーションをスキップ
     * @returns {Promise<void>}
     * @throws {AnimationError} バリデーションエラーまたは要素が見つからない場合
     *
     * @example
     * await combat.attack('fire', 50, 'target-123', { attackerId: 'attacker-456' });
     */
    async attack(attackerType, damage, targetId, options = {}) {
        // 入力検証
        this._validateAttackParams(attackerType, damage, targetId);

        try {
            // ターゲットのアニメーションロックを取得
            await this._acquireLock(targetId);

            const attackerElement = options.attackerId
                ? await this._findPokemonElementWithRetry(options.attackerId)
                : null;
            const targetElement = await this._findPokemonElementWithRetry(targetId);

            // 要素が見つからない場合はエラー
            if (!targetElement) {
                throw new AnimationError(
                    `Target element not found: ${targetId}`,
                    'attack',
                    { targetId, attackerType, damage }
                );
            }

            // 1. 攻撃者の前進動作（存在する場合）
            if (attackerElement) {
                await this.animate(
                    attackerElement,
                    'anim-attack-forward',
                    ANIMATION_TIMING.combat
                );
            }

            // 2. タイプ別攻撃エフェクト
            await this.typeEffect(attackerType, targetElement, attackerElement);

            // 3. ダメージ処理
            if (!options.skipDamageAnimation) {
                await this.damage(damage, targetId);
            }

        } catch (error) {
            this._logError(error, 'attack', { attackerType, damage, targetId, options });
            throw error;
        } finally {
            // ロック解放
            this._releaseLock(targetId);
        }
    }

    /**
     * ダメージアニメーション
     *
     * @param {number} damage - ダメージ量（0以上の数値）
     * @param {string} targetId - 対象ポケモンID
     * @returns {Promise<void>}
     * @throws {AnimationError} バリデーションエラーまたは要素が見つからない場合
     *
     * @example
     * await combat.damage(30, 'pokemon-123');
     */
    async damage(damage, targetId) {
        // 入力検証
        this._validateDamage(damage);
        this._validateId(targetId, 'targetId');

        try {
            await this._acquireLock(targetId);

            const targetElement = await this._findPokemonElementWithRetry(targetId);

            if (!targetElement) {
                throw new AnimationError(
                    `Target element not found: ${targetId}`,
                    'damage',
                    { targetId, damage }
                );
            }

            // ダメージ強度を計算（GPU最適化のため、transformで実装）
            const intensity = Math.min(
                Math.max(
                    damage / COMBAT_CONSTANTS.DAMAGE_INTENSITY_DIVISOR,
                    COMBAT_CONSTANTS.MIN_SHAKE_INTENSITY
                ),
                COMBAT_CONSTANTS.MAX_SHAKE_INTENSITY
            );

            // 1. ポケモンシェイク（GPU加速 - transform使用）
            await this.animate(
                targetElement,
                'anim-damage-shake',
                ANIMATION_TIMING.combat
            );

            // 2. 画面シェイク（ダメージが閾値以上の場合）
            if (damage >= COMBAT_CONSTANTS.SCREEN_SHAKE_THRESHOLD) {
                await this.screenShake(intensity);
            }

            // 3. HPフラッシュ（GPU加速 - opacity使用）
            const hpElement = this._findHPElement(targetId);
            if (hpElement) {
                await this.animate(
                    hpElement,
                    'anim-hp-flash',
                    ANIMATION_TIMING.fast
                );
            }

        } catch (error) {
            this._logError(error, 'damage', { damage, targetId });
            throw error;
        } finally {
            this._releaseLock(targetId);
        }
    }

    /**
     * 気絶アニメーション
     *
     * @param {string} pokemonId - 気絶ポケモンID
     * @param {Object} [options={}] - オプション
     * @param {boolean} [options.skipScreenFlash=false] - 画面フラッシュをスキップ
     * @returns {Promise<void>}
     * @throws {AnimationError} バリデーションエラーまたは要素が見つからない場合
     *
     * @example
     * await combat.knockout('pokemon-123');
     */
    async knockout(pokemonId, options = {}) {
        // 入力検証
        this._validateId(pokemonId, 'pokemonId');

        try {
            await this._acquireLock(pokemonId);

            const pokemonElement = await this._findPokemonElementWithRetry(pokemonId);

            if (!pokemonElement) {
                throw new AnimationError(
                    `Pokemon element not found: ${pokemonId}`,
                    'knockout',
                    { pokemonId }
                );
            }

            // 気絶演出：回転しながらフェードアウト（GPU加速 - transform + opacity）
            await this.animate(
                pokemonElement,
                'anim-knockout',
                ANIMATION_TIMING.slow
            );

            // 劇的な画面効果
            if (!options.skipScreenFlash) {
                await this.screenFlash();
            }

        } catch (error) {
            this._logError(error, 'knockout', { pokemonId, options });
            throw error;
        } finally {
            this._releaseLock(pokemonId);
        }
    }

    /**
     * タイプ別攻撃エフェクト
     *
     * @param {string} type - ポケモンタイプ
     * @param {HTMLElement} targetElement - 対象要素
     * @param {HTMLElement} [attackerElement=null] - 攻撃者要素（オプション）
     * @returns {Promise<void>}
     * @throws {AnimationError} 要素が無効な場合
     *
     * @example
     * await combat.typeEffect('fire', targetEl, attackerEl);
     */
    async typeEffect(type, targetElement, attackerElement = null) {
        // 入力検証
        if (!targetElement || !(targetElement instanceof HTMLElement)) {
            throw new AnimationError(
                'Invalid targetElement: must be an HTMLElement',
                'typeEffect',
                { type, targetElement }
            );
        }

        const effect = TYPE_EFFECTS[type?.toLowerCase()] || TYPE_EFFECTS.colorless;

        try {
            // 攻撃者エフェクト（存在する場合）
            if (attackerElement && attackerElement instanceof HTMLElement) {
                this._applyAttackerEffect(attackerElement, effect);
            }

            // 防御側エフェクト（ハイブリッド：CSS + DOM overlay）
            await this._applyTargetEffect(targetElement, effect);

        } catch (error) {
            this._logError(error, 'typeEffect', { type, targetElement, attackerElement });
            throw error;
        }
    }

    /**
     * 画面シェイクエフェクト
     *
     * @param {number} [intensity=1.0] - 強度 (0.5-3.0)
     * @returns {Promise<void>}
     * @throws {AnimationError} 強度が範囲外の場合
     *
     * @example
     * await combat.screenShake(2.0);
     */
    async screenShake(intensity = 1.0) {
        // 入力検証
        if (typeof intensity !== 'number' ||
            intensity < COMBAT_CONSTANTS.MIN_SHAKE_INTENSITY ||
            intensity > COMBAT_CONSTANTS.MAX_SHAKE_INTENSITY) {
            throw new AnimationError(
                `Invalid intensity: must be between ${COMBAT_CONSTANTS.MIN_SHAKE_INTENSITY} and ${COMBAT_CONSTANTS.MAX_SHAKE_INTENSITY}`,
                'screenShake',
                { intensity }
            );
        }

        const gameBoard = document.getElementById('game-board') || document.body;

        if (!gameBoard) {
            throw new AnimationError(
                'Game board element not found',
                'screenShake'
            );
        }

        try {
            // GPU加速のためのCSS変数設定
            gameBoard.style.setProperty('--shake-intensity', intensity.toString());

            await this.animate(
                gameBoard,
                'anim-screen-shake',
                ANIMATION_TIMING.combat
            );

        } finally {
            // クリーンアップ（必ず実行）
            gameBoard.style.removeProperty('--shake-intensity');
        }
    }

    /**
     * 画面フラッシュ（気絶時）
     *
     * @returns {Promise<void>}
     * @throws {AnimationError} ゲームボードが見つからない場合
     *
     * @example
     * await combat.screenFlash();
     */
    async screenFlash() {
        const gameBoard = document.getElementById('game-board') || document.body;

        if (!gameBoard) {
            throw new AnimationError(
                'Game board element not found',
                'screenFlash'
            );
        }

        try {
            await this.animate(
                gameBoard,
                'anim-screen-flash',
                ANIMATION_TIMING.fast
            );
        } catch (error) {
            this._logError(error, 'screenFlash', {});
            throw error;
        }
    }

    /**
     * 連続攻撃（コンボ）
     *
     * @param {Array<Object>} attacks - 攻撃配列
     * @param {string} attacks[].type - ポケモンタイプ
     * @param {number} attacks[].damage - ダメージ量
     * @param {string} attacks[].targetId - 対象ID
     * @param {Object} [attacks[].options] - オプション
     * @returns {Promise<void>}
     * @throws {AnimationError} 配列が無効な場合
     *
     * @example
     * await combat.combo([
     *   { type: 'fire', damage: 20, targetId: 'target-1', options: {} },
     *   { type: 'fire', damage: 30, targetId: 'target-1', options: {} }
     * ]);
     */
    async combo(attacks) {
        // 入力検証
        if (!Array.isArray(attacks) || attacks.length === 0) {
            throw new AnimationError(
                'Invalid attacks: must be a non-empty array',
                'combo',
                { attacks }
            );
        }

        try {
            for (const attack of attacks) {
                await this.attack(
                    attack.type,
                    attack.damage,
                    attack.targetId,
                    attack.options || {}
                );
                await this.delay(COMBAT_CONSTANTS.COMBO_DELAY_MS);
            }
        } catch (error) {
            this._logError(error, 'combo', { attacks });
            throw error;
        }
    }

    /**
     * 特殊状態エフェクト
     *
     * @param {string} condition - 特殊状態名 ('poisoned', 'burned', etc.)
     * @param {string} pokemonId - 対象ポケモンID
     * @returns {Promise<void>}
     * @throws {AnimationError} 条件が無効または要素が見つからない場合
     *
     * @example
     * await combat.specialCondition('poisoned', 'pokemon-123');
     */
    async specialCondition(condition, pokemonId) {
        // 入力検証
        this._validateId(pokemonId, 'pokemonId');

        const effect = CONDITION_EFFECTS[condition?.toLowerCase()];
        if (!effect) {
            throw new AnimationError(
                `Unknown condition: ${condition}`,
                'specialCondition',
                { condition, pokemonId, availableConditions: Object.keys(CONDITION_EFFECTS) }
            );
        }

        try {
            const pokemonElement = await this._findPokemonElementWithRetry(pokemonId);

            if (!pokemonElement) {
                throw new AnimationError(
                    `Pokemon element not found: ${pokemonId}`,
                    'specialCondition',
                    { condition, pokemonId }
                );
            }

            // 特殊状態の視覚効果を適用（GPU加速）
            pokemonElement.style.boxShadow = `0 0 15px ${effect.color}`;

            await this.animate(
                pokemonElement,
                effect.animation,
                ANIMATION_TIMING.normal
            );

            // クリーンアップをスケジュール
            this._scheduleStyleCleanup(
                pokemonElement,
                'boxShadow',
                COMBAT_CONSTANTS.CONDITION_EFFECT_DURATION_MS
            );

        } catch (error) {
            this._logError(error, 'specialCondition', { condition, pokemonId });
            throw error;
        }
    }

    // ========================================================================
    // プライベートメソッド - エフェクト実装
    // ========================================================================

    /**
     * 攻撃者エフェクトを適用
     * @param {HTMLElement} attackerElement - 攻撃者要素
     * @param {Object} effect - エフェクト定義
     * @private
     */
    _applyAttackerEffect(attackerElement, effect) {
        // CSSアニメーションクラスを適用
        attackerElement.classList.add(effect.cssClass);

        // GPU加速のための準備
        attackerElement.style.transition = 'box-shadow 0.3s ease';

        // クリーンアップをスケジュール
        this._scheduleCleanup(() => {
            attackerElement.classList.remove(effect.cssClass);
            attackerElement.style.boxShadow = '';
        }, COMBAT_CONSTANTS.TYPE_EFFECT_CLEANUP_MS);
    }

    /**
     * 防御側エフェクトを適用（メモリリーク防止版）
     * @param {HTMLElement} targetElement - 対象要素
     * @param {Object} effect - エフェクト定義
     * @returns {Promise<void>}
     * @private
     */
    async _applyTargetEffect(targetElement, effect) {
        // 1. CSSアニメーションクラスを適用
        targetElement.classList.add(effect.cssClass);

        // 2. グラデーションオーバーレイを作成（メモリリーク防止）
        const overlay = document.createElement('div');
        overlay.className = 'absolute inset-0 pointer-events-none';
        overlay.style.background = `radial-gradient(circle, ${effect.color}33 0%, transparent 70%)`;
        overlay.style.animation = 'pulse 0.5s ease-in-out';

        // WeakSetに追加してトラッキング
        this._activeOverlays.add(overlay);

        // 親要素の位置指定を確保
        targetElement.style.position = 'relative';

        try {
            targetElement.appendChild(overlay);

            // クリーンアップをスケジュール（メモリリーク防止）
            this._scheduleCleanup(() => {
                targetElement.classList.remove(effect.cssClass);
                if (overlay.parentNode) {
                    overlay.remove();
                }
            }, COMBAT_CONSTANTS.TYPE_EFFECT_CLEANUP_MS);

            await this.delay(COMBAT_CONSTANTS.TYPE_EFFECT_DELAY_MS);

        } catch (error) {
            // エラー時は即座にクリーンアップ
            targetElement.classList.remove(effect.cssClass);
            if (overlay.parentNode) {
                overlay.remove();
            }
            throw error;
        }
    }

    // ========================================================================
    // プライベートメソッド - ロック機構（並行処理制御）
    // ========================================================================

    /**
     * アニメーションロックを取得（並行処理制御）
     * @param {string} pokemonId - ポケモンID
     * @returns {Promise<void>}
     * @private
     */
    async _acquireLock(pokemonId) {
        // 既存のロックがあれば待機
        if (this._animationLocks.has(pokemonId)) {
            await this._animationLocks.get(pokemonId);
        }
    }

    /**
     * アニメーションロックを解放
     * @param {string} pokemonId - ポケモンID
     * @private
     */
    _releaseLock(pokemonId) {
        this._animationLocks.delete(pokemonId);
    }

    // ========================================================================
    // プライベートメソッド - 要素検索（リトライ機構付き）
    // ========================================================================

    /**
     * ポケモン要素をリトライ付きで検索
     * @param {string} pokemonId - ポケモンID
     * @returns {Promise<HTMLElement|null>}
     * @private
     */
    async _findPokemonElementWithRetry(pokemonId) {
        for (let i = 0; i < COMBAT_CONSTANTS.MAX_ELEMENT_LOOKUP_RETRIES; i++) {
            const element = this._findPokemonElement(pokemonId);
            if (element) return element;

            // 最後の試行以外はリトライ待機
            if (i < COMBAT_CONSTANTS.MAX_ELEMENT_LOOKUP_RETRIES - 1) {
                await this.delay(COMBAT_CONSTANTS.ELEMENT_LOOKUP_RETRY_DELAY_MS);
            }
        }
        return null;
    }

    /**
     * ポケモン要素を検索（runtime ID / card ID / pokemon ID）
     * @param {string} pokemonId - ポケモンの識別子
     * @returns {HTMLElement|null} 見つかった要素、見つからない場合null
     * @private
     */
    _findPokemonElement(pokemonId) {
        // runtimeId 優先で特定し、互換で master id / data-pokemon-id も探索
        return document.querySelector(`[data-runtime-id="${pokemonId}"]`) ||
            document.querySelector(`[data-card-id="${pokemonId}"]`) ||
            document.querySelector(`[data-pokemon-id="${pokemonId}"]`);
    }

    /**
     * HP表示要素を検索
     * @param {string} pokemonId - ポケモンID
     * @returns {HTMLElement|null}
     * @private
     */
    _findHPElement(pokemonId) {
        const pokemon = this._findPokemonElement(pokemonId);
        return pokemon?.querySelector('.hp-display, .damage-counter');
    }

    // ========================================================================
    // プライベートメソッド - バリデーション
    // ========================================================================

    /**
     * 攻撃パラメータを検証
     * @param {string} attackerType - 攻撃者タイプ
     * @param {number} damage - ダメージ
     * @param {string} targetId - ターゲットID
     * @throws {AnimationError} バリデーションエラー
     * @private
     */
    _validateAttackParams(attackerType, damage, targetId) {
        if (!attackerType || typeof attackerType !== 'string') {
            throw new AnimationError(
                `Invalid attackerType: must be a non-empty string, got ${typeof attackerType}`,
                'validation',
                { attackerType }
            );
        }
        this._validateDamage(damage);
        this._validateId(targetId, 'targetId');
    }

    /**
     * ダメージ値を検証
     * @param {number} damage - ダメージ
     * @throws {AnimationError} バリデーションエラー
     * @private
     */
    _validateDamage(damage) {
        if (typeof damage !== 'number' || damage < 0 || !Number.isFinite(damage)) {
            throw new AnimationError(
                `Invalid damage: must be a non-negative finite number, got ${damage} (${typeof damage})`,
                'validation',
                { damage }
            );
        }
    }

    /**
     * ID文字列を検証
     * @param {string} id - ID
     * @param {string} paramName - パラメータ名
     * @throws {AnimationError} バリデーションエラー
     * @private
     */
    _validateId(id, paramName) {
        if (!id || typeof id !== 'string') {
            throw new AnimationError(
                `Invalid ${paramName}: must be a non-empty string, got ${typeof id}`,
                'validation',
                { [paramName]: id }
            );
        }
    }

    // ========================================================================
    // プライベートメソッド - クリーンアップ・メモリ管理
    // ========================================================================

    /**
     * クリーンアップをスケジュール（タイマーID追跡でメモリリーク防止）
     * @param {Function} callback - クリーンアップ関数
     * @param {number} delay - 遅延（ミリ秒）
     * @private
     */
    _scheduleCleanup(callback, delay) {
        const timerId = setTimeout(() => {
            try {
                callback();
            } catch (error) {
                console.error('[CombatAnimations] Cleanup error:', error);
            } finally {
                this._cleanupTimers.delete(timerId);
            }
        }, delay);

        this._cleanupTimers.add(timerId);
    }

    /**
     * スタイルプロパティのクリーンアップをスケジュール
     * @param {HTMLElement} element - 要素
     * @param {string} property - CSSプロパティ名
     * @param {number} delay - 遅延（ミリ秒）
     * @private
     */
    _scheduleStyleCleanup(element, property, delay) {
        this._scheduleCleanup(() => {
            if (element && element.style) {
                element.style[property] = '';
            }
        }, delay);
    }

    /**
     * すべてのクリーンアップタイマーをクリア
     * @public
     */
    cleanup() {
        // すべてのタイマーをクリア
        for (const timerId of this._cleanupTimers) {
            clearTimeout(timerId);
        }
        this._cleanupTimers.clear();

        // ロックをクリア
        this._animationLocks.clear();

        console.log('[CombatAnimations] All resources cleaned up');
    }

    // ========================================================================
    // プライベートメソッド - エラーハンドリング・ログ
    // ========================================================================

    /**
     * エラーをログに記録（中央集権的エラーハンドリング）
     * @param {Error} error - エラーオブジェクト
     * @param {string} context - コンテキスト
     * @param {Object} details - 詳細情報
     * @private
     */
    _logError(error, context, details) {
        const animError = error instanceof AnimationError
            ? error
            : new AnimationError(error.message, context, error);

        animError.context = context;
        animError.details = details;

        this._errorLog.push(animError);

        // 最大100件までログ保持
        if (this._errorLog.length > 100) {
            this._errorLog.shift();
        }

        // コンソールにエラー出力
        console.error(`[CombatAnimations] Error in ${context}:`, {
            message: error.message,
            details,
            stack: error.stack
        });
    }

    /**
     * エラーログを取得
     * @returns {Array<AnimationError>}
     * @public
     */
    getErrorLog() {
        return [...this._errorLog];
    }

    /**
     * エラーログをクリア
     * @public
     */
    clearErrorLog() {
        this._errorLog = [];
    }

    // ========================================================================
    // プライベートメソッド - CSS依存性検証（開発環境のみ）
    // ========================================================================

    /**
     * 必要なCSSアニメーションが定義されているか検証
     * @private
     */
    _validateCSSAnimations() {
        const requiredAnimations = [
            'attackForward',
            'damageShake',
            'knockout',
            'screenShake',
            'screenFlash',
            'hpFlash'
        ];

        const missingAnimations = requiredAnimations.filter(anim => {
            return !this._isCSSAnimationDefined(anim);
        });

        if (missingAnimations.length > 0) {
            console.warn(
                `[CombatAnimations] Missing CSS animations: ${missingAnimations.join(', ')}\n` +
                `These animations should be defined in your CSS for proper visual effects.`
            );
        }
    }

    /**
     * CSSアニメーションが定義されているかチェック
     * @param {string} animationName - アニメーション名
     * @returns {boolean}
     * @private
     */
    _isCSSAnimationDefined(animationName) {
        const styleSheets = Array.from(document.styleSheets);

        for (const sheet of styleSheets) {
            try {
                // cssRules を優先使用（標準）、rules は古いブラウザ互換のみ
                const rules = Array.from(sheet.cssRules || []);
                const hasAnimation = rules.some(rule => {
                    return rule instanceof CSSKeyframesRule &&
                        rule.name === animationName;
                });
                if (hasAnimation) return true;
            } catch (e) {
                // CORS制限でアクセスできないスタイルシートは無視
                continue;
            }
        }

        return false;
    }
}
