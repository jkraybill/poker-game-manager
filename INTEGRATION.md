# Integration Guide 🃏

This guide shows you how to build poker applications with our library.

We'll get you up and running with the basics, then show you some fancier stuff.

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)  
3. [Player Implementation](#player-implementation)
4. [Game State](#game-state)
5. [Events](#events)
6. [Complete Examples](#complete-examples)
7. [Testing Your Players](#testing-your-players)
8. [API Reference](#api-reference)

## Installation

### From GitHub (Development)

```bash
# Clone it down
git clone https://github.com/jkraybill/poker-game-manager.git
cd poker-game-manager

# Install the stuff (needs Node.js 22+)
npm install
```

### From GitHub Packages (Published)

```bash
# Set up GitHub Packages authentication
echo "@jkraybill:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc

# Install the package
npm install @jkraybill/poker-game-manager
```

**Note:** Replace `YOUR_GITHUB_TOKEN` with a GitHub Personal Access Token that has `packages:read` permission. Don't use `npm login` - GitHub Packages uses token authentication directly through `.npmrc`.

## Quick Start

Here's how to get a game running - nothing fancy:

```javascript
import { PokerGameManager, Player, Action } from './packages/core/src/index.js';

// Make a basic player
class SimplePlayer extends Player {
  async getAction(gameState) {
    const { validActions, toCall } = gameState;
    
    // Simple strategy: call if it's cheap, otherwise check/fold appropriately
    if (validActions.includes(Action.CALL) && toCall <= 40) {
      return { action: Action.CALL };
    }
    
    if (validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK };
    }
    
    // Only fold if facing a bet (toCall > 0)
    if (validActions.includes(Action.FOLD)) {
      return { action: Action.FOLD }; // I've seen better!
    }
    
    // Fallback (should not reach here with proper validActions)
    return { action: Action.CHECK };
  }
}

// Set up the table
const manager = new PokerGameManager();
const table = manager.createTable({
  blinds: { small: 10, big: 20 },
  maxPlayers: 6
});

// Add some players (v2.0: must set chips first!)
const alice = new SimplePlayer('Alice');
alice.buyIn(1000); // Set chips before adding
table.addPlayer(alice);

const bob = new SimplePlayer('Bob');
bob.buyIn(1000);
table.addPlayer(bob);

const charlie = new SimplePlayer('Charlie');
charlie.buyIn(1000);
table.addPlayer(charlie);

// Listen for results - woof woof!
table.on('hand:ended', (result) => {
  console.log('Hand ended:', result);
});

// Start it up
table.tryStartGame();
```

**That's it!** Your first poker game is running.

## Player Implementation

### The Player Interface - This is Your Main Thing

Every player needs to extend the `Player` class. You mainly need to implement `getAction()`:

```javascript
import { Player, Action } from './packages/core/src/Player.js';

class MyPlayer extends Player {
  constructor(name, options = {}) {
    super(name);
    this.options = options;
  }

  // This is the important one - make decisions here
  async getAction(gameState) {
    // Return: { action: Action.FOLD|Action.CHECK|Action.CALL|Action.BET|Action.RAISE|Action.ALL_IN, amount?: number }
  }

  // These are optional but useful
  receivePrivateCards(cards) {
    this.holeCards = cards; // Your hole cards
  }

  receivePublicCards(cards) {
    this.communityCards = cards; // Board cards
  }

  receiveGameUpdate(update) {
    // Game events - do whatever you want with these
  }
}
```

### Basic Strategy Examples

**Simple Calling Station:**
```javascript
class CallingStation extends Player {
  async getAction(gameState) {
    const { validActions, toCall } = gameState;
    
    // Just call everything - not great strategy but simple!
    if (validActions.includes(Action.CALL)) {
      return { action: Action.CALL };
    }
    
    if (validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK };
    }
    
    // Only fold if facing a bet
    if (validActions.includes(Action.FOLD)) {
      return { action: Action.FOLD };
    }
    
    return { action: Action.CHECK };
  }
}
```

**Pot Odds Player (Slightly Smarter):**
```javascript
class PotOddsPlayer extends Player {
  async getAction(gameState) {
    const { validActions, toCall, potSize } = gameState;
    
    // Calculate pot odds - basic poker math
    const potOdds = toCall / (potSize + toCall);
    
    if (validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK }; // Free cards? Yes please
    }
    
    // Call if we're getting good odds
    if (validActions.includes(Action.CALL) && potOdds < 0.3) {
      return { action: Action.CALL };
    }
    
    // Only fold if facing a bet
    if (validActions.includes(Action.FOLD)) {
      return { action: Action.FOLD }; // I've seen better odds!
    }
    
    return { action: Action.CHECK };
  }
}
```

**Positional Player (Getting Fancy):**
```javascript
class PositionalPlayer extends Player {
  async getAction(gameState) {
    const { validActions, phase, currentBet } = gameState;
    const players = Object.values(gameState.players);
    const activePlayers = players.filter(p => p.state === 'ACTIVE');
    
    // Figure out where we sit
    const myIndex = activePlayers.findIndex(p => p.id === this.id);
    const isLatePosition = myIndex >= activePlayers.length - 2;
    
    // Play tighter early, looser late
    const aggression = isLatePosition ? 0.7 : 0.3;
    
    if (phase === 'PRE_FLOP' && currentBet === 0 && Math.random() < aggression) {
      return { action: Action.BET, amount: gameState.minRaise };
    }
    
    if (validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK };
    }
    
    if (validActions.includes(Action.FOLD)) {
      return { action: Action.FOLD };
    }
    
    return { action: Action.CHECK };
  }
}
```

## Position-Aware Players (New in v4.4.0)

The library now provides comprehensive position information in the `hand:started` event, making it much easier to implement sophisticated positional strategies:

### Using the Position API

```javascript
class AdvancedPositionalPlayer extends Player {
  constructor(config) {
    super(config);
    this.currentPosition = null;
    this.tablePositions = null;
  }

  // Called when hand starts - update position info
  onHandStarted(positions) {
    this.currentPosition = positions.positions[this.id];
    this.tablePositions = positions;
  }

  async getAction(gameState) {
    const { validActions, toCall, currentBet, bigBlind } = gameState;
    
    // Position-based strategy
    switch(this.currentPosition) {
      case 'button':
        return this.playButtonStrategy(gameState);
      case 'small-blind':
        return this.playSmallBlindStrategy(gameState);
      case 'big-blind':
        return this.playBigBlindStrategy(gameState);
      case 'under-the-gun':
        return this.playUTGStrategy(gameState);
      case 'middle-position':
        return this.playMiddlePositionStrategy(gameState);
      case 'cutoff':
        return this.playCutoffStrategy(gameState);
      default:
        return this.playDefaultStrategy(gameState);
    }
  }

  playButtonStrategy(gameState) {
    const { validActions, toCall, currentBet, bigBlind } = gameState;
    
    // Aggressive from the button
    if (currentBet === 0 && validActions.includes(Action.BET)) {
      return { action: Action.BET, amount: bigBlind * 3 };
    }
    
    if (validActions.includes(Action.RAISE) && toCall <= bigBlind * 2) {
      return { action: Action.RAISE, amount: currentBet + bigBlind * 2 };
    }
    
    if (validActions.includes(Action.CALL) && toCall <= bigBlind * 3) {
      return { action: Action.CALL };
    }
    
    return this.playDefaultStrategy(gameState);
  }

  playBigBlindStrategy(gameState) {
    const { validActions, toCall, bigBlind } = gameState;
    
    // Defend big blind with reasonable hands
    if (validActions.includes(Action.CALL) && toCall <= bigBlind * 3) {
      return { action: Action.CALL };
    }
    
    if (validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK };
    }
    
    return this.playDefaultStrategy(gameState);
  }

  playUTGStrategy(gameState) {
    const { validActions } = gameState;
    
    // Tight from under the gun
    if (validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK };
    }
    
    if (validActions.includes(Action.FOLD)) {
      return { action: Action.FOLD };
    }
    
    return this.playDefaultStrategy(gameState);
  }

  playDefaultStrategy(gameState) {
    const { validActions, toCall } = gameState;
    
    if (validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK };
    }
    
    if (validActions.includes(Action.CALL) && toCall <= 20) {
      return { action: Action.CALL };
    }
    
    if (validActions.includes(Action.FOLD)) {
      return { action: Action.FOLD };
    }
    
    return { action: Action.CHECK };
  }
}
```

### Setting Up Position-Aware Games

```javascript
// Set up the table
const manager = new PokerGameManager();
const table = manager.createTable({
  blinds: { small: 10, big: 20 },
  maxPlayers: 6
});

// Add position-aware players
const players = [
  new AdvancedPositionalPlayer({ id: 'alice', name: 'Alice' }),
  new AdvancedPositionalPlayer({ id: 'bob', name: 'Bob' }),
  new AdvancedPositionalPlayer({ id: 'charlie', name: 'Charlie' }),
];

players.forEach(player => {
  player.chips = 1000;
  table.addPlayer(player);
});

// Update players with position information when each hand starts
table.on('hand:started', ({ positions }) => {
  console.log('Hand started with positions:', positions);
  
  // Update all players with their current positions
  Object.entries(positions.positions).forEach(([playerId, position]) => {
    const playerData = table.players.get(playerId);
    if (playerData && playerData.player.onHandStarted) {
      playerData.player.onHandStarted(positions);
    }
  });
});

// Start the game
await table.tryStartGame();
```

### Available Position Information

The position API provides rich information for strategic decision-making:

```javascript
positions = {
  // Primary positions (player IDs)
  button: "alice",           // Player on the button
  smallBlind: "bob",         // Small blind player
  bigBlind: "charlie",       // Big blind player  
  utg: "david",             // Under the gun player (null if < 3 players)
  
  // Position mapping (all players)
  positions: {
    "alice": "button",
    "bob": "small-blind", 
    "charlie": "big-blind",
    "david": "under-the-gun",
    "eve": "middle-position",
    "frank": "cutoff"
  },
  
  // Additional context
  playerOrder: ["alice", "bob", "charlie", "david", "eve", "frank"],
  isDeadButton: false,       // Whether button is on eliminated player
  isDeadSmallBlind: false    // Whether small blind is dead this hand
}
```

**Position Names:**
- `button` - Dealer button (acts last post-flop)
- `small-blind` - Small blind position
- `big-blind` - Big blind position
- `under-the-gun` - First to act pre-flop (after BB)
- `middle-position` - Middle positions in larger games
- `cutoff` - Seat before the button
- `late-position` - Late position players
- `button-small-blind` - Heads-up: button is also small blind

See [POSITION_API_EXAMPLE.md](./POSITION_API_EXAMPLE.md) for complete usage examples and advanced patterns.

## Game State

The `gameState` object tells you everything happening at the table:

```javascript
{
  phase: 'PRE_FLOP|FLOP|TURN|RIVER',      // What street we're on
  communityCards: ['2h', '3s', 'Kd'],      // Board cards (pokersolver format)
  pot: 150,                                // Total money in the middle
  currentBet: 40,                          // What you need to match
  currentPlayer: 'player-id',              // Who's turn it is
  
  players: {                               // Info about everyone
    'player-id': {
      id: 'player-id',
      chips: 1000,                         // How much they have
      bet: 20,                             // What they've bet this round
      state: 'ACTIVE|FOLDED|ALL_IN',       // What they're doing
      hasActed: true,                      // Have they acted this round?
      lastAction: Action.CALL              // What they did last
    }
  },
  
  validActions: [Action.FOLD, Action.CALL, Action.RAISE], // What you can do
  
  // These are calculated for you - woof woof!
  toCall: 20,           // Amount to call
  minRaise: 80,         // Minimum raise amount (total bet)
  maxRaise: 1000,       // Maximum (all your chips)
  potSize: 150          // Same as pot, but hey
}
```

**Pro tip:** Use `gameState.players[this.id]` to get your own info.

## Events

The library fires events when stuff happens. Listen to what you care about:

### Basic Events You'll Want

```javascript
// Hand results - the important one!
table.on('hand:ended', (result) => {
  console.log('Hand finished!');
  result.winners.forEach(winner => {
    console.log(`${winner.playerId} wins ${winner.amount} chips`);
  });
});

// Players joining/leaving
table.on('player:joined', ({ player, seatNumber }) => {
  console.log(`${player.name} joined at seat ${seatNumber}`);
});

table.on('player:eliminated', ({ playerId, finalChips }) => {
  console.log(`${playerId} busted out with ${finalChips} chips`);
});

// Game starting
table.on('game:started', ({ gameNumber, players }) => {
  console.log(`Game ${gameNumber} starting with ${players.length} players`);
});
```

### Action Events (For Logging/Analysis)

```javascript
table.on('player:action', ({ playerId, action, amount }) => {
  console.log(`${playerId} ${action}${amount ? ` $${amount}` : ''}`);
});

table.on('cards:community', ({ cards, phase }) => {
  console.log(`${phase}: ${cards.join(' ')}`);
});

table.on('pot:updated', ({ total }) => {
  console.log(`Pot is now $${total}`);
});
```

## Complete Examples

### Tournament Simulation

Here's a more complete example with different player types:

```javascript
import { PokerGameManager, Player, Action } from './packages/core/src/index.js';

// Tight player - folds a lot
class TightPlayer extends Player {
  async getAction(gameState) {
    const { validActions, toCall, potSize } = gameState;
    const potOdds = toCall / (potSize + toCall);
    
    if (validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK };
    }
    
    // Only call with really good odds
    if (validActions.includes(Action.CALL) && potOdds < 0.2) {
      return { action: Action.CALL };
    }
    
    // Only fold if facing a bet
    if (validActions.includes(Action.FOLD)) {
      return { action: Action.FOLD }; // I've seen better!
    }
    
    return { action: Action.CHECK };
  }
}

// Loose player - calls more
class LoosePlayer extends Player {
  async getAction(gameState) {
    const { validActions, toCall, potSize } = gameState;
    const potOdds = toCall / (potSize + toCall);
    
    if (validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK };
    }
    
    // Call with okay odds
    if (validActions.includes(Action.CALL) && potOdds < 0.4) {
      return { action: Action.CALL };
    }
    
    if (validActions.includes(Action.FOLD)) {
      return { action: Action.FOLD };
    }
    
    return { action: Action.CHECK };
  }
}

// Aggressive player - likes to bet and raise
class AggressivePlayer extends Player {
  async getAction(gameState) {
    const { validActions, currentBet } = gameState;
    
    // Try to bet or raise first
    if (validActions.includes(Action.RAISE) && Math.random() < 0.4) {
      return { action: Action.RAISE, amount: gameState.minRaise };
    }
    
    if (validActions.includes(Action.BET) && Math.random() < 0.3) {
      return { action: Action.BET, amount: gameState.minRaise };
    }
    
    if (validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK };
    }
    
    if (validActions.includes(Action.CALL) && Math.random() < 0.6) {
      return { action: Action.CALL };
    }
    
    if (validActions.includes(Action.FOLD)) {
      return { action: Action.FOLD };
    }
    
    return { action: Action.CHECK };
  }
}

// Set up the tournament
const manager = new PokerGameManager();
const table = manager.createTable({
  blinds: { small: 25, big: 50 },
  maxPlayers: 6
});

// Add different player types - variety is the spice of life!
const tightTom = new TightPlayer('Tight Tom');
tightTom.buyIn(2000);
table.addPlayer(tightTom);

const looseLucy = new LoosePlayer('Loose Lucy');
looseLucy.buyIn(2000);
table.addPlayer(looseLucy);

const aggressiveAnna = new AggressivePlayer('Aggressive Anna');
aggressiveAnna.buyIn(2000);
table.addPlayer(aggressiveAnna);

const conservativeCarl = new TightPlayer('Conservative Carl');
conservativeCarl.buyIn(2000);
table.addPlayer(conservativeCarl);

let handCount = 0;

table.on('hand:ended', (result) => {
  handCount++;
  console.log(`\n=== Hand ${handCount} ===`);
  
  result.winners.forEach(winner => {
    console.log(`${winner.playerId} wins $${winner.amount}`);
  });
  
  // Show chip counts
  console.log('Chip counts:');
  Array.from(table.players.values())
    .sort((a, b) => b.player.chips - a.player.chips)
    .forEach(({ player }) => {
      console.log(`  ${player.name}: $${player.chips}`);
    });
  
  // Keep playing if we have players and haven't played too long
  if (table.getPlayerCount() >= 2 && handCount < 20) {
    setTimeout(() => table.tryStartGame(), 1000);
  } else {
    console.log('\nTournament finished!');
    table.close();
  }
});

// Start it up - woof woof!
console.log('Starting tournament simulation...');
table.tryStartGame();
```

## Testing Your Players

### Use Fixed Scenarios

**Pro tip:** Use custom decks to test specific situations:

```javascript
const table = manager.createTable({
  blinds: { small: 10, big: 20 },
  dealerButton: 0,  // Fixed position for consistent tests
});

// Set up a specific scenario
const customDeck = [
  { rank: 'A', suit: 's' }, { rank: 'K', suit: 's' }, // Player 1 gets AKs
  { rank: '2', suit: 'h' }, { rank: '7', suit: 'c' }, // Player 2 gets junk
  { rank: 'A', suit: 'd' }, { rank: 'K', suit: 'd' }, // Board: AK...
  { rank: 'Q', suit: 's' }, { rank: 'J', suit: 's' },
  { rank: 'T', suit: 's' } // Royal flush potential!
];

table.setCustomDeck(customDeck);

// Add your test players (v2.0: set chips first!)
const testPlayer1 = new YourPlayerClass('Test Player 1');
testPlayer1.buyIn(1000);
table.addPlayer(testPlayer1);

const testPlayer2 = new SimplePlayer('Test Player 2');
testPlayer2.buyIn(1000);
table.addPlayer(testPlayer2);

// Run the test
table.tryStartGame();
```

### Event Testing

Capture events to test your logic:

```javascript
const events = [];

table.on('*', (eventName, data) => {
  events.push({ event: eventName, data, timestamp: Date.now() });
});

table.on('hand:ended', () => {
  console.log('Events that happened:', events.map(e => e.event));
  // Check if your player did what you expected
});
```

## API Reference

### The Main Classes

**PokerGameManager:**
```javascript
const manager = new PokerGameManager();
manager.createTable(config)      // Make a new table
manager.getTable(id)            // Get existing table  
manager.getAllTables()          // Get all tables
manager.closeTable(id)          // Close specific table
```

**Table Config:**
```javascript
{
  blinds: { small: 10, big: 20 },  // Blind amounts
  maxPlayers: 9,                   // 2-10 players
  minPlayers: 2,                   // Minimum to start
  timeout: 30000,                  // How long players have to act (ms)
  dealerButton: 0                  // Fixed dealer position (for testing)
}
```

**Player Methods:**
```javascript
// Required
async getAction(gameState)       // Make your decision

// Optional  
receivePrivateCards(cards)       // Get your hole cards
receivePublicCards(cards)        // See the board
receiveGameUpdate(update)        // Game state changes
```

**Action Format:**
```javascript
// What you return from getAction() - MUST use Action enum!
{ action: Action.FOLD }                    // Give up (only when toCall > 0)
{ action: Action.CHECK }                   // No bet, no call
{ action: Action.CALL }                    // Match the bet
{ action: Action.BET, amount: 50 }         // First to bet
{ action: Action.RAISE, amount: 100 }      // Increase the bet (total amount)
{ action: Action.ALL_IN }                  // Everything!
```

### Important Events

```javascript
// Game flow
'game:started'          // New game
'hand:started'          // New hand  
'hand:ended'            // Hand finished (the big one!)

// Player stuff
'player:joined'         // Someone joined
'player:eliminated'     // Someone went broke
'player:action'         // Someone did something

// Card stuff
'cards:dealt'           // Hole cards dealt
'cards:community'       // Flop/turn/river

// Money stuff  
'pot:updated'           // Pot size changed
```

## Common Patterns

### Multi-Hand Games

Tables don't auto-restart. You control when new hands start:

```javascript
table.on('hand:ended', () => {
  // Wait a bit, then start next hand
  setTimeout(() => {
    if (table.getPlayerCount() >= 2) {
      table.tryStartGame();
    }
  }, 2000);
});
```

### Player Elimination

When players run out of chips, they get eliminated:

```javascript
table.on('player:eliminated', ({ playerId, finalChips }) => {
  console.log(`${playerId} is out! (had ${finalChips} chips)`);
  
  // Maybe add a new player? (v2.0: set chips first!)
  if (table.getPlayerCount() < 4) {
    const newPlayer = new SomePlayer('New Player');
    newPlayer.buyIn(1000);
    table.addPlayer(newPlayer);
  }
});
```

### Tracking Stats

```javascript
const playerStats = new Map();

table.on('player:action', ({ playerId, action }) => {
  if (!playerStats.has(playerId)) {
    playerStats.set(playerId, { actions: 0, folds: 0 });
  }
  
  const stats = playerStats.get(playerId);
  stats.actions++;
  if (action === Action.FOLD) stats.folds++;
});

table.on('hand:ended', () => {
  // Show fold percentages or whatever
  for (const [playerId, stats] of playerStats.entries()) {
    const foldPercent = (stats.folds / stats.actions * 100).toFixed(1);
    console.log(`${playerId} folds ${foldPercent}% of the time`);
  }
});
```

---

## Final Thoughts

**JK is solid** - this library handles the poker rules so you can focus on building cool applications. Whether you're making AI players, web games, or tournament systems, the event-driven architecture makes it pretty straightforward.

**What's your kicker?** Start with simple players and work your way up. The examples in `/examples/` have more code to look at.

**I've seen better!** If you find bugs or want features, [open an issue](https://github.com/jkraybill/poker-game-manager/issues). We're always trying to improve.

**Woof woof!** Have fun building poker stuff! 🐕
