import { ZIndexManager } from './z-index-constants.js';
/**
 * CARD-ORIENTATION.JS - 統一カード向き制御システム
 *
 * ルール:
 * - CPU: hand以外は180度回転
 * - CPU: handは未回転
 * - Player: すべて未回転
 * - プレースホルダーもルールに従う
 *
 * 実装指針:
 * - data-orientation属性によるCSS制御に完全統一
 * - プレースホルダーを含む全要素で統一管理
 */

/**
 * カード向き制御の統一管理クラス
 */
export class CardOrientationManager {
  /**
   * カードの向き判定（CPU側のhand以外は反転、但し山札・ダメージバッジは除外）
   * @param {string} playerId - プレイヤーID ('player' | 'cpu')
   * @param {string} zone - ゾーン情報
   * @param {Element} element - カード要素（プレースホルダー含む）
   * @returns {boolean} 反転が必要かどうか
   */
  static shouldFlipCard(playerId, zone = null, element = null) {
    // プレイヤー識別（要素からのフォールバック含む）
    const isCpu = (playerId === 'cpu') || (!!element?.closest?.('.opponent-board'));
    const normalizedZone = zone || element?.dataset?.zone || '';

    // 反転対象から除外するゾーン
    const nonFlipZones = [
      'hand',        // CPU手札は反転しない
      'modal',       // モーダル内は反転しない
      'deck',        // 山札は反転しない
      'discard',     // 山札エリア（捨て札）は反転しない
      'damage',      // ダメージバッジは反転しない
      'prize',       // サイドカード（小文字）は反転しない
      'Prize'        // サイドカード（大文字）は反転しない
    ];

    // CPU は 除外ゾーン以外を回転（プレースホルダー含む）
    return isCpu && !nonFlipZones.includes(normalizedZone);
  }

  /**
   * カード要素に適切な向きを適用（プレースホルダー含む）
   * @param {Element} cardElement - カード要素またはプレースホルダー
   * @param {string} playerId - プレイヤーID
   * @param {string} zone - ゾーン情報
   */
  static applyCardOrientation(cardElement, playerId, zone = null) {
    if (!cardElement) return;

    const shouldFlip = this.shouldFlipCard(playerId, zone, cardElement);
    // data-orientation属性でCSS制御を統一
    cardElement.dataset.orientation = shouldFlip ? 'flipped' : 'upright';
    
    // CSS競合対策：直接スタイル適用で確実な反転を保証
    const img = cardElement.querySelector && cardElement.querySelector('img');
    if (shouldFlip) {
      if (img) {
        ZIndexManager.applyTranslateZ(img, 'TZ_CARD_IMAGE_BASE', 'rotate(180deg)');
        img.style.transformStyle = 'preserve-3d';
      } else {
        // 画像タグがない（背景画像やプレースホルダー）場合は要素自体を反転
        ZIndexManager.applyTranslateZ(cardElement, 'TZ_CARD_IMAGE_BASE', 'rotate(180deg)');
        cardElement.style.transformStyle = 'preserve-3d';
      }
    } else {
      // 正位置に戻す（以前の反転をクリア）
      // CSSのdata-orientation属性に任せるため、直接transformはクリアしない
      // ZIndexManager.applyTranslateZがtranslateZを管理
    }
  }

  /**
   * 複数カードに一括で向きを適用
   * @param {Array<Element>} cardElements - カード要素配列
   * @param {string} playerId - プレイヤーID
   * @param {string} zone - ゾーン情報
   */
  static applyBatchCardOrientation(cardElements, playerId, zone = null) {
    if (!Array.isArray(cardElements)) return;
    cardElements.forEach(element => {
      this.applyCardOrientation(element, playerId, zone);
    });
  }
}

// デフォルトエクスポートも提供
export default CardOrientationManager;
