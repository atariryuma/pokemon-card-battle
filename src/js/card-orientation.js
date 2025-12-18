/**
 * CARD-ORIENTATION.JS - 統一カード向き制御システム
 *
 * ルール:
 * - CPU: hand, deck, discard, damage 以外は180度回転
 * - Player: すべて未回転
 *
 * 実装:
 * - data-orientation 属性を設定するのみ
 * - 実際の回転は CSS が担当 ([data-orientation="flipped"])
 */

/**
 * カード向き制御の統一管理クラス
 */
export class CardOrientationManager {
  /**
   * 反転対象から除外するゾーン
   * @private
   */
  static _nonFlipZones = ['hand', 'modal', 'deck', 'discard', 'damage'];

  /**
   * カードの向き判定
   * @param {string} playerId - 'player' | 'cpu'
   * @param {string} zone - ゾーン情報
   * @param {Element} element - カード要素
   * @returns {boolean} 反転が必要か
   */
  static shouldFlipCard(playerId, zone = null, element = null) {
    const isCpu = playerId === 'cpu' || !!element?.closest?.('.opponent-board');
    const normalizedZone = (zone || element?.dataset?.zone || '').toLowerCase();
    return isCpu && !this._nonFlipZones.includes(normalizedZone);
  }

  /**
   * カード要素に向きを適用（data-orientation 属性のみ設定）
   * @param {Element} cardElement - カード要素
   * @param {string} playerId - 'player' | 'cpu'
   * @param {string} zone - ゾーン情報
   */
  static applyCardOrientation(cardElement, playerId, zone = null) {
    if (!cardElement) return;
    // 既に設定されている場合はスキップ（HTMLで初期設定済みの場合など）
    if (cardElement.dataset.orientation) return;
    const shouldFlip = this.shouldFlipCard(playerId, zone, cardElement);
    cardElement.dataset.orientation = shouldFlip ? 'flipped' : 'upright';
  }

  /**
   * 複数カードに一括で向きを適用
   * @param {Array<Element>} cardElements - カード要素配列
   * @param {string} playerId - 'player' | 'cpu'
   * @param {string} zone - ゾーン情報
   */
  static applyBatchCardOrientation(cardElements, playerId, zone = null) {
    if (!Array.isArray(cardElements)) return;
    cardElements.forEach(el => this.applyCardOrientation(el, playerId, zone));
  }
}

export default CardOrientationManager;
