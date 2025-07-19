# Poker Game Manager 🃏

A high-performance, general-purpose poker game management library for Node.js with multi-platform support, AI players, and comprehensive game state management.

## Current Status

- **Infrastructure**: ✅ Modern build tools configured (ESLint, Prettier, TypeScript, Vitest)
- **CI/CD**: ✅ GitHub Actions pipeline for Node.js 22
- **Core API**: 🚧 Foundation implemented (PokerGameManager, Table, Player, Adapters)
- **Tests**: ⚠️ Legacy tests exist (Mocha/Chai) - migration to Vitest pending
- **Active Work**: Implementing GameEngine and abstracting Slack dependencies
- **GitHub Issues**: [4 issues tracking progress](https://github.com/jkraybill/slack-poker-bot/issues)

## Requirements

- Node.js >= 22.0.0
- npm >= 10.0.0

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint

# Type checking
npm run typecheck

# Build library
npm run build

# Development (Note: JK runs this separately)
npm run dev
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
- ✅ Set up modern infrastructure (ESLint, Prettier, TypeScript, Vitest)
- ✅ Implemented core API foundation:
  - PokerGameManager for multi-table management
  - Table class with event-driven architecture
  - Player and PlayerAdapter base classes
  - Comprehensive type definitions
- ✅ Created GitHub issues for tracking (#1-#4)
- ✅ Set up CI/CD with GitHub Actions
- 🚧 Next: Extract GameEngine from texas-holdem.js

### Key Decisions
- Preserve excellent RxJS-based game flow in texas-holdem.js
- Use adapter pattern for platform independence
- Target modern Node.js with ESM modules
- Implement multi-table support from ground up
- Focus on clean, event-driven API

## Architecture Vision

```javascript
// Clean, intuitive API
const manager = new PokerGameManager();
const table = manager.createTable({
  variant: 'texas-holdem',
  blinds: { small: 10, big: 20 }
});

// Platform agnostic
table.addPlayer(new SlackAdapter(slackUser));
table.addPlayer(new WebSocketAdapter(wsConnection));
table.addPlayer(new AIPlayer('aggressive'));

// Event-driven
table.on('game:ended', (result) => {
  console.log(`Winner: ${result.winner.name}`);
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