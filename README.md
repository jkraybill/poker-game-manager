# Poker Game Manager 🃏

## Quick Start for Claude

```
I'm working on the Poker Game Manager project. This is a high-performance, pure poker library for Node.js with multi-table support and event-driven architecture.

Please read these files in order:
1. CLAUDE.md - Technical guide and development workflow
2. ABOUT-JK.md - Working style and communication preferences  
3. REFACTORING_PLAN.md - Project transformation roadmap
4. src/texas-holdem.js - Core game logic implementation

Key context:
- Pure JavaScript (no TypeScript), Node.js 22+ required
- Event-driven architecture with clean player interfaces
- 159 tests passing, all core components implemented
- Working on AI players and tournament support
- Use TodoWrite tool frequently to track tasks
- Run tests with `npm test`, lint with `npm run lint`
- Never start servers or commit without permission
- JK's commands: go! (continue), go? (ask then continue), ?? (questions), flush (commit/push)

GitHub repo: https://github.com/jkraybill/poker-game-manager
```

---

A high-performance, pure poker game management library for Node.js. Handles tournaments, tables, and games with a clean event-driven API that any player implementation can connect to.

## Current Status

- **Infrastructure**: ✅ Modern build tools configured (ESLint, Prettier, Vitest)
- **CI/CD**: ✅ GitHub Actions pipeline for Node.js 22 (all tests passing!)
- **Core API**: ✅ Foundation implemented (PokerGameManager, Table, Player, GameEngine)
- **Tests**: ✅ Comprehensive test suite (169 tests passing - all core components covered)
- **Integration Tests**: ✅ Multi-player betting scenarios (2-5 players) fully tested
- **Hand Evaluation**: ✅ Integrated pokersolver library for robust hand evaluation
- **Player API**: ✅ Enhanced with lastAction tracking for advanced strategies
- **Active Work**: Ready for AI player implementations and tournament support
- **GitHub Issues**: [6 issues tracking progress](https://github.com/jkraybill/poker-game-manager/issues)

## Documentation

- [Integration Guide](./INTEGRATION.md) - How to implement players and use the library
- [API Reference](./packages/core/src/types/index.js) - Type definitions and interfaces
- [Examples](./examples/) - Sample implementations

## Requirements

- Node.js >= 22.0.0
- npm >= 10.0.0

## Quick Start

```bash
# Install dependencies
npm install

# Run tests (runs once and exits)
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint

# Build library
npm run build
```

## Project Structure

```
poker-game-manager/
├── src/                           # Core source code
│   ├── main.js                   # Current entry point (Slack bot)
│   ├── bot.js                    # Slack integration layer
│   ├── texas-holdem.js           # Core game logic (preserve this!)
│   ├── player-interaction.js     # Player action handling
│   ├── pot-manager.js            # Betting and pot logic
│   └── [other game modules]
├── tests/                         # Existing Mocha tests
├── ai/                           # AI player implementations
├── resources/                     # Card images
├── REFACTORING_PLAN.md          # Detailed transformation roadmap
├── CLAUDE.md                     # Technical guidance for Claude
└── ABOUT-JK.md                   # JK's working style

Future structure:
├── packages/
│   ├── core/                     # Platform-agnostic game engine
│   ├── adapters/                 # Platform integrations
│   └── ai/                       # AI player framework
```

## Session Memory

### Latest Session (2025-07-19 Afternoon)
- ✅ Created comprehensive integration tests for betting scenarios:
  - 2-player heads-up: SB folds to BB
  - 3-player: Button raises, blinds fold
  - 3-player: Button raises, BB calls, then folds to flop bet
  - 3-player: All players fold to big blind
- ✅ Fixed race conditions in test suite:
  - Resolved position-based timing issues
  - Added proper event capture control
  - Fixed test isolation when running multiple integration tests
- ✅ Fixed all ESLint errors for CI compliance:
  - Removed async from methods without await
  - Cleaned up unused variables
  - Added missing trailing commas
- ✅ All 159 tests passing (up from 122)
- ✅ CI/CD pipeline fully green

### Previous Session (2025-07-19 Morning)
- ✅ Fixed GameEngine betting round logic bug (pre-flop bet reset issue)
- ✅ Fixed failing check action test in GameEngine
- ✅ Removed coverage requirements from CI (simplified pipeline)
- ✅ Enhanced Deck tests with 8 additional test cases:
  - Performance and reliability tests
  - Card immutability verification
  - Complex operation sequences
  - Statistical shuffle verification
  - Additional edge case handling
- ✅ Replaced custom HandEvaluator with pokersolver library:
  - Reduced code from 297 lines to 162 lines
  - Improved reliability with battle-tested library
  - Standardized card format to use pokersolver notation (T instead of 10)
- ✅ Written comprehensive tests for PotManager (32 tests):
  - Side pot calculations
  - Multi-way all-in scenarios
  - Pot distribution logic
- ✅ Written comprehensive tests for Table class (28 tests):
  - Player management and waiting lists
  - Game lifecycle management
  - Event forwarding

### Previous Session
- ✅ Created comprehensive refactoring plan (REFACTORING_PLAN.md)
- ✅ Modernized package.json (Node 0.12.7 → 22+)
- ✅ Set up modern infrastructure (ESLint, Prettier, Vitest)
- ✅ Implemented core API foundation:
  - PokerGameManager for multi-table management
  - Table class with event-driven architecture
  - Player base class (simplified from adapter pattern)
  - GameEngine, Deck, HandEvaluator, PotManager
- ✅ Created GitHub issues for tracking (#1-#4)
- ✅ Set up CI/CD with GitHub Actions
- ✅ Removed all Slack dependencies - now a pure poker library
- ✅ Removed TypeScript configuration (pure JavaScript project)

### Key Decisions
- Created pure poker library (no platform dependencies)
- Simple player interface pattern (not adapter pattern)
- Target modern Node.js with ESM modules
- Implement multi-table support from ground up
- Focus on clean, event-driven API
- Pure JavaScript (no TypeScript)

## Architecture Vision

```javascript
// Clean, intuitive API
const manager = new PokerGameManager();
const table = manager.createTable({
  variant: 'texas-holdem',
  blinds: { small: 10, big: 20 }
});

// Add any player implementation
table.addPlayer(myPlayerImplementation);
table.addPlayer(aiPlayer);
table.addPlayer(remotePlayer);

// Event-driven architecture
table.on('game:ended', (result) => {
  console.log(`Winners: ${result.winners.join(', ')}`);
});

// Tournament support
const tournament = manager.createTournament({
  type: 'multi-table',
  buyIn: 1000,
  startingChips: 10000
});
```

## Links

- [Technical Guide](./CLAUDE.md) - Development workflow and conventions
- [JK's Working Style](./ABOUT-JK.md) - Communication preferences
- [Refactoring Plan](./REFACTORING_PLAN.md) - Detailed transformation roadmap

## Original Slack Bot

This project started as a Slack bot for playing Texas Hold'em. The bot responds to `@poker deal` commands and manages games within Slack channels. See git history for original implementation.

## Performance Goals

- Sub-10ms action processing
- Support 1000+ concurrent tables
- Memory-efficient game state management
- Zero blocking operations in game loop

## MCP Integration

Using MCP tools for enhanced development:
- `sequential-thinking`: Architecture planning and decision tracking
- `github`: Version control and collaboration (when needed)