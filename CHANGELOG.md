# Changelog

All notable changes to the Poker Game Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[2.1.1]: https://github.com/jkraybill/poker-game-manager/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/jkraybill/poker-game-manager/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/jkraybill/poker-game-manager/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/jkraybill/poker-game-manager/releases/tag/v1.0.0