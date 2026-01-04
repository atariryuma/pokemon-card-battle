/**
 * ゲーム全体の設定値統一管理
 * マジックナンバーを排除し、設定値を一元管理
 */

export const GAME_CONFIG = {
    // デッキ・カード関連
    DECK: {
        INITIAL_DRAW: 7,           // 初期手札枚数
        PRIZE_CARDS: 6,            // サイドカード枚数
        MAX_BENCH_SIZE: 5,         // ベンチの最大サイズ
    },

    // 手札関連
    HAND: {
        MAX_SIZE: 10,              // 手札の上限枚数
        NEAR_LIMIT_WARNING_AT: 8,  // 警告を表示する枚数（8枚）
        LIMIT_WARNING_AT: 9,       // 限界警告を表示する枚数（9枚）
    },

    // メモリ管理
    MEMORY: {
        CACHE_MAX_SIZE: 100,       // DOMキャッシュの最大サイズ
        CACHE_RETAIN_SIZE: 50,     // クリーンアップ後に残すサイズ
        RENDER_QUEUE_MAX: 20,      // レンダリングキューの最大サイズ
    },

    // メンテナンス
    MAINTENANCE: {
        INTERVAL_MS: 30000,        // メンテナンス実行間隔（30秒）
        MEMORY_WARNING_THRESHOLD: 0.8,  // メモリ警告閾値（80%）
    },

    // CPU思考時間
    CPU_THINKING: {
        MIN: 500,                  // 最小思考時間（ms）
        MAX: 1500,                 // 最大思考時間（ms）
        MULLIGAN: 600,             // マリガン時の思考時間（ms）
        PRIZE_SELECTION: 800,      // サイド選択時の思考時間（ms）
    },

    // UI定数（view.js Mac Dockエフェクト用）
    UI: {
        DOCK_RADIUS_MAX: 220,      // Mac Dockエフェクトの最大半径
        DOCK_RADIUS_RATIO: 0.25,   // 画面幅に対する比率
        DOCK_MAX_SCALE: 1.4,       // 最大スケール
        DOCK_MAX_LIFT: 80,         // 最大持ち上げ量
        DOCK_LIFT_RATIO: 0.08,     // 画面幅に対する比率
    },
};
