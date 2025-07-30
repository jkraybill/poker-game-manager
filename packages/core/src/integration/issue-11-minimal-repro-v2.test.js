import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  StrategicPlayer,
  DeckBuilder,
  cleanupTables,
  waitForHandEnd,
  Action,
} from '../test-utils/index.js';

/**
 * MINIMAL reproduction of Issue #11: Pot Distribution Bug
 *
 * The bug occurs when:
 * 1. A short-stacked player goes all-in
 * 2. Other players continue betting beyond the all-in amount
 * 3. The all-in player wins
 * 4. They receive 0 chips despite winning
 *
 * Root cause: The all-in player is not marked as eligible for the pot they helped create
 */

describe('Issue #11 - Minimal Pot Distribution Bug (v2)', () => {
  let manager, table, events;

  beforeEach(() => {
    ({ manager, table } = createTestTable('standard', {
      tableId: 'exact-bug',
      minPlayers: 3,
      maxPlayers: 3,
      blinds: { small: 10, big: 20 },
      dealerButton: 0,
      minBuyIn: 1000,
    }));
    events = setupEventCapture(table);
  });

  afterEach(() => {
    cleanupTables(manager);
  });

  it('should reproduce the exact failing scenario', async () => {
    // Create custom deck matching the original test
    const customDeck = new DeckBuilder(3)
      .dealHoleCards([
        ['As', 'Ah'], // P1 gets AA (best hand)
        ['Kd', 'Kh'], // P2 gets KK
        ['Qc', 'Qh'], // P3 gets QQ
      ])
      .addFlop('3d', '5s', '7h')
      .addTurn('9h')
      .addRiver('Jc')
      .build();

    table.setCustomDeck(customDeck);

    // Strategy for each player based on original test
    const p1Strategy = (gameState, playerId) => {
      console.log('Short Stack: ALL_IN 100');
      return { playerId, action: Action.ALL_IN, amount: gameState.players[playerId].chips, timestamp: Date.now() };
    };

    const p2Strategy = (gameState, playerId) => {
      console.log('Medium Stack: ALL_IN 300');
      return { playerId, action: Action.ALL_IN, amount: gameState.players[playerId].chips, timestamp: Date.now() };
    };

    const p3Strategy = (gameState, playerId) => {
      const myState = gameState.players[playerId];
      const toCall = gameState.currentBet - myState.bet;
      if (toCall > 0) {
        console.log('Big Stack: CALL', toCall);
        return { playerId, action: Action.CALL, amount: toCall, timestamp: Date.now() };
      }
      return { playerId, action: Action.CHECK, timestamp: Date.now() };
    };

    // Create players
    const p1 = new StrategicPlayer({
      id: 'p1',
      name: 'Short Stack',
      strategy: p1Strategy,
    });

    const p2 = new StrategicPlayer({
      id: 'p2',
      name: 'Medium Stack',
      strategy: p2Strategy,
    });

    const p3 = new StrategicPlayer({
      id: 'p3',
      name: 'Big Stack',
      strategy: p3Strategy,
    });

    // Add players
    table.addPlayer(p1);
    table.addPlayer(p2);
    table.addPlayer(p3);

    // Set exact chip counts from failing test
    const p1Data = Array.from(table.players.values()).find(p => p.player.id === 'p1');
    const p2Data = Array.from(table.players.values()).find(p => p.player.id === 'p2');
    const p3Data = Array.from(table.players.values()).find(p => p.player.id === 'p3');
    
    if (p1Data) {
p1Data.chips = 100;
}
    if (p2Data) {
p2Data.chips = 300;
}
    if (p3Data) {
p3Data.chips = 1000;
}

    console.log('\n=== EXACT FAILING SCENARIO ===');
    console.log('P1:', 100, 'chips');
    console.log('P2:', 300, 'chips');
    console.log('P3:', 1000, 'chips');

    // Debug: track pot events
    table.on('pot:updated', (data) => {
      console.log('pot:updated event:', data);
    });

    table.on('sidepot:created', (data) => {
      console.log('sidepot:created event:', data);
    });

    // Track player actions
    table.on('player:action', (data) => {
      console.log(
        `\nPlayer action: ${data.playerId} ${data.action} ${data.amount || ''}`,
      );
    });

    // Start game
    table.tryStartGame();

    // Wait for hand to end
    await waitForHandEnd(events);

    const { winners, sidePots } = events;

    console.log('\n=== RESULTS ===');
    console.log(
      'Winners:',
      winners.map((w) => ({
        id: w.playerId,
        amount: w.amount,
        hand: w.hand?.description || 'Unknown',
      })),
    );

    console.log(
      '\nActual Pots:',
      sidePots.map((pot) => ({
        amount: pot.amount,
        eligible: pot.eligiblePlayers,
      })),
    );

    // Expected pot structure:
    // Main pot: 300 (100 from each player) - P1, P2, P3 eligible
    // Side pot: 400 (200 from P2 and P3) - only P2, P3 eligible
    console.log('\nExpected Pots:');
    console.log('- Main pot: 300, eligible: [p1, p2, p3]');
    console.log('- Side pot: 400, eligible: [p2, p3]');

    const winner = winners[0];
    expect(winner.playerId).toBe('p1');

    // Calculate expected winnings:
    // P1 (100 chips) is all-in, so main pot = 100 * 3 = 300
    // P1 should win this main pot since they have AA
    const expectedWinnings = 300;

    if (winner.amount === 0) {
      console.log(
        '\n🐛 BUG REPRODUCED: Winner got 0 chips instead of',
        expectedWinnings,
      );
    } else if (winner.amount === expectedWinnings) {
      console.log(
        '\n✅ Bug FIXED: Winner correctly got',
        winner.amount,
        'chips',
      );
    } else {
      console.log(
        '\n⚠️  Partial bug: Winner got',
        winner.amount,
        'chips instead of',
        expectedWinnings,
      );
    }

    // The exact amount P1 should win
    expect(winner.amount).toBe(expectedWinnings);

    // Also check final chip counts after hand
    const p1Final = Array.from(table.players.values()).find(p => p.player.id === 'p1');
    const p2Final = Array.from(table.players.values()).find(p => p.player.id === 'p2');
    const p3Final = Array.from(table.players.values()).find(p => p.player.id === 'p3');

    console.log('\n=== FINAL CHIP COUNTS ===');
    console.log('P1:', p1Final?.chips, '(started with 100)');
    console.log('P2:', p2Final?.chips, '(started with 300)');
    console.log('P3:', p3Final?.chips, '(started with 1000)');

    // Expected final chips:
    // Betting: P1 all-in 100, P2 all-in 300, P3 calls 300
    // Main pot: 100 * 3 = 300 (all players eligible)
    // Side pot: 200 * 2 = 400 (only P2 and P3 eligible)
    // Winners: P1 (AA) wins main pot, P2 (KK) beats P3 (QQ) for side pot
    expect(p1Final?.chips).toBe(300); // Started 100 - bet 100 + won 300 = 300
    expect(p2Final?.chips).toBe(400); // Started 300 - bet 300 + won 400 = 400
    expect(p3Final?.chips).toBe(700); // Started 1000 - bet 300 = 700
  });
});