/**
 * BOARD-EVENT-HANDLER.JS - ゲームボードイベント委譲システム
 *
 * ゲームボード全体でイベントを受信し、適切な要素に委譲する
 *
 * アーキテクチャ:
 * - DOM (#game-board): イベント処理・アニメーション用
 * - Three.js (#three-container): 3D表示担当
 *
 * ベストプラクティス:
 * - 親要素でイベントリスナーを一元化
 * - event.target から実際のターゲットを特定
 */

export class BoardEventHandler {
    constructor(gameBoard, clickHandler) {
        this.gameBoard = gameBoard;
        this.clickHandler = clickHandler;
        this.isEnabled = true;

        // ✅ ホバー状態追跡用
        this.lastHoveredSlot = null;

        // ✅ メモリリーク修正: バインド済み関数を保存
        this._boundHandleClick = this._handleClick.bind(this);
        this._boundHandleMouseOver = this._handleMouseOver.bind(this);
        this._boundHandleMouseOut = this._handleMouseOut.bind(this);

        this._bindEvents();
    }

    /**
     * イベントのバインド
     */
    _bindEvents() {
        // クリックイベント委譲
        this.gameBoard.addEventListener('click', this._boundHandleClick, true);

        // ホバー効果のためのマウスイベント
        this.gameBoard.addEventListener('mouseover', this._boundHandleMouseOver, true);
        this.gameBoard.addEventListener('mouseout', this._boundHandleMouseOut, true);
    }

    /**
     * クリックイベントハンドラ
     */
    _handleClick(event) {
        // デバッグ: クリックイベント受信を確認
        console.log('🖱️ BoardEventHandler: click received', event.target);

        if (!this.isEnabled) {
            console.log('🖱️ BoardEventHandler: disabled, ignoring');
            return;
        }

        // カードスロットを探す
        const slot = this._findCardSlot(event.target);
        console.log('🖱️ BoardEventHandler: found slot?', slot);

        if (!slot) {
            console.log('🖱️ BoardEventHandler: no card-slot found in target chain');
            return;
        }

        event.stopPropagation();
        event.preventDefault();

        // クリック情報を収集
        const clickInfo = this._extractClickInfo(slot);
        console.log('🖱️ BoardEventHandler: clickInfo', clickInfo);

        // ハンドラに委譲
        if (this.clickHandler && typeof this.clickHandler === 'function') {
            this.clickHandler(clickInfo, slot, event);
        }
    }

    /**
     * ✅ マウスオーバーハンドラ（改善版）
     */
    _handleMouseOver(event) {
        const slot = this._findCardSlot(event.target);
        if (slot) {
            // ✅ 前回のホバー要素をクリア
            if (this.lastHoveredSlot && this.lastHoveredSlot !== slot) {
                this.lastHoveredSlot.classList.remove('is-hovered');
            }

            slot.classList.add('is-hovered');
            this.lastHoveredSlot = slot;
        }
    }

    /**
     * ✅ マウスアウトハンドラ（改善版）
     */
    _handleMouseOut(event) {
        const slot = this._findCardSlot(event.target);
        if (slot) {
            // ✅ 実際に要素から離れたときのみクリア（relatedTargetチェック）
            const relatedTarget = event.relatedTarget;
            if (!slot.contains(relatedTarget)) {
                slot.classList.remove('is-hovered');
                if (this.lastHoveredSlot === slot) {
                    this.lastHoveredSlot = null;
                }
            }
        }
    }

    /**
     * 要素からカードスロットを探す
     */
    _findCardSlot(element) {
        if (!element) return null;
        return element.closest('.card-slot');
    }

    /**
     * スロットからクリック情報を抽出
     */
    _extractClickInfo(slot) {
        // データ属性から情報を取得
        const zone = slot.dataset.zone || '';
        const owner = slot.dataset.owner || this._detectOwner(slot);
        const cardId = slot.dataset.cardId || null;
        const runtimeId = slot.dataset.runtimeId || null;
        const orientation = slot.dataset.orientation || 'upright';

        // インデックスの抽出（data-index > data-prizeIndex > クラス名からパース）
        let index = slot.dataset.index || slot.dataset.prizeIndex || null;

        if (index === null) {
            // クラス名からインデックスを抽出（例: 'bottom-bench-3' → 2 (0-indexed)）
            index = this._extractIndexFromClassName(slot.className);
        }

        return {
            zone,
            owner,
            index: String(index),
            cardId,
            runtimeId,
            orientation,
            element: slot
        };
    }

    /**
     * クラス名からインデックスを抽出
     * 例: 'card-slot bottom-bench-3' → '2' (1-indexedを0-indexedに変換)
     */
    _extractIndexFromClassName(className) {
        // ベンチスロット: bottom-bench-1, top-bench-3 など
        const benchMatch = className.match(/(?:bottom|top)-bench-(\d+)/);
        if (benchMatch) {
            return String(parseInt(benchMatch[1], 10) - 1); // 1-indexed → 0-indexed
        }

        // サイドカード: side-left-1, side-right-2 など
        const sideMatch = className.match(/side-(?:left|right)-(\d+)/);
        if (sideMatch) {
            return String(parseInt(sideMatch[1], 10) - 1);
        }

        // アクティブ: active-bottom, active-top
        if (className.includes('active-bottom') || className.includes('active-top')) {
            return '0';
        }

        // デッキ/トラッシュ
        if (className.includes('deck') || className.includes('trash')) {
            return '0';
        }

        return '0';
    }

    /**
     * スロットの所有者を検出
     */
    _detectOwner(slot) {
        if (slot.closest('.player-self')) return 'player';
        if (slot.closest('.opponent-board')) return 'cpu';
        return 'unknown';
    }

    /**
     * イベント処理を有効化
     */
    enable() {
        this.isEnabled = true;
    }

    /**
     * イベント処理を無効化
     */
    disable() {
        this.isEnabled = false;
    }

    /**
     * クリーンアップ
     */
    destroy() {
        // ✅ ホバー状態をクリア
        if (this.lastHoveredSlot) {
            this.lastHoveredSlot.classList.remove('is-hovered');
            this.lastHoveredSlot = null;
        }

        // ✅ メモリリーク修正: 保存済みの関数参照を使用
        this.gameBoard.removeEventListener('click', this._boundHandleClick, true);
        this.gameBoard.removeEventListener('mouseover', this._boundHandleMouseOver, true);
        this.gameBoard.removeEventListener('mouseout', this._boundHandleMouseOut, true);

        // 参照をクリア
        this._boundHandleClick = null;
        this._boundHandleMouseOver = null;
        this._boundHandleMouseOut = null;
        this.clickHandler = null;
    }
}

export default BoardEventHandler;
