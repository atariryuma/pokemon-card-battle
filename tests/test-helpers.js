/**
 * TEST HELPERS
 * 
 * テスト用のユーティリティ関数集
 * カードフリップ、ダメージバッジ、状態同期などのテストをサポート
 */

/**
 * ThreeViewBridgeインスタンスを取得
 * @returns {ThreeViewBridge|null}
 */
function getThreeViewBridge() {
    return window.threeViewBridge || window.game?.view?.threeViewBridge;
}

/**
 * 指定時間待機
 * @param {number} ms - 待機時間（ミリ秒）
 * @returns {Promise<void>}
 */
export function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * アニメーション完了を待つ
 * @param {HTMLElement} element - 対象要素
 * @param {number} timeout - タイムアウト（ミリ秒）
 * @returns {Promise<void>}
 */
export function waitForAnimation(element, timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (!element) {
            reject(new Error('Element is null or undefined'));
            return;
        }

        let transitionEndFired = false;
        let animationEndFired = false;

        const handleTransitionEnd = () => {
            transitionEndFired = true;
            checkComplete();
        };

        const handleAnimationEnd = () => {
            animationEndFired = true;
            checkComplete();
        };

        const checkComplete = () => {
            if (transitionEndFired || animationEndFired) {
                cleanup();
                resolve();
            }
        };

        const cleanup = () => {
            element.removeEventListener('transitionend', handleTransitionEnd);
            element.removeEventListener('animationend', handleAnimationEnd);
            clearTimeout(timeoutId);
        };

        const timeoutId = setTimeout(() => {
            cleanup();
            // タイムアウトはエラーではなく、完了として扱う
            resolve();
        }, timeout);

        element.addEventListener('transitionend', handleTransitionEnd);
        element.addEventListener('animationend', handleAnimationEnd);

        // アニメーションがない場合は即座に解決
        const computedStyle = window.getComputedStyle(element);
        const hasTransition = computedStyle.transition !== 'all 0s ease 0s';
        const hasAnimation = computedStyle.animationName !== 'none';

        if (!hasTransition && !hasAnimation) {
            cleanup();
            resolve();
        }
    });
}

/**
 * 要素が表示されるまで待つ
 * @param {string} selector - CSSセレクター
 * @param {number} timeout - タイムアウト（ミリ秒）
 * @returns {Promise<HTMLElement>}
 */
export function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const check = () => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
            } else if (Date.now() - startTime > timeout) {
                reject(new Error(`Element not found: ${selector}`));
            } else {
                setTimeout(check, 100);
            }
        };

        check();
    });
}

/**
 * スクリーンショットを撮影（データURL）
 * @param {string} testName - テスト名
 * @returns {Promise<string>} - Data URL
 */
export async function captureScreenshot(testName) {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
        // Canvasがない場合は警告を出してスキップ（テストは失敗させない）
        console.warn('Canvas not found for screenshot');
        return null;
    }

    try {
        // Three.jsのレンダリングを待つ
        await wait(100);

        const dataUrl = canvas.toDataURL('image/png');

        // ローカルストレージに保存（開発用）
        try {
            localStorage.setItem(`test-screenshot-${testName}`, dataUrl);
        } catch (e) {
            console.warn('Could not save screenshot to localStorage:', e);
        }

        return dataUrl;
    } catch (error) {
        console.error('Screenshot capture failed:', error);
        // エラーをスローせずnullを返す
        return null;
    }
}

/**
 * カードが存在するか確認
 * @param {string} runtimeId - カードのランタイムID
 * @param {boolean} checkDom - DOM要素の存在確認
 * @param {boolean} checkThree - Three.jsオブジェクトの存在確認
 * @returns {Object} - 確認結果
 */
export function assertCardExists(runtimeId, checkDom = true, checkThree = true) {
    const result = {
        exists: true,
        inDom: false,
        inThree: false,
        errors: []
    };

    // DOM確認
    if (checkDom) {
        const domCard = document.querySelector(`[data-runtime-id="${runtimeId}"]`);
        result.inDom = !!domCard;
        if (!domCard) {
            result.errors.push(`Card ${runtimeId} not found in DOM`);
            result.exists = false;
        }
    }

    // Three.js確認
    const bridge = getThreeViewBridge();
    if (checkThree && bridge?.gameBoard) {
        const threeCard = bridge.gameBoard.cards.get(runtimeId);
        result.inThree = !!threeCard;
        if (!threeCard) {
            result.errors.push(`Card ${runtimeId} not found in Three.js`);
            result.exists = false;
        }
    }

    return result;
}

