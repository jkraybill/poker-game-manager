# Session Context - Quick Start

## Current Sprint Focus
- **Active Issues**: [6 open issues](https://github.com/jkraybill/poker-game-manager/issues)
  - #5: Complete betting scenarios for 6-8 players (in progress)
  - #7-10: Productivity improvements (SESSION_CONTEXT.md, TESTING_GUIDE.md, test utilities, flaky tests)
- **Test Status**: 168 passing, 1 skipped (CI green ✅)
- **Next Tasks**: 
  1. Create TESTING_GUIDE.md
  2. Extract test utilities
  3. Continue 6-8 player betting scenarios

## Quick Commands
```bash
# Testing
npm test                    # All tests (168 passing)
npm test -- betting-scenarios  # Integration tests only
npm test -- GameEngine      # Specific test file
npm test -- -t "specific test name"  # Single test

# Development
npm run lint               # Check ESLint
npm run format            # Format with Prettier
npm run build             # Build library

# Git
git status                # Check changes
git add -A && git commit -m "message"
git push origin master

# JK shortcuts
go!   # Continue with best judgment
go?   # Ask questions then continue
??    # Ask clarifying questions
flush # Commit/push changes
```

## Recent Changes (2025-07-19)
- ✅ Implemented lastAction tracking in GameEngine (Issue #6)
- ✅ Fixed flaky tests with deterministic dealer button (Issue #10)
- ✅ Added betting scenarios for 4-5 players (10 new tests)
- ✅ Enhanced Player API to expose lastAction for strategies
- ⚠️ Found pot distribution bug (winner gets 0 chips in some cases)

## Known Issues
1. **Pot Distribution Bug**: Multi-way pot test shows winner receiving 0 chips despite pot having chips
2. **Position Randomness**: Fixed with dealerButton: 0 in all tests
3. **Skipped Test**: Multi-way pot with various stack sizes (due to bug #1)

## Code Locations
- **Integration Tests**: `/packages/core/src/integration/`
  - `betting-scenarios.test.js` - Main test file (2000+ lines)
  - `3player-*.test.js` - Standalone 3-player tests
- **Game Engine**: `/packages/core/src/game/`
  - `GameEngine.js` - Core game logic (now with lastAction tracking)
  - `PotManager.js` - Pot calculations (has distribution bug)
- **Test Utilities**: Currently inline, need extraction (Issue #9)

## Current Architecture
- **Pure JavaScript** (no TypeScript)
- **Node.js 22+** with ESM modules
- **Event-driven** with EventEmitter3
- **pokersolver** for hand evaluation
- **Deterministic tests** via dealerButton config

## Testing Patterns
```javascript
// Create table with deterministic dealer button
const table = manager.createTable({
  blinds: { small: 10, big: 20 },
  dealerButton: 0,  // Always position 0 for tests
});

// Position-aware player template
class PositionPlayer extends Player {
  getAction(gameState) {
    const myState = gameState.players[this.id];
    if (myState.lastAction === Action.RAISE) {
      // Can now see specific actions taken
    }
  }
}
```

## Active Work Items
1. **Betting Scenarios** (Issue #5)
   - ✅ 2-player: SB folds
   - ✅ 3-player: Various scenarios
   - ✅ 4-player: 5 scenarios complete
   - ✅ 5-player: 5 scenarios (1 skipped)
   - 🚧 6-8 players: Not started

2. **Productivity Improvements**
   - ✅ Issue #10: Deterministic dealer button
   - 🚧 Issue #7: SESSION_CONTEXT.md (this file!)
   - 📋 Issue #8: TESTING_GUIDE.md
   - 📋 Issue #9: Extract test utilities

## Session Notes
- Always run `npm test` after changes
- Use TodoWrite tool to track progress
- Update this file at session end
- Check GitHub issues for context