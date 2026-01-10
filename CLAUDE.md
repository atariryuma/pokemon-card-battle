# Pokemon Card Game - Project Instructions

Web-based Pokemon Trading Card Game implementation using Vanilla JavaScript, focusing on turn-based game mechanics and state management.

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Runtime**: Node.js (development server)
- **Architecture**: MVC pattern with pure functions
- **State Management**: Immutable state updates, Finite State Machine
- **Module System**: ES6 modules

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (serves public/ as web root)
node server.js
# OR
npm start

# Access game at http://localhost:3000
# Card editor at http://localhost:3000/card_viewer.html
```

## Project Structure

```text
pokemon/
├── src/js/                    # Source modules
│   ├── animations/            # Animation subsystem
│   ├── game.js                # Main game controller (MVC Controller)
│   ├── state.js               # State management (MVC Model)
│   ├── logic.js               # Pure game logic functions
│   ├── view.js                # DOM rendering (MVC View)
│   ├── main.js                # Entry point
│   └── *-manager.js           # Feature managers (action-hud, animation, data, etc.)
├── public/                    # Web root
│   ├── assets/                # Static resources (cards/, playmat/, ui/)
│   ├── index.html             # Main game interface
│   └── card_viewer.html       # Card editor/viewer
├── data/
│   └── cards-master.json      # Card database
├── tests/                     # Test files
└── server.js                  # Development server
```

## Architecture Principles

### IMPORTANT: Core Patterns

1. **MVC Separation**
   - `state.js`: Game state creation/initialization + state helpers (updateTurnState, getTurnStateCompat)
   - `logic.js`: Pure game logic functions ONLY (no side effects, no DOM)
   - `view.js`: DOM manipulation and rendering ONLY
   - `game.js`: Orchestration, event handling, state transitions
   - `main.js`: Application bootstrap

2. **Immutable State Updates** ⚠️ **STRICTLY ENFORCED**

   ```javascript
   // ✅ ALWAYS return new state object, NEVER mutate existing state
   function updateGameState(state, action) {
       return { ...state, /* changes */ };
   }

   // ✅ Array operations: use spread operator to create new arrays
   function shuffle(array) {
       const newArray = [...array];  // Create copy first
       // ... shuffle logic
       return newArray;
   }

   // ❌ NEVER mutate directly
   function badShuffle(array) {
       array.sort(() => Math.random() - 0.5);  // ❌ Mutates original
       return array;
   }
   ```

3. **Pure Functions for Game Logic**

   ```javascript
   // Pure function: same input → same output, no side effects
   function calculateDamage(pokemon, attack, opponent) {
       // Calculate and return damage value
       return damage;
   }
   ```

4. **State Machine for Game Flow**
   - Use Finite State Machine for phases: SETUP → DRAW → MAIN → ATTACK → END
   - `phase-manager.js` handles phase transitions
   - `turn-manager.js` handles turn control

5. **Centralized Turn State Management** (Updated 2025)
   - All turn-related state is in `state.turnState` object
   - Use `updateTurnState()` helper for safe updates
   - No direct mutation of turn state properties

   ```javascript
   // ✅ Correct way to update turn state
   import { updateTurnState } from './state.js';
   newState = updateTurnState(state, { hasDrawn: true, energyAttached: 1 });

   // ❌ Wrong way (deprecated legacy fields)
   state.hasDrawnThisTurn = true;  // Don't use
   state.hasAttachedEnergyThisTurn = true;  // Don't use
   ```

### Module Responsibilities

#### IMPORTANT: Never mix responsibilities

- **Core MVC**: `state.js`, `logic.js`, `view.js`, `game.js`, `main.js`
- **Managers**: `action-hud-manager.js`, `animation-manager.js`, `data-manager.js`, `error-handler.js`, `memory-manager.js`, `modal-manager.js`, `phase-manager.js`, `setup-manager.js`, `turn-manager.js`
- **Integration**: `card-api.js`, `card-viewer-integration.js`, `toast-messages.js`, `game-logger.js`, `debug-system.js`
- **Utilities**: `card-orientation.js`, `dom-utils.js`, `ui-constants.js`, `z-index-constants.js`

## Development Rules

### IMPORTANT: Code Standards

1. **Module Imports**: Use ES6 module syntax (`import`/`export`), NOT CommonJS
2. **Naming Conventions**:
   - Variables/functions: `camelCase`
   - Constants: `UPPER_SNAKE_CASE`
   - Classes: `PascalCase`
   - Files: `kebab-case.js`

3. **State Management**:
   - NEVER mutate state directly
   - ALWAYS return new state objects
   - Use spread operator for updates: `{ ...state, field: newValue }`

4. **Function Purity**:
   - Game logic functions MUST be pure (no side effects)
   - DOM operations ONLY in `view.js` or view-related managers
   - State updates ONLY through proper state management

5. **Error Handling**:
   - Validate inputs before processing
   - Check null/undefined with defensive programming
   - Use `error-handler.js` for centralized error logging

### Performance Guidelines

- **Differential Rendering**: Only update changed DOM elements
- **Event Listener Management**: Remove listeners when components unmount
- **Memory Management**: Use `memory-manager.js` to monitor usage
- **Animation Queue**: Use `animation-manager.js` for coordinated animations

### Debugging Tools

```javascript
// Enable debug system for detailed logging
import { debugSystem } from './debug-system.js';
debugSystem.enable();

