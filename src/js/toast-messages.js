/**
 * TOAST-MESSAGES.JS - トースト通知メッセージ定義
 * 
 * ポケモンカードゲームにおける警告・エラーメッセージの定数定義
 * 黄色（警告）と赤色（エラー）のメッセージを管理
 */

/**
 * 警告メッセージ（黄色）- 推奨されない行動への注意喚起
 */
export const WARNING_MESSAGES = {
    // エネルギー関連
    ENERGY_NOT_ATTACHED: 'まだエネルギーを付けることができます',
    INSUFFICIENT_ENERGY: 'このわざには十分なエネルギーがありません',
    RETREAT_COST_INSUFFICIENT: 'にげるコストが足りません',
    
    // ポケモン関連
    NO_BENCH_POKEMON: 'ベンチにポケモンがいません',
    BENCH_FULL: 'ベンチがいっぱいです（最大5匹）',
    NO_EVOLUTION_TARGET: '進化できるポケモンがいません',
    
    // 手札関連
    HAND_LIMIT_EXCEEDED: '手札の上限を超えています',
    NO_CARDS_IN_HAND: '手札にカードがありません',
    HAND_NEAR_LIMIT_8: '手札が上限に近づいています（8/10枚）',
    HAND_NEAR_LIMIT_9: '手札が上限に近づいています（9/10枚）',
    
    // 行動関連
    BETTER_ACTION_AVAILABLE: 'より効果的な行動があります',
    CONSIDER_STRATEGY: '戦略を見直すことをおすすめします',
    ALREADY_DRAWN_CARD: 'このターンはすでにカードを引いています',
    ALREADY_RETREATED: 'このターンはすでににげました',
    OPPONENT_POKEMON_FAINTED: '相手のポケモンがきぜつしています',
    
    // その他
    DECK_LOW: '山札の残りが少なくなっています',
    PRIZE_ADVANTAGE: 'サイドカードで有利な状況です'
};

/**
 * エラーメッセージ（赤色）- 禁止行為・ルール違反
 */
export const ERROR_MESSAGES = {
    // ターン制限
    NOT_YOUR_TURN: '相手のターンです',
    ALREADY_ATTACHED_ENERGY: '1ターンに1枚しかエネルギーを付けられません',
    ALREADY_EVOLVED: 'このターンは既に進化しました',
    
    // 行動不可
    ACTION_NOT_ALLOWED: 'この行動はできません',
    INVALID_TARGET: '無効な対象です',
    NO_ACTIVE_POKEMON: 'バトルポケモンがいないため、あなたの負けです。',
    
    // カード制限
    NO_DECK_CARDS: '山札がありません',
    CANNOT_RETREAT_FIRST_TURN: '1ターン目は逃げることができません',
    CARD_NOT_IN_HAND: 'そのカードは手札にありません',
    HAND_AT_LIMIT: '手札が上限です。これ以上ドローできません（10/10枚）',
    CANNOT_DRAW_HAND_FULL: '手札が満杯のためカード獲得はできません',

    // 選択ミス
    DECK_NOT_SELECTED: '山札をクリックしてカードを引いてください',
    ENERGY_SELECTED_NO_TARGET: 'エネルギーを選びましたが、ポケモンを選んでいません',
    INVALID_INITIAL_POKEMON: '最初に出せるのはたねポケモンだけです',
    
    // 状態異常
    POKEMON_ASLEEP: 'ポケモンが『ねむり』状態のため行動できません',
    POKEMON_PARALYZED: 'ポケモンが『マヒ』状態のため攻撃できません',
    
    // ルール違反
    RULE_VIOLATION: 'ルールに違反しています',
    GAME_OVER: 'ゲームが終了しています',
    
    // システムエラー
    SYSTEM_ERROR: 'システムエラーが発生しました',
    NETWORK_ERROR: '通信エラーが発生しました'
};

/**
 * トースト表示用のヘルパー関数
 */
