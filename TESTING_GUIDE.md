# Testing Guide

## Quick Commands

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- betting-scenarios
npm test -- GameEngine.test
npm test -- PotManager

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run a specific test by name
npm test -- -t "should handle SB/Button folding"

# Run tests matching a pattern
npm test -- -t "should handle.*all-in"
```

### Debugging Tests
```bash
# Run with verbose output
npm test -- --reporter=verbose

# Run single test file with all console.log output
npm test -- betting-scenarios --no-silence
```

## Test File Locations

### Unit Tests
Unit tests are located next to their source files:
- `/packages/core/src/game/GameEngine.test.js` - Tests GameEngine
- `/packages/core/src/game/Deck.test.js` - Tests Deck and shuffle
- `/packages/core/src/game/HandEvaluator.test.js` - Tests hand evaluation
- `/packages/core/src/game/PotManager.test.js` - Tests pot calculations
- `/packages/core/src/Table.test.js` - Tests table management
- `/packages/core/src/PokerGameManager.test.js` - Tests multi-table manager

### Integration Tests
Integration tests are in a separate directory:
- `/packages/core/src/integration/betting-scenarios.test.js` - Main betting scenarios (2-5 players)
- `/packages/core/src/integration/3player-button-raises-blinds-fold.test.js` - Specific 3-player test
- `/packages/core/src/integration/3player-button-raises-bb-calls-folds-flop.test.js` - Multi-street 3-player test

## Common Test Patterns

### Creating a Test Table
```javascript
// Always use deterministic dealer button for consistent tests
const table = manager.createTable({
  blinds: { small: 10, big: 20 },
  minBuyIn: 1000,
  maxBuyIn: 1000,
  minPlayers: 2,    // Optional: minimum players to start
  dealerButton: 0,  // IMPORTANT: Makes tests deterministic
});
```

### Position-Aware Test Player
```javascript
class PositionAwarePlayer extends Player {
  constructor(config) {
    super(config);
    this.position = null;  // Will be set by test
    this.hasActed = false;
  }

  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    // Position-based logic
    if (this.position === 'button' && !this.hasActed) {
      this.hasActed = true;
      return {
        playerId: this.id,
        action: Action.RAISE,
        amount: 100,
        timestamp: Date.now(),
      };
    }

    // Default actions
    if (toCall > 0) {
      return { playerId: this.id, action: Action.FOLD, timestamp: Date.now() };
    }
    return { playerId: this.id, action: Action.CHECK, timestamp: Date.now() };
  }
}
```

### Using lastAction for Advanced Strategies
```javascript
class SqueezePlayPlayer extends Player {
  getAction(gameState) {
    // Check for squeeze opportunity using lastAction
    const playerStates = Object.values(gameState.players);
    const hasRaiser = playerStates.some(p => p.lastAction === Action.RAISE);
    const hasCaller = playerStates.some(p => p.lastAction === Action.CALL);
    
    if (hasRaiser && hasCaller && this.position === 'sb') {
      return {
        playerId: this.id,
        action: Action.RAISE,
        amount: gameState.currentBet * 3,
        timestamp: Date.now(),
      };
    }
    // ... other logic
  }
}
```

### Event Capture Pattern
```javascript
// Set up event capture before adding players
const eventCapture = [];
let captureEvents = true;

table.on('game:started', (e) => {
  if (captureEvents) eventCapture.push({ event: 'game:started', data: e });
});

table.on('player:action', ({ playerId, action, amount }) => {
  if (captureEvents) {
    eventCapture.push({ 
      playerName: players.find(p => p.id === playerId)?.name || playerId,
      action, 
      amount 
    });
  }
});

table.on('hand:ended', ({ winners }) => {
  captureEvents = false;  // Stop capturing after hand ends
  // Process winners...
});
```

### Waiting for Game Events
```javascript
// Create promise for hand completion
const handEndPromise = new Promise((resolve) => {
  table.on('hand:ended', ({ winners }) => {
    resolve({
      winnerId: winners[0]?.playerId,
      winnerAmount: winners[0]?.amount,
    });
  });
});

// Add players and wait for result
table.addPlayer(player1);
table.addPlayer(player2);

const { winnerId, winnerAmount } = await handEndPromise;
```

### Setting Custom Chip Amounts
```javascript
// Override addPlayer to set custom chips
const originalAddPlayer = table.addPlayer.bind(table);
table.addPlayer = function(player) {
  const result = originalAddPlayer(player);
  const playerData = this.players.get(player.id);
  if (playerData && player.targetChips) {
    playerData.chips = player.targetChips;
  }
  return result;
};
```

## Debugging Tips

### 1. Add Debug Logging
```javascript
getAction(gameState) {
  console.log(`Player ${this.name} state:`, {
    position: this.position,
    chips: gameState.players[this.id].chips,
    currentBet: gameState.currentBet,
    toCall: gameState.currentBet - gameState.players[this.id].bet,
    lastAction: gameState.players[this.id].lastAction,
  });
  // ... action logic
}
```

### 2. Track Event Sequence
```javascript
// Log all events with timestamps
table.on('*', (eventName, data) => {
  console.log(`[${new Date().toISOString()}] ${eventName}:`, data);
});
```

### 3. Verify Position Assignments
With `dealerButton: 0`, positions are:
- 2 players: Player 0 = SB/Button, Player 1 = BB
- 3 players: Player 0 = Button, Player 1 = SB, Player 2 = BB
- 4+ players: Player 0 = Button, then SB, BB, UTG, MP, CO...

### 4. Common Issues and Solutions

**Test timing out**: 
- Check if players are returning valid actions
- Ensure `timestamp: Date.now()` is included in all actions
- Verify minPlayers is set correctly

**Wrong winner**:
- Check player positions match expectations
- Verify chip amounts are set correctly
- Use event capture to trace action sequence

**Pot calculations wrong**:
- Log all player actions and amounts
- Check for all-in situations creating side pots
- Verify blind posting is counted correctly

## Adding New Tests

### Test Structure Template
```javascript
describe('New scenario category', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach(table => table.close());
  });

  it('should handle specific scenario', async () => {
    // 1. Create table with deterministic setup
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      dealerButton: 0,
    });

    // 2. Set up event tracking
    let winnerId = null;
    const handEndPromise = new Promise((resolve) => {
      table.on('hand:ended', ({ winners }) => {
        winnerId = winners[0]?.playerId;
        resolve();
      });
    });

    // 3. Create test players with specific behavior
    const player1 = new TestPlayer({ name: 'Player 1' });
    const player2 = new TestPlayer({ name: 'Player 2' });

    // 4. Add players and wait for completion
    table.addPlayer(player1);
    table.addPlayer(player2);
    await handEndPromise;

    // 5. Assert expected outcomes
    expect(winnerId).toBe(player1.id);
    
    // 6. Clean up
    table.close();
  });
});
```

## Performance Testing

For performance-critical tests:
```javascript
it('should handle action within 10ms', async () => {
  const start = performance.now();
  const action = await player.getAction(gameState);
  const duration = performance.now() - start;
  
  expect(duration).toBeLessThan(10);
});
```

## Coverage Goals

- Core game logic: 100% coverage required
- Integration tests: Cover all major scenarios
- Edge cases: All-ins, side pots, timeouts
- Error handling: Invalid actions, disconnections