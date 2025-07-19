# Poker Game Manager 🃏

A high-performance, pure poker game management library for Node.js. Handles tournaments, tables, and games with a clean event-driven API that any player implementation can connect to.

## Current Status

- **Infrastructure**: ✅ Modern build tools configured (ESLint, Prettier, Vitest)
- **CI/CD**: ✅ GitHub Actions pipeline for Node.js 22 (all tests passing!)
- **Core API**: ✅ Foundation implemented (PokerGameManager, Table, Player, GameEngine)
- **Tests**: ✅ Comprehensive test suite started (Deck class fully tested)
- **Active Work**: Pure poker library - all Slack dependencies removed
- **GitHub Issues**: [4 issues tracking progress](https://github.com/jkraybill/slack-poker-bot/issues)

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
slack-poker-bot/                    # (to be renamed poker-game-manager)
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

### Latest Session (2025-07-19)
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
- ✅ Created comprehensive test suite for Deck class
- ✅ Fixed all CI failures - build is green!
- ✅ Cleaned up POKER-RULES.md for simulation use
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