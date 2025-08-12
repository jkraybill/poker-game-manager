# Changelog

All notable changes to the Poker Game Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.4.0] - 2025-08-12

### Added ✨
- **Comprehensive Position Information API** - Enhanced `hand:started` event with detailed position data
  - Primary positions: `button`, `smallBlind`, `bigBlind`, `utg` (player IDs)
  - Position mapping: All players mapped to descriptive names (`"button"`, `"small-blind"`, `"big-blind"`, `"under-the-gun"`, `"middle-position"`, `"cutoff"`, `"late-position"`)
  - Player order array and dead button status information
  - Full backward compatibility with existing `dealerButton` field
- **Position API Documentation** - Complete usage examples in `POSITION_API_EXAMPLE.md`
- **Comprehensive Test Suite** - 5 new tests covering 2-6 player position scenarios

### Enhanced 🚀
- **Strategic Player Development** - Position-aware strategies now much easier to implement
- **Dead Button Support** - Full position tracking even with eliminated players
- **Developer Experience** - No more manual position calculation required

```javascript
// New position API usage
table.on('hand:started', ({ positions }) => {
  console.log(`Button: ${positions.button}`);
  console.log(`Big Blind: ${positions.bigBlind}`);
  console.log(`All positions:`, positions.positions);
});
```

## [4.3.0] - 2025-08-12

### Added ✨
- **Integer Validation for All Monetary Values** - Comprehensive validation prevents floating-point precision issues
  - All chip amounts enforced as integers with graceful rounding
  - All bet amounts validated and rounded to nearest integer
  - All pot amounts guaranteed to be integers
  - Blind amounts validated at table creation
- **Validation Utilities** - New `validateIntegerAmount` and `ensureInteger` functions
- **Comprehensive Test Suite** - Complete integer validation testing across all monetary operations

### Enhanced 🚀
- **Chip Precision** - Eliminates floating-point math errors in poker calculations
- **Backward Compatibility** - Existing code continues to work with automatic rounding
- **Developer Safety** - Clear error messages for invalid amounts

### Technical Details
- Validation applied at all entry points: player chips, betting actions, pot calculations
- Fractional amounts automatically rounded before validation (e.g., 100.5 → 101)
- All 296 tests passing with integer validation enabled

## [4.2.0] - 2025-08-12

### Enhanced 🚀
- **Enhanced GameState Validation Numbers** - Improved validation context for debugging
- **Code Quality Improvements** - ESLint compliance across all source files
- **Documentation Updates** - Improved inline documentation and examples

### Fixed 🔧
- **ESLint Compliance** - Resolved all linting warnings and errors
- **Code Consistency** - Standardized formatting and naming conventions

## [4.1.0] - 2025-08-12

### 🚨 BREAKING CHANGES
- **Enhanced `tryStartGame()` Result Object** - Returns detailed result instead of boolean

### Added ✨
- **Comprehensive Game Start Diagnostics** - Detailed failure information with structured results
- **Error Context** - Full debugging information including player states, chip counts, and error traces
- **Failure Categorization** - Specific error reasons: `TABLE_NOT_READY`, `INSUFFICIENT_PLAYERS`, `INSUFFICIENT_ACTIVE_PLAYERS`, `ENGINE_ERROR`

```javascript
// NEW (v4.1.0+)
const result = await table.tryStartGame();
if (!result.success) {
  console.error(`Failed: ${result.reason}`);
  console.error(`Details:`, result.details.message);
  // result.details contains complete diagnostic information
}
```

### Enhanced 🚀
- **Developer Experience** - Know exactly why games fail to start
- **Tournament Integration** - Better error handling for tournament systems
- **Debugging Support** - Rich diagnostic information for troubleshooting

### Migration Guide
- Change `if (await table.tryStartGame())` to `if ((await table.tryStartGame()).success)`
- Access failure details through `result.reason` and `result.details`

## [4.0.0] - 2025-08-11

### 🚨 BREAKING CHANGES
- **`tryStartGame()` is now async** - Returns `Promise<boolean>` instead of `boolean`
  - All callers MUST now await this method: `await table.tryStartGame()`
  - This change was necessary to fix race conditions with concurrent tables

### Fixed 🔧
- **Race Condition with Concurrent Tables** - Fixed infinite loop bug when multiple tables start simultaneously
  - `gameEngine.start()` is now properly awaited, preventing race conditions
  - Resolves issue where players were asked for same decision multiple times
  - Fixes problems reported with 32-player tournaments across 4 tables

### Migration Guide
```javascript
// OLD (v3.x)
const started = table.tryStartGame();
if (started) {
  console.log('Game started');
}

// NEW (v4.x) 
const started = await table.tryStartGame();
if (started) {
  console.log('Game started');
}
```

## [3.0.5] - 2025-08-11

### Enhanced 🚀
- **Fail-Fast on Contract Violations** - Player errors now immediately crash the game with no retry attempts
- **Fatal Error Messages** - Clear indication when players violate the contract (throw errors, return invalid actions, timeout)
- **No Retry Logic** - Any exception from player methods causes immediate game termination
- **Comprehensive Test Suite** - Added 5 tests verifying fail-fast behavior in all scenarios

