/**
 * ANIMATION CONSTANTS - アニメーション定数の統合
 * 
 * すべてのアニメーション関連定数を一箇所に集約
 */

// ============================================================================
// タイミング定数
// ============================================================================

export const ANIMATION_TIMING = {
    fast: 200,
    normal: 400,
    slow: 800,
    combat: 600
};

// ============================================================================
// イージング定数
// ============================================================================

export const ANIMATION_EASING = {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
};

// ============================================================================
// 戦闘アニメーション定数
// ============================================================================

export const COMBAT_CONSTANTS = Object.freeze({
    // ダメージ計算
    DAMAGE_INTENSITY_DIVISOR: 50,
    MIN_SHAKE_INTENSITY: 0.5,
    MAX_SHAKE_INTENSITY: 3.0,
    SCREEN_SHAKE_THRESHOLD: 30,

    // タイミング（ミリ秒）
    ATTACK_DELAY_MS: 200,
    DAMAGE_DURATION_MS: 400,
    KNOCKOUT_DELAY_MS: 500,
    TYPE_EFFECT_DELAY_MS: 300,

    // DOM検索の最大リトライ回数
    MAX_ELEMENT_LOOKUP_RETRIES: 3,
    ELEMENT_LOOKUP_RETRY_DELAY_MS: 50
});

// ============================================================================
// ポケモンタイプ別エフェクト定義
// ============================================================================

export const TYPE_EFFECTS = Object.freeze({
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
    grass: Object.freeze({
        color: '#44ff44',
        effect: 'leaf',
        cssClass: 'anim-type-grass'
    }),
    lightning: Object.freeze({
        color: '#ffff44',
        effect: 'thunder',
        cssClass: 'anim-type-lightning'
    }),
    psychic: Object.freeze({
        color: '#ff44ff',
        effect: 'psychic',
        cssClass: 'anim-type-psychic'
    }),
    fighting: Object.freeze({
        color: '#ff8844',
        effect: 'punch',
        cssClass: 'anim-type-fighting'
    }),
    darkness: Object.freeze({
        color: '#444444',
        effect: 'shadow',
        cssClass: 'anim-type-darkness'
    }),
    metal: Object.freeze({
        color: '#888888',
        effect: 'steel',
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

// ============================================================================
// 特殊状態エフェクト定義
// ============================================================================

export const CONDITION_EFFECTS = Object.freeze({
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
        color: '#ffc107',
        animation: 'anim-condition-paralyze'
    }),
    confused: Object.freeze({
        color: '#9e9e9e',
        animation: 'anim-condition-confuse'
    })
});

// ============================================================================
// エネルギーカラー定数
// ============================================================================

export const ENERGY_COLORS = Object.freeze({
    fire: '#ff4444',
    water: '#4285f4',
    grass: '#34a853',
    lightning: '#fbbc04',
    psychic: '#9c27b0',
    fighting: '#ff6d00',
    darkness: '#424242',
    metal: '#607d8b',
    colorless: '#9e9e9e'
});

// ============================================================================
// カード移動アニメーション定数
// ============================================================================

export const CARD_ANIMATION_CONSTANTS = Object.freeze({
    // 配布アニメーション
    DEAL_STAGGER_DELAY: 80,
    DEAL_FADE_DURATION: 300,
    DEAL_FLIP_DURATION: 500,

    // ドローアニメーション  
    DRAW_DURATION: 600,
    DRAW_SCALE_UP: 1.05,
    DRAW_ROTATION: 3,

    // 振動フィードバック
    VIBRATION_DURATION: 50
});
