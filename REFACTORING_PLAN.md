# Poker Game Manager - Refactoring Plan

## Overview
This document outlines the transformation of the Slack Poker Bot into a general-purpose poker game manager library that can be used in any poker project with support for human and computer players.

## Current Status (2025-07-19)
✅ **COMPLETED**: The core transformation is complete! We have:
- Removed all Slack dependencies - now a pure poker library
- Modernized to Node.js 22+ with ESM modules
- Implemented core API (PokerGameManager, Table, Player, GameEngine)
- Set up modern testing with Vitest (159 tests passing)
- Comprehensive test coverage for all core components:
  - GameEngine (12 tests) - game flow and betting logic
  - Deck (29 tests) - including Fisher-Yates verification
  - HandEvaluator (21 tests) - using pokersolver library
  - PotManager (32 tests) - side pot calculations
  - Table (28 tests) - player and game management
  - PokerGameManager (32 tests) - multi-table management
  - Integration tests (6 tests) - multi-player betting scenarios
- Replaced custom hand evaluation with pokersolver library
- Standardized card format to use pokersolver notation (T for 10)
- CI/CD pipeline working with all tests passing
- Cleaned up documentation for simulation use
- Fixed race conditions and test isolation issues
- All ESLint errors resolved for CI compliance

🚧 **IN PROGRESS**: 
- Creating example AI player implementations
- Tournament management support

📋 **TODO**:
- Additional poker variants (Omaha, Stud, etc.)
- Performance benchmarks
- Publish as npm package

## Goals
1. **Pure Poker Library** - Remove all Slack-specific code entirely
2. **Modernize** - Update to Node.js 22+ and modern JavaScript patterns
3. **Library Design** - Create a reusable npm package with clean APIs
4. **Multi-table Support** - Allow multiple simultaneous games
5. **Tournament Support** - Add tournament management capabilities
6. **Extensibility** - Support different poker variants
7. **Testing** - Comprehensive test coverage with modern testing tools

## Architecture Design

### Core Components

#### 1. Game Manager (Main Library Interface)
```javascript
class PokerGameManager {
  createTable(config) // Returns Table instance
  getTables() // Returns all active tables
  getTable(tableId) // Returns specific table
}
```

#### 2. Table
```javascript
class Table {
  constructor(config) // Game variant, blind structure, etc.
  addPlayer(player) // Add human or AI player
  removePlayer(playerId)
  startGame()
  on(event, handler) // Event-driven architecture
}
```

#### 3. Player Interface
```javascript
interface Player {
  id: string
  name: string
  requestAction(validActions, timeout): Promise<Action>
  receivePrivateCards(cards): void
  receivePublicCards(cards): void
  receiveGameUpdate(update): void
}
```

#### 4. Tournament Manager
```javascript
class TournamentManager {
  createTournament(config) // Returns Tournament instance
  getTournaments() // Returns all active tournaments
  manageBlinds() // Handle blind level increases
  manageTableBalancing() // Balance players across tables
}
```

### Events Architecture
The library will emit events for all game state changes:
- `game:started`
- `round:started` (preflop, flop, turn, river)
- `player:action` (check, bet, raise, fold, all-in)
- `cards:dealt`
- `pot:updated`
- `game:ended`
- `player:joined`
- `player:left`

## Implementation Phases

### Phase 1: Core Library Development
1. **Remove Platform Dependencies**
   - Delete all Slack-specific code
   - Remove image generation/upload features
   - Remove message parsing utilities
   - Focus purely on game mechanics

2. **Core Game Logic**
   - Implement clean `GameEngine` class
   - Event-driven architecture for all state changes
   - Support for async player actions

3. **Modernize Codebase**
   - Convert to ES modules
   - Use async/await instead of callbacks
   - Add comprehensive type definitions

### Phase 2: Multi-table Support
1. **Table Management**
   - PokerGameManager handles multiple tables
   - Implement table creation/destruction
   - Add table ID to all events and state

2. **Player Session Management**
   - Allow players to join multiple tables
   - Track player state per table

### Phase 3: Tournament Support
1. **Tournament Manager**
   - Multi-table tournament support
   - Blind level management
   - Table balancing algorithms
   - Payout calculations

### Phase 4: Enhanced Features
1. **AI Framework**
   - Enhance existing AI bot framework
   - Add more sophisticated AI strategies
   - Allow custom AI implementations

2. **Game Variants**
   - Abstract Texas Hold'em rules
   - Add support for Omaha, Stud, etc.

3. **Tournament Support**
   - Multi-table tournaments
   - Sit-and-go support
   - Blind level management

## Technical Modernization

### Dependencies Update
- Node.js: 0.12.7 → 20.x
- RxJS: 2.5.2 → 7.x (or consider removing)
- Replace `lwip` with `sharp` or `canvas`
- Update test framework to Jest or Vitest
- Add ESLint and Prettier

### Build System
- Replace Gulp with npm scripts
- Add bundling with Rollup or esbuild
- Configure for both CommonJS and ESM output

### Project Structure
```
poker-game-manager/
├── packages/
│   ├── core/          # Core game logic
│   ├── adapters/      # Platform adapters
│   │   ├── slack/
│   │   ├── cli/
│   │   └── websocket/
│   ├── ai/            # AI player implementations
│   └── utils/         # Shared utilities
├── examples/          # Example implementations
├── docs/              # API documentation
└── tests/             # Integration tests
```

## Migration Strategy

1. **Create new repository structure** without breaking existing code
2. **Incrementally refactor** modules starting with least coupled
3. **Maintain backward compatibility** during transition
4. **Run existing tests** throughout refactoring
5. **Add new tests** for refactored components
6. **Create migration guide** for existing users

## API Examples

### Creating a Game
```javascript
import { PokerGameManager, TexasHoldem } from '@poker-manager/core';
import { WebSocketAdapter } from '@poker-manager/adapters';

const manager = new PokerGameManager();
const table = manager.createTable({
  variant: TexasHoldem,
  blinds: { small: 10, big: 20 },
  maxPlayers: 9
});

// Add players
table.addPlayer(new WebSocketAdapter(socket, playerInfo));
table.addPlayer(new AIPlayer('aggressive'));

// Start game
table.startGame();

// Listen to events
table.on('game:ended', (result) => {
  console.log('Winner:', result.winner);
});
```

### Implementing a Custom Adapter
```javascript
class CustomAdapter extends PlayerAdapter {
  async getAction(gameState) {
    // Get player input from your platform
    const action = await this.promptUser(gameState);
    return action;
  }
  
  async receivePrivateCards(cards) {
    // Send hole cards to player
    await this.sendPrivateMessage(`Your cards: ${cards}`);
  }
}
```

## Timeline Estimate
- Phase 1 (Core Refactoring): 2-3 weeks
- Phase 2 (Multi-table): 1 week
- Phase 3 (Adapters): 2 weeks
- Phase 4 (Enhanced Features): 2-3 weeks
- Documentation & Testing: Ongoing

## Success Criteria
- All existing tests pass after refactoring
- Clean separation between game logic and platform code
- Multiple example implementations working
- Comprehensive API documentation
- Published as npm package
- Performance benchmarks show no regression