# 🐛 Current Bugs & Issues (2025-07-20)

## 🔥 CRITICAL: Minimum Raise Validation Failing (NEW!)

**Issue**: Minimum raise validation logic failing in GameEngine
**Discovery**: 4 tests in minimum-raise-validation.test.js failing
**Severity**: CRITICAL - Breaks fundamental poker betting rules

### Failing Tests
1. **should enforce minimum raise of 2x big blind for first raise**
   - Expected: First raise ≥ $40 (2x $20 BB)
   - Actual: Getting $30 raise
   
2. **should enforce minimum re-raise equal to previous raise size**
   - Expected: 2 raises in sequence
   - Actual: Getting 4 raises (logic error)
   
3. **should not reopen betting when all-in is less than minimum raise**
   - Expected: Short all-in defined
   - Actual: shortAllIn is undefined
   
4. **should track minimum raise amounts through multiple raises**
   - Expected: 4 raises in sequence
   - Actual: Only getting 2 raises

### Debug Output
```
AssertionError: expected 30 to be greater than or equal to 40
AssertionError: expected [ …(4) ] to have a length of 2 but got 4
AssertionError: expected undefined to be defined
AssertionError: expected [ Array(2) ] to have a length of 4 but got 2
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

**Total Tests**: 209
- ✅ Passing: 205
- ❌ Failing: 4

### Failing Tests
1. **minimum-raise-validation.test.js**:
   - "should enforce minimum raise of 2x big blind for first raise" ❌
   - "should enforce minimum re-raise equal to previous raise size" ❌
   - "should not reopen betting when all-in is less than minimum raise" ❌
   - "should track minimum raise amounts through multiple raises" ❌

### Common Failure Pattern
All failing tests involve:
- Minimum raise validation logic
- Betting rule enforcement
- Raise amount calculations
- Action sequence tracking

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