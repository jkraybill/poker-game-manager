# SESSION CONTEXT - Poker Game Manager

## Current Status (2025-07-31)
- **✅ ALL TESTS PASSING**: 231 tests passing, CI green
- **✅ Fixed all test failures**: Resolved hanging tests and chip initialization issues
- **✅ ESLint compliant**: All code follows project style rules

## Recent Changes
- Fixed hanging test in dead-button-v2-fixed.test.js
- Fixed chip initialization architecture (set on Player objects, not playerData)
- Reduced test timeouts from 5-6s to 2s to prevent CI hangs
- Fixed event ordering test to use array index instead of timestamps

## Next Priorities
1. Issue #9 - Complete test utility migration
2. Issue #32 - All-in betting reopening rules 
3. Issue #33 - Event ordering improvements
4. Issue #34 - Eliminated player display fix

## Key Commands
```bash
npm test          # Run all 231 tests
npm run lint      # Check code style
npm run format    # Auto-format code
```