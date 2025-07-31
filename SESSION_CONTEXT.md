# SESSION CONTEXT - Poker Game Manager

## Current Status (2025-07-31)
- **✅ ALL TESTS PASSING**: 231 tests passing, CI green
- **✅ ESLint compliant**: All code follows project style rules
- **🎯 Test Utilities Migration**: Progressing on Issue #9

## Recent Changes
- Migrated betting-reopening-simple.test.js to use test utilities
- Migrated eliminated-player-display.test.js to use test utilities
- Added validActions to StrategicPlayer strategy context
- All test migrations maintain 100% pass rate

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