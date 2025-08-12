# BREAKING CHANGE: tryStartGame Return Value (v4.1.0+)

## The Problem
If your code is checking `tryStartGame()` return value like this, it's BROKEN in v4.1+:

```javascript
// ❌ BROKEN CODE - This will NOT work in v4.1+
const result = await table.tryStartGame();
if (result === false) {  // This will NEVER be true in v4.1+
  console.log('Game failed to start');
}
if (result === true) {   // This will NEVER be true in v4.1+
  console.log('Game started');
}
```

## The Solution
You MUST update your code to check the object properties:

```javascript
// ✅ CORRECT CODE for v4.1+
const result = await table.tryStartGame();
if (!result.success) {
  console.log('Game failed to start:', result.reason);
  console.log('Details:', result.details);
}
if (result.success) {
  console.log('Game started successfully');
}
```

## What tryStartGame Returns in v4.1+

**ALWAYS returns an object**, NEVER returns `true` or `false`:

```javascript
// Success case
{
  success: true,
  reason: 'GAME_STARTED',
  details: {
    tableId: 'table-id',
    gameNumber: 1,
    playerCount: 4,
    blinds: { small: 10, big: 20 },
    message: 'Game #1 started successfully with 4 players'
  }
}

// Failure cases
{
  success: false,
  reason: 'TABLE_NOT_READY' | 'INSUFFICIENT_PLAYERS' | 'INSUFFICIENT_ACTIVE_PLAYERS' | 'ENGINE_ERROR',
  details: {
    // Comprehensive debugging information
    currentState: 'IN_PROGRESS',
    message: 'Detailed error message',
    tableId: 'table-id',
    timestamp: '2025-08-12T07:00:00.000Z',
    // ... many more debugging fields
  }
}
```

## Migration Guide

### Old Code (v3.x - v4.0.x)
```javascript
// v3.x (synchronous, returns boolean)
const started = table.tryStartGame();
if (!started) {
  console.log('Failed to start');
}

// v4.0.x (async, returns boolean)
const started = await table.tryStartGame();
if (!started) {
  console.log('Failed to start');
}
```

### New Code (v4.1.0+)
```javascript
// v4.1+ (async, returns object)
const result = await table.tryStartGame();
if (!result.success) {
  console.log('Failed to start:', result.reason);
  console.log('Debug info:', result.details);
  
  // Handle specific failure reasons
  switch (result.reason) {
    case 'TABLE_NOT_READY':
      // Table is already running a game or closed
      break;
    case 'INSUFFICIENT_PLAYERS':
      // Not enough players joined
      console.log(`Need ${result.details.minPlayers} players, have ${result.details.currentPlayers}`);
      break;
    case 'INSUFFICIENT_ACTIVE_PLAYERS':
      // Players joined but have no chips
      console.log('Players without chips:', result.details.playersWithNoChips);
      break;
    case 'ENGINE_ERROR':
      // Game engine failed to initialize
      console.error('Engine error:', result.details.error);
      break;
  }
}
```

## Common Pitfalls

### ❌ Wrong: Boolean Comparison
```javascript
if (result === false) { /* This never executes in v4.1+ */ }
if (result === true) { /* This never executes in v4.1+ */ }
if (!result) { /* This is always false - result is always an object */ }
```

### ✅ Correct: Property Check
```javascript
if (!result.success) { /* Check the success property */ }
if (result.success) { /* Check the success property */ }
```

### ❌ Wrong: Type Coercion
```javascript
if (result) { 
  // This ALWAYS executes because result is always a truthy object
  console.log('Started'); // WRONG - might not have started!
}
```

### ✅ Correct: Explicit Check
```javascript
if (result && result.success) {
  console.log('Started successfully');
}
```

## Debugging Helper

Add this to catch migration issues:

```javascript
const result = await table.tryStartGame();

// Debug assertion to catch old-style checks
if (typeof result === 'boolean') {
  throw new Error('Unexpected boolean from tryStartGame - are you using v4.0.x?');
}
if (result === true || result === false) {
  throw new Error('Invalid comparison - tryStartGame returns object in v4.1+');
}

// Proceed with correct v4.1+ handling
if (!result.success) {
  // Handle failure
}
```

## Event Listening

v4.1+ also emits a `game:start-failed` event with full details:

```javascript
table.on('game:start-failed', (failure) => {
  console.error('Game start failed:', failure);
  // Log to monitoring service
  logger.error('Game start failure', {
    reason: failure.reason,
    details: failure.details
  });
});
```