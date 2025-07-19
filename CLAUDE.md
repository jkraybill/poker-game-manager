# Claude Technical Guide - Poker Game Manager

## Session Preparation

**First read:**
1. This file (CLAUDE.md)
2. ABOUT-JK.md for communication style
3. REFACTORING_PLAN.md for transformation roadmap
4. src/texas-holdem.js to understand core game logic

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
- **Testing**: Vitest configured, 159 tests passing (all core components covered)
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
- **Tests**: Comprehensive test suite for all core components (159 tests)

### Key Patterns

1. **Player Interface**
```javascript
// Any player implementation must provide these methods
interface Player {
  requestAction(validActions, timeout): Promise<Action>
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

### Test Structure
```javascript
// tests/core/table.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { PokerTable } from '../../src/core/table.js';

describe('PokerTable', () => {
  let table;
  
  beforeEach(() => {
    table = new PokerTable({ 
      variant: 'texas-holdem',
      maxPlayers: 9 
    });
  });
  
  describe('player management', () => {
    it('should add players up to max limit', async () => {
      // Test implementation
    });
  });
});
```

### Testing Priorities
1. **Core game logic** - 100% coverage required
2. **Adapter interfaces** - Mock extensively  
3. **AI players** - Test decision making
4. **Performance** - Benchmark critical paths

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
   - Write comprehensive tests for all core components (159 tests total)
   - Create integration tests for multi-player betting scenarios
   - Fix race conditions and test isolation issues
   - Resolve all ESLint errors for CI compliance

2. **In Progress** 🚧:
   - Create example player implementations
   - Add tournament management support

3. **Next Phase**:
   - Complete betting scenario tests for 4-8 players
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
- GitHub Issues [#1-#4](https://github.com/jkraybill/poker-game-manager/issues)

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