import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createChipStackTable,
  setupEventCapture,
  StrategicPlayer,
  cleanupTables,
  waitForHandEnd,
  Action,
} from '../test-utils/index.js';

/**
 * Test for Issue #33: Event ordering with guaranteed elimination
 *
 * This test ensures that player:eliminated events fire AFTER hand:ended events
 * when a player loses all their chips.
 */

describe('Event Ordering - Elimination (Issue #33)', () => {
  let manager, table, events;

  beforeEach(() => {
    manager = null;
    table = null;
    events = null;
  });

  afterEach(() => {
    if (manager) {
      cleanupTables(manager);
    }
  });

  it('should fire player:eliminated after hand:ended when player loses all chips', async () => {
    // Create table with chip stacks
    ({ manager, table } = createChipStackTable(
      'standard',
      [100, 50], // Player 1 has more chips
      {
        id: 'elimination-test',
        blinds: { small: 10, big: 20 },
        minBuyIn: 40,
        maxBuyIn: 200,
        minPlayers: 2,
        maxPlayers: 9,
        dealerButton: 0,
      },
    ));
    events = setupEventCapture(table);

    // Create a custom deck where player 1 gets better cards than player 2
    const customDeck = [
      // Player 1 gets AA (will win)
      { rank: 'A', suit: 's', toString() {
 return 'As'; 
} },
      // Player 2 gets 72 (will lose)
      { rank: '7', suit: 'd', toString() {
 return '7d'; 
} },
      // Player 1 second card
      { rank: 'A', suit: 'h', toString() {
 return 'Ah'; 
} },
      // Player 2 second card
      { rank: '2', suit: 'c', toString() {
 return '2c'; 
} },
      // Burn + Community cards that don't help player 2
      { rank: '3', suit: 'h', toString() {
 return '3h'; 
} }, // burn
      { rank: 'K', suit: 's', toString() {
 return 'Ks'; 
} }, // flop
      { rank: 'Q', suit: 'h', toString() {
 return 'Qh'; 
} },
      { rank: 'J', suit: 'd', toString() {
 return 'Jd'; 
} },
      { rank: '4', suit: 'h', toString() {
 return '4h'; 
} }, // burn
      { rank: 'T', suit: 'c', toString() {
 return 'Tc'; 
} }, // turn
      { rank: '5', suit: 'h', toString() {
 return '5h'; 
} }, // burn
      { rank: '9', suit: 's', toString() {
 return '9s'; 
} }, // river
    ];

    table.setCustomDeck(customDeck);

    const eventLog = [];

    // Track events
    table.on('hand:ended', ({ winners }) => {
      eventLog.push({
        event: 'hand:ended',
        timestamp: Date.now(),
        winners: winners.map((w) => ({ id: w.playerId, amount: w.amount })),
      });
    });

    table.on('player:eliminated', ({ playerId }) => {
      eventLog.push({
        event: 'player:eliminated',
        timestamp: Date.now(),
        playerId,
      });
    });

    // Simple all-in strategy
    const allInStrategy = ({ myState }) => {
      if (myState.chips > 0) {
        return {
          action: Action.ALL_IN,
          amount: myState.chips,
        };
      }
      return {
        action: Action.CHECK,
      };
    };

    const player1 = new StrategicPlayer({
      name: 'Player 1',
      strategy: allInStrategy,
    });
    const player2 = new StrategicPlayer({
      name: 'Player 2',
      strategy: allInStrategy,
    });

    // Add players in order
    table.addPlayer(player1);
    table.addPlayer(player2);

    // Start game
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);
    
    // Give time for elimination event to fire
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify we got both events
    const handEndedEvents = eventLog.filter((e) => e.event === 'hand:ended');
    const eliminationEvents = eventLog.filter(
      (e) => e.event === 'player:eliminated',
    );

    expect(handEndedEvents).toHaveLength(1);
    expect(eliminationEvents).toHaveLength(1);

    // Verify ordering - elimination must come after hand:ended
    const handTime = handEndedEvents[0].timestamp;
    const elimTime = eliminationEvents[0].timestamp;

    expect(elimTime).toBeGreaterThanOrEqual(handTime);

    // Verify the correct player was eliminated (player2 who had 50 chips)
    expect(eliminationEvents[0].playerId).toBe(player2.id);

    // Verify player1 won the pot
    expect(handEndedEvents[0].winners[0].id).toBe(player1.id);
    // Player 1 (SB) posts 10, Player 2 (BB) posts 20, then both go all-in
    // Player 2 has 50 chips total, Player 1 matches that amount
    // Total pot = 50 + 50 = 100, but Player 1 gets back 20 (uncalled portion)
    // So Player 1 wins 80
    expect(handEndedEvents[0].winners[0].amount).toBe(80);
  });
});
