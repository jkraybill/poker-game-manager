# Event Lifecycle & State Management Documentation

## Overview

The poker game manager uses an event-driven architecture where state changes ALWAYS occur before past-tense events are emitted. This ensures consistency and prevents race conditions in consuming applications.

## Core Principle: State Before Events

**CRITICAL RULE**: State must change to its final value BEFORE any past-tense event is emitted.

```javascript
// ✅ CORRECT: State changes, then event fires
this.state = TableState.WAITING;
this.emit('hand:ended', data);

// ❌ WRONG: Event fires while state is still IN_PROGRESS
this.emit('hand:ended', data);
this.state = TableState.WAITING;
```

## Table States

The `Table` class has three states:

1. **WAITING** - Table is ready for a new game
2. **IN_PROGRESS** - Game is actively being played
3. **CLOSED** - Table is shut down

### State Transitions

```
WAITING → IN_PROGRESS (when tryStartGame() succeeds)
IN_PROGRESS → WAITING (when hand ends)
ANY → CLOSED (when close() is called)
```

## Complete Event Lifecycle

### 1. Game Start Sequence

```
State: WAITING → IN_PROGRESS
Events (in order):
1. table:ready         (when minPlayers reached, still WAITING)
2. game:started        (state is now IN_PROGRESS)
3. hand:started        (first hand begins)
4. cards:dealt         (hole cards distributed)
```

### 2. Betting Round Sequence

```
State: IN_PROGRESS (unchanged)
Events (per player action):
1. action:requested    (prompting player for action)
2. player:action       (AFTER validation, BEFORE processing)
3. action:performed    (action has been processed)
4. pot:updated         (if pot changed)
```

### 3. Community Cards Sequence

```
State: IN_PROGRESS (unchanged)
Events:
1. round:ended         (betting round complete)
2. cards:community     (flop/turn/river dealt)
   - phase: 'FLOP' | 'TURN' | 'RIVER'
```

### 4. Hand End Sequence (CRITICAL)

```
State: IN_PROGRESS → WAITING
Events (STRICT ORDER):
1. chips:awarded       (winners receive chips)
2. hand:complete       (internal engine event)
3. player:eliminated   (for each eliminated player, AFTER removal)
4. [State changes to WAITING]
5. hand:ended          (AFTER state change, v4.4.3 fix)
```

### 5. Player Elimination (ATOMIC)

```
Operations (in order):
1. Remove player from table (this.players.delete())
2. Add waiting player if available
3. Emit 'player:eliminated' event
```

This ensures the table state is consistent when the event fires.

## Event Details

### Table Events

| Event | When Fired | Table State | Data |
|-------|------------|-------------|------|
| `table:ready` | minPlayers reached | WAITING | `{ playerCount, minPlayers }` |
| `table:closed` | Table shutdown | CLOSED | `{ tableId }` |

### Game Flow Events

| Event | When Fired | Table State | Data |
|-------|------------|-------------|------|
| `game:started` | New game begins | IN_PROGRESS | `{ tableId, gameNumber, players }` |
| `game:ended` | Game terminated early | WAITING | `{ tableId, reason }` |
| `game:error` | Engine error | WAITING | `{ tableId, error }` |
| `game:start-failed` | tryStartGame() fails | WAITING | `{ success: false, reason, details }` |

### Hand Events

| Event | When Fired | Table State | Data |
|-------|------------|-------------|------|
| `hand:started` | New hand begins | IN_PROGRESS | `{ tableId, gameNumber, handNumber }` |
| `hand:ended` | Hand complete, AFTER state change | WAITING | `{ tableId, gameNumber, winners, pots }` |

### Card Events

| Event | When Fired | Table State | Data |
|-------|------------|-------------|------|
| `cards:dealt` | Hole cards distributed | IN_PROGRESS | `{ tableId, gameNumber }` |
| `cards:community` | Flop/turn/river | IN_PROGRESS | `{ tableId, phase, cards }` |

### Action Events

| Event | When Fired | Table State | Data |
|-------|------------|-------------|------|
| `action:requested` | Prompting player | IN_PROGRESS | `{ playerId, gameState }` |
| `player:action` | After validation, before processing | IN_PROGRESS | `{ playerId, action, amount }` |
| `action:performed` | Action processed | IN_PROGRESS | `{ playerId, action, amount }` |

### Pot Events

| Event | When Fired | Table State | Data |
|-------|------------|-------------|------|
| `pot:updated` | Pot changes | IN_PROGRESS | `{ total, contributions }` |
| `chips:awarded` | Winners paid | IN_PROGRESS | `{ winners, amounts }` |
| `side-pot:created` | Side pot formed | IN_PROGRESS | `{ potId, amount, eligiblePlayers }` |

### Player Events

| Event | When Fired | Table State | Data |
|-------|------------|-------------|------|
| `player:joined` | Player added | ANY | `{ player, tableId, seatNumber }` |
| `player:left` | Player removed | ANY | `{ playerId, tableId, chips }` |
| `player:waiting` | Added to wait list | ANY | `{ player, position }` |
| `player:eliminated` | Busted from game (ATOMIC) | IN_PROGRESS | `{ playerId, tableId, finalChips, startingChips, finishingPosition }` |

## Event Ordering Guarantees

### 1. State Consistency Guarantee
When you receive a past-tense event, the state has ALREADY changed:
- `hand:ended` → `isGameInProgress()` returns `false`
- `game:started` → `isGameInProgress()` returns `true`
- `player:eliminated` → Player is ALREADY removed from table

