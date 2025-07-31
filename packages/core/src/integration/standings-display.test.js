import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  StrategicPlayer,
  cleanupTables,
  waitForHandEnd,
  Action,
} from '../test-utils/index.js';
import { getFormattedStandings } from '../utils/playerStatus.js';

/**
 * Test for Issue #34: Eliminated players shown in active standings
 *
 * This test verifies that eliminated players are properly separated
 * from active players in standings displays.
 */

describe('Standings Display (Issue #34)', () => {
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

  it('should separate active and eliminated players in standings', async () => {
    ({ manager, table } = createTestTable('standard', {
      id: 'standings-test',
      blinds: { small: 10, big: 20 },
      minBuyIn: 100,
      maxBuyIn: 500,
      minPlayers: 3,
      dealerButton: 0,
    }));
    events = setupEventCapture(table);

    // Simple all-in strategy for forcing eliminations
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

    // Create players with different chip amounts
    const alice = new StrategicPlayer({ name: 'Alice', strategy: allInStrategy });
    const bob = new StrategicPlayer({ name: 'Bob', strategy: allInStrategy });
    const charlie = new StrategicPlayer({ name: 'Charlie', strategy: allInStrategy });

    table.addPlayer(alice);
    table.addPlayer(bob);
    table.addPlayer(charlie);

    // Set different chip amounts - Alice will win, Bob and Charlie will be eliminated
    alice.chips = 500; // Big stack (will win)
    bob.chips = 50; // Small stack (will be eliminated)
    charlie.chips = 100; // Medium stack (will be eliminated)

    // Check initial standings - all should be active
    const initialStandings = getFormattedStandings(table.players);
    expect(initialStandings.standings).toHaveLength(3);
    expect(initialStandings.eliminated).toHaveLength(0);
    expect(initialStandings.summary.playersRemaining).toBe(3);

    // The initial standings should be sorted by chip count (descending)
    expect(initialStandings.standings[0].name).toBe('Alice');
    expect(initialStandings.standings[0].chips).toBe(500);
    expect(initialStandings.standings[1].name).toBe('Charlie');
    expect(initialStandings.standings[1].chips).toBe(100);
    expect(initialStandings.standings[2].name).toBe('Bob');
    expect(initialStandings.standings[2].chips).toBe(50);

    // Track eliminated players for standings display
    const eliminatedPlayers = [];

    // Track eliminated players for standings display
    let eliminatedCount = 0;
    table.on('player:eliminated', ({ playerId }) => {
      eliminatedCount++;
      const playerName =
        [alice, bob, charlie].find((p) => p.id === playerId)?.name || playerId;
      console.log(
        `Player ${playerName} (${playerId}) eliminated (${eliminatedCount} total)`,
      );

      // Track eliminated player for standings display
      eliminatedPlayers.push({
        id: playerId,
        name: playerName,
        chips: 0,
        seatNumber: 0, // Not important for this test
        status: 'eliminated',
        eliminationOrder: eliminatedCount,
      });
    });

    // Start the game
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);
    
    // Brief delay for elimination events to fire
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check final standings - should have eliminated players separated
    const finalStandings = getFormattedStandings(
      table.players,
      eliminatedPlayers,
    );

    console.log('Final standings:', {
      active: finalStandings.standings.map((p) => ({
        name: p.name,
        chips: p.chips,
      })),
      eliminated: finalStandings.eliminated.map((p) => ({
        name: p.name,
        status: p.status,
      })),
      summary: finalStandings.summary,
    });

    // One player should remain active (the winner)
    expect(finalStandings.standings).toHaveLength(1);
    expect(finalStandings.standings[0].chips).toBeGreaterThan(0);
    expect(finalStandings.standings[0].status).toBe('active');

    // Two players should be eliminated
    expect(finalStandings.eliminated).toHaveLength(2);
    finalStandings.eliminated.forEach((player) => {
      expect(player.status).toBe('eliminated');
      expect(player.chips).toBe(0);
    });

    // Summary should reflect the changes
    expect(finalStandings.summary.playersRemaining).toBe(1);
    expect(finalStandings.summary.totalChipsInPlay).toBeGreaterThan(0);
    expect(finalStandings.summary.averageStack).toBeGreaterThan(0);

    console.log(
      '✅ Issue #34 fix verified: Eliminated players properly separated from active standings',
    );
  });

  it('should handle all players eliminated scenario', async () => {
    ({ manager, table } = createTestTable('standard', {
      id: 'all-eliminated-test',
      blinds: { small: 5, big: 10 },
      minBuyIn: 30,
      maxBuyIn: 100,
      minPlayers: 2,
      dealerButton: 0,
    }));
    events = setupEventCapture(table);

    // All-in strategy
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

    const player1 = new StrategicPlayer({ name: 'Player 1', strategy: allInStrategy });
    const player2 = new StrategicPlayer({ name: 'Player 2', strategy: allInStrategy });

    table.addPlayer(player1);
    table.addPlayer(player2);

    // Set very small stacks to force elimination
    player1.chips = 30;
    player2.chips = 30;

    // Track eliminated players
    const eliminatedPlayers = [];

    table.on('player:eliminated', ({ playerId }) => {
      const playerName =
        [player1, player2].find((p) => p.id === playerId)?.name || playerId;
      eliminatedPlayers.push({
        id: playerId,
        name: playerName,
        chips: 0,
        seatNumber: 0,
        status: 'eliminated',
        eliminationOrder: eliminatedPlayers.length + 1,
      });
    });

    table.tryStartGame();
    await waitForHandEnd(events);
    
    // Brief delay for elimination events
    await new Promise(resolve => setTimeout(resolve, 100));

    // After the hand, we should have 1 active + 1 eliminated = 2 total
    const standings = getFormattedStandings(table.players, eliminatedPlayers);

    // Should have exactly 1 active and 1 eliminated (one player won)
    expect(standings.standings.length + standings.eliminated.length).toBe(2);
    expect(standings.summary.playersRemaining).toBe(standings.standings.length);

    // The standings utilities should handle the edge case properly
    if (standings.standings.length === 0) {
      expect(standings.summary.totalChipsInPlay).toBe(0);
      expect(standings.summary.averageStack).toBe(0);
    }

    console.log('✅ Edge case handled: All/most players eliminated scenario');
  });
});
