# Poker Game Manager 🃏

A decent single-table Texas Hold'em engine for Node.js

What's your kicker? This library handles the poker basics pretty well.

[![Tests](https://github.com/jkraybill/poker-game-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/jkraybill/poker-game-manager/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![GitHub Package](https://img.shields.io/badge/npm-GitHub%20Packages-blue)](https://github.com/jkraybill/poker-game-manager/packages)

## 🚨 Breaking Changes in v4.0.0

### `tryStartGame()` is now async
- **MUST await the method** - Returns `Promise<boolean>` instead of `boolean`
- **Fixes race conditions** - Properly awaits internal async operations
- **Prevents infinite loops** - Resolves issues with concurrent table starts

```javascript
// Before (v3.x)
const started = table.tryStartGame();

// After (v4.x)
const started = await table.tryStartGame();
```

## Previous v3.0.5 Changes

### Fail-Fast Contract Enforcement 🚀
- **No Retry on Errors** - Player contract violations immediately crash the game
- **Clear Error Messages** - Fatal errors indicate exactly which player broke the contract

## Previous v3.0.4 Changes

### Enhanced Error Messages 🎯
- **Detailed Validation Errors** - Invalid actions include full game state for debugging
- **Actionable Solutions** - Each error suggests the correct action with proper syntax

## Previous v3.0.3 Changes

### Critical Chip Conservation Fix 💰
- **CRITICAL FIX**: Resolved chip conservation bug that caused up to 15% of chips to disappear
- **100% chip conservation guaranteed** - All game scenarios maintain exact chip totals

## Previous v3.0.2 Changes

### Race Condition Fix 🏁
- **Fixed `hand:ended` timing** - Now fires AFTER elimination processing completes
- **Chip conservation guaranteed** - External systems always see consistent state
- **Tournament integrity** - No more temporary "missing chips" during eliminations

## Previous v3.0.0 Changes

### Strict Action Validation 🚨
- **Action enum is now mandatory** - String actions like 'FOLD' will crash immediately
- **Fold validation enforced** - Players CANNOT fold when they can check for free (toCall = 0)
- **No auto-folding on timeouts** - Timeouts throw fatal errors (this is a simulation framework!)
- **Developer errors crash fast** - Undefined/null actions are fatal, not silently handled

#### Valid Action Rules (Simulation Framework)
- **CHECK**: Only valid when `toCall = 0` (nothing to call)
- **FOLD**: Only valid when `toCall > 0` (facing a bet/raise)
- **CALL**: Only valid when `toCall > 0` and player has chips
- **BET**: Only valid when no current bet exists
- **RAISE**: Only valid when facing a bet and player has sufficient chips
- **ALL_IN**: Always valid when player has chips

⚠️ **Important**: In this simulation framework, players CANNOT fold when they can check for free. This prevents unrealistic gameplay where players fold with no cost.

### Previous v2.0 Breaking Changes
- **Tables no longer enforce buy-in limits** - That's a tournament/room policy now
- **Players must have chips before joining** - No more automatic buy-ins
- **Removed minBuyIn/maxBuyIn from tables** - Use any chip amount you want

### What's Working:
- ✅ **Texas Hold'em Rules** - Dead button, side pots, the usual stuff
- ✅ **247 Tests** - All passing with strict validation
- ✅ **Tournament Ready** - Tables accept any stack size now
- ✅ **Event-Driven** - Events fire in correct order (eliminations before hand:ended)
- ✅ **Clean Code** - No legacy junk cluttering things up
- ✅ **Lightning Fast** - 32x faster hand evaluation with caching
- ✅ **Memory Efficient** - Object pooling reduces GC pressure
- ✅ **Strict Validation** - Invalid actions crash immediately (no silent failures!)
- ✅ **Race-Condition Free** - Proper event synchronization for tournament managers

## 🚀 Quick Start

### Installation

This package is published to GitHub Packages (not the public npm registry). To install:

1. **Get a GitHub Personal Access Token:**
   - Go to https://github.com/settings/tokens/new
   - Create a token with `read:packages` scope
   - Copy the generated token

2. **Configure npm to use GitHub Packages:**
   
   Create a `.npmrc` file in your project root:
   ```bash
   echo "@jkraybill:registry=https://npm.pkg.github.com" >> .npmrc
   echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc
   ```
   
   Or set it globally in `~/.npmrc`:
   ```bash
   echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> ~/.npmrc
   ```

3. **Install the package:**
   ```bash
   npm install @jkraybill/poker-game-manager  # Requires Node.js 22+
   ```

**Note:** Replace `YOUR_GITHUB_TOKEN` with your actual token. For security, consider using an environment variable:
```bash
echo "//npm.pkg.github.com/:_authToken=\${GITHUB_TOKEN}" >> .npmrc
export GITHUB_TOKEN=your_actual_token_here
npm install @jkraybill/poker-game-manager
```

Or if you're building from source:
```bash
git clone https://github.com/jkraybill/poker-game-manager.git
cd poker-game-manager
npm install
npm run build  # Build for distribution
```

### Your First Game
```javascript
import { PokerGameManager, Player, Action } from '@jkraybill/poker-game-manager';

// Create a simple player - nothing fancy
class MyPlayer extends Player {
  async getAction(gameState) {
    const { validActions, toCall } = gameState;
    
    // Basic strategy: What's your kicker?
    // IMPORTANT: Must use Action enum - strings will crash!
    if (validActions.includes(Action.CALL) && toCall <= 20) {
      return { action: Action.CALL };
    }
    // Only fold if facing a bet (toCall > 0)
    if (validActions.includes(Action.FOLD)) {
      return { action: Action.FOLD };
    }
    // Check if we can check for free
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
const alice = new MyPlayer('Alice');
alice.buyIn(1000); // Set chips before adding
table.addPlayer(alice);

const bob = new MyPlayer('Bob');
bob.buyIn(1000);
table.addPlayer(bob);

// Listen for results - Woof woof!
table.on('hand:ended', (result) => {
  console.log('Hand complete!', result.winners);
});

// Start the game
table.tryStartGame();
```

### Available Imports

```javascript
// Main imports
import { PokerGameManager, Table, Player } from '@jkraybill/poker-game-manager';

// Type imports
import { Action, GamePhase, PlayerStatus } from '@jkraybill/poker-game-manager';

// Specific module imports
import { Table } from '@jkraybill/poker-game-manager/table';
import { Player } from '@jkraybill/poker-game-manager/player';
import { Action, GamePhase } from '@jkraybill/poker-game-manager/types';

// Game components
import { HandEvaluator, Deck, GameEngine } from '@jkraybill/poker-game-manager';

// CommonJS also supported
const { PokerGameManager, Player } = require('@jkraybill/poker-game-manager');
```

## 🎲 What We've Built

### Solid Poker Engine
- **Texas Hold'em** - The rules work like they should
- **Dead Button Rules** - Tournament-style position handling  
- **Side Pots** - Complex all-in scenarios handled properly
- **Split Pots** - Odd chips distributed correctly
- **Hand Evaluation** - Uses pokersolver library (I've seen better, but it works)

### Developer Friendly
- **Clean APIs** - Straightforward to use
- **Event-Driven** - React to game events as they happen
- **Flexible Players** - Any player implementation can connect
- **Good Testing** - 242 tests covering the important stuff
- **JSDoc Types** - Documented interfaces

### Production Ready
- **Performance** - Sub-millisecond hand evaluation (0.001ms)
- **Memory Efficient** - Object pooling and smart caching
- **Error Handling** - Fails gracefully when things go wrong
- **CI/CD Pipeline** - Tests run automatically
- **Benchmarked** - Comprehensive performance monitoring

## 📚 Documentation

- [Integration Guide](./INTEGRATION.md) - How to build players and use the library
- [Testing Guide](./TESTING_GUIDE.md) - Testing patterns and utilities
- [Poker Rules](./POKER-RULES.md) - Rule reference for the curious
- [Examples](./examples/) - Working code to get started

## 🧪 Development

```bash
# Run all tests (242 passing - not bad!)
npm test

# Run specific scenarios - What's your kicker?
npm test -- 2player-scenarios     # Heads-up play
npm test -- 4player-side-pots     # Side pot handling
npm test -- dead-button           # Tournament position rules

# Code quality stuff
npm run lint                       # Check the code
npm run format                     # Make it pretty
npm run test:coverage              # See what we're testing

# Build it
npm run build                      # Creates dist/ folder

# 🚨 NEVER manually publish - CI handles releases!
# ❌ npm publish                   # DON'T DO THIS!
# ✅ git tag v2.x.x && git push origin v2.x.x  # Triggers CI release
```

### 📦 Publishing & Releases

**⚠️ Important:** Never run `npm publish` manually! This causes CI conflicts.

The release process is fully automated:
1. Push changes to `master` and wait for CI ✅
2. Update `package.json` version and commit  
3. Create and push a git tag: `git tag v2.x.x && git push origin v2.x.x`
4. GitHub Actions automatically publishes to GitHub Packages

All releases are published to GitHub Packages (not public npm registry).

## 📋 Requirements

- **Node.js** >= 22.0.0 (newer is probably fine)
- **npm** >= 10.0.0 (or whatever you've got)

## 🏗️ Architecture

```
packages/core/src/
├── PokerGameManager.js      # Manages multiple tables
├── Table.js                 # Single table management  
├── Player.js               # Base player class
├── game/
│   ├── GameEngine.js       # Core Texas Hold'em logic
│   ├── PotManager.js       # Betting and pot math
│   ├── HandEvaluator.js    # Hand strength calculation
│   └── Deck.js             # Card shuffling and dealing
├── types/                  # Type definitions
└── test-utils/             # Testing helpers
```

## 🎯 What This Library Gives You

This library handles **single-table Texas Hold'em** pretty well:

✅ **Rule Implementation** - Texas Hold'em rules work correctly  
✅ **Edge Cases** - All-ins, side pots, eliminations handled  
✅ **Tournament Rules** - Dead button positioning like the pros use  
✅ **Testing Coverage** - 247 tests prove it works  
✅ **Performance** - Fast enough for real use  
✅ **Clean Code** - Event-driven architecture that makes sense  

## 🚀 What's Next

**This is solid** - but there's always room for improvement:

- 📊 **Analytics** - Track decisions and spots
- 🎮 **Training Mode** - Practice specific scenarios
- 🏆 **Multi-Table** - Tournament management
- 🃏 **More Variants** - Omaha, Short Deck, etc.

## 🎲 JK Philosophy

This library focuses on getting the fundamentals right:

- We handle the poker rules correctly
- We test the important scenarios  
- We keep the code clean and readable
- We don't overcomplicate things

**"I've seen better!"** - We're not claiming to be the greatest poker engine ever built. We're just trying to be solid, reliable, and useful for building poker applications.

**"Woof woof!"** - Sometimes you gotta have fun with it. 🐕

## 📄 License

MIT License - see [LICENSE.md](./LICENSE.md)

## 🙏 Contributing

Found a bug? Got an improvement? **What's your kicker?**

- Report issues on [GitHub Issues](https://github.com/jkraybill/poker-game-manager/issues)  
- Follow the testing patterns (see [TESTING_GUIDE.md](./TESTING_GUIDE.md))
- Keep it simple and solid
