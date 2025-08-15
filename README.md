# Poker Game Manager 🃏

Championship-grade single-table Texas Hold'em engine for Node.js with comprehensive position information and integer-validated betting.

[![Tests](https://github.com/jkraybill/poker-game-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/jkraybill/poker-game-manager/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![GitHub Package](https://img.shields.io/badge/npm-GitHub%20Packages-blue)](https://github.com/jkraybill/poker-game-manager/packages)

## 🚀 What's New in v4.4.8

### CRITICAL: Preflop Stuck Bug FIXED! 🎯
**v4.4.8** resolves the critical bug where hands would get stuck when a player posts an all-in blind:

- **✅ All-In Blind Posting FIXED** - Games no longer freeze when players have insufficient chips for blinds
- **✅ Tournament Short Stacks** - Properly handles late-tournament scenarios with small stacks
- **✅ Game Flow Continuity** - `promptNextPlayer()` correctly handles all-in players
- **✅ Cards Dealt Properly** - All players receive cards even with all-in blind posts
- **✅ Comprehensive Testing** - Added extensive test coverage for all-in blind scenarios

### Previous: Infinite Loop Bug Fixed (v4.4.7)
**v4.4.7** resolved the devastating infinite loop bug reported in v4.4.6:

- **✅ CHECK-CHECK Infinite Loop ELIMINATED** - Fixed race condition causing tournament hangs 
- **✅ Mutex Protection** - `endingBettingRound` mutex prevents duplicate betting round calls
- **✅ Tournament Stability** - Memory exhaustion and infinite loops completely resolved

### WildcardEventEmitter Fully Exported! 🎯 (v4.4.2)
**v4.4.2** exposed the powerful `WildcardEventEmitter` class for client applications:

- **Advanced Event Monitoring** - Listen to ALL events with a single `on('*', ...)` listener
- **Perfect for Debugging** - Capture complete event flow for analysis
- **Analytics Ready** - Build comprehensive event tracking systems
- **Zero Overhead** - EventEmitter3 based for optimal performance
- **Full Documentation** - Complete guide with examples and best practices

## Position Information API (v4.4.0)

### Enhanced Position Information API 🎯
The `hand:started` event now provides comprehensive position information:

```javascript
table.on('hand:started', ({ players, dealerButton, positions }) => {
  // Easy position identification
  console.log(`Button: ${positions.button}`);
  console.log(`Big Blind: ${positions.bigBlind}`);
  console.log(`Under the Gun: ${positions.utg}`);
  
  // Detailed position mapping for all players
  console.log('All positions:', positions.positions);
  // Example: { "player1": "button", "player2": "small-blind", "player3": "big-blind" }
});
```

**Position Names Supported:**
- `button`, `small-blind`, `big-blind`, `under-the-gun`
- `middle-position`, `cutoff`, `late-position`
- `button-small-blind` (heads-up)
- Dead button information with `isDeadButton` and `isDeadSmallBlind` flags

See [POSITION_API_EXAMPLE.md](./POSITION_API_EXAMPLE.md) for complete usage examples.

## Recent Major Features

### Integer Validation for All Monetary Values (v4.3.0) 💰
- **All chip/bet/pot amounts enforced as integers** - Prevents floating-point precision issues
- **Graceful rounding** - Fractional amounts automatically rounded to nearest integer  
- **Comprehensive validation** - Covers blinds, bets, raises, chips, and pot calculations
- **Backward compatible** - Existing code continues to work

### Enhanced Game Start Diagnostics (v4.1.0) 🔍
- **Detailed failure information** - Know exactly why games fail to start
- **Comprehensive debugging context** - Player states, chip counts, error traces
- **Structured result objects** - Programmatic access to failure reasons

```javascript
const result = await table.tryStartGame();
if (!result.success) {
  console.error(`Failed: ${result.reason}`);
  console.error(`Details:`, result.details);
}
```

### Strict Simulation Framework (v3.0.x+) ⚡
- **No fold-when-can-check** - Prevents unrealistic gameplay
- **Immediate crash on violations** - Fast feedback for development
- **Action enum enforcement** - Must use `Action.FOLD`, not string 'FOLD'
- **Race-condition free** - Proper event ordering for tournament systems

## 🚀 Quick Start

### Installation

This package is published to GitHub Packages. To install:

1. **Get a GitHub Personal Access Token** with `read:packages` scope from https://github.com/settings/tokens/new

2. **Configure npm for GitHub Packages:**
   ```bash
   echo "@jkraybill:registry=https://npm.pkg.github.com" >> .npmrc
   echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc
   ```

3. **Install the package:**
   ```bash
   npm install @jkraybill/poker-game-manager  # Requires Node.js 22+
   ```

### Your First Game with Position Awareness

```javascript
import { PokerGameManager, Player, Action } from '@jkraybill/poker-game-manager';

// Create a position-aware player
class PositionalPlayer extends Player {
  constructor(config) {
    super(config);
    this.currentPosition = null;
  }

  async getAction(gameState) {
    const { validActions, toCall } = gameState;
    
    // Position-based strategy
    switch(this.currentPosition) {
      case 'button':
        // Aggressive from button
        if (validActions.includes(Action.RAISE)) {
          return { action: Action.RAISE, amount: gameState.bigBlind * 3 };
        }
        break;
      case 'big-blind':
        // Defend big blind
        if (validActions.includes(Action.CALL) && toCall <= gameState.bigBlind * 3) {
          return { action: Action.CALL };
        }
        break;
      case 'under-the-gun':
        // Tight from UTG
        if (validActions.includes(Action.FOLD)) {
          return { action: Action.FOLD };
        }
        break;
    }
    
    // Default strategy
    if (validActions.includes(Action.CHECK)) return { action: Action.CHECK };
    if (validActions.includes(Action.CALL) && toCall <= 20) return { action: Action.CALL };
    return { action: Action.FOLD };
  }
}

// Set up the game
const manager = new PokerGameManager();
const table = manager.createTable({
  blinds: { small: 10, big: 20 },
  maxPlayers: 6
});

// Add players with starting chips
const alice = new PositionalPlayer({ id: 'alice', name: 'Alice' });
alice.chips = 1000;
table.addPlayer(alice);

const bob = new PositionalPlayer({ id: 'bob', name: 'Bob' });
bob.chips = 1000;
table.addPlayer(bob);

// Update player positions when hand starts
table.on('hand:started', ({ positions }) => {
  // Update all players with their current positions
  Object.entries(positions.positions).forEach(([playerId, position]) => {
    const playerData = table.players.get(playerId);
    if (playerData) {
      playerData.player.currentPosition = position;
    }
  });
  
  console.log('New hand positions:', positions.positions);
});

// Listen for results
table.on('hand:ended', (result) => {
  console.log('Hand complete!', result.winners);
});

// Start the game
const result = await table.tryStartGame();
if (result.success) {
  console.log('Game started successfully!');
} else {
  console.error('Failed to start:', result.details.message);
}
```

### Available Imports

```javascript
// Main imports
import { PokerGameManager, Table, Player } from '@jkraybill/poker-game-manager';

// Type imports
import { Action, GamePhase, PlayerState, TableState } from '@jkraybill/poker-game-manager';

// Specific module imports
import { Table } from '@jkraybill/poker-game-manager/table';
import { Player } from '@jkraybill/poker-game-manager/player';
import { Action, GamePhase } from '@jkraybill/poker-game-manager/types';

// Game components
import { HandEvaluator, Deck, GameEngine } from '@jkraybill/poker-game-manager';

// Event system (v4.4.2+)
import { WildcardEventEmitter } from '@jkraybill/poker-game-manager';
import { WildcardEventEmitter } from '@jkraybill/poker-game-manager/wildcard-event-emitter';

// Validation utilities (v4.3.0+)
import { validateIntegerAmount, ensureInteger } from '@jkraybill/poker-game-manager/utils/validation';

// CommonJS also supported
const { PokerGameManager, Player } = require('@jkraybill/poker-game-manager');
```

## 🎲 Championship Features

### Tournament-Grade Poker Engine
- **Texas Hold'em Rules** - Complete implementation with edge case handling
- **Dead Button Rules** - WSOP-compliant tournament position management  
- **Side Pots** - Complex all-in scenarios with precise chip distribution
- **Split Pots** - Correct odd chip distribution and tied hand handling
- **Hand Evaluation** - Fast and accurate using pokersolver library
- **Position Tracking** - Comprehensive position information for strategic play

### Developer Excellence
- **Clean APIs** - Intuitive interfaces with comprehensive events
- **Event-Driven Architecture** - React to game changes in real-time
- **Flexible Player System** - Any player implementation can connect
- **Championship Testing** - 308+ tests covering all scenarios
- **Complete Type Definitions** - Full JSDoc documentation
- **Integer Validation** - All monetary values guaranteed to be integers

### Production Ready
- **Lightning Performance** - Sub-millisecond hand evaluation
- **Memory Efficient** - Optimized object management and caching
- **Robust Error Handling** - Detailed diagnostics and graceful failures
- **CI/CD Pipeline** - Automated testing and releases
- **Zero Dependencies** - Only essential poker-related packages

## 📚 Documentation

- **[Position API Examples](./POSITION_API_EXAMPLE.md)** - Comprehensive position usage guide
- **[WildcardEventEmitter Guide](./WILDCARD_EVENT_EMITTER.md)** - Advanced event monitoring and debugging
- **[Integration Guide](./INTEGRATION.md)** - Player implementation patterns
- **[Testing Guide](./TESTING_GUIDE.md)** - Test utilities and patterns
- **[Poker Rules](./POKER-RULES.md)** - Complete rule reference
- **[Examples](./examples/)** - Working code examples

## 🧪 Development

```bash
# Test suite (308+ tests - championship coverage!)
npm test

# Specific test categories
npm test -- position-information    # Position API tests
npm test -- integer-validation      # Monetary validation tests
npm test -- dead-button             # Tournament position rules
npm test -- side-pots               # Complex pot scenarios

# Code quality
npm run lint                         # ESLint validation
npm run format                       # Prettier formatting
npm run test:coverage                # Coverage reporting

# Build
npm run build                        # Creates dist/ for distribution

# 🚨 NEVER manually publish - CI handles releases!
# ✅ Create tags for automated publishing:
git tag v4.x.x && git push origin v4.x.x
```

## 📦 Release Management

**Automated Release Process:**
1. Push changes to `master` and verify CI passes ✅
2. Update `package.json` version and commit
3. Create and push git tag: `git tag v4.x.x && git push origin v4.x.x`
4. GitHub Actions automatically publishes to GitHub Packages

**Never run `npm publish` manually** - it causes CI conflicts!

## 📋 Requirements

- **Node.js** >= 22.0.0 (tested on latest versions)
- **npm** >= 10.0.0

## 🏗️ Architecture

```
packages/core/src/
├── PokerGameManager.js       # Multi-table management
├── Table.js                  # Single table with position tracking
├── Player.js                 # Base player class
├── game/
│   ├── GameEngine.js        # Core Texas Hold'em with position calculation
│   ├── PotManager.js        # Betting and pot management
│   ├── HandEvaluator.js     # Fast hand strength calculation
│   └── Deck.js              # Card management
├── utils/
│   └── validation.js        # Integer validation utilities
├── types/                   # Complete type definitions
└── integration/             # 84+ test files total
```

## 🎯 What This Library Delivers

**Championship-Grade Single-Table Texas Hold'em:**

✅ **Complete Rule Implementation** - All Texas Hold'em scenarios handled correctly  
✅ **Position Intelligence** - Comprehensive position tracking and identification  
✅ **Tournament Standards** - Dead button, side pots, split pots like the pros  
✅ **Integer Precision** - All monetary values validated as integers  
✅ **Comprehensive Testing** - 308+ tests across 84 test files  
✅ **Production Performance** - Optimized for real-world usage  
✅ **Clean Architecture** - Event-driven design that scales  

## 🌟 Advanced Features

### Position-Aware Strategy Development
```javascript
// Implement sophisticated strategies using position data
class TournamentPlayer extends Player {
  getAction(gameState) {
    const position = this.getCurrentPosition();
    const playerCount = Object.keys(gameState.players).length;
    
    // Adjust strategy based on position and table size
    return this.getPositionalStrategy(position, playerCount)
      .getAction(gameState);
  }
}
```

### Integer-Safe Monetary Operations
```javascript
// All amounts automatically validated and rounded
player.chips = 1000.5;  // Becomes 1000
table.blinds = { small: 10.3, big: 20.7 };  // Becomes 10, 21
```

### Comprehensive Event System
```javascript
// Rich event data for analysis and debugging
table.on('hand:started', ({ positions, players, dealerButton }) => {
  // Position tracking, player states, button location
});

table.on('player:action', ({ playerId, action, amount, position }) => {
  // Track every action with context
});

table.on('hand:ended', ({ winners, pot, sidePots, board }) => {
  // Complete hand results with detailed breakdowns
});
```

## 🚀 Future Enhancements

**The vision continues to expand:**

- 📊 **Advanced Analytics** - Decision tracking and EV calculation
- 🎮 **Training Scenarios** - Practice specific poker situations
- 🏆 **Multi-Table Tournaments** - Full tournament management
- 🃏 **Poker Variants** - Omaha, Short Deck, Mixed Games
- 🧠 **AI Integration** - Neural network player implementations

## 🎲 Philosophy

This library embodies championship-level poker software:

- **Correctness First** - Every rule implemented precisely
- **Developer Experience** - Clean, well-documented APIs
- **Performance Matters** - Fast enough for production use
- **Testing Excellence** - Comprehensive scenario coverage
- **Real-World Ready** - Built for actual poker applications

**"Championship-grade doesn't happen by accident"** - Every feature is thoroughly tested and validated against real poker scenarios.

## 📄 License

MIT License - see [LICENSE.md](./LICENSE.md)

## 🙏 Contributing

**Found a bug? Got an enhancement idea?**

- Report issues on [GitHub Issues](https://github.com/jkraybill/poker-game-manager/issues)
- Follow the comprehensive testing patterns in [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- Maintain the championship standard - all features must be thoroughly tested

---

**Built for poker excellence.** 🏆🃏