/**
 * デバッグログシステム
 * 環境に応じてログを制御する統一インターフェース
 */

// 環境判定
const isDevelopment = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
const isDebugEnabled = typeof window !== 'undefined' && window.DEBUG_MODE === true;

/**
 * ロガークラス
 */
export class Logger {
    constructor(moduleName = '') {
        this.moduleName = moduleName;
        this.enabled = isDevelopment || isDebugEnabled;
    }

    /**
     * デバッグログ（開発環境のみ）
     */
    debug(...args) {
        if (this.enabled) {
            console.log(`[DEBUG:${this.moduleName}]`, ...args);
        }
    }

    /**
     * 情報ログ
     */
    info(...args) {
        if (this.enabled) {
            console.log(`[INFO:${this.moduleName}]`, ...args);
        }
    }

    /**
     * 警告ログ（常に表示）
     */
    warn(...args) {
        console.warn(`[WARN:${this.moduleName}]`, ...args);
    }

    /**
     * エラーログ（常に表示）
     */
    error(...args) {
        console.error(`[ERROR:${this.moduleName}]`, ...args);
    }

    /**
     * グループログ（開発環境のみ）
     */
    group(label, callback) {
        if (this.enabled) {
            console.group(`[${this.moduleName}] ${label}`);
            callback();
            console.groupEnd();
        }
    }

    /**
     * テーブルログ（開発環境のみ）
     */
    table(data) {
        if (this.enabled) {
            console.table(data);
        }
    }

    /**
     * パフォーマンスログ
     */
    time(label) {
        if (this.enabled) {
            console.time(`[${this.moduleName}] ${label}`);
        }
    }

    timeEnd(label) {
        if (this.enabled) {
            console.timeEnd(`[${this.moduleName}] ${label}`);
        }
    }
}

/**
 * グローバルロガーインスタンスを作成
 */
export function createLogger(moduleName) {
    return new Logger(moduleName);
}

// デフォルトロガー
export const logger = new Logger('Game');

// グローバルに公開（デバッグ用）
if (typeof window !== 'undefined') {
    window.PokemonCardGame = window.PokemonCardGame || {};
    window.PokemonCardGame.Logger = Logger;
    window.PokemonCardGame.createLogger = createLogger;
}
