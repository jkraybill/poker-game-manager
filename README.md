# Poker Game Manager 🃏

## Quick Start for Claude

```
I'm working on the Poker Game Manager project - a pure poker library for Node.js with multi-table support.

Please read:
1. SESSION_CONTEXT.md - Current state and priorities
2. CLAUDE.md - Technical guide (if needed)

Key facts:
- Pure JavaScript, Node.js 22+, event-driven architecture
- 186 tests all passing, ESLint clean
- Player class is now the single source of truth
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
- **Tests**: ✅ 186 comprehensive tests all passing!
- **Architecture**: ✅ Player class is now the single source of truth for all state
- **Integration Tests**: ✅ Multi-player betting scenarios (2-8 players)
- **Hand Evaluation**: ✅ pokersolver library integrated
- **Active Issues**: Issue #11 (pot distribution edge cases), Issue #5 (6-8 player scenarios)
- **Top Priority**: 🔥 [Test Suite Failures (#16)](https://github.com/jkraybill/poker-game-manager/issues/16) - Memory leaks and timing issues preventing full test suite from running
- **Known Issues**: 🐛 [Pot distribution bug (#11)](https://github.com/jkraybill/poker-game-manager/issues/11) - 90% FIXED, edge cases remain
- **GitHub Issues**: [Open issues tracking progress](https://github.com/jkraybill/poker-game-manager/issues)

## Documentation

- [Integration Guide](./INTEGRATION.md) - How to implement players and use the library
- [API Reference](./packages/core/src/types/index.js) - Type definitions and interfaces
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

## Key Decisions
- Pure poker library (no platform dependencies)
- Simple player interface pattern
- Modern Node.js with ESM modules
- Multi-table support from ground up
- Event-driven API
- Pure JavaScript (no TypeScript)
- Player class is the single source of truth

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
