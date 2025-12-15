/**
 * animations/flow.js - 安定・単純なアニメーション呼び出しファサード
 *
 * 目的:
 * - プレイヤー/CPUの手札→配置（アクティブ/ベンチ）を同じAPIで扱う
 * - サイド配布も同じ関数で扱う
 * - ランタイムID優先でDOM要素を解決し、混同を防ぐ
 */

import { animate } from '../animation-manager.js';
import { normalizePlayerId, findZoneElement, findBenchSlot } from '../dom-utils.js';
import { ZIndexManager } from '../z-index-constants.js';

function resolveHandCardElement(playerId, runtimeOrMasterId) {
  const pid = normalizePlayerId(playerId);
  // runtimeId 優先で手札内の該当カードを検索
  const handRoot = findZoneElement(pid, 'hand');
  if (!handRoot) return null;
  return handRoot.querySelector(`[data-runtime-id="${runtimeOrMasterId}"]`) ||
         handRoot.querySelector(`[data-card-id="${runtimeOrMasterId}"]`);
}

export const animateFlow = {
  /** 手札→アクティブ */
  async handToActive(playerId, runtimeOrMasterId, options = {}) {
    const pid = normalizePlayerId(playerId);
    const activeEl = findZoneElement(pid, 'active');
    if (!activeEl) return;

    // セットアップ専用: 実座標クローン移動（元画像→目的地）
    if (options.isSetupPhase && options.initialSourceRect) {
      const placed = activeEl.querySelector('[data-card-id], .relative, img') || activeEl;
      await cloneMoveFromRectToTarget(options.initialSourceRect, placed, options.duration || 600);
      return;
    }

    // 通常：軽量モーション
    const cardEl = resolveHandCardElement(pid, runtimeOrMasterId);
    if (!cardEl) return;
    await animate.card.move(pid, runtimeOrMasterId, 'hand->active', options).catch(() => {});
  },

  /** 手札→ベンチ */
  async handToBench(playerId, runtimeOrMasterId, benchIndex = 0, options = {}) {
    const pid = normalizePlayerId(playerId);
    const benchSlot = findBenchSlot(pid, benchIndex);
    if (!benchSlot) return;

    // セットアップ専用: 実座標クローン移動
    if (options.isSetupPhase && options.initialSourceRect) {
      const placed = benchSlot.querySelector('[data-card-id], .relative, img') || benchSlot;
      await cloneMoveFromRectToTarget(options.initialSourceRect, placed, options.duration || 600);
      return;
    }

    // 通常：軽量モーション
    const cardEl = resolveHandCardElement(pid, runtimeOrMasterId);
    if (!cardEl) return;
    await animate.card.move(pid, runtimeOrMasterId, 'hand->bench', { ...options, benchIndex }).catch(() => {});
  },

  /** サイド配布（片側） */
  async dealPrizesFor(playerId, prizeElements = []) {
    const pid = normalizePlayerId(playerId);
    if (!Array.isArray(prizeElements) || prizeElements.length === 0) return;
    await animate.prizeDeal(prizeElements, pid).catch(() => {});
  }
};

// 追加: ベンチ→アクティブ（昇格）
animateFlow.benchToActive = async function(playerId, benchIndex = 0, options = {}) {
  const pid = normalizePlayerId(playerId);
  const benchSlot = findBenchSlot(pid, benchIndex);
  const activeEl = findZoneElement(pid, 'active');
  if (!benchSlot || !activeEl) return;
  await animate.card.move(pid, null, 'bench->active', { ...options, benchIndex }).catch(() => {});
};

// 追加: アクティブ→ベンチ（にげる）
animateFlow.activeToBench = async function(playerId, benchIndex = 0, options = {}) {
  const pid = normalizePlayerId(playerId);
  const activeEl = findZoneElement(pid, 'active');
  const benchSlot = findBenchSlot(pid, benchIndex);
  if (!activeEl || !benchSlot) return;
  await animate.card.move(pid, null, 'active->bench', { ...options, benchIndex }).catch(() => {});
};

// 追加: 汎用 hand->(active|bench)
animateFlow.handToZone = async function(playerId, runtimeOrMasterId, zone, targetIndex = 0, options = {}) {
  if (zone === 'active') {
    return animateFlow.handToActive(playerId, runtimeOrMasterId, options);
  }
  if (zone === 'bench') {
    return animateFlow.handToBench(playerId, runtimeOrMasterId, targetIndex, options);
  }
  // その他ゾーンは将来拡張
};

/**
 * 実座標クローン移動（開始矩形→ターゲット要素）
 */
async function cloneMoveFromRectToTarget(initialRect, targetElement, duration = 600) {
  if (!initialRect || !targetElement) return;
  const targetRect = targetElement.getBoundingClientRect();

  // 対象（本体）を一時的に不可視
  const originalOpacity = targetElement.style.opacity;
  targetElement.style.opacity = '0';

  // クローン作成（見た目はターゲットに揃える）
  const clone = targetElement.cloneNode(true);
  const width = targetRect.width || targetElement.offsetWidth || 96;
  const height = targetRect.height || targetElement.offsetHeight || 128;
  clone.style.position = 'fixed';
  clone.style.left = `${initialRect.left}px`;
  clone.style.top = `${initialRect.top}px`;
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.pointerEvents = 'none';
  clone.style.borderRadius = '8px';
  clone.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)';
  clone.style.transform = 'scale(0.9)';
  clone.style.transition = 'none';
  // 中央管理のZIndexManagerで最前面に表示
  ZIndexManager.setAnimating(clone);
  document.body.appendChild(clone);

  // 強制reflow
  // eslint-disable-next-line no-unused-expressions
  clone.offsetHeight;

  // 遷移
  await new Promise(resolve => {
    clone.style.transition = `all ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    clone.style.left = `${targetRect.left}px`;
    clone.style.top = `${targetRect.top}px`;
    clone.style.transform = 'scale(1)';
    clone.style.opacity = '1';

    const done = () => {
      clone.removeEventListener('transitionend', done);
      // クリーンアップ
      if (clone.parentNode) clone.parentNode.removeChild(clone);
      targetElement.style.opacity = originalOpacity || '1';
      // 小さな着地効果
      targetElement.style.transform = 'scale(1.05)';
      setTimeout(() => {
        targetElement.style.transition = 'transform 160ms ease';
        targetElement.style.transform = '';
        setTimeout(() => { targetElement.style.transition = ''; }, 160);
      }, 60);
      resolve();
    };
    clone.addEventListener('transitionend', done, { once: true });
    setTimeout(done, duration + 120); // フォールバック
  });
}

export default animateFlow;
