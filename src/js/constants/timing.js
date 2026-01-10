/**
 * アニメーションとタイミング定数の統一管理
 * 全てのミリ秒単位の遅延値をここで定義
 */

export const ANIMATION_TIMING = {
    // カード移動アニメーション
    CARD_MOVE: 400,                    // カード移動の基本時間
    CARD_FLIP: 600,                    // カードフリップ時間
    CARD_TO_ACTIVE: 400,               // 手札→アクティブ
    CARD_TO_BENCH: 400,                // 手札→ベンチ

    // 攻撃アニメーション
    ATTACK: 400,                       // 攻撃アニメーション
    DAMAGE: 500,                       // ダメージエフェクト
    HP_FLASH: 400,                     // HPフラッシュ
    KNOCKOUT: 800,                     // 気絶アニメーション

    // エネルギー・進化
    ENERGY_ATTACH: 600,                // エネルギー付与
    EVOLUTION: 800,                    // 進化アニメーション

    // セットアップフェーズ
    SHUFFLE_INTERVAL: 100,             // シャッフルシェイク間隔
    SHUFFLE_COUNT: 6,                  // シャッフルシェイク回数
    HAND_DEAL_INTERVAL: 800,           // 手札配布間隔
    PRIZE_DEAL_INTERVAL: 600,          // サイド配布間隔

    // CPU自動操作
    CPU_INITIAL_DELAY: 1500,           // CPU初期セットアップ開始前の遅延
    CPU_FULL_SETUP_DELAY: 1000,        // CPUフルセットアップ前の遅延
    CPU_CARD_PLACEMENT_INTERVAL: 1200, // CPUカード配置間隔
    CPU_DECISION_DELAY: 100,           // CPU判断処理の短い遅延

    // UI更新
    RENDER_DEBOUNCE: 16,               // レンダリングdebounce (1 frame)
    BUTTON_UPDATE_DELAY: 1500,         // ボタン更新遅延
    MESSAGE_DISPLAY: 300,              // メッセージ表示遅延

    // 画面エフェクト
    SCREEN_SHAKE: 300,                 // 画面シェイク時間
    SCREEN_FLASH: 200,                 // 画面フラッシュ時間

    // システム
    ERROR_RECOVERY_DELAY: 500,         // エラー復旧待機時間
    STATE_UPDATE_BUFFER: 100,          // 状態更新バッファ
};

export const SHAKE_CONFIG = {
    AMPLITUDE: 6,                      // シェイク振幅（ピクセル）
    COUNT: 6,                          // シェイク回数
    INTERVAL: 100,                     // シェイク間隔（ms）
};

export const MULLIGAN_CONFIG = {
    MAX_COUNT: 3,                      // マリガン最大回数
};

export const DOM_VERIFICATION = {
    MAX_ATTEMPTS: 20,                  // DOM要素準備確認の最大リトライ回数
    RETRY_INTERVAL: 50,                // リトライ間隔（ms）
};
