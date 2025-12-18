/**
 * UI要素のID定数管理
 * 全システムで統一的に使用される
 */

// ボタンID定数 (フローティングHUDシステム)
export const BUTTON_IDS = {
    // アクションボタン（フローティング版）
    RETREAT: 'retreat-button-float',
    ATTACK: 'attack-button-float',
    EVOLVE: 'evolve-button-float',
    END_TURN: 'end-turn-button-float',
    
    // セットアップフェーズボタン (フローティング版)
    CONFIRM_SETUP: 'confirm-setup-button-float',
    CONFIRM_INITIAL_POKEMON: 'confirm-setup-button-float',
    
    // ゲーム開始関連ボタン
    START_GAME: 'start-game-button-float',
    CARD_EDITOR: 'card-editor-button-float',
    
    // その他のUI要素
    ACTION_MODAL_OK: 'action-modal-ok',
    ACTION_MODAL_CANCEL: 'action-modal-cancel'
};

// コンテナID定数
export const CONTAINER_IDS = {
    // フローティングアクションHUDコンテナ
    FLOATING_ACTION_HUD: 'floating-action-hud',
    
    // 動的ボタンコンテナ
    PLAYER_ACTION_BUTTONS: 'player-action-buttons',
    
    // その他のコンテナ
    ACTION_MODAL: 'action-modal',
    GAME_MESSAGE_DISPLAY: 'game-message-display',
    
    // プレイヤーエリア
    PLAYER_HAND: 'player-hand',
    CPU_HAND: 'cpu-hand',
    PLAYER_BOARD: 'player-board',
    CPU_BOARD: 'cpu-board',
    
    // ゲームステータス
    GAME_STATUS_PANEL: 'game-status-panel',
    PHASE_INDICATOR: 'phase-indicator',
    TURN_INDICATOR: 'turn-indicator',
    CURRENT_PLAYER: 'current-player'
};

// ボタン表示用の配列定数
export const ACTION_BUTTON_GROUPS = {
    // 初期状態（ゲーム開始前）
    INITIAL: [
        BUTTON_IDS.START_GAME,
        BUTTON_IDS.CARD_EDITOR
    ],
    
    // セットアップフェーズで表示するボタン
    SETUP: [
        BUTTON_IDS.CONFIRM_SETUP
    ],
    
    // ゲーム開始準備完了
    GAME_START_READY: [
        BUTTON_IDS.START_GAME
    ],
    
    // プレイヤーメインフェーズで表示するボタン
    PLAYER_MAIN: [
        BUTTON_IDS.RETREAT,
        BUTTON_IDS.ATTACK,
        BUTTON_IDS.EVOLVE,
        BUTTON_IDS.END_TURN
    ],
    
    // 初期ポケモン選択で表示するボタン
    INITIAL_POKEMON: [
        BUTTON_IDS.CONFIRM_INITIAL_POKEMON
    ]
};

// フェーズ別ボタン設定
export const PHASE_BUTTON_CONFIG = {
    initial: {
        buttons: ACTION_BUTTON_GROUPS.INITIAL,
        defaultText: {
            [BUTTON_IDS.START_GAME]: '手札を7枚引く',
            [BUTTON_IDS.CARD_EDITOR]: 'カードエディタ'
        },
        defaultIcon: {
            [BUTTON_IDS.START_GAME]: '🎴',
            [BUTTON_IDS.CARD_EDITOR]: '🎴'
        }
    },
    setup: {
        buttons: ACTION_BUTTON_GROUPS.SETUP,
        defaultText: {
            [BUTTON_IDS.CONFIRM_SETUP]: 'ポケモン配置を確定'
        },
        defaultIcon: {
            [BUTTON_IDS.CONFIRM_SETUP]: '✅'
        }
    },
    gameStart: {
        buttons: ACTION_BUTTON_GROUPS.GAME_START_READY,
        defaultText: {
            [BUTTON_IDS.START_GAME]: 'ゲームスタート'
        },
        defaultIcon: {
            [BUTTON_IDS.START_GAME]: '🎮'
        }
    },
    playerMain: {
        buttons: ACTION_BUTTON_GROUPS.PLAYER_MAIN,
        defaultText: {
            [BUTTON_IDS.RETREAT]: 'にげる',
            [BUTTON_IDS.ATTACK]: '攻撃',
            [BUTTON_IDS.EVOLVE]: '進化',
            [BUTTON_IDS.END_TURN]: 'ターン終了'
        },
        defaultIcon: {
            [BUTTON_IDS.RETREAT]: '🏃',
            [BUTTON_IDS.ATTACK]: '⚔️',
            [BUTTON_IDS.EVOLVE]: '🔄',
            [BUTTON_IDS.END_TURN]: '➡️'
        }
    }
};

// CSS クラス名定数
export const CSS_CLASSES = {
    HIDDEN: 'hidden',
    VISIBLE: 'visible',
    DISABLED: 'disabled',
    ACTIVE: 'active',
    
    // ボタンスタイル
    BUTTON_PRIMARY: 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg text-sm',
    BUTTON_SECONDARY: 'px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg shadow-lg text-sm',
    BUTTON_SUCCESS: 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg text-sm',
    BUTTON_WARNING: 'px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg shadow-lg text-sm',
    BUTTON_DANGER: 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg text-sm'
};