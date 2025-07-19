# Claude Technical Guide - Poker Game Manager

## Quick Reference Card
```bash
# Essential commands
npm test                    # Run all tests
npm test -- betting-scenarios  # Specific test file
npm run lint && npm run format && npm test  # Pre-commit check
git status && git diff      # Check changes
git add -A && git commit -m "message" && git push origin master  # Commit & push

# Debugging
npm test -- --reporter=verbose  # Verbose output
npm test -- -t "test name"      # Run specific test

# JK shortcuts
go!   # Continue with best judgment
go?   # Ask questions then continue
??    # Ask clarifying questions
flush # Commit/push changes
```

## Session Preparation

**First read:**
1. SESSION_CONTEXT.md for immediate context
2. This file (CLAUDE.md) for detailed guidance
3. ABOUT-JK.md for communication style (if needed)
4. REFACTORING_PLAN.md for transformation roadmap (if needed)
5. TROUBLESHOOTING.md for common issues (if debugging)

## JK's Shorthand Commands

- **go!** - Continue with best judgment, ask questions as needed, use sequential-thinking MCP, log status and tasks into GitHub issues to track progress
- **go?** - Ask one or more clarifying questions, then go!
- **??** - Ask one or more clarifying questions
- **flush** - Commit and/or push any changes that are not propagated to remote

## Development Commands

### What Claude CAN Run
```bash
# Testing
npm test                    # Run all tests (runs once and exits)
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage

# Linting & Formatting
npm run lint              # ESLint check
npm run format            # Prettier format

# Building
npm run build             # Build library for distribution
npm run clean             # Clean build artifacts

# Git Operations
git status
git diff
git add .
git commit -m "message"
```

### What Claude CANNOT Run
- `npm run dev` - JK runs dev server separately
- Any server start commands
- Direct database operations
- Production deployments

## Architecture Overview

### Current State (Transitioning)
- **Node Version**: 22.17.0 (required)
- **Framework**: Pure poker library with no platform dependencies
- **Game Logic**: Clean event-driven architecture
- **Testing**: Vitest configured, 169 tests passing (all core components covered)
- **Build**: esbuild configured for ESM and CJS output
- **CI/CD**: GitHub Actions running on Node.js 22 - all tests passing!
- **Language**: Pure JavaScript (no TypeScript)
- **Dependencies**: pokersolver library for hand evaluation

