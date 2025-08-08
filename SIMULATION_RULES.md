# Poker Simulation Framework Rules

This document defines the strict rules enforced by this poker simulation framework to ensure realistic gameplay and prevent invalid actions that would never occur in real poker games.

## Core Philosophy

This is a **simulation framework**, not a production poker room. As such:
- **All errors are fatal** - Invalid actions crash immediately
- **No forgiveness** - Developer errors are not silently handled
- **Strict validation** - Actions must be logically valid in poker context
- **No auto-recovery** - Timeouts and errors terminate the game

## Action Validation Rules

### CHECK
- **Valid when**: `toCall = 0` (nothing to call)
- **Invalid when**: Facing any bet or raise
- **Examples**:
  - ✅ Big blind with no raises facing them
  - ✅ First to act on flop/turn/river
  - ❌ Player facing a bet

### FOLD
- **Valid when**: `toCall > 0` (facing a bet/raise)
- **Invalid when**: `toCall = 0` (can check for free)
- **CRITICAL**: Players CANNOT fold when they can check for free
- **Examples**:
  - ✅ UTG facing big blind
  - ✅ Player facing a raise
  - ❌ Big blind with option (no raises)
  - ❌ First to act postflop
  - ❌ Any player when current bet equals their bet

### CALL
- **Valid when**: `toCall > 0` AND player has chips ≥ `toCall`
- **Invalid when**: Nothing to call or insufficient chips
- **Examples**:
  - ✅ Player facing a bet with sufficient chips
  - ❌ Player with option to check
  - ❌ Player with insufficient chips (must go all-in)

### BET
- **Valid when**: No current bet AND player has chips ≥ minimum bet
- **Invalid when**: Bet already exists (must raise instead)
- **Minimum**: Big blind amount
- **Examples**:
  - ✅ First to act postflop with chips
  - ❌ Player facing existing bet

### RAISE
- **Valid when**: Facing a bet AND has chips > `toCall`
- **Invalid when**: No bet to raise or insufficient chips
- **Minimum raise**: Previous bet/raise increment
- **Examples**:
  - ✅ Player facing bet with excess chips
  - ❌ First to act (no bet to raise)

### ALL_IN
- **Valid when**: Player has any chips > 0
- **Always valid**: If player has chips, they can go all-in
- **Examples**:
  - ✅ Any time with chips
  - ❌ Player with 0 chips

## Error Handling

### Timeouts
- **Behavior**: Throw fatal error
- **No auto-fold**: Timeouts are developer bugs in simulations
- **Error message**: `Player {id} action timeout after {timeout}ms`

### Invalid Actions
- **Behavior**: Throw fatal error immediately
- **No recovery**: Game terminates
- **Common errors**:
  - Using string actions instead of Action enum
  - Returning null/undefined
  - Attempting invalid actions (fold when can check)

### Validation Errors
All validation errors throw immediately with highly detailed messages including full game state:
- **FOLD errors**: Include toCall amount, current bet, player bet, and suggest CHECK
- **CHECK errors**: Show amount to call and suggest CALL/RAISE/FOLD alternatives
- **CALL errors**: Detail missing bet or insufficient chips with ALL_IN suggestion
- **BET errors**: Clarify existing bet amount and suggest RAISE with correct syntax
- **RAISE errors**: Show minimum raise requirements, chip constraints, and raise history

Example enhanced error message:
```
Cannot bet when facing a bet - use raise.
Reason: There's already a bet of 40 on the table
Solution: Use Action.RAISE to increase the bet to 100
Current bet details: player1: 40 chips, player2: 20 chips
Game State: {
  "gamePhase": "PRE_FLOP",
  "currentBet": 40,
  "pot": 60,
  "player": { /* full player state */ },
  "table": { /* full table state */ },
  "bettingHistory": { /* raise history */ },
  "playerBets": [ /* all player bets */ ]
}
```

## Implementation Details

### Action Enum Usage
```javascript
import { Action } from '@jkraybill/poker-game-manager';

// CORRECT
return { action: Action.FOLD };

// WRONG - will throw error
return { action: 'FOLD' };
return { action: 'fold' };
```

### Validation Functions
The framework provides two methods that enforce these rules:
1. `calculateValidActions(player)` - Returns array of valid Action enums
2. `calculateBettingDetails(player)` - Returns valid actions with betting amounts
3. `validateAction(player, action)` - Throws if action is invalid

Both methods enforce identical validation logic.

## Testing Strategies

When writing player strategies for tests:

```javascript
// CORRECT - Check toCall before folding
const strategy = ({ toCall }) => {
  if (toCall > 0) {
    return { action: Action.FOLD };
  }
  return { action: Action.CHECK };
};

// WRONG - Always folding is invalid
const badStrategy = () => {
  return { action: Action.FOLD }; // Will crash when toCall = 0
};
```

## Common Scenarios

### Big Blind with Option
- **Situation**: All players call to BB, action on BB
- **Valid actions**: CHECK, RAISE, ALL_IN
- **Invalid**: FOLD (toCall = 0)

### First to Act Postflop
- **Situation**: New betting round, no bets yet
- **Valid actions**: CHECK, BET, ALL_IN
- **Invalid**: FOLD (toCall = 0), CALL (nothing to call)

### Facing All-In
- **Situation**: Player faces bet larger than their stack
- **Valid actions**: FOLD, ALL_IN
- **Invalid**: CALL (insufficient chips), RAISE (insufficient chips)

## Version History

- **v2.1.7**: Enforced fold validation - cannot fold when toCall = 0
- **v2.1.6**: Strict Action enum enforcement
- **v2.1.5**: Removed auto-fold on timeouts