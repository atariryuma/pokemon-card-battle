/**
 * MEMORY-MANAGER.JS - メモリとパフォーマンス管理システム
 *
 * タイマー、DOM要素、イベントリスナーの一元管理でメモリリークを防止
 */

import { noop } from './utils.js';

/**
 * メモリ効率管理クラス
 */
export class MemoryManager {
    constructor() {
        this.timers = new Set();           // setTimeout/setInterval の管理
        this.animationFrames = new Set();  // requestAnimationFrame の管理
        this.eventListeners = new WeakMap(); // イベントリスナーの管理
        this.domElements = new Set();       // 一時DOM要素の管理
        this.initialized = false;
    }

    /**
     * 初期化
     */
    init() {
        if (this.initialized) return;
        
        // ページアンロード時の自動クリーンアップ
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        this.initialized = true;
        noop('🧹 MemoryManager initialized');
    }

    /**
     * 管理付きsetTimeout
     * @param {Function} callback 
     * @param {number} delay 
     * @returns {number} timer ID
     */
    setTimeout(callback, delay) {
        const timerId = setTimeout(() => {
            // 実行後に自動的にSetから削除
            this.timers.delete(timerId);
            callback();
        }, delay);
        
        this.timers.add(timerId);
        return timerId;
    }

    /**
     * 管理付きsetInterval
     * @param {Function} callback 
     * @param {number} interval 
     * @returns {number} timer ID
     */
    setInterval(callback, interval) {
        const timerId = setInterval(callback, interval);
        this.timers.add(timerId);
        return timerId;
    }

    /**
     * 管理付きrequestAnimationFrame
     * @param {Function} callback 
     * @returns {number} frame ID
     */
    requestAnimationFrame(callback) {
        const frameId = requestAnimationFrame(() => {
            // 実行後に自動的にSetから削除
            this.animationFrames.delete(frameId);
            callback();
        });
        
        this.animationFrames.add(frameId);
        return frameId;
    }

    /**
     * タイマーのクリア
     * @param {number} timerId 
     */
    clearTimeout(timerId) {
        clearTimeout(timerId);
        this.timers.delete(timerId);
    }

    /**
     * インターバルのクリア
     * @param {number} timerId 
     */
    clearInterval(timerId) {
        clearInterval(timerId);
        this.timers.delete(timerId);
    }

    /**
     * アニメーションフレームのキャンセル
     * @param {number} frameId 
     */
    cancelAnimationFrame(frameId) {
        cancelAnimationFrame(frameId);
        this.animationFrames.delete(frameId);
    }

    /**
     * DOM要素を管理下に追加
     * @param {Element} element 
     */
    trackElement(element) {
        if (element) {
            this.domElements.add(element);
        }
    }

    /**
     * DOM要素の削除と管理解除
     * @param {Element} element 
     */
    removeElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
            this.domElements.delete(element);
        }
    }

    /**
     * イベントリスナー管理
     * @param {Element} element 
     * @param {string} event 
     * @param {Function} handler 
     * @param {object} options 
     */
    addEventListener(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);
        
        // WeakMapで要素とリスナーを関連付け
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, []);
        }
        this.eventListeners.get(element).push({ event, handler, options });
    }

    /**
     * 要素のイベントリスナーをすべて削除
     * @param {Element} element 
     */
    removeAllEventListeners(element) {
        const listeners = this.eventListeners.get(element);
        if (listeners) {
            listeners.forEach(({ event, handler, options }) => {
                element.removeEventListener(event, handler, options);
            });
            this.eventListeners.delete(element);
        }
    }

    /**
     * バトル終了時などの部分クリーンアップ
     */
    cleanupBattle() {
        // バトル関連のタイマーをすべてクリア
        this.timers.forEach(timerId => {
            clearTimeout(timerId);
            clearInterval(timerId);
        });
        this.timers.clear();

        // アニメーションフレームをキャンセル
        this.animationFrames.forEach(frameId => {
            cancelAnimationFrame(frameId);
        });
        this.animationFrames.clear();

        // 一時DOM要素を削除
        this.domElements.forEach(element => {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        this.domElements.clear();

        noop('🧹 Battle cleanup completed');
    }

    /**
     * 完全クリーンアップ（ページ終了時）
     */
    cleanup() {
        this.cleanupBattle();
        noop('🧹 Full cleanup completed');
    }

    /**
     * メモリ使用状況の取得（デバッグ用）
     */
    getMemoryStats() {
        return {
            timers: this.timers.size,
            animationFrames: this.animationFrames.size,
            domElements: this.domElements.size,
            timestamp: Date.now()
        };
    }
}

// デフォルトインスタンス
export const memoryManager = new MemoryManager();

// 自動初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        memoryManager.init();
    });
} else {
    memoryManager.init();
}