import { getCardMasterList } from './data-manager.js';
import { GAME_PHASES } from './phase-manager.js';

/**
 * Fisher-Yates shuffle algorithm - 配列をランダムにシャッフルする
 * Immutable version: 元の配列を変更せず、新しい配列を返す
 * @param {Array} array - シャッフルする配列
 * @returns {Array} シャッフル済みの新しい配列
 */
function shuffle(array) {
    // スプレッド演算子で新しい配列を作成（Immutability原則）
    const newArray = [...array];

    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }

    return newArray;
}

/**
 * 最適化されたデッキ作成（ポケモン20枚、エネルギー40枚）
 * メモリ効率とパフォーマンスを改善
 * @returns {Array} 作成されたデッキ（シャッフル済み）
 */
function createDeck() {
    const cardMasterList = getCardMasterList();
    
    // フィルタリング結果をキャッシュして処理効率向上
    const pokemon = cardMasterList.filter(c => c.card_type === 'Pokémon');
    const energy = cardMasterList.filter(c => c.card_type === 'Basic Energy');
    
    // デッキサイズを事前確保してメモリ効率向上
    const deck = new Array(60);
    let deckIndex = 0;
    let cardId = 0;
    
    // ポケモンカード追加（20枚）
    const pokemonCount = pokemon.length;
    for (let i = 0; i < 20; i++) {
        const randomIndex = Math.floor(Math.random() * pokemonCount);
        const selectedPokemon = pokemon[randomIndex];
        
        // 軽量なカードオブジェクト作成（必要最小限のコピー）
        deck[deckIndex++] = { 
            ...selectedPokemon, 
            runtimeId: `card-${cardId++}`
        };
    }

    // エネルギーカード追加（40枚）
    const energyCount = energy.length;
    for (let i = 0; i < 40; i++) {
        const randomIndex = Math.floor(Math.random() * energyCount);
        const selectedEnergy = energy[randomIndex];
        
        deck[deckIndex++] = { 
            ...selectedEnergy, 
            runtimeId: `card-${cardId++}`
        };
    }

    return shuffle(deck);
}

/**
 * 初期プレイヤー状態を作成する
 * @returns {Object} 初期化されたプレイヤー状態オブジェクト
 */
function createPlayerState() {
    const deck = createDeck(); // Deck is already shuffled by createDeck
    // Hand and prize will be populated by Logic.setupGame
    return {
        deck,
        hand: [], // Start with empty hand
        active: null,
        bench: Array(5).fill(null),
        discard: [],
        prize: [], // Start with empty prize
        prizeRemaining: 6, // Still track remaining prizes
        prizesToTake: 0, // Number of prizes pending to take
    };
}

/**
 * ゲームの初期状態を作成する
 * @returns {Object} 初期化されたゲーム状態オブジェクト
 */
export function createInitialState() {
    return {
        // Core game state
        rngSeed: Math.floor(Math.random() * 1000000),
        turn: 1,
        phase: GAME_PHASES.SETUP,
        turnPlayer: 'player',
        
        // 処理中フラグ
        isProcessing: false,
        
        // Turn state management (統合されたターン制約)
        // 全てのターン関連の状態はturnStateに集約
        turnState: {
            hasAttacked: false,           // ターン内攻撃済みフラグ
            hasDrawn: false,              // ターン内ドロー済みフラグ
            energyAttached: 0,            // ターン内エネルギー付与数
            turnNumber: 1,                // ターン番号
            canRetreat: true,             // にげる可能フラグ
            canPlaySupporter: true        // サポート使用可能フラグ
        },
        
        // Special states
        pendingAction: null,
        awaitingInput: false,
        
        // Stadium and shared areas
        stadium: null,
        
        // Game log
        log: [],
        
        // UI state
        prompt: {
            message: '手札からたねポケモンを1匹選び、バトル場に出してください。',
            actions: [],
        },
        
        // Setup specific state
        setupSelection: {
            active: null,
            bench: [],
            confirmed: false
        },
        
        // Players
        players: {
            player: createPlayerState(),
            cpu: createPlayerState(),
        },
        
        // Win conditions
        winner: null,
        gameEndReason: null,
    };
}

/**
 * ゲーム状態のディープクローン
 */
export function cloneGameState(state) {
    // JSON.parse(JSON.stringify(...)) では手札配列が意図せず消失するケースがあったため
    // structuredClone を使用し、フォールバックとして JSON ベースのクローンも用意する
    let cloned;
    try {
        cloned = structuredClone(state || {});
    } catch (e) {
        cloned = JSON.parse(JSON.stringify(state || {}));
    }

    if (!Array.isArray(cloned.log)) {
        cloned.log = [];
    }

    // players 構造の補完と手札配列の保護
    if (!cloned.players) {
        cloned.players = {
            player: createPlayerState(),
            cpu: createPlayerState(),
        };
    }

    if (!Array.isArray(cloned.players.player.hand)) {
        cloned.players.player.hand = [];
    }
    if (!Array.isArray(cloned.players.cpu.hand)) {
        cloned.players.cpu.hand = [];
    }

    return cloned;
}

/**
 * プレイヤー状態の安全な取得
 */
export function getPlayerState(state, playerId) {
    const player = state.players[playerId];
    if (!player) {
        console.warn(`Player ${playerId} not found in state`);
        return createPlayerState();
    }
    return player;
}

/**
 * ログエントリの追加
 */
export function addLogEntry(state, entry) {
    const newState = cloneGameState(state);
    // cloneGameState で補完しているが念のため防御的にチェック
    if (!Array.isArray(newState.log)) {
        newState.log = [];
    }
    newState.log.push({
        turn: state?.turn ?? 0,
        timestamp: Date.now(),
        ...entry
    });
    return newState;
}

/**
 * 互換性レイヤー: レガシーフィールドからturnStateへの移行サポート
 *
 * 古いコードがレガシーフィールドにアクセスした場合、
 * 自動的にturnStateの値を返す
 */
export function getTurnStateCompat(state) {
    return {
        hasDrawnThisTurn: state.turnState?.hasDrawn ?? false,
        hasAttachedEnergyThisTurn: state.turnState?.energyAttached > 0,
        canRetreat: state.turnState?.canRetreat ?? true,
        canPlaySupporter: state.turnState?.canPlaySupporter ?? true,
    };
}

/**
 * turnStateを安全に更新する（Immutability保証）
 * @param {Object} state - 現在のゲーム状態
 * @param {Object} updates - turnStateへの更新内容
 * @returns {Object} 新しいゲーム状態
 */
export function updateTurnState(state, updates) {
    return {
        ...state,
        turnState: {
            ...state.turnState,
            ...updates
        }
    };
}