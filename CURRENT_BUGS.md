# 🐛 Current Bugs & Issues (2025-07-20)

## 🔥 CRITICAL: Pot Overpayment Bug (NEW!)

**Issue**: Winners receiving MORE chips than exist in the pot
**Discovery**: 8-player "family pot with minimal raising" test
**Severity**: CRITICAL - Breaks fundamental poker economics

### Symptoms
- Test expects pot of $320 (8 players × $40 each)
- Actual pot shows only $150
- Winner receives $320 (more than pot contains!)
- Players appear to be calling $20 before CO even raises

### Test Details
```javascript
// From 8player-scenarios.test.js
it('should handle 8-way family pot with minimal raising', async () => {
  // Expected: CO raises to $40, everyone calls
  // Actual: Players call $20 before CO acts, pot calculations wrong
});
```

### Debug Output
```
🎯 Debug - Player actions leading to failure:
Player 1 (UTG) [position 3]: checks (was: check)
Player 2 (UTG+1) [position 4]: calls $20 (was: call)
Player 3 (MP) [position 5]: calls $20 (was: call)
Player 4 (MP+1) [position 6]: calls $20 (was: call)
Player 5 (CO) [position 7]: raises to $40 (was: minRaise)
...
Final pot: $150
Winner gets: $320 ❌
```

## 🐛 Issue #11: Pot Distribution Bug (90% Fixed)

**Status**: Mostly resolved but edge cases remain
**Original Issue**: Winners receiving 0 chips
**Fixed**: Object reference equality issues

### What's Fixed ✅
- Object reference comparisons now use player IDs
- Simple pot distributions work correctly
- 2-5 player scenarios pass all tests
- Button steals and regular pots work

### What's Broken ❌
- Complex side pot scenarios in 6-8 player games
- Edge cases with multiple all-ins at different levels
- Player state synchronization issues

## 📊 Test Status Summary

**Total Tests**: 184
- ✅ Passing: 180
- ⏭️ Skipped: 2
- ❌ Failing: 4

### Failing Tests
1. **7player-scenarios.test.js**:
   - "should handle 7-way family pot with everyone calling" ❌
   - "should handle LAG wars with 3-betting and 4-betting" ❌

2. **8player-scenarios.test.js**:
   - "should handle 8-way family pot with minimal raising" ❌
   - "should handle bubble scenario with short stacks" ❌

### Common Failure Pattern
All failing tests involve:
- Large number of players (7-8)
- Complex betting patterns
- Side pot calculations
- Pot size mismatches

## 🔍 Root Cause Analysis

### Hypothesis 1: Betting Round State
- Players may be acting before their turn
- Current bet not properly tracked across many players
- Pre-flop action sequence corrupted

### Hypothesis 2: Pot Accumulation
- Pot not collecting all bets properly
- Side pot creation triggering too early
- Chips "leaking" during bet collection

### Hypothesis 3: Winner Payout Logic
- Winner payout calculated from expected pot, not actual
- Double-counting of contributions
- Side pot distribution adding phantom chips

## 🛠️ Next Steps

1. **Immediate**: Add detailed logging to PotManager
2. **Debug**: Trace chip flow in 8-player test
3. **Fix**: Ensure pot total matches contributions
4. **Validate**: Winner can never receive more than pot
5. **Test**: Add assertions for pot integrity

## 📝 Notes for Future Claude

This bug is more severe than Issue #11. While #11 caused winners to get 0 chips (bad but detectable), this bug creates chips from nothing (catastrophic for game integrity).

Focus areas:
- `PotManager.collectBets()`
- `GameEngine.handlePlayerAction()` 
- `PotManager.calculatePayouts()`
- Pre-flop betting round initialization

The 8-player test is the simplest reproduction case.