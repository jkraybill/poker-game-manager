# Poker Game Manager 🃏

## Quick Start for Claude

```
I'm working on the Poker Game Manager project - a pure poker library for Node.js with multi-table support.

Please read:
1. SESSION_CONTEXT.md - Current state and priorities
2. TESTING_GUIDE.md - for writing unit tests etc.
3. CLAUDE.md - Technical guide (if needed)


Key facts:
- Pure JavaScript, Node.js 22+, event-driven architecture
- 211 tests passing (100% success rate!)
- Player class is the single source of truth
- GitHub: https://github.com/jkraybill/poker-game-manager
- Issues: https://github.com/jkraybill/poker-game-manager/issues

Commands: 
- go! = continue with best judgment
- go? = ask questions then continue  
- ?? = ask clarifying questions
- flush = commit/push changes

Use TodoWrite tool to track tasks. Make use of the sequential-thinking MCP if it will improve outcomes. Run `npm test` and `npm run lint` before committing.
```

## End-of-Session Checklist for Claude

When wrapping up your session, please complete these steps:

```
1. **Final Code Checks**:
   - `npm run lint` - ensure code is clean
   - `npm test` - verify tests pass (or document failures)
   - `git status` - check for uncommitted changes

2. **Commit & Push**:
   - Stage all changes: `git add -A`
   - Commit with descriptive message: `git commit -m "type: description"`
   - Push to remote: `git push origin master`
   - Reference GitHub issues in commits when relevant

3. **Update GitHub Issues**:
   - Comment on issues you worked on
   - Close completed issues
   - Create new issues for bugs found

4. **Self-Refinement** (IMPORTANT!):
   - Review this README - is it still accurate?
   - Update these copypastas if they could be better
   - Prune obsolete sections from documentation
   - Update CLAUDE.md with new patterns/fixes
   - Update TESTING_GUIDE.md with updates to testing methodology
   - Simplify SESSION_CONTEXT.md (remove old victories)
   - Delete or archive outdated files

5. **Document for Next Session**:
   - Update SESSION_CONTEXT.md with:
     * Current state (brief!)
     * Active blockers
     * Next priorities
   - Note any incomplete work and why

6. **Quick Summary** (2-3 lines max):
   - What changed?
   - What's broken?
   - What's next?

Remember: Future Claudes will thank you for clean, current docs!
```

---

A high-performance, pure poker game management library for Node.js. Handles tournaments, tables, and games with a clean event-driven API that any player implementation can connect to.

## Current Status

- **Infrastructure**: ✅ Modern build tools configured (ESLint, Prettier, Vitest)
- **CI/CD**: ✅ GitHub Actions pipeline for Node.js 22 (all tests passing!)
- **Core API**: ✅ Foundation implemented (PokerGameManager, Table, Player, GameEngine)
- **Tests**: ✅ 183 tests passing, 1 failing (split pot expectation)
- **Architecture**: ✅ Player class is single source of truth, no legacy wrappers
- **Integration Tests**: ✅ Multi-player betting scenarios (2-8 players)
- **Hand Evaluation**: ✅ pokersolver library integrated
- **Recent Fixes**: ✅ Issue #32 (betting reopening rules), test suite timeouts
- **Active Issues**: 
  - 🔧 [Event ordering (#33)](https://github.com/jkraybill/poker-game-manager/issues/33)
  - 🎨 [Eliminated players display (#34)](https://github.com/jkraybill/poker-game-manager/issues/34)
  - 📚 [Multi-hand examples (#23)](https://github.com/jkraybill/poker-game-manager/issues/23)
- **GitHub**: [View all issues](https://github.com/jkraybill/poker-game-manager/issues)

## Documentation

- [Integration Guide](./INTEGRATION.md) - How to implement players and use the library
- [API Reference](./packages/core/src/types/index.js) - Type definitions and interfaces
- [Testing Guide](./TESTING_GUIDE.md) - How to write and run tests
- [Examples](./examples/) - Sample implementations

## Requirements

- Node.js >= 22.0.0
- npm >= 10.0.0

## Quick Start

### Installation
```bash
# Clone the repository
git clone https://github.com/jkraybill/poker-game-manager.git
cd poker-game-manager

# Install dependencies (requires Node.js 22+)
npm install
```

### Development Commands
```bash
# Run tests (runs once and exits)
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Check code quality
npm run lint              # ESLint check
npm run format           # Prettier format

# Build library for distribution
npm run build            # Creates dist/ folder
npm run clean            # Remove build artifacts
```

### Quick Test Commands
```bash
# Run specific test file
npm test -- betting-scenarios
npm test -- GameEngine

# Run single test by name
npm test -- -t "should handle SB folding"

# Debug failing tests
npm test -- --reporter=verbose

# Set test timeout (default 10s per test)
npm test -- --test-timeout=30000
```

## Project Structure

```
poker-game-manager/
├── packages/
│   ├── core/                     # Platform-agnostic game engine
│   │   ├── src/
│   │   │   ├── PokerGameManager.js      # Multi-table manager
│   │   │   ├── Table.js                 # Individual table management
│   │   │   ├── Player.js                # Base player class
│   │   │   ├── game/                    # Core game logic
│   │   │   │   ├── GameEngine.js        # Texas Hold'em engine
│   │   │   │   ├── PotManager.js        # Pot calculations
│   │   │   │   ├── HandEvaluator.js     # Hand evaluation
│   │   │   │   └── Deck.js              # Card management
│   │   │   ├── types/                   # Type definitions
│   │   │   └── test-utils/              # Testing utilities
│   │   └── tests/                       # Comprehensive test suite
│   └── ai/                              # AI player implementations
├── docs/                                # Documentation
├── examples/                            # Usage examples
└── .github/                            # CI/CD workflows
```

## Key Features

- **Pure Poker Engine**: No platform dependencies, works anywhere
- **Multi-Table Support**: Manage thousands of concurrent tables
- **Event-Driven API**: React to game events in real-time
- **Flexible Player Interface**: Connect any player implementation
- **Tournament Ready**: Built-in support for MTTs and SNGs
- **Comprehensive Testing**: 180+ tests covering all scenarios
- **Performance Optimized**: Sub-10ms action processing

## Architecture Highlights

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

## Recent Achievements

- ✅ Fixed betting reopening rules (Issue #32)
- ✅ Resolved test suite timeout issues
- ✅ Added validActions to gameState for player guidance
- ✅ Removed all legacy playerData wrapper code
- ✅ Enhanced test utilities for cleaner test writing

## Performance Goals

- Sub-10ms action processing
- Support 1000+ concurrent tables
- Memory-efficient game state management
- Zero blocking operations in game loop

## MCP Integration

Using MCP tools for enhanced development:
- `sequential-thinking`: Architecture planning and decision tracking
- `github`: Version control and collaboration
- `TodoWrite`: Task management and progress tracking

## Links

- [Technical Guide](./CLAUDE.md) - Development workflow and conventions
- [Session Context](./SESSION_CONTEXT.md) - Current state and priorities
- [Refactoring Plan](./REFACTORING_PLAN.md) - Championship vision roadmap

## Original Slack Bot

This project started as a Slack bot for playing Texas Hold'em. The bot responds to `@poker deal` commands and manages games within Slack channels. The core poker engine has been extracted and made platform-agnostic.