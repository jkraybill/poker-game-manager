# SESSION CONTEXT - Poker Game Manager

## Current Status (2025-07-31)
- **✅ ALL TESTS PASSING**: 231 tests passing, CI green
- **✅ ESLint compliant**: All code follows project style rules
- **🎯 Test Utilities Migration**: 7/11 test files migrated for Issue #9

## Recent Changes (2025-07-31)
- Migrated 5 additional test files to use test utilities:
  - elimination-ordering.test.js
  - elimination-display-fixed.test.js
  - event-ordering-elimination.test.js
  - issue-11-minimal-repro.test.js
- Previous session: betting-reopening-simple.test.js, eliminated-player-display.test.js
- Added validActions to StrategicPlayer strategy context
- All test migrations maintain 100% pass rate
- 4 test files remaining: memory-leak-repro.test.js, standings-display.test.js, GameEngine.test.js, dealer-button-rotation.test.js

## Next Priorities
1. Issue #9 - Continue test utility migration (more files to migrate)
2. Issue #32 - All-in betting reopening rules 
3. Issue #33 - Event ordering improvements
4. Issue #34 - Eliminated player display fix

## Key Commands
```bash
npm test          # Run all 231 tests
npm run lint      # Check code style
npm run format    # Auto-format code
```