// Log state changes
import { gameLogger } from './game-logger.js';
gameLogger.logStateChange('ACTION_NAME', oldState, newState);
```

## Pokemon Card Game Rules

### Game Flow

```text
Setup:
  1. Shuffle decks → draw 7 cards
  2. Place 1 Basic Pokemon (active), up to 5 on bench (face-down)
  3. Set 6 prize cards face-down
  4. Mulligan: if no Basic Pokemon, redraw (opponent may draw extra)
  5. Flip all Pokemon face-up → first player starts

Turn Structure:
  1. Draw Phase: Draw 1 card (if unable → lose)

  2. Main Phase (any order, with limits):
     - Play Basic Pokemon to bench (max 5 bench)
     - Evolve Pokemon (NOT: same turn placed, same turn evolved, first turn)
     - Attach 1 Energy per turn (once per turn only)
     - Play Trainer cards:
       * Items: unlimited
       * Supporters: 1 per turn (NOT on first player's first turn)
       * Stadium: 1 in play (can replace)
     - Use Abilities (as specified on cards)
     - Retreat (once per turn, discard retreat cost)

  3. Attack Phase:
     - First player CANNOT attack on first turn
     - Choose 1 attack (must have required energy)
     - Calculate damage → knock out → take prize cards
     - Turn ends after attack

  4. End Phase (Pokemon Checkup):
     - Apply special conditions (poison → burn → sleep → paralysis)
     - Trigger "between turns" abilities
     - Check knocked out → take prizes → replace active if needed

Win Conditions:
  - Take all prize cards, OR
  - Opponent has no Pokemon in play, OR
  - Opponent cannot draw at start of turn
```

### Key Constraints

- **Energy Attachment**: 1 per turn limit
- **Evolution**: Cannot evolve Pokemon played or evolved this turn
- **First Turn**: Cannot attack (first player), cannot play Supporters
- **Bench Limit**: Maximum 5 Pokemon
- **Stadium**: Only 1 in play at a time

## Card Editor Integration

**IMPORTANT**: The card editor (`card_viewer.html`) integrates with the main game:

1. Launch card editor from main game via "Card Editor" button
2. Create/edit cards in the editor
3. Changes automatically sync to main game via `card-api.js` and `card-viewer-integration.js`
4. Card data persists to `data/cards-master.json`

## Workflow

### Feature Development

1. **Design**: Identify affected modules (respect separation of concerns)
2. **Implement**: Start with pure functions in `logic.js`, then integrate
3. **Test**: Create test file in `tests/` before main integration
4. **Debug**: Use `debug-system.js` and `game-logger.js`
5. **Verify**: Check state consistency and UI updates

### Common Patterns

```javascript
// Module imports
import { Game } from './game.js';
import { errorHandler } from './error-handler.js';
import { debugSystem } from './debug-system.js';
import { gameLogger } from './game-logger.js';

// State update pattern
const newState = {
    ...currentState,
    players: {
        ...currentState.players,
        [playerId]: {
            ...currentState.players[playerId],
            hand: [...currentState.players[playerId].hand, cardId]
        }
    }
};
```

## Git Conventions

```
feat: Add new feature
fix: Bug fix
refactor: Code refactoring (no behavior change)
test: Add/modify tests
docs: Documentation updates
style: Code formatting (no logic change)
```

## Additional Resources

- [State Pattern for Games](https://betterprogramming.pub/design-patterns-for-games-state-pattern-97519e0b9165)
- [JavaScript Game State Management](https://codeincomplete.com/articles/javascript-game-foundations-state-management/)
- [Digital Card Game Architecture](http://www.locogame.co.uk/blog/digital-card-game-p01/)
- [boardgame.io Framework](https://boardgame.io/) - Reference for turn-based games

---

## 📋 完全要件定義書 v3.0 (2026-01-04更新)

### 現在のアーキテクチャステータス

**ハイブリッド3D/2Dアーキテクチャ採用済み**:
- **手札**: DOM/CSS (業界標準TCG方式: Hearthstone, MTG Arena準拠)
- **バトル場**: Three.js (3D演出)

### 必須要件チェックリスト

#### ✅ AR-001: レンダリング分離
- [ ] **手札はDOM/CSSでレンダリング** (`view.js:_renderHand()`)
- [ ] **Three.js手札レンダリングは完全無効** (`three-view-bridge.js:_clearHand()`)
- [ ] **ボードはThree.jsでレンダリング** (active, bench, deck, discard, prize)
- [ ] **重複レンダリングなし** (DOM版とThree.js版が競合しない)

検証方法:
```javascript
// コンソールで確認
document.querySelectorAll('#player-hand .hand-slot').length  // → 7
document.querySelectorAll('#cpu-hand .hand-slot').length     // → 7
```

#### ✅ AR-002: カード配布アニメーション
- [ ] **フリップアニメーション実行** (`card-moves.js:dealHand()`)
- [ ] **DOM要素準備確認** (`setup-manager.js:animateInitialDraw()` - 最大10回リトライ)
- [ ] **animate import確認** (`setup-manager.js` line 18)
- [ ] **クリーンアップ実行** (opacity: 1, transform: none, visibility: visible)

実装ファイル:
- `src/js/setup-manager.js` - `dealInitialHands()`, `animateInitialDraw()`
- `src/js/animations/card-moves.js` - `dealHand()`
- `src/js/animation-manager.js` - `handDeal()`

#### ✅ AR-003: 手札ホバーエフェクト
- [ ] **スケール1.2倍** (20%拡大、業界標準)
- [ ] **リフト20px** (上昇)
- [ ] **トランジション250ms** (ease-out)
- [ ] **Mac Dockエフェクト初期化** (`view.js:_initHandDock()`)
- [ ] **呼吸アニメーション停止** (ホバー時)

実装ファイル:
- `src/js/view.js` - `_initHandDock()`
- `src/styles/layout/_hand-area.css` - `.hand-slot:hover`
- `src/js/three/card.js` - `setHovered()`

#### ✅ AR-004: 手札クリック可能性
- [ ] **pointer-events: auto !important** (全手札スロット)
- [ ] **cursor: pointer !important** (視覚的フィードバック)
- [ ] **親要素のpointer-events無効化** (#player-hand-container, #cpu-hand-container)
- [ ] **クリックイベントリスナー登録** (`view.js:_attachHandEventListeners()`)

実装ファイル:
- `src/styles/layout/_hand-area.css` - lines 75-76, 156-157
- `src/js/view.js` - `_attachHandEventListeners()`, `_handleHandCardClick()`

#### ✅ AR-005: サイドカードシステム
- [ ] **プレイヤー選択機能** (`game.js:_handlePrizeSelection()`)
- [ ] **CPU自動選択機能** (`game.js:_handleCpuPrizeSelection()`)
- [ ] **アニメーション実行** (`game.js:_animatePrizeTake()`, `three/card.js:animatePrizeTake()`)
- [ ] **金色グローエフェクト** (0xfcd34d, 400ms)
- [ ] **勝利条件判定** (`logic.js:checkForWinner()`)

実装ファイル:
- `src/js/logic.js` - `handlePokemonKnockout()`, `takePrizeCard()`
- `src/js/game.js` - `_handlePrizeSelection()`, `_handleCpuPrizeSelection()`, `_animatePrizeTake()`
- `src/js/three/card.js` - `animatePrizeTake()`

### 検証手順

#### Phase 1: 初期表示
1. ブラウザリロード
2. コンソール確認: `✅ Three.js Scene initialized`, `✅ GameContext initialized`
3. 「手札を7枚引く」ボタン表示確認

#### Phase 2: カード配布
1. ボタンクリック
2. フリップアニメーション確認（回転 + フェード）
3. プレイヤー手札7枚表示（画面下部）
4. CPU手札7枚表示（画面上部、小さめ）
5. コンソール確認: `✅ Initial hand draw animation completed`

#### Phase 3: ホバーエフェクト
1. 手札カードにマウスオーバー
2. カード拡大確認（1.2倍、明確に視認可能）
3. カード上昇確認（20px）
4. 近接カード影響確認（Mac Dockエフェクト）
5. カーソル変化確認（pointer）

#### Phase 4: クリック
1. 手札カードクリック
2. クリックイベント発火確認
3. カード選択状態確認
4. コンソール確認: クリックログ表示

#### Phase 5: ゲーム進行
1. たねポケモン配置
2. セットアップ完了
3. ドローフェーズ移行
4. メインフェーズ移行

### 既知の問題と対策

#### 問題1: カードが表示されない
**原因**: DOM要素のタイミング問題
**対策**: `_verifyDOMElements()` で最大20回リトライ (50ms間隔)

#### 問題2: アニメーションが動作しない
**原因**: `animate` import欠如
**対策**: `setup-manager.js` line 18 で import確認

#### 問題3: カードがクリックできない
**原因**: pointer-events継承問題
**対策**: `pointer-events: auto !important` で強制有効化

#### 問題4: ホバーエフェクトが見えない
**原因**: エフェクトが小さすぎる
**対策**: 業界標準値採用（1.2倍, 20px, 250ms）

### 重要な実装パターン

#### DOM要素準備確認パターン
```javascript
const maxAttempts = 10;
let attempts = 0;
while (attempts < maxAttempts) {
    const element = document.getElementById('target');
    if (element) break;
    await new Promise(resolve => setTimeout(resolve, 50));
    attempts++;
}
```

#### アニメーションクリーンアップパターン
```javascript
await animate();
// ✅ 確実に表示させるクリーンアップ
element.style.opacity = '1';
element.style.visibility = 'visible';
element.style.display = 'flex';
element.style.transform = 'none';
element.classList.remove('is-preparing-animation');
```

#### Three.js無効化パターン
```javascript
// hand rendering無効化
if (this.view?.threeViewBridge) {
    this.view.threeViewBridge._clearHand();
}
// hand interaction無効化
this.gameBoard3D.disableHandInteraction();
```

---

**Note**: This file serves as project memory for Claude Code. Keep it concise and focused on project-specific information. Update iteratively as patterns emerge.
