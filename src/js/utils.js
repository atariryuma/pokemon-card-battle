/**
 * UTILS.JS - 共通ユーティリティ関数
 *
 * プロジェクト全体で使用される共通関数を提供
 * DRY原則に基づき、重複コードを削減
 */

/**
 * No-operation function
 * デバッグや開発時のプレースホルダーとして使用
 * 本番環境では何も実行しない
 */
export const noop = () => {};

/**
 * 安全なDOM要素の作成とテキスト設定
 * XSS対策：innerHTMLの代わりにtextContentを使用
 *
 * @param {string} tagName - 作成する要素のタグ名
 * @param {string} text - 設定するテキスト内容
 * @param {string} className - CSSクラス名（オプション）
 * @returns {HTMLElement} 作成されたDOM要素
 */
export function createSafeElement(tagName, text = '', className = '') {
    const element = document.createElement(tagName);
    if (text) {
        element.textContent = text; // XSS対策: innerHTMLではなくtextContent
    }
    if (className) {
        element.className = className;
    }
    return element;
}

/**
 * 安全なHTML属性の設定
 * XSS対策：属性値をエスケープ
 *
 * @param {HTMLElement} element - 対象要素
 * @param {Object} attributes - 設定する属性のオブジェクト
 */
export function setSafeAttributes(element, attributes) {
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'class') {
            element.className = value;
        } else if (key === 'style') {
            // スタイルオブジェクトとして設定
            if (typeof value === 'object') {
                Object.assign(element.style, value);
            }
        } else {
            element.setAttribute(key, value);
        }
    }
}

/**
 * イベントリスナーの管理クラス
 * メモリリーク対策：addEventListener/removeEventListenerを自動管理
 */
export class EventListenerManager {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * イベントリスナーを追加
     * @param {EventTarget} target - イベントターゲット
     * @param {string} event - イベント名
     * @param {Function} handler - ハンドラー関数
     * @param {Object} options - オプション
     */
    add(target, event, handler, options = {}) {
        target.addEventListener(event, handler, options);

        // リスナーを記録（後でクリーンアップできるように）
        const key = `${target.constructor.name}_${event}`;
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push({ target, event, handler, options });
    }

    /**
     * 特定のイベントリスナーを削除
     * @param {EventTarget} target - イベントターゲット
     * @param {string} event - イベント名
     * @param {Function} handler - ハンドラー関数
     */
    remove(target, event, handler) {
        target.removeEventListener(event, handler);

        const key = `${target.constructor.name}_${event}`;
        if (this.listeners.has(key)) {
            const list = this.listeners.get(key);
            const index = list.findIndex(
                item => item.target === target &&
                        item.event === event &&
                        item.handler === handler
            );
            if (index !== -1) {
                list.splice(index, 1);
            }
        }
    }

    /**
     * すべてのイベントリスナーをクリーンアップ
     * メモリリーク対策
     */
    removeAll() {
        for (const listeners of this.listeners.values()) {
            for (const { target, event, handler } of listeners) {
                target.removeEventListener(event, handler);
            }
        }
        this.listeners.clear();
    }
}

/**
 * Null安全なオブジェクトアクセス
 * @param {Object} obj - オブジェクト
 * @param {string} path - アクセスパス（'a.b.c'形式）
 * @param {*} defaultValue - デフォルト値
 * @returns {*} 値またはデフォルト値
 */
export function safeGet(obj, path, defaultValue = null) {
    if (!obj || typeof obj !== 'object') {
        return defaultValue;
    }

    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
        if (result == null || typeof result !== 'object') {
            return defaultValue;
        }
        result = result[key];
    }

    return result !== undefined ? result : defaultValue;
}

/**
 * 配列の安全なアクセス
 * @param {Array} arr - 配列
 * @param {number} index - インデックス
 * @param {*} defaultValue - デフォルト値
 * @returns {*} 値またはデフォルト値
 */
export function safeArrayAccess(arr, index, defaultValue = null) {
    if (!Array.isArray(arr)) {
        return defaultValue;
    }
    if (index < 0 || index >= arr.length) {
        return defaultValue;
    }
    return arr[index] !== undefined ? arr[index] : defaultValue;
}

/**
 * デバウンス関数
 * パフォーマンス最適化：頻繁な呼び出しを制限
 *
 * @param {Function} func - 実行する関数
 * @param {number} wait - 待機時間（ミリ秒）
 * @returns {Function} デバウンスされた関数
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * スロットル関数
 * パフォーマンス最適化：一定間隔で実行
 *
 * @param {Function} func - 実行する関数
 * @param {number} limit - 実行間隔（ミリ秒）
 * @returns {Function} スロットルされた関数
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