export class ToastMessenger {
    constructor(modalManager) {
        this.modalManager = modalManager;
    }

    /**
     * 警告メッセージを表示（黄色）
     * @param {string} messageKey - WARNING_MESSAGESのキー
     * @param {Object} options - 追加オプション
     */
    showWarning(messageKey, options = {}) {
        const message = WARNING_MESSAGES[messageKey] || messageKey;
        this.modalManager.showToast({
            message,
            type: 'warning',
            duration: options.duration || 4000,
            ...options
        });
    }

    /**
     * エラーメッセージを表示（赤色）
     * @param {string} messageKey - ERROR_MESSAGESのキー
     * @param {Object} options - 追加オプション
     */
    showError(messageKey, options = {}) {
        const message = ERROR_MESSAGES[messageKey] || messageKey;
        this.modalManager.showToast({
            message,
            type: 'error',
            duration: options.duration || 5000,
            ...options
        });
    }

    /**
     * カスタムメッセージを表示
     * @param {string} message - カスタムメッセージ
     * @param {string} type - 'warning' or 'error'
     * @param {Object} options - 追加オプション
     */
    showCustom(message, type = 'warning', options = {}) {
        this.modalManager.showToast({
            message,
            type,
            duration: type === 'error' ? 5000 : 4000,
            ...options
        });
    }

    /**
     * ポケモンカードゲーム専用メッセージ
     */
    
    // エネルギー付与制限
    energyLimitReached() {
        this.showError('ALREADY_ATTACHED_ENERGY');
    }

    // 相手のターン警告
    notPlayerTurn() {
        this.showError('NOT_YOUR_TURN');
    }

    // 攻撃制限
    insufficientEnergyForAttack(attackName) {
        this.showWarning('INSUFFICIENT_ENERGY');
    }

    // 逃げる制限
    cannotRetreat() {
        this.showWarning('RETREAT_COST_INSUFFICIENT');
    }

    // ベンチ関連
    benchFull() {
        this.showWarning('BENCH_FULL');
    }

    noBenchPokemon() {
        this.showWarning('NO_BENCH_POKEMON');
    }

    // 山札関連
    deckEmpty() {
        this.showError('NO_DECK_CARDS');
    }

    deckLow() {
        this.showWarning('DECK_LOW');
    }

    // 状態異常
    pokemonCannotAct(condition) {
        if (condition === 'sleep') {
            this.showError('POKEMON_ASLEEP');
        } else if (condition === 'paralysis') {
            this.showError('POKEMON_PARALYZED');
        }
    }

    // 一般的な禁止行為
    actionNotAllowed() {
        this.showError('ACTION_NOT_ALLOWED');
    }

    // 戦略的アドバイス
    suggestBetterAction() {
        this.showWarning('BETTER_ACTION_AVAILABLE');
    }
}

// メッセージ候補を分類でエクスポート
export const TOAST_MESSAGE_CATEGORIES = {
    ENERGY: {
        warnings: [
            'ENERGY_NOT_ATTACHED',
            'INSUFFICIENT_ENERGY', 
            'RETREAT_COST_INSUFFICIENT'
        ],
        errors: [
            'ALREADY_ATTACHED_ENERGY',
            'ENERGY_SELECTED_NO_TARGET'
        ]
    },
    POKEMON: {
        warnings: [
            'NO_BENCH_POKEMON',
            'BENCH_FULL',
            'NO_EVOLUTION_TARGET'
        ],
        errors: [
            'NO_ACTIVE_POKEMON',
            'POKEMON_ASLEEP',
            'POKEMON_PARALYZED',
            'INVALID_INITIAL_POKEMON'
        ]
    },
    TURN: {
        warnings: [],
        errors: [
            'NOT_YOUR_TURN',
            'ALREADY_EVOLVED'
        ]
    },
    DECK: {
        warnings: [
            'DECK_LOW'
        ],
        errors: [
            'NO_DECK_CARDS',
            'DECK_NOT_SELECTED'
        ]
    }
};
