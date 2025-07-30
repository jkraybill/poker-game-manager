# SESSION CONTEXT - Poker Game Manager

## Current Status (2025-07-30)
- **✅ ALL TESTS PASSING**: 211 of 211 tests passing (100% success!)
- **✅ ESLint compliant**: All code follows project style rules
- **🚧 Test migration**: 29 of 42 integration tests use utilities (Issue #9)
- **⚠️ Dead button rules**: Partial implementation, needs v2.0 architecture change

## Active Work
- **Issue #9**: Migrating integration tests to use test utilities
  - 29 completed, 13 remaining
  - Next targets: dead-button tests, event-ordering tests

## Next Priorities
1. Complete Issue #9 (test utility migration)
2. Issue #32 - All-in betting reopening rules
3. Issue #37 - Dead button rules (needs architecture change)

## Key Commands
```bash
npm test          # Run all 211 tests
npm run lint      # Check code style
npm run format    # Auto-format code
```

## Recent Changes
- Fixed 6204 ESLint semicolon errors
- Updated documentation with correct test counts
- Migrated 2 more tests to use utilities