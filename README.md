# Poker Game Manager 🃏

A high-performance, general-purpose poker game management library for Node.js with multi-platform support, AI players, and comprehensive game state management.

## Current Status

- **Tests**: ⚠️ Legacy tests exist (Mocha/Chai) - migration to Vitest pending
- **Build**: ⚠️ Transitioning from Node 0.12.7 to Node 20+
- **Active Work**: Refactoring Slack bot into platform-agnostic library
- **Priority**: Core abstraction and modernization

## Quick Start

```bash
# Install dependencies (after modernization)
npm install

# Run tests
npm test

# Development
npm run dev

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
- Created comprehensive refactoring plan
- Modernized package.json (Node 0.12.7 → 20+)
- Established architecture for adapter pattern
- Identified core game logic preservation strategy
- Set up MCP tools: sequential-thinking for planning

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