### Implemented Components
- **PokerGameManager**: Multi-table management with event forwarding
- **Table**: Game table with player management and auto-flow
- **Player**: Simple interface for player implementations
- **GameEngine**: Complete poker game logic (Texas Hold'em)
- **Deck**: Card management with Fisher-Yates shuffle
- **HandEvaluator**: Poker hand evaluation using pokersolver library
- **PotManager**: Betting, pot calculations, and side pot management
- **Type System**: Complete enums and JSDoc types
- **Infrastructure**: ESLint, Prettier, Vitest all configured
- **Tests**: Comprehensive test suite for all core components (169 tests)

### Key Patterns

1. **Player Interface**
```javascript
// Any player implementation must provide these methods
interface Player {
  getAction(gameState): Promise<Action>  // Enhanced with lastAction data
  receivePrivateCards(cards): void
  receivePublicCards(cards): void
  receiveGameUpdate(update): void
}
```

2. **Event-Driven Architecture**
```javascript
// All game state changes emit events
table.on('player:action', ({ player, action }) => {
  // Handle action
});
```

3. **Multi-Table Support**
```javascript
// Each table has unique ID and isolated state
const table1 = manager.createTable({ id: 'high-stakes' });
const table2 = manager.createTable({ id: 'beginner' });
```

## Workflow & Conventions

### Development Process

1. **Before changing any file**:
   - Read it completely first
   - Check for existing tests
   - Understand dependencies

2. **When removing platform code**:
   - Preserve core game logic
   - Remove all UI/messaging code
   - Keep only poker mechanics

3. **When modernizing code**:
   - Convert callbacks to async/await
   - Use ES modules (import/export)
   - Add proper type definitions

4. **Testing requirements**:
   - Write tests BEFORE implementation
   - Maintain 90%+ coverage
   - Test edge cases thoroughly

### Code Style

```javascript
// Modern ES modules
import { EventEmitter } from 'eventemitter3';

// Clean class structure
export class PokerTable extends EventEmitter {
  #players = new Map();  // Private fields
  
  constructor(config) {
    super();
    this.config = config;
  }
  
  async addPlayer(player) {
    // Async/await over callbacks
    const validated = await this.validatePlayer(player);
    this.#players.set(player.id, validated);
    this.emit('player:joined', { player: validated });
  }
}
```

### Commit Conventions

```bash
# Feature commits
feat(core): add multi-table support
feat(adapter): implement WebSocket adapter

# Refactoring commits  
refactor(game): extract Slack dependencies
refactor(tests): migrate to Vitest

# Fix commits
fix(pot): correct side pot calculation
fix(ai): prevent infinite decision loop
```

## Testing Strategy

### Test Architecture Philosophy
**GRANULAR OVER MONOLITHIC**: Each test file focuses on ONE specific poker concept for pinpoint failure identification.

**Test File Organization**:
- `/integration/2player-scenarios.test.js` - Heads-up specific mechanics
- `/integration/3player-*.test.js` - 3-player dynamics (3 files)
- `/integration/4player-*.test.js` - 4-player scenarios (5 files)
- `/integration/5player-*.test.js` - 5-player advanced concepts (4 files)
- `/integration/fold-scenarios.test.js` - Folding pattern testing
- `/integration/betting-scenarios.test.js` - Original comprehensive suite

### Test Structure
```javascript
// Deterministic testing pattern
const table = manager.createTable({
  blinds: { small: 10, big: 20 },
  dealerButton: 0, // CRITICAL: Always use deterministic dealer button
});

// Position-aware player template
class PositionPlayer extends Player {
  getAction(gameState) {
    const myState = gameState.players[this.id];
    // Use myState.lastAction for advanced strategies
    if (myState.lastAction === Action.RAISE) {
      // React to previous actions
    }
  }
}
```

### Critical Testing Learnings
1. **Object Reference Equality Bugs**: Always use `player.id` comparison, never `===` for playerData objects
2. **Deterministic Tests**: Use `dealerButton: 0` to prevent flaky position-dependent tests
3. **Granular Failure Identification**: 13 focused files > 1 monolithic 2157-line file
4. **Side Pot Testing**: Complex scenarios expose pot distribution edge cases (Issue #11)

### Test Extraction Methodology
**When extracting large test suites**:
1. **Identify poker concepts** - Each file should test ONE clear poker concept
2. **Preserve test logic** - Copy exact player behavior and assertions
3. **Add descriptive headers** - Document expected flow and poker theory
4. **Run after extraction** - Verify each extracted test passes independently
5. **Group by complexity** - 2-player → 3-player → 4-player → 5-player progression
6. **Focus on debugging** - Granular tests make failure diagnosis immediate

**Example extraction pattern**:
```
betting-scenarios.test.js (2157 lines)
├── 2player-scenarios.test.js (heads-up)
├── 3player-scenarios.test.js (basic 3-way)
├── 4player-utg-raise-all-fold.test.js (position aggression)
├── 4player-side-pots.test.js (side pot mechanics)
├── 5player-squeeze-play.test.js (advanced concepts)
└── fold-scenarios.test.js (folding patterns)
```

### Testing Priorities
1. **Core game logic** - 100% coverage required
2. **Adapter interfaces** - Mock extensively  
3. **AI players** - Test decision making
4. **Performance** - Benchmark critical paths
5. **Regression Testing** - Each poker concept in isolation

## Current Priorities

1. **Completed Tasks** ✅:
   - Set up modern build tooling (ESLint, Prettier, Vitest)
   - Design core API (PokerGameManager, Table, Player)
   - Implement GameEngine with complete poker logic
   - Configure for Node.js 22
   - Set up CI/CD pipeline (all tests passing!)
   - Create GitHub issues for tracking
   - Remove all Slack-specific code - pure poker library
   - Write comprehensive Deck tests (29 tests covering all edge cases)
   - Fix GameEngine betting round logic and tests
   - Remove coverage requirements from CI
   - Clean up POKER-RULES.md for simulation use
   - Replace custom HandEvaluator with pokersolver library
   - Standardize card format to use pokersolver notation (T for 10)
   - Write comprehensive tests for all core components (180 tests total)
   - Create integration tests for multi-player betting scenarios
   - Fix race conditions and test isolation issues
   - Resolve all ESLint errors for CI compliance
   - Enhanced Player API with lastAction tracking (GitHub Issue #6)
   - **MAJOR REFACTOR**: Extract 2157-line monolithic test into 13 granular files
   - **BUG FIX**: Resolve object reference equality issues in pot distribution
   - Create comprehensive poker scenario test suite (2-5 players)

2. **In Progress** 🚧:
   - Create example player implementations
   - Add tournament management support

3. **Next Phase**:
   - Complete betting scenario tests for 6-8 players (GitHub Issue #5)
   - Fix flaky tests (squeeze play, multi-way pot) with deterministic dealer button
   - Add tournament management
   - Create example player implementations
   - Add performance benchmarks
   - Implement additional poker variants

4. **Future Enhancements**:
   - Tournament support
   - More poker variants
   - Advanced AI strategies
   - Performance optimizations

## Key Technical Decisions

### Why Keep RxJS (for now)?
The existing game flow in texas-holdem.js uses RxJS elegantly for:
- Async game state management
- Timer-based actions (timeouts)
- Event composition

We'll modernize to RxJS 7 but preserve the patterns.

### Why Simple Player Interface?
- Clean separation of concerns
- Any implementation can connect
- Testable in isolation
- No platform dependencies

### Why Event-Driven?
- Natural fit for game state changes
- Easy integration for consumers
- Supports real-time updates
- Familiar Node.js pattern

## Performance Considerations

### Memory Management
- Use object pools for cards/decks
- Clear references after games
- Efficient player state storage

### CPU Optimization  
- Lazy evaluation for hand strength
- Cached poker hand rankings
- Minimal object creation in hot paths

### Benchmarks to Track
```javascript
// Target performance metrics
const benchmarks = {
  'action-processing': '< 10ms',
  'hand-evaluation': '< 1ms',
  'game-creation': '< 50ms',
  'memory-per-table': '< 1MB'
};
```

## MCP Tool Usage

### Sequential Thinking
Use for:
- Architecture decisions
- Complex refactoring planning  
- API design considerations

### GitHub Operations
Use for:
- Creating pull requests
- Managing issues
- Code searches across repos

### Memory Management
The project uses sequential-thinking MCP for tracking architectural decisions and planning complex refactoring tasks.

## Common Pitfalls & Solutions

### 1. Flaky Test Failures
**Problem**: Tests fail randomly due to dealer button position
**Solution**: Always use `dealerButton: 0` in test tables:
```javascript
const table = manager.createTable({
  blinds: { small: 10, big: 20 },
  dealerButton: 0,  // CRITICAL for deterministic tests
});
```

### 2. Event Name Confusion
**Problem**: `hand:complete` vs `hand:ended` events
**Solution**: Use `hand:ended` - Table maps `hand:complete` to `hand:ended` for backward compatibility

### 3. Position Order in Tests
**Problem**: Player positions don't match expectations
**Solution**: With `dealerButton: 0`, positions are:
- 2 players: Player 0 = SB/Button, Player 1 = BB
- 3 players: Player 0 = Button, Player 1 = SB, Player 2 = BB
- 4+ players: Player 0 = Button, then SB, BB, UTG, MP, CO...

### 4. Race Conditions in Tests
**Problem**: Tests interfere with each other when run together
**Solution**: 
- Use event capture control flags
- Clean up tables in afterEach
- Don't share player instances between tests

### 5. ESLint Errors Breaking CI
**Problem**: CI fails on minor linting issues
**Solution**: Always run before committing:
```bash
npm run lint
npm run format
npm test
```

### 6. Card Format Issues
**Problem**: Using '10' instead of 'T' for tens
**Solution**: Use pokersolver notation - 'T' for 10:
```javascript
// Correct
const cards = ['As', 'Th', '2c'];  // Ace spades, Ten hearts, Two clubs
// Wrong
const cards = ['As', '10h', '2c'];
```

## Session Continuity

When resuming work:
1. Check README.md for latest status
2. Review GitHub issues for current tasks
3. Check any uncommitted changes with `git status`
4. Run tests to verify state
5. Continue from TODO list

Key files to check:
- `/packages/core/src/` - Main library implementation
- `/packages/core/src/game/` - Game logic components
- `/packages/ai/src/` - AI player implementations
- `/REFACTORING_PLAN.md` - Transformation roadmap
- `/POKER-RULES.md` - Simulation-focused poker rules
- GitHub Issues [#1-#6](https://github.com/jkraybill/poker-game-manager/issues)

## Known Bugs

### 🐛 PARTIALLY RESOLVED: Pot Distribution Bug (Issue #11)
**Problem**: Winner receives 0 chips despite pot having chips in complex side pot scenarios
**Status**: Major progress made - object reference equality bugs fixed ✅
**Remaining Issue**: Player state synchronization between pot tracking and hand evaluation

**Fixed Components**:
- ✅ Object reference equality in `PotManager.calculatePayouts()`
- ✅ Winner amount lookup in `GameEngine` showdown logic
- ✅ Cross-compatibility with unit test and integration test player structures
- ✅ All simple scenarios (button steal, regular pots) now work correctly

**Remaining Symptoms**: 
- Complex side pot scenarios still show `amount: 0`
- Different player instances tracked as eligible vs. winners
- Root cause: Player state tracking between pot creation and hand evaluation

**Detection**: Extracted tests automatically detect and log this bug with detailed debugging info
**Workaround**: Affected tests pass but log warning messages
**Next Steps**: Investigate player state synchronization in complex multi-way scenarios

## Troubleshooting Guide

### Test Timeout Issues
```bash
# If tests hang, check:
1. Players returning valid actions with timestamp
2. minPlayers set correctly on table
3. No infinite loops in player logic
```

### Module Import Errors
```bash
# Ensure using .js extensions in imports:
import { Player } from './Player.js';  # Correct
import { Player } from './Player';     # Wrong
```

### CI Pipeline Failures
```bash
# Before pushing, always run:
npm run lint && npm run format && npm test
```

## Recent Implementation Details

### File Locations
- **Core API**: `/packages/core/src/`
  - `index.js` - Main exports
  - `PokerGameManager.js` - Multi-table manager
  - `Table.js` - Individual table management
  - `Player.js` - Base player class
  - `adapters/PlayerAdapter.js` - Adapter base class
  - `types/index.js` - All type definitions

### GitHub Integration
- Issues are being used to track all major work items
- Progress updates posted as comments
- Using MCP GitHub tools for issue management

### Player API Enhancement (Session 2025-07-19)
The GameEngine now tracks `lastAction` for each player, exposing it through `gameState.players[id].lastAction`:
```javascript
// In GameEngine.handlePlayerAction()
playerData.lastAction = action.action;  // Stores Action enum value

// In GameEngine.buildGameState()
players[playerData.player.id] = {
  id: playerData.player.id,
  chips: playerData.chips,
  bet: playerData.bet,
  state: playerData.state,
  hasActed: playerData.hasActed,
  lastAction: playerData.lastAction,  // Now available to players
};
```

This enables advanced player strategies like squeeze plays:
```javascript
getAction(gameState) {
  const raisers = Object.values(gameState.players)
    .filter(p => p.lastAction === Action.RAISE);
  
  if (raisers.length === 1 && callers.length >= 1) {
    // Squeeze play opportunity!
    return { action: Action.RAISE, amount: gameState.currentBet * 3 };
  }
}