### 2. Elimination Before Completion
Player eliminations ALWAYS fire before `hand:ended`:
```
chips:awarded → player:eliminated → [state change] → hand:ended
```

### 3. Action Event Timing (v4.4.5)
`player:action` fires AFTER validation but BEFORE processing:
- Guarantees the action is valid
- Allows tracking/logging before state changes
- Ensures action is always emitted (even if processing fails)

## Critical Fixes History

### v4.4.3: Hand End Race Condition
**Problem**: `hand:ended` fired while state was still `IN_PROGRESS`
**Fix**: Change state to `WAITING` before emitting `hand:ended`
**File**: Table.js:730

### v4.4.5: Action Event Timing
**Problem**: `player:action` emitted after processing, could be missed
**Fix**: Emit after validation but before processing
**File**: GameEngine.js

### v4.4.5: Atomic Elimination
**Problem**: `player:eliminated` fired before player removal
**Fix**: Remove player first, then emit event
**File**: Table.js:700

## Best Practices for Event Listeners

### 1. Don't Assume State in Event Handlers
```javascript
// ❌ WRONG
table.on('hand:ended', () => {
  if (table.isGameInProgress()) { // This will be false!
    // ...
  }
});

// ✅ CORRECT
table.on('hand:ended', (data) => {
  // State is already WAITING
  // Use event data, not table state checks
  console.log(`Hand ended with ${data.winners.length} winners`);
});
```

### 2. Use Event Data, Not Table Queries
```javascript
// ❌ WRONG
table.on('player:eliminated', ({ playerId }) => {
  const player = table.players.get(playerId); // Already removed!
});

// ✅ CORRECT
table.on('player:eliminated', ({ playerId, startingChips, finalChips }) => {
  // Use provided event data
  console.log(`Player ${playerId} busted with ${finalChips} chips`);
});
```

### 3. Handle Events Asynchronously
```javascript
// ✅ CORRECT - Don't block the event emitter
table.on('hand:ended', async (data) => {
  // Process asynchronously
  await processHandEnd(data);
  
  // Start new game after processing
  await table.tryStartGame();
});
```

### 4. Order-Dependent Operations
```javascript
// If you need to track eliminations AND hand ends:
const eliminations = [];

table.on('player:eliminated', (data) => {
  eliminations.push(data);
});

table.on('hand:ended', (data) => {
  // Eliminations have already been collected
  processHandResult(data, eliminations);
  eliminations.length = 0; // Reset for next hand
});
```

## State Query Methods

### Table State Methods

| Method | Returns | When to Use |
|--------|---------|-------------|
| `isGameInProgress()` | `boolean` | Check if game active |
| `getPlayerCount()` | `number` | Current player count |
| `getInfo()` | `object` | Full table information |

### State in Events

Most events include relevant state in their data payload:
- Don't query table state during event handling
- Use the provided event data for consistency
- State queries are for external checks, not event handlers

## Testing Event Sequences

Use the provided test utilities for reliable event testing:

```javascript
import { setupEventCapture, waitForHandEnd } from './test-utils/eventCapture.js';

// Capture all events
const eventState = setupEventCapture(table);

// Start game
await table.tryStartGame();

// Wait for completion
await waitForHandEnd(eventState);

// Verify event order
expect(eventState.events.map(e => e.event)).toEqual([
  'game:started',
  'hand:started',
  'cards:dealt',
  // ... actions ...
  'chips:awarded',
  'player:eliminated', // if any
  'hand:ended'
]);
```

## Common Patterns

### Starting Games Automatically
```javascript
// Auto-start when ready
table.on('table:ready', async () => {
  await table.tryStartGame();
});

// Auto-restart after hands
table.on('hand:ended', async () => {
  // Add delay if desired
  setTimeout(() => table.tryStartGame(), 1000);
});
```

### Tournament Management
```javascript
// Track eliminations for tournament
table.on('player:eliminated', ({ playerId, finishingPosition }) => {
  tournament.recordFinish(playerId, finishingPosition);
  
  // Move player to another table if needed
  if (tournament.shouldRebalance()) {
    tournament.rebalanceTables();
  }
});
```

### Statistics Tracking
```javascript
// Track all actions for analysis
const actionLog = [];

table.on('player:action', (data) => {
  actionLog.push({
    ...data,
    timestamp: Date.now(),
    handNumber: currentHandNumber
  });
});

table.on('hand:ended', () => {
  saveHandStatistics(actionLog);
  actionLog.length = 0;
});
```

## Debugging Event Issues

### 1. Event Order Problems
Enable comprehensive event capture:
```javascript
const debug = setupEventCapture(table, { captureAll: true });
// After issue occurs:
console.log(debug.events.map(e => `${e.event} @ ${e.timestamp}`));
```

### 2. Missing Events
Check event listener setup:
```javascript
// Verify listener is attached
console.log(table.eventNames()); // Should include your event

// Check for typos
table.on('hand:ended', handler);  // ✅ Correct
table.on('hand:end', handler);    // ❌ Wrong event name
```

### 3. Race Conditions
Use promises for sequential operations:
```javascript
// ✅ CORRECT - Wait for each operation
await table.tryStartGame();
await waitForHandEnd(eventState);
await table.tryStartGame(); // Next game

// ❌ WRONG - Race condition
table.tryStartGame();
table.tryStartGame(); // May fail, first game still running
```

## Version History

- **v4.4.5**: Fixed player:action timing, atomic eliminations
- **v4.4.3**: Fixed hand:ended race condition
- **v3.0.2**: Initial event ordering implementation
- **v2.x**: Legacy event system (deprecated)