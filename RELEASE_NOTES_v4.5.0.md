# Release Notes - v4.5.0

## 🎉 New Feature: Showdown Participants in hand:ended Event

### Added
- **NEW**: `showdownParticipants` array in `hand:ended` event data structure
  - Includes ALL players who reached showdown, not just winners
  - Each participant includes: `playerId`, `cards`, `hand`, `amount`
  - Enables complete hand history logging for poker applications
  - Follows standard poker convention where all showdown participants reveal cards

### Use Case
This feature enables comprehensive tournament logging and hand replay functionality:

```javascript
table.on('hand:ended', (data) => {
  if (data.showdownParticipants) {
    console.log(`SHOWDOWN (Pot: ${data.pot}):`);
    console.log(`Board: [${data.board.join(' ')}]`);
    
    for (const participant of data.showdownParticipants) {
      const result = participant.amount > 0 ? `wins ${participant.amount}` : 'loses';
      console.log(`- Player${participant.playerId} shows [${participant.cards.join(' ')}] for ${participant.hand.description} (${result})`);
    }
  }
});
```

### Technical Details

#### Event Structure
The `hand:ended` event now includes:
```javascript
{
  winners: [/* existing winners array */],
  showdownParticipants: [
    {
      playerId: 1,
      cards: ['As', 'Kh'],        // Hole cards
      hand: {                     // Hand evaluation
        rank: 6,
        description: "Pair, Aces",
        kickers: [14, 13, 12, 8, 3]
      },
      amount: 1200               // Amount won (0 for losers)
    },
    // ... more participants
  ],
  board: ['3d', '8s', '8d', 'Kc', '7d'],
  finalChips: {/* player chip counts */},
  showdownHands: {/* legacy format */}
}
```

#### Behavior
- **Showdown scenarios**: All active players included in `showdownParticipants`
- **Fold scenarios**: Only `showdownParticipants` is `null` or omitted
- **Split pots**: Multiple participants with `amount > 0`
- **Backward compatibility**: Existing `winners` array unchanged

### Test Coverage
Added comprehensive test suite covering:
1. Basic showdown with all participants included
2. Folded players excluded from showdown participants  
3. Split pot scenarios with multiple winners
4. All-in scenarios forcing showdown
5. Backward compatibility with existing winners array

### Migration Guide
No breaking changes. Existing code continues to work as before.

To use the new feature:
```javascript
table.on('hand:ended', (data) => {
  // Existing winners array still available
  console.log('Winners:', data.winners);
  
  // New showdown participants array
  if (data.showdownParticipants) {
    console.log('All showdown participants:', data.showdownParticipants);
  }
});
```

### Implementation
- Modified `GameEngine.showdown()` to build `showdownParticipants` array
- Updated `GameEngine.endHand()` to accept and pass through participants
- Added to both `hand:complete` and `hand:ended` events
- Maintains full backward compatibility

## Version
- Previous: 4.4.9 (bet clearing fix)
- Current: 4.5.0 (minor version bump for new feature)
- Type: Minor (new feature, backward compatible)

## Compatibility
- Node.js: >=22.0.0
- No breaking changes
- Backward compatible with all existing integrations

## Credits
- Feature requested by PokerSim client team for issue #150
- Implements standard poker showdown conventions
- Enables complete hand history and tournament logging functionality