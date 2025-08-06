# Changelog

All notable changes to the Poker Game Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.7] - 2025-08-06

### Fixed
- **Critical chip conservation bug** - Fixed issue where blinds were deducted but never refunded when `tryStartGame()` failed
- **Return value for tryStartGame()** - Method now properly returns `true` on success and `false` on failure

### Changed
- **Blind refund mechanism** - Added chip snapshot and restoration when game fails to start
- **API improvement** - `tryStartGame()` now returns boolean to indicate success/failure

### Technical Details
- When `GameEngine.start()` throws an error, all player chips are restored to pre-blind values
- Ensures perfect chip conservation in all scenarios
- Fixes issue reported by pokersim team where chips were lost in multi-table setups

## [2.1.6] - 2025-08-06

### Breaking Changes 🚨
- **Strict Action enum enforcement** - String actions like 'FOLD' or 'allIn' now throw fatal errors
- **No auto-folding on invalid actions** - Any invalid action crashes immediately (proper for simulation framework)
- **Undefined/null actions are fatal** - Players must always return valid action objects

### Fixed
- **Infinite loop bug** - Fixed issue where invalid string actions caused infinite re-prompting loops
- **Action validation** - All actions now strictly validated against Action enum values
- **Test infrastructure** - Fixed ConditionalPlayer API usage in multiple test files

### Changed
- **Error handling philosophy** - Changed from production-style (auto-fold) to simulation-style (crash on error)
- **Validation timing** - Actions validated immediately, not after processing
- **Test mocks** - Updated all mock players to return valid Action enum values

### Technical Details
- Players MUST import and use the Action enum: `import { Action } from '@jkraybill/poker-game-manager'`
- Valid actions: `Action.FOLD`, `Action.CHECK`, `Action.CALL`, `Action.BET`, `Action.RAISE`, `Action.ALL_IN`
- String actions like `'FOLD'` or `'allIn'` will throw: `Invalid action type: "allIn". Must use Action enum values`

## [2.1.5] - 2025-08-06

### Fixed
- **Chip conservation bug** - Resolved issue where pot distribution could violate chip conservation
- **Winner payout calculation** - Fixed edge case in multi-way pot winner determination

### Added
- **Additional pot distribution tests** - Enhanced test coverage for complex pot scenarios

## [2.1.4] - 2025-08-06

### Added
- **Integration test for all-in scenarios** - Added comprehensive test for scenarios where all active players are all-in
- **Automatic betting round termination** - Game now correctly ends betting rounds when no further action is possible

### Fixed
- **All-in betting logic** - Fixed issue where betting rounds continued unnecessarily when all active players were all-in
- **Game flow optimization** - Eliminated redundant betting rounds in all-in scenarios, proceeding directly to showdown

### Testing
- Added `all-in-no-further-betting.test.js` integration test
- Validates proper pot distribution when no further betting action is possible
- Ensures game proceeds efficiently through all-in scenarios

## [2.1.1] - 2025-08-03

### Fixed
- **Fixed flaky test in standings-display-v2** - Updated to use proper v2.0 API (buyIn before addPlayer)
- **Removed deprecated table config options** - Cleaned up minBuyIn/maxBuyIn references in tests

## [2.1.0] - 2025-08-03

### Added
- **LRU cache for hand evaluations** - 32x performance improvement (0.032ms → 0.001ms)
- **Object pooling** - Reduced GC pressure for game states
- **Performance monitoring utilities** - Track operation times in development
- **Comprehensive benchmark suite** - Measure performance across all operations

### Fixed
- **Flaky test in standings-display** - Fixed improper player initialization
- **ESLint compliance** - All code now passes strict linting rules

### Changed
- Optimized game state building with pooled objects
- Added performance tracking to critical paths

### Performance
- Hand evaluation: 32x faster with caching
- Memory usage: Efficient object pooling reduces GC overhead
- All optimizations maintain 100% backward compatibility

## [2.0.0] - 2025-08-03

### Breaking Changes 🚨
- **Removed table-level buy-in enforcement** - Tables no longer have `minBuyIn` or `maxBuyIn` properties
- **Players must have chips before joining tables** - Tables no longer automatically call `player.buyIn()` when adding players
- **Updated TableConfig typedef** - Removed `minBuyIn` and `maxBuyIn` properties

### Added
- **Performance optimizations** - 32x faster hand evaluation with LRU caching
- **Object pooling** - Reduced GC pressure for high-frequency objects
- **Performance monitoring** - Built-in utilities to track operation times
- **Comprehensive benchmarks** - Full benchmark suite for measuring performance

### Changed
- Tables now accept players with any chip amount, making them suitable for tournament play
- Buy-in policies are now the responsibility of tournament/room implementations, not individual tables
- Test utilities updated to handle player chip initialization

### Fixed
- Fixed 3 integration tests that had incorrect expectations about winner payouts
- Updated test infrastructure to work with new player initialization requirements

### Performance Improvements
- Hand evaluation: 0.032ms → 0.001ms (32x faster)
- Table creation: <0.01ms average
- Game start (6 players): ~0.1ms
- Memory usage: Efficient GC with object pooling

### Migration Guide
```javascript
// OLD (v1.x) - Table automatically bought in players
const player = new Player({ name: 'Alice' });
table.addPlayer(player); // Player got minBuyIn chips automatically

// NEW (v2.x) - Must set chips before adding
const player = new Player({ name: 'Alice' });
player.buyIn(50000); // Tournament starting stack
table.addPlayer(player); // Player joins with their chips
```

### Why This Change?
In tournament poker, starting stacks vary widely (10,000 to 100,000+ chips). Tables must accept whatever chips players bring from the tournament. Buy-in limits only make sense for cash games, not tournaments. This change properly separates concerns between table mechanics and tournament/room policies.

## [1.0.0] - 2025-07-31

### Added
- Initial release of the Poker Game Manager
- Complete Texas Hold'em implementation with tournament-standard rules
- Dead button rule implementation (WSOP compliant)
- Complex side pot calculations
- Event-driven architecture
- 239 comprehensive tests
- Published to GitHub Packages as @jkraybill/poker-game-manager

### Features
- Multi-table support via PokerGameManager
- Clean Player interface for easy AI/bot implementation
- Full game state tracking and event emissions
- Performance optimized (sub-millisecond hand evaluation)
- ESM and CommonJS dual package support

[2.1.4]: https://github.com/jkraybill/poker-game-manager/compare/v2.1.1...v2.1.4
[2.1.1]: https://github.com/jkraybill/poker-game-manager/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/jkraybill/poker-game-manager/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/jkraybill/poker-game-manager/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/jkraybill/poker-game-manager/releases/tag/v1.0.0