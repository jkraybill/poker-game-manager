# Session Context - Quick Start

## Current Sprint Focus
- **MAJOR MILESTONE ACHIEVED**: ✅ Extracted 2157-line monolithic test into 13 granular files
- **CRITICAL BUG PROGRESS**: ✅ Fixed object reference equality issues in pot distribution (Issue #11)
- **Test Status**: 180 passing, 1 skipped (CI green ✅)
- **Active Issues**: [Mostly resolved]
  - #11: 🔄 PARTIALLY FIXED - Object equality bugs resolved, complex scenarios need investigation
  - #9: Extract common test utilities (lower priority after successful extraction)
  - #5: Complete betting scenarios for 6-8 players (extended to 5 players ✅)
- **Next Tasks**: 
  1. Investigate player state synchronization in complex side pot scenarios
  2. Create example player implementations
  3. Add tournament management support

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
- ✅ Fixed flaky tests with deterministic dealer button (Issue #10)
- ✅ Created SESSION_CONTEXT.md for faster startup (Issue #7)
- ✅ Created TESTING_GUIDE.md for test development (Issue #8)
- ✅ Implemented lastAction tracking in GameEngine (Issue #6)
- ✅ Added betting scenarios for 4-5 players (10 new tests)
- 🐛 Discovered critical pot distribution bug (Issue #11)
- ✅ Enhanced documentation for future Claude productivity:
  - Added common pitfalls section to CLAUDE.md
  - Created TROUBLESHOOTING.md with 10 common issues
  - Updated README.md with better quick start
  - Documented pot distribution bug prominently
- ✅ **MAJOR REFACTOR**: Extracted granular test files for pinpoint failure ID:
  - Split 2157-line monolith into 6 focused test files
  - Each file tests one specific poker concept
  - Test failures now immediately pinpoint exact issue
  - All extracted files pass tests ✅

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
- See TROUBLESHOOTING.md for common issues