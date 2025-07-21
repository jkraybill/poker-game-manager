# Integration Guide 🃏

This guide shows you how to integrate the Poker Game Manager library into your application.

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [Player Implementation](#player-implementation)
5. [Table Management](#table-management)
6. [Event System](#event-system)
7. [Complete Examples](#complete-examples)
8. [Testing Best Practices](#testing-best-practices)
9. [Advanced Topics](#advanced-topics)
10. [API Reference](#api-reference)

## Installation

```bash
npm install @poker-manager/core
```

## Quick Start

```javascript
import { PokerGameManager, Player, Action } from '@poker-manager/core';

// Create the game manager
const manager = new PokerGameManager();

// Create a table
const table = manager.createTable({
  blinds: { small: 10, big: 20 },
  minBuyIn: 1000,
  maxBuyIn: 5000,
  minPlayers: 2,
});

// Add players
table.addPlayer(player1);
table.addPlayer(player2);

// IMPORTANT: Tables no longer auto-start
// You must explicitly start the game
table.tryStartGame();
```

## Core Concepts

### 1. No Automatic Game Start
Tables no longer automatically start games when minimum players are reached. You must explicitly call `tryStartGame()`:

```javascript
// Add players first
table.addPlayer(player1);
table.addPlayer(player2);

// Then start the game
table.tryStartGame();

// No automatic restart after hands end
// You must call tryStartGame() again for the next hand
```

### 2. Enhanced Player API
The `gameState` object now includes `lastAction` for each player, enabling advanced strategies:

```javascript
getAction(gameState) {
  // Access other players' last actions
  const raisers = Object.values(gameState.players)
    .filter(p => p.lastAction === Action.RAISE);
  
  // Player state includes:
  // - id: player ID
  // - chips: current chip count
  // - bet: current bet this round
  // - state: ACTIVE, FOLDED, ALL_IN, etc.
  // - hasActed: whether acted this round
  // - lastAction: previous action (CHECK, BET, RAISE, etc.)
}
```

## Player Implementation

Every player must extend the `Player` class and implement the `getAction()` method:

```javascript
import { Player, Action } from '@poker-manager/core';

class StrategicPlayer extends Player {
  constructor(config) {
    super(config);
    this.style = config.style || 'balanced';
  }

  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    
    // Advanced strategy using lastAction
    const aggressors = Object.values(gameState.players)
      .filter(p => p.lastAction === Action.RAISE || p.lastAction === Action.BET)
      .length;
    
    // Squeeze play opportunity
    if (aggressors === 1 && this.detectCallers(gameState) >= 1) {
      return this.squeezePlay(gameState);
    }
    
    // Standard decision logic
    if (toCall === 0) {
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now(),
      };
    }
    
    // Must return action with playerId and timestamp
    return {
      playerId: this.id,
      action: Action.FOLD,
      timestamp: Date.now(),
    };
  }
  
  detectCallers(gameState) {
    return Object.values(gameState.players)
      .filter(p => p.lastAction === Action.CALL)
      .length;
  }
  
  squeezePlay(gameState) {
    const myState = gameState.players[this.id];
    const squeezeAmount = gameState.currentBet * 3.5;
    
    if (squeezeAmount >= myState.chips) {
      return {
        playerId: this.id,
        action: Action.ALL_IN,
        amount: myState.chips,
        timestamp: Date.now(),
      };
    }
    
    return {
      playerId: this.id,
      action: Action.RAISE,
      amount: squeezeAmount,
      timestamp: Date.now(),
    };
  }

  // Optional: Handle receiving hole cards
  receivePrivateCards(cards) {
    super.receivePrivateCards(cards);
    this.holeCards = cards;
  }
}
```

## Table Management

### Creating Tables

```javascript
const table = manager.createTable({
  id: 'high-stakes-1',           // Optional custom ID
  variant: 'texas-holdem',        // Game variant (default)
  maxPlayers: 9,                  // Maximum seats
  minPlayers: 2,                  // Minimum to start
  blinds: { small: 25, big: 50 }, // Blind structure
  minBuyIn: 2000,                 // Minimum chips
  maxBuyIn: 10000,                // Maximum chips
  timeout: 30000,                 // Decision timeout (ms)
  dealerButton: 0,                // Initial button position
});
```

### Multi-Table Support

```javascript
// Create multiple tables
const cashGame = manager.createTable({ 
  id: 'cash-1',
  blinds: { small: 1, big: 2 },
});

const tournament = manager.createTable({
  id: 'tourney-1',
  blinds: { small: 50, big: 100 },
});

// Access tables
const table = manager.getTable('cash-1');
const allTables = manager.getTables();

// Monitor all tables via event forwarding
manager.on('table:event', ({ tableId, eventName, data }) => {
  console.log(`Table ${tableId}: ${eventName}`, data);
});
```

## Event System

### Table Events

```javascript
// Game lifecycle
table.on('game:started', ({ gameNumber, players }) => {
  console.log(`Game ${gameNumber} started`);
});

table.on('hand:started', ({ dealerButton }) => {
  console.log(`New hand, button at position ${dealerButton}`);
});

table.on('hand:ended', ({ winners }) => {
  // Note: 'hand:complete' is mapped to 'hand:ended' for compatibility
  console.log('Hand complete, winners:', winners);
});

// Player events
table.on('player:joined', ({ player }) => {
  console.log(`${player.name} joined the table`);
});

table.on('player:action', ({ playerId, action, amount }) => {
  console.log(`Player ${playerId}: ${action} ${amount || ''}`);
});

// Betting rounds
table.on('round:started', ({ phase }) => {
  console.log(`${phase} round started`);
});

// Pot updates
table.on('pot:updated', ({ total, sidePots }) => {
  console.log(`Main pot: $${total}`);
  if (sidePots?.length > 0) {
    console.log('Side pots:', sidePots);
  }
});
```

### Manager Events

```javascript
// Table management
manager.on('table:created', ({ tableId, table }) => {
  console.log(`Table ${tableId} created`);
});

manager.on('table:removed', ({ tableId }) => {
  console.log(`Table ${tableId} removed`);
});

// Global event forwarding
manager.on('table:event', ({ tableId, eventName, data }) => {
  // All table events are forwarded here
  console.log(`[${tableId}] ${eventName}:`, data);
});
```

## Complete Examples

### Example 1: Heads-Up Game

```javascript
import { PokerGameManager, Player, Action } from '@poker-manager/core';

// Simple aggressive player
class AggressivePlayer extends Player {
  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    
    // Always raise if possible
    if (toCall === 0 && myState.chips > gameState.currentBet) {
      return {
        playerId: this.id,
        action: Action.BET,
        amount: Math.min(gameState.pot, myState.chips),
        timestamp: Date.now(),
      };
    }
    
    // Call any bet up to half stack
    if (toCall > 0 && toCall <= myState.chips / 2) {
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now(),
      };
    }
    
    // Otherwise fold
    return {
      playerId: this.id,
      action: toCall > 0 ? Action.FOLD : Action.CHECK,
      timestamp: Date.now(),
    };
  }
}

async function runHeadsUp() {
  const manager = new PokerGameManager();
  const table = manager.createTable({
    blinds: { small: 10, big: 20 },
    minBuyIn: 1000,
    maxBuyIn: 1000,
    minPlayers: 2,
  });
  
  // Create players
  const player1 = new AggressivePlayer({ name: 'Alice' });
  const player2 = new AggressivePlayer({ name: 'Bob' });
  
  // Wait for hand to complete
  const handResult = new Promise(resolve => {
    table.on('hand:ended', ({ winners }) => {
      resolve(winners);
    });
  });
  
  // Add players and start
  table.addPlayer(player1);
  table.addPlayer(player2);
  table.tryStartGame();
  
  // Wait for result
  const winners = await handResult;
  console.log('Winners:', winners);
  
  // Clean up
  table.close();
}
```

### Example 2: Multi-Way Pot with Side Pots

```javascript
class StackSizePlayer extends Player {
  constructor(config) {
    super(config);
    this.stackSize = config.stackSize;
  }
  
  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    
    // Short stacks go all-in when facing bets
    if (this.stackSize === 'short' && toCall > 0) {
      return {
        playerId: this.id,
        action: Action.ALL_IN,
        amount: myState.chips,
        timestamp: Date.now(),
      };
    }
    
    // Big stacks raise to put pressure
    if (this.stackSize === 'big' && gameState.currentBet < 100) {
      return {
        playerId: this.id,
        action: Action.RAISE,
        amount: 150,
        timestamp: Date.now(),
      };
    }
    
    // Medium stacks call reasonable bets
    if (toCall > 0 && toCall <= myState.chips * 0.3) {
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now(),
      };
    }
    
    return {
      playerId: this.id,
      action: toCall > 0 ? Action.FOLD : Action.CHECK,
      timestamp: Date.now(),
    };
  }
}

// Create players with different stack sizes
const shortStack = new StackSizePlayer({ 
  name: 'Short Stack',
  stackSize: 'short',
});

const bigStack = new StackSizePlayer({ 
  name: 'Big Stack',
  stackSize: 'big',
});
```

### Example 3: Tournament Bubble Play

```javascript
class BubblePlayer extends Player {
  constructor(config) {
    super(config);
    this.isBubble = config.isBubble;
    this.position = config.position;
  }
  
  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    const mRatio = myState.chips / (gameState.blinds.small + gameState.blinds.big);
    
    // ICM pressure on bubble
    if (this.isBubble && mRatio < 10) {
      // Shove from late position
      if (this.position === 'BUTTON' || this.position === 'CO') {
        return {
          playerId: this.id,
          action: Action.ALL_IN,
          amount: myState.chips,
          timestamp: Date.now(),
        };
      }
    }
    
    // Exploit bubble dynamics
    const shortStacks = Object.values(gameState.players)
      .filter(p => p.chips < myState.chips * 0.5)
      .length;
    
    if (shortStacks >= 2 && toCall === 0) {
      // Apply pressure as big stack
      return {
        playerId: this.id,
        action: Action.BET,
        amount: gameState.blinds.big * 2.5,
        timestamp: Date.now(),
      };
    }
    
    // Tight play otherwise
    return {
      playerId: this.id,
      action: toCall > myState.chips * 0.2 ? Action.FOLD : Action.CHECK,
      timestamp: Date.now(),
    };
  }
}
```

## Testing Best Practices

### Handling Race Conditions

When testing, use proper delays to handle asynchronous operations:

```javascript
import { vi } from 'vitest';

it('should handle complex scenarios', async () => {
  const table = manager.createTable({ /* config */ });
  
  let handEnded = false;
  let winners = [];
  
  // Capture data in event handler with delay
  table.on('hand:ended', (result) => {
    if (!handEnded) {
      handEnded = true;
      winners = result.winners;
      // Add delay for state updates
      setTimeout(() => table.close(), 50);
    }
  });
  
  // Start game
  table.tryStartGame();
  
  // Wait with Vitest utilities
  await vi.waitFor(() => handEnded, { timeout: 1000 });
  
  // Additional delay for async operations
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Now safe to check results
  expect(winners.length).toBeGreaterThan(0);
});
```

### Deterministic Testing

Always use fixed dealer button positions for consistent tests:

```javascript
const table = manager.createTable({
  blinds: { small: 10, big: 20 },
  dealerButton: 0, // Fixed position for testing
});

// With dealerButton: 0
// 2 players: P0 = SB/Button, P1 = BB
// 3 players: P0 = Button, P1 = SB, P2 = BB
// 4+ players: P0 = Button, then positions clockwise
```

## Advanced Topics

### Memory Management

```javascript
// Clean up tables after use
afterEach(() => {
  manager.tables.forEach(table => table.close());
});

// Monitor memory usage
const stats = manager.getStats();
console.log(`Memory usage: ${stats.memoryUsage / 1024 / 1024}MB`);
```

### Custom Hand Evaluation

The library uses the `pokersolver` library for hand evaluation:

```javascript
// Card format uses T for 10
const validCards = ['As', 'Kh', 'Qd', 'Jc', 'Ts', '9s', '8h'];
// NOT: ['As', 'Kh', 'Qd', 'Jc', '10s', '9s', '8h'] // Wrong!
```

### Performance Optimization

```javascript
// Batch event handling
const actions = [];
table.on('player:action', (action) => {
  actions.push(action);
});

// Process in batches
setInterval(() => {
  if (actions.length > 0) {
    processBatch(actions.splice(0));
  }
}, 100);
```

### State Persistence

```javascript
// Get current table state
const state = table.getInfo();

// Save to database
await saveTableState(state);

// Note: Full restoration requires custom implementation
// as player instances cannot be serialized
```

## API Reference

### PokerGameManager

```javascript
class PokerGameManager extends EventEmitter {
  constructor(config?: {
    maxTables?: number;        // Default: 1000
    defaultTimeout?: number;   // Default: 30000ms
  });
  
  createTable(config?: TableConfig): Table;
  getTable(tableId: string): Table | undefined;
  getTables(): Table[];
  closeTable(tableId: string): boolean;
  closeAllTables(): void;
  getStats(): {
    totalTables: number;
    activeTables: number;
    totalPlayers: number;
    memoryUsage: number;
  };
}
```

### Table

```javascript
class Table extends EventEmitter {
  constructor(config: TableConfig);
  
  addPlayer(player: Player): boolean;
  removePlayer(playerId: string): boolean;
  tryStartGame(): void;  // Must be called explicitly
  close(): void;
  getInfo(): TableInfo;
  getPlayerCount(): number;
  isGameInProgress(): boolean;
}
```

### Player

```javascript
abstract class Player extends EventEmitter {
  constructor(config?: {
    id?: string;
    name?: string;
    avatar?: string;
  });
  
  abstract getAction(gameState: GameState): Promise<PlayerAction> | PlayerAction;
  
  // Optional overrides
  receivePrivateCards(cards: string[]): void;
  receiveMessage(message: any): void;
  disconnect(): void;
}
```

### GameState

```javascript
interface GameState {
  phase: 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER';
  communityCards: string[];
  pot: number;
  currentBet: number;
  currentPlayer: string;
  players: {
    [playerId: string]: {
      id: string;
      chips: number;
      bet: number;
      state: 'ACTIVE' | 'FOLDED' | 'ALL_IN';
      hasActed: boolean;
      lastAction: Action | null;  // NEW: Track last action
    };
  };
}
```

### PlayerAction

```javascript
interface PlayerAction {
  playerId: string;
  action: 'CHECK' | 'BET' | 'CALL' | 'RAISE' | 'FOLD' | 'ALL_IN';
  amount?: number;  // Required for BET, RAISE, CALL, ALL_IN
  timestamp: number;
}
```

## Migration from Previous Versions

### Breaking Changes

1. **No Auto-Start**: Tables no longer automatically start games
   ```javascript
   // Old behavior (deprecated)
   table.addPlayer(player1);
   table.addPlayer(player2);
   // Game would auto-start
   
   // New behavior (required)
   table.addPlayer(player1);
   table.addPlayer(player2);
   table.tryStartGame(); // Must explicitly start
   ```

2. **Enhanced GameState**: Players now have `lastAction` property
   ```javascript
   // New property available
   gameState.players[playerId].lastAction // 'RAISE', 'CALL', etc.
   ```

3. **Event Name Changes**: `hand:complete` → `hand:ended`
   ```javascript
   // Both work for compatibility, but prefer:
   table.on('hand:ended', handler);
   ```

## Best Practices Summary

1. **Always call `tryStartGame()`** after adding players
2. **Use `lastAction`** for advanced strategies
3. **Handle race conditions** with proper delays in tests
4. **Clean up tables** with `table.close()` when done
5. **Use deterministic dealer buttons** for testing
6. **Monitor memory usage** for long-running applications
7. **Return proper timestamps** in all player actions
8. **Use 'T' not '10'** for card notation

## Next Steps

- Explore the [test files](./packages/core/src/integration/) for more examples
- Check [POKER-RULES.md](./POKER-RULES.md) for game rules reference
- See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues
- Review [GitHub Issues](https://github.com/jkraybill/poker-game-manager/issues) for known bugs

Happy coding! 🎰