### Technical Details
- Wrapped `player.getAction()` and `player.receivePrivateCards()` in try-catch blocks
- Errors throw fatal exceptions with descriptive messages indicating contract violations
- Ensures broken player implementations are caught immediately during development
- All 266 tests passing including new fail-fast tests

## [3.0.4] - 2025-08-08

### Enhanced 🎯
- **Detailed Error Messages** - Invalid betting actions now include comprehensive game state for debugging
- **Error Context Helper** - New `buildErrorContext()` method provides full table/player/betting information
- **Actionable Solutions** - Each error suggests the correct action to take with proper syntax
- **Complete Game State** - Errors include pot size, all player bets, raise history, and valid actions

## [3.0.3] - 2025-08-08

### Critical Fixes 🚨
- **CRITICAL CHIP CONSERVATION FIX** - Resolved bug causing up to 15% of chips to disappear in complex side pot scenarios
- **Uncalled Bet Refunds** - Properly returns uncalled chips when `potManager.addToPot()` cannot add all chips to any pot
- **100% Chip Conservation** - Perfect chip tracking guaranteed in all game scenarios including multi-way all-ins

### Technical Details
- Check return value from `potManager.addToPot()` in `handleCall()` and `handleBet()` methods
- Refund any chips that couldn't be added to pots back to the player
- Added comprehensive chip conservation test suite (test-chip-loss.js, test-customer-bug-repro.js)
- All 247+ tests passing with perfect chip conservation

## [3.0.2] - 2025-08-07

### Fixed 🔧
- **Race Condition in Event Timing** - `hand:ended` now fires AFTER elimination processing completes
- **Chip Conservation Guaranteed** - External tournament managers always see consistent chip state
- **Player Count Accuracy** - Eliminated players removed before `hand:ended` event fires

### Technical Details
- Delayed `hand:ended` event emission until after all Table-level processing
- Synchronized elimination events with proper ordering
- No API breaking changes - only timing adjustments for correctness

## [3.0.1] - 2025-08-07

### Fixed 🔧
- **Unhandled Promise Rejections** - Fixed async/await chain in GameEngine for proper error propagation
- **Test Suite Stability** - All 247 tests now pass consistently in CI environment

## [3.0.0] - 2025-08-07

### 🎉 MAJOR RELEASE: v3.0.0 - Documentation Excellence & Validation Mastery

### Breaking Changes 🚨
- **Action Enum Mandatory** - String actions like 'FOLD' now throw fatal errors, must use Action.FOLD
- **Strict Fold Validation** - Players CANNOT fold when they can check for free (`toCall = 0`) 
- **Simulation Framework Rules** - Invalid actions crash immediately (not production-style graceful handling)
- **Enhanced Validation** - All player actions validated against validActions array from GameEngine

### Added ✨
- **Comprehensive Documentation Overhaul** - All examples now v3.0.0 compliant
- **Action Enum Integration** - 50+ code examples updated across INTEGRATION.md
- **Modern API Examples** - All documentation uses v2.0+ player.buyIn() pattern
- **Validation Best Practices** - Strategic players check toCall before folding

### Fixed 🔧
- **Documentation Accuracy** - Updated test counts from outdated 267+ to correct 242 tests
- **Code Example Compliance** - All documentation examples work with strict validation
- **API Consistency** - Removed deprecated minBuyIn/maxBuyIn references
- **Strategic Player Logic** - Fixed fold-when-can-check issues in example players

### Technical Excellence 🏆
- **247 Tests Passing** - Modern test suite with comprehensive coverage
- **Zero Breaking Examples** - All documentation code examples verified working
- **Strict Validation** - Prevents unrealistic gameplay in simulation scenarios
- **Developer Experience** - Clear error messages for invalid actions

### Migration Guide 📖
```javascript
// OLD (v2.x) - Will crash in v3.0.0
return { action: 'FOLD' };

// NEW (v3.0.0) - Proper usage
import { Action } from '@jkraybill/poker-game-manager';
return { action: Action.FOLD }; // Only when toCall > 0
```

## [2.1.8] - 2025-08-07

### Breaking Changes 🚨
- **Fold validation enforced** - Players CANNOT fold when they can check for free (`toCall = 0`)
- **No auto-folding on timeouts** - Timeouts now throw fatal errors instead of auto-folding
- **Strict simulation rules** - This is a simulation framework, not a production poker room

### Fixed
- **Fixed duplicate validation method** - `calculateValidActions` now matches `calculateBettingDetails` logic
- **Fold validation** - Fold is now only valid when facing a bet (`toCall > 0`)
- **Test utilities** - Updated `alwaysFold` strategy to check `toCall` before folding

### Added
- **SIMULATION_RULES.md** - Comprehensive documentation of all action validation rules
- **Enhanced documentation** - Updated README.md and POKER-RULES.md with clear validation rules
- **Action validation examples** - Added specific scenarios where actions are valid/invalid

### Changed
- **Error messages** - More descriptive validation error messages
- **Test strategies** - All test strategies now properly validate actions before returning

### Technical Details
- Fold is INVALID when: Big blind with option, first to act postflop, any player when `toCall = 0`
- Fold is VALID when: Facing a bet/raise (`toCall > 0`)
- All validation errors throw immediately with descriptive messages
- Both `calculateValidActions()` and `calculateBettingDetails()` enforce identical rules

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