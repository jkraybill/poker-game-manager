# Claude Technical Guide - Poker Game Manager

## Session Preparation

**First read:**
1. This file (CLAUDE.md)
2. ABOUT-JK.md for communication style
3. REFACTORING_PLAN.md for transformation roadmap
4. src/texas-holdem.js to understand core game logic

## JK's Shorthand Commands

- **go!** - Continue using your best judgment; ask questions as needed to maximize the chances of work being what JK wants
- **go?** - Ask one or more clarifying questions, then go!
- **??** - Ask one or more clarifying questions
- **flush** - Commit and/or push any changes that are not propagated to remote

## Development Commands

### What Claude CAN Run
```bash
# Testing
npm test                    # Run all tests
npm run test:coverage      # Run tests with coverage

# Linting & Formatting
npm run lint              # ESLint check
npm run format            # Prettier format
npm run typecheck         # TypeScript type checking

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

### Current State (Legacy)
- **Node Version**: 0.12.7 (2015 era)
- **Framework**: Slack bot using slack-client
- **Game Logic**: RxJS-based state management
- **Testing**: Mocha + Chai + Sinon
- **Build**: Gulp + Babel 5

### Target State (Modern)
- **Node Version**: 20+ with ESM modules
- **Framework**: Platform-agnostic library
- **Game Logic**: Event-driven with adapters
- **Testing**: Vitest with coverage
- **Build**: esbuild for performance

### Key Patterns

1. **Adapter Pattern**
```javascript
// All platform integrations implement this interface
interface PlayerAdapter {
  getAction(gameState): Promise<Action>
  receivePrivateCards(cards): Promise<void>
  receiveMessage(message): Promise<void>
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

### Refactoring Process

1. **Before changing any file**:
   - Read it completely first
   - Check for existing tests
   - Understand dependencies

2. **When abstracting Slack code**:
   - Preserve game logic exactly
   - Create adapter interface
   - Move Slack-specific code to adapter

3. **When modernizing code**:
   - Convert callbacks to async/await
   - Use ES modules (import/export)
   - Maintain backward compatibility

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

1. **Immediate Tasks**:
   - Set up modern build tooling
   - Create adapter interfaces
   - Extract core game logic
   - Migrate to modern Node.js

2. **Next Phase**:
   - Implement multi-table support
   - Create example adapters
   - Enhance AI framework
   - Write comprehensive docs

3. **Future Enhancements**:
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

### Why Adapter Pattern?
- Clean separation of concerns
- Easy to add new platforms
- Testable in isolation
- Future-proof architecture

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
2. Review any uncommitted changes
3. Run tests to verify state
4. Continue from TODO list

Key files to check:
- `/src/texas-holdem.js` - Core game logic
- `/src/bot.js` - Current Slack integration
- `/REFACTORING_PLAN.md` - Transformation roadmap