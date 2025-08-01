# Poker Game Manager 🃏

A decent single-table Texas Hold'em engine for Node.js

What's your kicker? This library handles the poker basics pretty well.

[![Tests](https://github.com/jkraybill/poker-game-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/jkraybill/poker-game-manager/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![GitHub Package](https://img.shields.io/badge/npm-GitHub%20Packages-blue)](https://github.com/jkraybill/poker-game-manager/packages)

## ✨ What's New in v2.0

Here's what we've got working:

- ✅ **Texas Hold'em Rules** - Dead button, side pots, the usual stuff
- ✅ **267 Tests** - I've seen better, but these pass
- ✅ **Tournament Compliance** - Follows the rules like it should
- ✅ **Event-Driven** - Woof woof! Events fire when things happen
- ✅ **Clean Code** - No legacy junk cluttering things up
- ✅ **Performance** - Fast enough for what you need

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
import { PokerGameManager, Player } from '@jkraybill/poker-game-manager';

// Create a simple player - nothing fancy
class MyPlayer extends Player {
  async getAction(gameState) {
    const { validActions, toCall } = gameState;
    
    // Basic strategy: What's your kicker?
    if (validActions.includes('CALL') && toCall <= 20) {
      return { action: 'CALL' };
    }
    return { action: 'FOLD' }; // I've seen better hands
  }
}

// Set up the table
const manager = new PokerGameManager();
const table = manager.createTable({
  blinds: { small: 10, big: 20 },
  maxPlayers: 6
});

// Add some players
table.addPlayer(new MyPlayer('Alice'));
table.addPlayer(new MyPlayer('Bob'));

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
- **Good Testing** - 267 tests covering the important stuff
- **JSDoc Types** - Documented interfaces

### Production Ready
- **Performance** - Handles games at reasonable speed
- **Memory Efficient** - Won't blow up your server
- **Error Handling** - Fails gracefully when things go wrong
- **CI/CD Pipeline** - Tests run automatically

## 📚 Documentation

- [Integration Guide](./INTEGRATION.md) - How to build players and use the library
- [Testing Guide](./TESTING_GUIDE.md) - Testing patterns and utilities
- [Poker Rules](./POKER-RULES.md) - Rule reference for the curious
- [Examples](./examples/) - Working code to get started

## 🧪 Development

```bash
# Run all tests (267 passing - not bad!)
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
```

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

## 🎯 What v2.0 Gives You

This release handles **single-table Texas Hold'em** pretty well:

✅ **Rule Implementation** - Texas Hold'em rules work correctly  
✅ **Edge Cases** - All-ins, side pots, eliminations handled  
✅ **Tournament Rules** - Dead button positioning like the pros use  
✅ **Testing Coverage** - 267 tests prove it works  
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