/**
 * 攻撃をシミュレート
 * @param {string} attackerId - 攻撃側カードID
 * @param {string} defenderId - 防御側カードID
 * @returns {Promise<Object>} - 攻撃結果
 */
export async function simulateAttack(attackerId, defenderId) {
    const game = window.game;
    if (!game) {
        throw new Error('Game instance not found');
    }

    const initialDefenderState = getCardState(defenderId);
    const initialDamage = initialDefenderState?.damage || 0;

    // 攻撃ボタンをクリック
    const attackBtn = document.getElementById('attack-button-float');
    if (!attackBtn || attackBtn.disabled) {
        throw new Error('Attack button not available');
    }

    attackBtn.click();
    await wait(500);

    // 攻撃選択（最初の攻撃を選択）
    const attackOptions = document.querySelectorAll('.attack-option');
    if (attackOptions.length > 0) {
        attackOptions[0].click();
        await wait(2000); // アニメーション完了を待つ
    }

    const finalDefenderState = getCardState(defenderId);
    const finalDamage = finalDefenderState?.damage || 0;

    return {
        success: finalDamage > initialDamage,
        damageDealt: finalDamage - initialDamage,
        initialDamage,
        finalDamage
    };
}

/**
 * カードの状態を取得
 * @param {string} runtimeId - カードのランタイムID
 * @returns {Object|null} - カード状態
 */
export function getCardState(runtimeId) {
    const game = window.game;
    if (!game?.state) {
        return null;
    }

    const state = game.state;

    // プレイヤーのアクティブをチェック
    if (state.players.player.active?.runtimeId === runtimeId) {
        return state.players.player.active;
    }

    // プレイヤーのベンチをチェック
    for (const card of state.players.player.bench) {
        if (card?.runtimeId === runtimeId) {
            return card;
        }
    }

    // CPUのアクティブをチェック
    if (state.players.cpu.active?.runtimeId === runtimeId) {
        return state.players.cpu.active;
    }

    // CPUのベンチをチェック
    for (const card of state.players.cpu.bench) {
        if (card?.runtimeId === runtimeId) {
            return card;
        }
    }

    return null;
}

/**
 * メモリリークをチェック
 * @returns {Object} - メモリリーク情報
 */
export function checkMemoryLeaks() {
    const leaks = {
        domNodes: 0,
        eventListeners: 0,
        threeObjects: 0,
        warnings: []
    };

    // DOM要素の数をチェック
    const allElements = document.querySelectorAll('*');
    leaks.domNodes = allElements.length;

    // Three.jsオブジェクトをチェック
    const bridge = getThreeViewBridge();
    if (bridge?.gameBoard?.scene) {
        const scene = bridge.gameBoard.scene;
        leaks.threeObjects = scene.children.length;
    }

    // 異常な数のDOM要素
    if (leaks.domNodes > 5000) {
        leaks.warnings.push(`High DOM node count: ${leaks.domNodes}`);
    }

    // 異常な数のThree.jsオブジェクト
    if (leaks.threeObjects > 500) {
        leaks.warnings.push(`High Three.js object count: ${leaks.threeObjects}`);
    }

    return leaks;
}

/**
 * カードフリップ状態をチェック
 * @param {string} runtimeId - カードのランタイムID
 * @returns {Object} - フリップ状態
 */
export function checkCardFlipState(runtimeId) {
    const result = {
        isFlipped: null,
        rotation: null,
        error: null
    };

    const bridge = getThreeViewBridge();
    if (!bridge?.gameBoard) {
        result.error = 'Three.js view bridge not available';
        return result;
    }

    const card = bridge.gameBoard.cards.get(runtimeId);
    if (!card) {
        result.error = `Card ${runtimeId} not found`;
        return result;
    }

    if (card.mesh) {
        result.isFlipped = card.isFlipped;
        result.rotation = {
            x: card.mesh.rotation.x,
            y: card.mesh.rotation.y,
            z: card.mesh.rotation.z
        };
    }

    return result;
}

/**
 * ダメージバッジの表示状態をチェック
 * @param {string} runtimeId - カードのランタイムID
 * @returns {Object} - ダメージバッジ情報
 */
