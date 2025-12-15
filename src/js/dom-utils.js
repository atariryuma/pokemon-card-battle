/**
 * DOM-UTILS.JS - DOM要素検索の統一システム
 * 
 * 全てのカード移動・アニメーションで使用する信頼性の高いDOM検索
 */

/**
 * プレイヤーIDを正規化
 * @param {string} playerId - 生のプレイヤーID
 * @returns {string} 正規化されたプレイヤーID
 */
export function normalizePlayerId(playerId) {
    if (playerId === 'cpu' || playerId === 'opponent') return 'cpu';
    return 'player';
}

/**
 * ゾーン要素を確実に検索
 * @param {string} playerId - プレイヤーID
 * @param {string} zone - ゾーン名
 * @returns {HTMLElement|null} 見つかった要素
 */
export function findZoneElement(playerId, zone) {
    const normalizedId = normalizePlayerId(playerId);
    
    // 統一されたセレクタパターン
    const selectors = {
        player: {
            hand: '#player-hand, #you-hand',
            active: '#you-active, [data-owner="player"][data-zone="active"]',
            bench: '#you-bench, [data-owner="player"][data-zone="bench"]',
            deck: '#you-deck, [data-owner="player"][data-zone="deck"]',
            discard: '#you-discard, [data-owner="player"][data-zone="discard"]',
            prize: '#you-prize-area, [data-owner="player"][data-zone="prize"]'
        },
        cpu: {
            hand: '#cpu-hand, [data-owner="cpu"][data-zone="hand"]',
            active: '#cpu-active, .opponent-board .active-zone, .opponent-board .active-top, [data-owner="cpu"][data-zone="active"]',
            bench: '#cpu-bench, .opponent-board .bench-zone, .opponent-board .bench-area, [data-owner="cpu"][data-zone="bench"]',
            deck: '#cpu-deck, .opponent-board .deck-container',
            discard: '#cpu-discard, .opponent-board .discard-container',
            prize: '#cpu-prize-area, .opponent-board .side-right'
        }
    };
    
    const selectorList = selectors[normalizedId]?.[zone];
    if (!selectorList) {
        console.warn(`Unknown zone: ${zone} for player: ${normalizedId}`);
        return null;
    }
    
    // 複数のセレクタを試行
    const selectors_array = selectorList.split(', ');
    for (const selector of selectors_array) {
        const element = document.querySelector(selector.trim());
        if (element) {
            return element;
        }
    }
    
    console.warn(`Zone element not found: ${zone} for ${normalizedId}, tried: ${selectorList}`);
    return null;
}

/**
 * カード要素を確実に検索
 * @param {string} playerId - プレイヤーID
 * @param {string} cardId - カードID
 * @param {string} zone - ゾーン名（オプション）
 * @returns {HTMLElement|null} 見つかった要素
 */
export function findCardElement(playerId, cardId, zone = null) {
    const normalizedId = normalizePlayerId(playerId);

    // 所有者に基づいてカードを検索
    const selectors = [];
    // runtimeId を最優先で探索（重複カード対策）
    if (zone) {
        selectors.push(`[data-owner="${normalizedId}"][data-zone="${zone}"] [data-runtime-id="${cardId}"]`);
    }
    selectors.push(`[data-owner="${normalizedId}"] [data-runtime-id="${cardId}"]`);
    selectors.push(`[data-runtime-id="${cardId}"]`);
    // 互換: master id でも探索（最終フォールバック）。同名衝突時の誤選択を避けるため最後にする。
    if (zone) {
        selectors.push(`[data-owner="${normalizedId}"][data-zone="${zone}"] [data-card-id="${cardId}"]`);
    }
    selectors.push(`[data-owner="${normalizedId}"] [data-card-id="${cardId}"]`);
    selectors.push(`[data-card-id="${cardId}"]`); // 最終フォールバック

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            return element;
        }
    }

    console.warn(`Card element not found: ${cardId} for ${normalizedId}${zone ? ` in ${zone}` : ''}`);
    return null;
}

/**
 * ベンチスロットを確実に検索
 * @param {string} playerId - プレイヤーID
 * @param {number} index - ベンチインデックス
 * @returns {HTMLElement|null} 見つかった要素
 */
export function findBenchSlot(playerId, index) {
    const normalizedId = normalizePlayerId(playerId);

    const benchClass = normalizedId === 'player'
        ? `.bottom-bench-${index + 1}`
        : `.top-bench-${index + 1}`;

    const selectors = [
        `[data-owner="${normalizedId}"][data-zone="bench"][data-index="${index}"]`,
        `#${normalizedId}-bench .bench-slot:nth-child(${index + 1})`,
        `[data-owner="${normalizedId}"][data-zone="bench"] .slot:nth-child(${index + 1})`,
        benchClass
    ];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            return element;
        }
    }

    console.warn(`Bench slot not found: index ${index} for ${normalizedId}`);
    return null;
}

/**
 * 要素の位置情報を安全に取得
 * @param {HTMLElement} element - 対象要素
 * @returns {DOMRect|null} 位置情報
 */
export function getElementRect(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') {
        console.warn('Invalid element for getBoundingClientRect');
        return null;
    }
    
    try {
        return element.getBoundingClientRect();
    } catch (error) {
        console.error('Error getting element rect:', error);
        return null;
    }
}

/**
 * DOM要素が有効かどうかチェック
 * @param {HTMLElement} element - チェック対象
 * @returns {boolean} 有効かどうか
 */
export function isValidElement(element) {
    return element && 
           element.nodeType === Node.ELEMENT_NODE && 
           element.isConnected;
}

/**
 * 複数の要素を同時にチェック
 * @param {...HTMLElement} elements - チェック対象の要素たち
 * @returns {boolean} 全て有効かどうか
 */
export function areValidElements(...elements) {
    return elements.every(element => isValidElement(element));
}
