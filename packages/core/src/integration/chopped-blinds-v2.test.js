/**
 * Chopped Blinds Test (Using Test Utilities)
 *
 * Tests the scenario where all players fold to the big blind,
 * resulting in the BB winning the pot without showing cards.
 * This is one of the most common scenarios in poker.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  createHeadsUpTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  Action,
  cleanupTables,
} from '../test-utils/index.js';

describe('Chopped Blinds Scenarios (v2)', () => {
  let manager;
  let table;
  let events;

  beforeEach(() => {
    // Initialize but don't create yet
    manager = null;
    table = null;
    events = null;
  });

  afterEach(() => {
    // Clean up if created
    if (manager) {
      cleanupTables(manager);
    }
  });

  it('should handle everyone folding to BB in 6-handed game', async () => {
    // Create 6-player table
    const result = createTestTable('standard', {
      minPlayers: 6,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Strategy: Everyone folds to BB
    const tightStrategy = ({ position, gameState }) => {
      // Everyone folds to BB
      if (gameState.phase === 'PRE_FLOP' && position !== 'bb') {
        return { action: Action.FOLD };
      }
      // BB should win without acting
      return { action: Action.CHECK };
    };

    // Create 6 players and assign positions
    const players = Array.from(
      { length: 6 },
      (_, i) =>
        new StrategicPlayer({
          name: `Player ${i + 1}`,
          strategy: tightStrategy,
        }),
    );

    // Track winner's cards shown status
    let winnerShowedCards = false;
    table.on('hand:ended', ({ winners }) => {
      if (winners && winners.length > 0) {
        // If hand is "Won by fold", cards weren't shown
        winnerShowedCards = winners[0]?.hand !== 'Won by fold';
      }
    });

    // Assign positions when hand starts
    table.on('hand:started', () => {
      // In 6-player game with dealerButton = 0:
      // 0 = Button, 1 = SB, 2 = BB, 3 = UTG, 4 = MP, 5 = CO
      const positions = ['button', 'sb', 'bb', 'utg', 'mp', 'co'];
      players.forEach((player, idx) => {
        player.position = positions[idx];
      });
    });

    // Add players and start
    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { winners, actions } = events;

    // Verify BB won
    expect(winners).toHaveLength(1);
    const bbPlayer = players.find((p) => p.position === 'bb');
    expect(winners[0].playerId).toBe(bbPlayer.id);

    // BB should win SB + BB = 30 chips
    expect(winners[0].amount).toBe(30);

    // Cards should not be shown
    expect(winnerShowedCards).toBe(false);

    // Count folds - should be 5 (everyone except BB)
    const folds = actions.filter((a) => a.action === Action.FOLD);
    expect(folds).toHaveLength(5);
  });

  it('should handle heads-up where SB/Button folds to BB', async () => {
    // Create heads-up table
    const result = createHeadsUpTable({
      blinds: { small: 25, big: 50 },
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Strategy: Button/SB folds, BB wins
    const headsUpStrategy = ({ player }) => {
      // In heads-up, button is SB and acts first
      if (player.isButton) {
        return { action: Action.FOLD };
      }
      // BB shouldn't need to act
      return { action: Action.CHECK };
    };

    // Create 2 players
    const players = [
      new StrategicPlayer({ name: 'Button/SB', strategy: headsUpStrategy }),
      new StrategicPlayer({ name: 'BB', strategy: headsUpStrategy }),
    ];

    // Mark button player
    table.on('hand:started', ({ dealerButton }) => {
      players[0].isButton = dealerButton === 0;
      players[1].isButton = dealerButton === 1;
    });

    // Add players and start
    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { winners, actions } = events;

    // BB should win
    expect(winners).toHaveLength(1);
    expect(winners[0].amount).toBe(75); // SB (25) + BB (50)

    // Only one action - SB folding
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe(Action.FOLD);
  });

  it('should handle walk scenario where SB completes and BB checks', async () => {
    // Create heads-up table
    const result = createHeadsUpTable({
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Strategy: SB completes, both check down
    const walkStrategy = ({ player, gameState, toCall }) => {
      if (gameState.phase === 'PRE_FLOP') {
        // SB completes (calls the BB)
        if (player.isButton && toCall > 0) {
          return { action: Action.CALL, amount: toCall };
        }
      }
      // Both check all streets
      return { action: Action.CHECK };
    };

    // Create 2 players
    const players = [
      new StrategicPlayer({ name: 'Button/SB', strategy: walkStrategy }),
      new StrategicPlayer({ name: 'BB', strategy: walkStrategy }),
    ];

    // Mark button player
    table.on('hand:started', ({ dealerButton }) => {
      players[0].isButton = dealerButton === 0;
      players[1].isButton = dealerButton === 1;
    });

    // Track showdown
    let showdownOccurred = false;
    table.on('hand:ended', ({ winners }) => {
      if (winners && winners.length > 0) {
        // Check if hand went to showdown
        showdownOccurred = winners[0]?.hand && winners[0].hand !== 'Won by fold';
      }
    });

    // Add players and start
    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { actions } = events;

    // Should go to showdown
    expect(showdownOccurred).toBe(true);

    // Should have 1 call and many checks
    const calls = actions.filter((a) => a.action === Action.CALL);
    const checks = actions.filter((a) => a.action === Action.CHECK);

    expect(calls).toHaveLength(1); // SB completes
    expect(checks.length).toBeGreaterThan(6); // Both check pre-flop, flop, turn, river
  });

  it('should properly return blinds when everyone folds pre-flop', async () => {
    // Create 4-player table
    const result = createTestTable('standard', {
      blinds: { small: 100, big: 200 },
      minBuyIn: 5000,
      maxBuyIn: 5000,
      minPlayers: 4,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Strategy: Everyone folds pre-flop
    const foldStrategy = ({ gameState, myState }) => {
      // If I'm not BB and haven't acted, fold
      if (
        gameState.phase === 'PRE_FLOP' &&
        !myState.hasActed &&
        gameState.currentBet > myState.bet
      ) {
        return { action: Action.FOLD };
      }
      return { action: Action.CHECK };
    };

    // Create 4 players
    const players = Array.from(
      { length: 4 },
      (_, i) =>
        new StrategicPlayer({
          name: `Player ${i + 1}`,
          strategy: foldStrategy,
        }),
    );

    // Add players and start
    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { winners } = events;

    // Winner should get SB + BB = 300
    expect(winners).toHaveLength(1);
    expect(winners[0].amount).toBe(300);

    // Should be won by fold
    expect(winners[0].hand).toBe('Won by fold');
  });
});