export function checkDamageBadge(runtimeId) {
    const result = {
        visible: false,
        damage: 0,
        position: null,
        error: null
    };

    const cardState = getCardState(runtimeId);
    if (!cardState) {
        result.error = `Card ${runtimeId} not found in state`;
        return result;
    }

    result.damage = cardState.damage || 0;

    const bridge = getThreeViewBridge();
    if (!bridge?.gameBoard) {
        result.error = 'Three.js view bridge not available';
        return result;
    }

    const card = bridge.gameBoard.cards.get(runtimeId);
    if (!card) {
        result.error = `Card ${runtimeId} not found in Three.js`;
        return result;
    }

    if (card.damageBadge) {
        result.visible = card.damageBadge.visible;
        if (card.damageBadge.position) {
            result.position = {
                x: card.damageBadge.position.x,
                y: card.damageBadge.position.y,
                z: card.damageBadge.position.z
            };
        }
    }

    return result;
}

/**
 * ゲーム状態とThree.jsの同期をチェック
 * @returns {Object} - 同期状態
 */
export function checkStateSync() {
    const result = {
        synced: true,
        mismatches: [],
        stateCards: 0,
        threeCards: 0
    };

    const game = window.game;
    if (!game?.state) {
        result.synced = false;
        result.mismatches.push('Game state not available');
        return result;
    }

    const bridge = getThreeViewBridge();
    if (!bridge?.gameBoard) {
        result.synced = false;
        result.mismatches.push('Three.js view bridge not available');
        return result;
    }

    const state = game.state;
    const cardsMap = bridge.gameBoard.cards;

    // ゲーム状態のカードをカウント
    let stateCardCount = 0;
    const stateCardIds = new Set();

    const collectCards = (card) => {
        if (card?.runtimeId) {
            stateCardCount++;
            stateCardIds.add(card.runtimeId);
        }
    };

    collectCards(state.players.player.active);
    state.players.player.bench.forEach(collectCards);
    collectCards(state.players.cpu.active);
    state.players.cpu.bench.forEach(collectCards);

    // サイドカードもカウント（実装によるが、Three.jsには存在するはず）
    const setupPhases = ['setup', 'initialPokemonSelection'];
    if (!setupPhases.includes(state.phase)) {
        state.players.player.prize?.forEach(collectCards);
        state.players.cpu.prize?.forEach(collectCards);
    }

    // デッキとトラッシュは特殊扱いのためカウントロジックを調整
    // Three.jsはデッキとトラッシュを1つのオブジェクトとして扱うことが多いが、
    // ここでは個別のカード同期をチェック

    result.stateCards = stateCardCount;
    result.threeCards = 0; // 下記で再計算

    // Three.js側のカードカウント (deck/discard/prize等の特殊キーを除外または考慮)
    let threeCardCount = 0;
    cardsMap.forEach((card, key) => {
        // deck-player, discard-cpu などの特殊キーは除外して、実カードIDのみ比較するアプローチも可
        // ここでは単純にruntimeIdが一致するかを見る
        if (stateCardIds.has(key)) {
            threeCardCount++;
        }
    });
    result.threeCards = threeCardCount;

    // 各カードの存在確認
    stateCardIds.forEach(runtimeId => {
        if (!cardsMap.has(runtimeId)) {
            // サイドカードなどは非表示かもしれないので警告レベルにするか、厳密にチェックするか
            // ここでは厳密にチェック
            result.synced = false;
            result.mismatches.push(`Card ${runtimeId} exists in state but not in Three.js`);
        }
    });

    return result;
}

/**
 * テスト結果をコンソールに出力
 * @param {string} testName - テスト名
 * @param {boolean} passed - 合格したか
 * @param {string} message - メッセージ
 */
export function logTestResult(testName, passed, message = '') {
    const icon = passed ? '✅' : '❌';
    const color = passed ? 'color: green' : 'color: red';
    console.log(`%c${icon} ${testName}`, color);
    if (message) {
        console.log(`   ${message}`);
    }
}

/**
 * すべてのテストヘルパー関数をエクスポート
 */
export const TestHelpers = {
    wait,
    waitForAnimation,
    waitForElement,
    captureScreenshot,
    assertCardExists,
    simulateAttack,
    getCardState,
    checkMemoryLeaks,
    checkCardFlipState,
    checkDamageBadge,
    checkStateSync,
    logTestResult
};

export default TestHelpers;
