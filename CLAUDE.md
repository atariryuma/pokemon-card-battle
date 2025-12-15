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

**Note**: This file serves as project memory for Claude Code. Keep it concise and focused on project-specific information. Update iteratively as patterns emerge.
