# Quick Debug Reference

## Console Log Quick Reference

### When You Click a Card, You Should See:

```
1. BoardEventHandler: click received HTMLDivElement
2. BoardEventHandler: found slot? <div class="card-slot">
3. BoardEventHandler: clickInfo {owner: "player", zone: "hand", ...}
4. SLOT CLICKED (view.js): {owner: "player", zone: "hand", index: "0", hasCard: true, cardId: "..."}
5. Card Click: {owner: "player", zone: "hand", cardId: "...", index: "0", currentPhase: "PLAYER_MAIN", turnPlayer: "player", isProcessing: false}
6. ALLOWED: Click allowed, processing...
```

### If Click is Blocked:

**During CPU Turn:**
```
Card Click: {owner: "player", ..., turnPlayer: "cpu", ...}
BLOCKED: CPU turn, Player card clicked
```

**Click CPU Card During Player Turn:**
```
Card Click: {owner: "cpu", ..., turnPlayer: "player", ...}
BLOCKED: Player turn, CPU card clicked {zone: "active"}
```

**While Processing:**
```
Card Click: {..., isProcessing: true}
BLOCKED: isProcessing = true
```

### For 3D Dragging:

**Allowed:**
```
THREE.JS MOUSE DOWN: {objectType: "card", owner: "player", isDraggable: true, currentPlayer: "player"}
```

**Blocked:**
```
THREE.JS MOUSE DOWN: {objectType: "card", owner: "player", isDraggable: true, currentPlayer: "cpu"}
DRAG BLOCKED: Wrong turn {owner: "player", currentPlayer: "cpu"}
```

## Key Information in Logs

| Field | Meaning |
|-------|---------|
| `owner` | Who owns the card ("player" or "cpu") |
| `zone` | Where the card is ("hand", "active", "bench", "deck", "prize") |
| `cardId` | Unique identifier for the card |
| `index` | Position in the zone (e.g., bench slot 0-4) |
| `currentPhase` | Current game phase (e.g., "PLAYER_MAIN", "SETUP") |
| `turnPlayer` | Whose turn it is ("player" or "cpu") |
| `isProcessing` | Whether game is currently processing an action |

## Common Debug Scenarios

### "Why isn't my click working?"

Check the logs for:
1. Does `BoardEventHandler: click received` appear?
   - No → Click event not reaching handler
2. Does `SLOT CLICKED (view.js)` appear?
   - No → Slot not properly set up with click listener
3. Does `Card Click:` appear?
   - No → cardClickHandler not properly connected
4. Is there a `BLOCKED:` message?
   - Yes → Check the reason (turn, processing, etc.)

### "Cards are clickable but nothing happens"

Look for:
- `ALLOWED: Click allowed, processing...` ← Should appear
- Check what phase-specific handler is called next
- No phase handler → Might be wrong game phase

### "3D dragging not working"

Check for:
- `THREE.JS MOUSE DOWN:` with correct `currentPlayer`
- `DRAG BLOCKED:` indicates turn mismatch
- No log at all → 3D interaction system not initialized

## Enable/Disable Logs

To temporarily disable logs, search and comment out console.log statements:

```javascript
// console.log('Card Click:', {
```

Or use console filtering in browser DevTools.

## Browser Console Tips

- Filter by text: Use the filter box in DevTools
  - Type "BLOCKED" to see only blocked clicks
  - Type "ALLOWED" to see only allowed clicks
- Clear console: Ctrl+L (Windows) or Cmd+K (Mac)
- Preserve log: Check "Preserve log" to keep logs across page reloads
