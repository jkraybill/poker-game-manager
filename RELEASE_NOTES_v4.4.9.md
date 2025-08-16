# Release Notes - v4.4.9

## 🐛 Critical Bug Fix: Bet Clearing on Fold

### Fixed
- **CRITICAL**: Fixed bug where `player.bet` fields were not cleared when hands ended by folding
  - Previously, bets (especially blinds) remained stuck in `player.bet` field indefinitely
  - This affected ~70% of poker hands (those ending by fold rather than showdown)
  - Caused chip conservation violations and incorrect game state

### Impact
This bug affected:
- **Multi-table tournaments**: Chip tracking became increasingly inaccurate over time
- **Chip conservation**: Chips appeared duplicated (existing in both `player.chips` and `player.bet`)
- **Game state integrity**: Subsequent hands started with incorrect bet values
- **Statistics**: Any chip-based metrics were corrupted

### Technical Details
- **Root Cause**: The `GameEngine.endHand()` method did not clear player bets
- **Solution**: Added `player.bet = 0` for all players in `endHand()` method
- **Location**: `packages/core/src/game/GameEngine.js` line 1394
- **Tests Added**: Comprehensive test suite in `test/integration/bet-clearing-on-fold.test.js`

### Testing
Added 4 new tests covering:
1. Basic bet clearing when hand ends by fold
2. Chip conservation across multiple folded hands
3. Bet clearing when fold occurs at any betting round
4. Multi-way pots with folding players

### Migration Guide
No changes required for consumers. This is a bug fix that restores expected behavior.

### Verification
To verify the fix in your application:
```javascript
// After any hand ends (by fold or showdown)
for (const player of table.players) {
  console.assert(player.bet === 0, 'Player bet should be cleared');
}
```

### Credits
- Bug reported by our #1 customer with detailed reproduction case
- Fix implements customer's suggested solution
- Comprehensive TDD approach used for implementation

## Version
- Previous: 4.4.8
- Current: 4.4.9
- Type: Patch (bug fix)

## Compatibility
- Node.js: >=22.0.0
- No breaking changes
- Backward compatible