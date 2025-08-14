# Blinds Mutability Analysis

## Current State: Blinds ARE Mutable Between Hands

**The client team is INCORRECT**. Blinds CAN be changed between hands without recreating tables.

## How It Works

1. **Blinds are stored in `table.config.blinds`** - a regular JavaScript object property
2. **Blinds are ONLY used when creating a new GameEngine** for each hand (line 296)
3. **GameEngine is recreated for EVERY hand** - not reused

## Code Evidence

```javascript
// Table.js line 293-305
this.gameEngine = new GameEngine({
  variant: this.config.variant,
  players: activePlayersList,
  blinds: this.config.blinds,  // <-- Reads current blinds value
  timeout: this.config.timeout,
  // ... other config
});
```

The GameEngine is created fresh in `tryStartGame()` for each hand, reading the current `this.config.blinds` value.

## Simple Solution for Tournament Blind Increases

```javascript
// Between hands, when table.state === TableState.WAITING:
table.config.blinds = {
  small: newSmallBlind,
  big: newBigBlind
};

// Next hand will use the new blinds automatically
await table.tryStartGame();
```

## Why This Works

1. **No persistent GameEngine** - Each hand gets a new engine
2. **Table state must be WAITING** - Can't change mid-hand
3. **Blinds are read at hand start** - Not cached or stored elsewhere

## Validation Test

```javascript
// Start with 10/20 blinds
const table = new Table({ blinds: { small: 10, big: 20 } });

// Play first hand
await table.tryStartGame();
// ... hand completes, state becomes WAITING

// Change blinds for next level
table.config.blinds = { small: 25, big: 50 };

// Start next hand with new blinds
await table.tryStartGame();
// GameEngine created with 25/50 blinds
```

## What NOT to Do

❌ **DON'T** change blinds while `state === IN_PROGRESS`
❌ **DON'T** try to modify an existing GameEngine's blinds
❌ **DON'T** recreate the entire Table

## What TO Do

✅ **DO** change `table.config.blinds` between hands
✅ **DO** ensure table state is WAITING before changing
✅ **DO** validate new blind amounts are integers

## Implementation for SimpleTournament

```javascript
class SimpleTournament {
  increaseBlinds() {
    for (const table of this.tables.values()) {
      // Only update tables that are between hands
      if (table.state === TableState.WAITING) {
        table.config.blinds = {
          small: this.currentLevel.smallBlind,
          big: this.currentLevel.bigBlind
        };
      }
      // Tables in progress will get new blinds after current hand
    }
  }
  
  // Listen for hand end to update mid-game tables
  setupTable(table) {
    table.on('hand:ended', () => {
      // Update blinds if level changed during the hand
      if (this.shouldUpdateBlinds(table)) {
        table.config.blinds = {
          small: this.currentLevel.smallBlind,
          big: this.currentLevel.bigBlind
        };
      }
    });
  }
}
```

## Summary

The PGM tables have **MUTABLE** blinds. No major refactoring needed. Simply update `table.config.blinds` between hands.