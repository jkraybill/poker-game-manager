# Integration Guide 🃏

This guide shows you how to integrate the Poker Game Manager library into your application.

## Table of Contents

1. [Installation](#installation)
2. [Basic Setup](#basic-setup)
3. [Implementing a Player](#implementing-a-player)
4. [Listening to Game Events](#listening-to-game-events)
5. [Complete Example: Three-Player Game](#complete-example-three-player-game)
6. [Example Output](#example-output)
7. [Advanced Topics](#advanced-topics)

## Installation

```bash
npm install @poker-manager/core
```

## Basic Setup

```javascript
import { PokerGameManager, Player, Action } from '@poker-manager/core';

// Create the game manager
const manager = new PokerGameManager();

// Create a table
const table = manager.createTable({
  blinds: { small: 10, big: 20 },
  minBuyIn: 1000,
  maxBuyIn: 5000,
});
```

## Implementing a Player

Every player must extend the `Player` class and implement the `getAction()` method:

```javascript
import { Player, Action } from '@poker-manager/core';

class MyPlayer extends Player {
  constructor(config) {
    super(config);
    this.strategy = config.strategy || 'default';
  }

  async getAction(gameState) {
    // gameState contains:
    // - phase: current game phase (PRE_FLOP, FLOP, TURN, RIVER)
    // - communityCards: cards on the board
    // - pot: current pot size
    // - currentBet: amount to call
    // - players: all player states
    // - actionHistory: previous actions
    
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    
    // Your decision logic here
    if (toCall === 0) {
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now(),
      };
    } else if (toCall <= myState.chips * 0.1) {
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now(),
      };
    } else {
      return {
        playerId: this.id,
        action: Action.FOLD,
        timestamp: Date.now(),
      };
    }
  }

  // Optional: Handle receiving hole cards
  receivePrivateCards(cards) {
    super.receivePrivateCards(cards);
    console.log(`${this.name} received cards:`, cards);
  }
}
```

## Listening to Game Events

The library emits various events you can listen to:

```javascript
// Table events
table.on('game:started', ({ gameNumber, players }) => {
  console.log(`Game ${gameNumber} started with players:`, players);
});

table.on('game:ended', ({ winners, payouts }) => {
  console.log('Game ended. Winners:', winners);
  console.log('Payouts:', payouts);
});

table.on('player:joined', ({ player, seatNumber }) => {
  console.log(`${player.name} joined at seat ${seatNumber}`);
});

// Game events (during gameplay)
table.on('cards:dealt', ({ phase, cards }) => {
  console.log(`${phase} cards:`, cards);
});

table.on('player:action', ({ playerId, action, amount }) => {
  console.log(`Player ${playerId} ${action}${amount ? ` $${amount}` : ''}`);
});

table.on('pot:updated', ({ total, sidePots }) => {
  console.log(`Pot: $${total}`);
});

// Manager events (for multi-table setups)
manager.on('table:created', ({ tableId }) => {
  console.log(`Table ${tableId} created`);
});
```

## Complete Example: Three-Player Game

Here's a complete example with three different player strategies:

```javascript
import { PokerGameManager, Player, Action } from '@poker-manager/core';

// Player that always folds
class FoldingPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    
    // Always fold unless we can check
    if (toCall === 0) {
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now(),
      };
    }
    
    return {
      playerId: this.id,
      action: Action.FOLD,
      timestamp: Date.now(),
    };
  }
}

// Player that always calls
class CallingPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    
    if (toCall === 0) {
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now(),
      };
    }
    
    // Call up to all-in
    const callAmount = Math.min(toCall, myState.chips);
    return {
      playerId: this.id,
      action: callAmount === myState.chips ? Action.ALL_IN : Action.CALL,
      amount: callAmount,
      timestamp: Date.now(),
    };
  }
}

// Player that always raises half the pot
class AggressivePlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    const potSize = gameState.pot;
    
    // Calculate half-pot raise
    const raiseAmount = Math.floor(potSize / 2);
    const totalBet = gameState.currentBet + raiseAmount;
    const myTotalBet = totalBet - myState.bet;
    
    // If we can't afford the raise, just call or go all-in
    if (myTotalBet >= myState.chips) {
      return {
        playerId: this.id,
        action: Action.ALL_IN,
        amount: myState.chips,
        timestamp: Date.now(),
      };
    }
    
    // If it's already a big bet relative to our stack, just call
    if (toCall > myState.chips * 0.5) {
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now(),
      };
    }
    
    // Otherwise, raise half the pot
    if (toCall === 0 && raiseAmount > 0) {
      return {
        playerId: this.id,
        action: Action.BET,
        amount: raiseAmount,
        timestamp: Date.now(),
      };
    } else if (raiseAmount > gameState.currentBet) {
      return {
        playerId: this.id,
        action: Action.RAISE,
        amount: totalBet,
        timestamp: Date.now(),
      };
    } else {
      // Just call if raise would be too small
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now(),
      };
    }
  }
}

// Run the simulation
async function runSimulation() {
  const manager = new PokerGameManager();
  
  const table = manager.createTable({
    blinds: { small: 10, big: 20 },
    minBuyIn: 1000,
    maxBuyIn: 1000,
  });
  
  // Create players
  const folder = new FoldingPlayer({ name: 'Fearful Fred' });
  const caller = new CallingPlayer({ name: 'Calling Carl' });
  const raiser = new AggressivePlayer({ name: 'Aggressive Amy' });
  
  // Add event listeners
  table.on('game:started', ({ gameNumber }) => {
    console.log(`\n========== GAME ${gameNumber} STARTED ==========\n`);
  });
  
  table.on('player:action', ({ playerId, action, amount }) => {
    const player = [folder, caller, raiser].find(p => p.id === playerId);
    console.log(`${player.name} ${action}${amount ? ` $${amount}` : ''}`);
  });
  
  table.on('cards:dealt', ({ phase, cards }) => {
    if (cards && cards.length > 0) {
      console.log(`\n--- ${phase} ---`);
      console.log(`Community cards: ${cards.join(' ')}`);
    }
  });
  
  table.on('pot:updated', ({ total }) => {
    console.log(`Pot size: $${total}`);
  });
  
  // Listen to game engine events after game starts
  table.on('game:started', () => {
    const engine = table.gameEngine;
    
    engine.on('hand:complete', ({ winners, payouts }) => {
      console.log('\n--- SHOWDOWN ---');
      winners.forEach(winner => {
        const player = [folder, caller, raiser].find(p => p.id === winner.playerId);
        console.log(`${player.name} wins with ${winner.hand.description}!`);
        console.log(`Hand: ${winner.hand.cards.map(c => c.toString()).join(' ')}`);
      });
    });
  });
  
  table.on('game:ended', ({ finalChips }) => {
    console.log('\n========== FINAL CHIP COUNTS ==========');
    Object.entries(finalChips).forEach(([playerId, chips]) => {
      const player = [folder, caller, raiser].find(p => p.id === playerId);
      console.log(`${player.name}: $${chips}`);
    });
  });
  
  // Add players to table
  table.addPlayer(folder);
  table.addPlayer(caller);
  table.addPlayer(raiser);
  
  // Game will start automatically when minimum players are reached
  // Wait for game to complete
  await new Promise(resolve => {
    table.on('game:ended', () => {
      setTimeout(resolve, 1000);
    });
  });
  
  // Check final chip counts
  console.log('\n========== FINAL CHIP COUNTS ==========');
  const finalStates = table.getInfo();
  [folder, caller, raiser].forEach(player => {
    const playerData = table.players.get(player.id);
    console.log(`${player.name}: $${playerData.chips}`);
  });
}

// Run the example
runSimulation().catch(console.error);
```

## Example Output

```
========== GAME 1 STARTED ==========

Fearful Fred posts small blind $10
Calling Carl posts big blind $20

Fearful Fred receives: Kh 7s
Calling Carl receives: 9c 9d
Aggressive Amy receives: Ah Qc

Aggressive Amy raises to $45
Fearful Fred folds
Calling Carl calls $45
Pot: $100

--- FLOP ---
Community cards: 9h 5s 2d
Calling Carl checks
Aggressive Amy bets $50
Calling Carl raises to $150
Aggressive Amy calls $150
Pot: $400

--- TURN ---
Community cards: 9h 5s 2d Jc
Calling Carl bets $200
Aggressive Amy calls $200
Pot: $800

--- RIVER ---
Community cards: 9h 5s 2d Jc 3h
Calling Carl bets $400
Aggressive Amy folds
Pot: $800

--- SHOWDOWN ---
Calling Carl wins $800 with Three of a Kind, Nines
Winning hand: 9c 9d 9h Jc 5s

========== FINAL CHIP COUNTS ==========
Fearful Fred: $990
Calling Carl: $1405  
Aggressive Amy: $605
```

## Advanced Topics

### Custom Game Configuration

```javascript
const table = manager.createTable({
  variant: 'texas-holdem',
  maxPlayers: 6,
  minPlayers: 2,
  blinds: { small: 25, big: 50 },
  minBuyIn: 2000,
  maxBuyIn: 10000,
  timeout: 60000, // 60 second decision time
});
```

### Player Disconnection Handling

```javascript
class RobustPlayer extends Player {
  async getAction(gameState) {
    try {
      // Your logic here
      return await this.makeDecision(gameState);
    } catch (error) {
      console.error('Error making decision:', error);
      // Default to check/fold on error
      const myState = gameState.players[this.id];
      const toCall = gameState.currentBet - myState.bet;
      
      return {
        playerId: this.id,
        action: toCall === 0 ? Action.CHECK : Action.FOLD,
        timestamp: Date.now(),
      };
    }
  }
  
  disconnect() {
    // Clean up resources
    super.disconnect();
  }
}
```

### Multi-Table Management

```javascript
const manager = new PokerGameManager({ maxTables: 10 });

// Create multiple tables
const cashGame = manager.createTable({ 
  blinds: { small: 1, big: 2 },
  minBuyIn: 100,
});

const tournament = manager.createTable({
  blinds: { small: 50, big: 100 },
  minBuyIn: 10000,
});

// Monitor all tables
manager.on('table:event', ({ tableId, eventName, data }) => {
  console.log(`Table ${tableId} event:`, eventName, data);
});

// Get statistics
const stats = manager.getStats();
console.log(`Active tables: ${stats.activeTables}/${stats.totalTables}`);
console.log(`Total players: ${stats.totalPlayers}`);
```

### State Persistence

```javascript
// Save game state
const gameState = table.getInfo();
fs.writeFileSync('game-state.json', JSON.stringify(gameState));

// Note: Full state restoration requires additional implementation
```

## Best Practices

1. **Always handle errors** in your `getAction()` method
2. **Return actions promptly** to avoid timeouts
3. **Validate game state** before making decisions
4. **Use event listeners** for logging and analytics
5. **Test your players** with different scenarios
6. **Monitor memory usage** for long-running games

## Next Steps

- Check out the [API Reference](./API.md) for detailed documentation
- See [Example Players](./packages/ai/src/) for more sophisticated implementations
- Join our [Discord](https://discord.gg/poker-game-manager) for support

Happy coding! 🎰