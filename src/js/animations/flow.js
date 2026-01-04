/**
 * animations/flow.js - Three.js専用モード
 *
 * ✅ DOM版アニメーションは完全削除
 * Three.jsがすべてのアニメーションを処理
 */

export const animateFlow = {
  /** ✅ Three.js専用: 手札→アクティブはThree.jsが処理 */
  async handToActive(playerId, runtimeOrMasterId, options = {}) {
    return Promise.resolve();
  },

  /** ✅ Three.js専用: 手札→ベンチはThree.jsが処理 */
  async handToBench(playerId, runtimeOrMasterId, benchIndex = 0, options = {}) {
    return Promise.resolve();
  },

  /** ✅ Three.js専用: サイド配布はThree.jsが処理 */
  async dealPrizesFor(playerId, prizeElements = []) {
    return Promise.resolve();
  },

  /** ✅ Three.js専用: 手札登場アニメーション */
  async handEntry(cards) {
    return Promise.resolve();
  }
};

// ✅ Three.js専用: ベンチ→アクティブ（昇格）
animateFlow.benchToActive = async function(playerId, benchIndex = 0, options = {}) {
  return Promise.resolve();
};

// ✅ Three.js専用: アクティブ→ベンチ（にげる）
animateFlow.activeToBench = async function(playerId, benchIndex = 0, options = {}) {
  return Promise.resolve();
};

// ✅ Three.js専用: 汎用 hand->(active|bench)
animateFlow.handToZone = async function(playerId, runtimeOrMasterId, zone, targetIndex = 0, options = {}) {
  return Promise.resolve();
};

export default animateFlow;
