# How to Access Pot Information - API Guide

## ❌ INCORRECT: Using table.pot

```javascript
// This DOES NOT EXIST in the API
const pot = table.pot; // Returns undefined
console.log(pot); // undefined (NOT 0!)
```

The Table class does not expose a `.pot` property directly.

## ✅ CORRECT METHOD 1: Direct Access via GameEngine

During an active game, you can access the pot through the game engine:

```javascript
// After starting a game
const result = await table.tryStartGame();

// Access pot during the game
if (table.gameEngine && table.gameEngine.potManager) {
  const currentPot = table.gameEngine.potManager.getTotal();
  console.log('Current pot:', currentPot);
}

// Safe access with fallback
const pot = table.gameEngine?.potManager?.getTotal() || 0;
```

## ✅ CORRECT METHOD 2: Through Events (Recommended)

The best way to track pot changes is through events:

```javascript
// Listen for pot updates during the game
table.on('pot:updated', (data) => {
  console.log('Pot updated:', data.total);
  console.log('Player contributions:', data.contributions);
});

// Get final pot information when hand ends
table.on('hand:ended', (data) => {
  console.log('Winners:', data.winners);
  console.log('Main pot:', data.pot);
  console.log('Side pots:', data.sidePots);
});

// Track side pot creation
table.on('side-pot:created', (data) => {
  console.log('Side pot created:', data.amount);
  console.log('Eligible players:', data.eligiblePlayers);
});
```

## ✅ CORRECT METHOD 3: Through Player's Game State

When implementing a Player, the pot is provided in the game state:

```javascript
class MyPlayer extends Player {
  async getAction(gameState) {
    // Pot is available in gameState
    console.log('Current pot:', gameState.pot);
    console.log('Amount to call:', gameState.toCall);
    
    // Make decision based on pot odds
    const potOdds = gameState.toCall / (gameState.pot + gameState.toCall);
    
    if (potOdds < 0.3) {
      return { action: Action.CALL };
    }
    return { action: Action.FOLD };
  }
}
```

## Complete Example: Tracking Pot Throughout a Hand

```javascript
import { Table, Player, Action } from '@jkraybill/poker-game-manager';

class SimplePlayer extends Player {
  async getAction(gameState) {
    // Pot is available here
    console.log(`[${this.name}] Pot is ${gameState.pot}, to call: ${gameState.toCall}`);
    
    const { validActions } = gameState;
    if (validActions.includes(Action.CHECK)) return { action: Action.CHECK };
    if (validActions.includes(Action.CALL)) return { action: Action.CALL };
    return { action: Action.FOLD };
  }
}

async function trackPotExample() {
  const table = new Table({
    id: 'pot-example',
    blinds: { small: 10, big: 20 }
  });
  
  // Track pot through events
  let currentPot = 0;
  
  table.on('pot:updated', (data) => {
    currentPot = data.total;
    console.log(`[EVENT] Pot updated to: ${currentPot}`);
  });
  
  table.on('hand:ended', (data) => {
    console.log(`[HAND END] Final pot: ${data.pot || 0}`);
    console.log(`[HAND END] Winners:`, data.winners);
  });
  
  // Add players
  const p1 = new SimplePlayer({ id: 'p1', name: 'Alice' });
  p1.chips = 1000;
  table.addPlayer(p1);
  
  const p2 = new SimplePlayer({ id: 'p2', name: 'Bob' });
  p2.chips = 1000;
  table.addPlayer(p2);
  
  // Start game
  await table.tryStartGame();
  
  // Access pot directly during game
  if (table.gameEngine) {
    const pot = table.gameEngine.potManager.getTotal();
    console.log(`[DIRECT ACCESS] Current pot: ${pot}`);
  }
}
```

## Common Mistakes

### ❌ Mistake 1: Accessing non-existent properties
```javascript
console.log(table.pot);        // undefined
console.log(table.potManager);  // undefined
console.log(table.totalPot);    // undefined
```

### ❌ Mistake 2: Not checking if game is active
```javascript
// This will throw if no game is running
const pot = table.gameEngine.potManager.getTotal(); // Error!
```

### ✅ Correct: Safe access
```javascript
const pot = table.gameEngine?.potManager?.getTotal() || 0;
```

## Test Examples

See these test files for working examples:

1. **PotManager Unit Tests**: `/packages/core/src/game/PotManager.test.js`
   - Shows how PotManager.getTotal() works
   - Examples of side pot scenarios

2. **Integration Tests**: `/packages/core/src/test/integration/blind-posting-bug.test.js`
   - Shows correct pot access during gameplay
   - Demonstrates blind posting with insufficient chips

3. **GameEngine Tests**: `/packages/core/src/game/GameEngine.test.js`
   - Shows how pot is tracked internally
   - Examples of pot updates during betting

## Key Points

1. **No table.pot property** - This doesn't exist in the API
2. **Use events for tracking** - Most reliable way to track pot changes
3. **Direct access via gameEngine** - Only available during active games
4. **Player game state** - Pot is provided to players when making decisions
5. **Always check for null** - Use optional chaining (`?.`) for safety

## For Tournament/Production Use

```javascript
class TournamentTable {
  constructor(table) {
    this.table = table;
    this.currentPot = 0;
    
    // Track pot through events
    table.on('pot:updated', (data) => {
      this.currentPot = data.total;
    });
    
    table.on('hand:ended', () => {
      this.currentPot = 0; // Reset for next hand
    });
  }
  
  getPot() {
    // Try direct access first
    if (this.table.gameEngine?.potManager) {
      return this.table.gameEngine.potManager.getTotal();
    }
    // Fall back to tracked value
    return this.currentPot;
  }
}
```