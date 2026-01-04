# Debug Logging Summary

## Overview
Detailed debug logging has been added to track click event handling throughout the application.

## Modified Files

### 1. game.js - _handleCardClick function (Lines ~997-1037)

**Logs Added:**
- **Card Click:** Logs when any card is clicked, showing:
  - owner, zone, cardId, index
  - currentPhase, turnPlayer, isProcessing

- **BLOCKED: isProcessing = true** - When click is ignored due to processing

- **BLOCKED: Player turn, CPU card clicked** - When player clicks CPU card during player turn
  - Also shows: `{ zone }`

- **INFO: Info display allowed for CPU active/bench** - When info display is allowed

- **BLOCKED: CPU turn, Player card clicked** - When player tries to click during CPU turn

- **ALLOWED: Click allowed, processing...** - When click passes all validation

### 2. view.js - _makeSlotClickable function (Lines ~1755-1778)

**Logs Added:**
- **SLOT CLICKED (view.js):** Logs when a slot is clicked in the DOM, showing:
  - owner, zone, index
  - hasCard (boolean)
  - cardId

### 3. three/interaction.js - _handleMouseDown function (Lines ~159-182)

**Logs Added:**
- **THREE.JS MOUSE DOWN:** Logs when 3D objects are clicked, showing:
  - objectType
  - owner
  - isDraggable
  - currentPlayer

- **DRAG BLOCKED: Wrong turn** - When drag is blocked due to wrong turn
  - Shows: `{ owner, currentPlayer }`

### 4. view/board-event-handler.js - _handleClick function (Lines ~39-68)

**Existing Logs (Already Present):**
- BoardEventHandler: click received
- BoardEventHandler: disabled, ignoring
- BoardEventHandler: found slot?
- BoardEventHandler: no card-slot found in target chain
- BoardEventHandler: clickInfo

## Log Flow Diagram

```
User Clicks Card
    |
    v
[BoardEventHandler._handleClick]
    - "click received"
    - "found slot?"
    - "clickInfo"
    |
    v
[View._makeSlotClickable event listener]
    - "SLOT CLICKED (view.js):"
    |
    v
[Game._handleCardClick]
    - "Card Click:" (initial info)
    - VALIDATION CHECKS:
      - "BLOCKED: isProcessing = true" OR
      - "BLOCKED: Player turn, CPU card clicked" OR
      - "INFO: Info display allowed" OR
      - "BLOCKED: CPU turn, Player card clicked" OR
      - "ALLOWED: Click allowed, processing..."
    |
    v
[Phase-specific handlers]
```

## Three.js Drag Flow

```
User Mouse Down on 3D Object
    |
    v
[Interaction._handleMouseDown]
    - "THREE.JS MOUSE DOWN:"
    - CHECK: Is it player's turn?
      - No → "DRAG BLOCKED: Wrong turn"
      - Yes → Continue drag
```

## Testing Instructions

1. **Start the development server**
   ```bash
   npm start
   # OR
   node server.js
   ```

2. **Open browser console** (F12)

3. **Test scenarios:**

   **a) Click player's card during player turn**
   - Expected logs:
     - BoardEventHandler: click received
     - BoardEventHandler: found slot? [object]
     - BoardEventHandler: clickInfo {owner: "player", ...}
     - SLOT CLICKED (view.js): {owner: "player", ...}
     - Card Click: {owner: "player", ...}
     - ALLOWED: Click allowed, processing...

   **b) Click CPU's card during player turn**
   - Expected logs:
     - SLOT CLICKED (view.js): {owner: "cpu", ...}
     - Card Click: {owner: "cpu", ...}
     - BLOCKED: Player turn, CPU card clicked

   **c) Click player's card during CPU turn**
   - Expected logs:
     - SLOT CLICKED (view.js): {owner: "player", ...}
     - Card Click: {owner: "player", ...}
     - BLOCKED: CPU turn, Player card clicked

   **d) Click while game is processing**
   - Expected logs:
     - Card Click: {isProcessing: true, ...}
     - BLOCKED: isProcessing = true

   **e) Drag 3D card during player turn**
   - Expected logs:
     - THREE.JS MOUSE DOWN: {objectType: "card", ...}
     - (drag continues)

   **f) Drag 3D card during CPU turn**
   - Expected logs:
     - THREE.JS MOUSE DOWN: {currentPlayer: "cpu", ...}
     - DRAG BLOCKED: Wrong turn {owner: "player", currentPlayer: "cpu"}

## Log Prefixes Guide

- **Card Click:** - Initial click information
- **BLOCKED:** - Click/drag was blocked (with reason)
- **INFO:** - Additional information
- **ALLOWED:** - Click/drag was allowed to proceed
- **SLOT CLICKED:** - DOM slot was clicked
- **THREE.JS MOUSE DOWN:** - 3D object interaction
- **BoardEventHandler:** - Low-level event handling

## Troubleshooting

If logs are not appearing:
1. Check browser console is open
2. Verify log level is not filtered (should show "Info" level logs)
3. Clear browser cache and reload
4. Check if server has been restarted after modifications

## Files Modified

- `c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/game.js`
- `c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/view.js`
- `c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/three/interaction.js`
- `c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/view/board-event-handler.js` (already had logs)

## Backup Files

- `c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/game.js.backup` (original game.js)

## Scripts Used

- `add_debug_final.py` - Python script that added the debug logs
