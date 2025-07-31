# Poker Game Manager 🃏

## Quick Start for Claude

```
I'm working on the Poker Game Manager project - a championship-grade poker library for Node.js with multi-table support and tournament-standard rules.

Please read:
1. SESSION_CONTEXT.md - Current state and priorities
2. CLAUDE.md - Technical guide and conventions
3. REFACTORING_PLAN.md - Championship vision and roadmap

Key facts:
- Pure JavaScript, Node.js 22+, event-driven architecture
- 260+ tests across 63 test files (championship-grade testing)
- Tournament-standard rules (dead button, side pots, all edge cases)
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
   - Update documentation if you discover inaccuracies
   - Ensure all *.md files remain current and accurate
   - Remove any newly obsolete information

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

## Current Status - CHAMPIONSHIP FOUNDATION COMPLETE ✅

**🏆 PRODUCTION-READY POKER ENGINE** - Tournament-grade foundation achieved!

- **Infrastructure**: ✅ Modern build tools configured (ESLint, Prettier, Vitest)
- **CI/CD**: ✅ GitHub Actions pipeline for Node.js 22 (all tests passing!)
- **Core Engine**: ✅ Complete Texas Hold'em implementation with tournament rules
- **Tests**: ✅ **260+ tests across 63 test files** - world-class coverage
- **Tournament Rules**: ✅ **Dead button implementation** (Issue #37) - WSOP compliant
- **Architecture**: ✅ Event-driven, multi-table ready, zero legacy code
- **Edge Cases**: ✅ Side pots, split pots, eliminations, all poker scenarios covered
- **Performance**: ✅ Sub-millisecond hand evaluation, deterministic testing

**Next Level - The Big 3 Championship Features:**
- 📊 [Analytics & Learning Engine (#12)](https://github.com/jkraybill/poker-game-manager/issues/12)
- 🎮 [Training Mode & Scenarios (#13)](https://github.com/jkraybill/poker-game-manager/issues/13)  
- 🏆 [Tournament Management System (#14)](https://github.com/jkraybill/poker-game-manager/issues/14)

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
- **Tournament Rules**: WSOP-compliant dead button rules and position handling
- **Comprehensive Testing**: 260+ tests across 63 files covering all poker scenarios
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

// Tournament-grade rules (dead button, side pots, etc.)
table.tryStartGame(); // Handles all edge cases automatically
```

## Recent Major Achievements

- ✅ **Championship Foundation Complete** - Production-ready poker engine
- ✅ **Dead Button Rules** (Issue #37) - Tournament-standard position handling
- ✅ **Test Revolution** - 260+ tests across 63 granular test files  
- ✅ **Zero Legacy Code** - Clean architecture, no technical debt
- ✅ **Test Utilities Framework** - World-class testing infrastructure
- ✅ **Performance Optimization** - Sub-millisecond hand evaluation

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