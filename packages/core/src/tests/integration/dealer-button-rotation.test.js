import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  StrategicPlayer,
  cleanupTables,
  waitForHandEnd,
  STRATEGIES,
} from '../../test-utils/index.js';


describe('Dealer Button Rotation', () => {
  let manager, table, events;
  let players;

  beforeEach(() => {
    ({ manager, table } = createTestTable('standard', {
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2, // Changed from 3 to 2 to allow heads-up play after elimination
      dealerButton: 0, // Start with position 0
    }));
    events = setupEventCapture(table);

    // Create 3 test players using alwaysCall strategy
    players = [
      new StrategicPlayer({ id: 'player-1', name: 'Player 1', strategy: STRATEGIES.alwaysCall }),
      new StrategicPlayer({ id: 'player-2', name: 'Player 2', strategy: STRATEGIES.alwaysCall }),
      new StrategicPlayer({ id: 'player-3', name: 'Player 3', strategy: STRATEGIES.alwaysCall }),
    ];
  });

  afterEach(() => {
    if (manager) {
      cleanupTables(manager);
    }
  });

  it('should rotate dealer button clockwise after each hand', async () => {
    const buttonPositions = [];
    const handCount = 4; // Play 4 hands to see full rotation

    // Track button positions
    table.on('hand:started', (data) => {
      buttonPositions.push(data.dealerButton);
    });

    // Add players
    players.forEach((player) => table.addPlayer(player));

    // Play multiple hands
    for (let i = 0; i < handCount; i++) {
      table.tryStartGame();
      await waitForHandEnd(events);
      
      // Small delay between hands
      if (i < handCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Verify button rotated correctly
    expect(buttonPositions).toHaveLength(handCount);
    expect(buttonPositions[0]).toBe(0); // First hand: position 0
    expect(buttonPositions[1]).toBe(1); // Second hand: position 1
    expect(buttonPositions[2]).toBe(2); // Third hand: position 2
    expect(buttonPositions[3]).toBe(0); // Fourth hand: back to position 0
  });

  it('should handle player elimination and continue with reduced players', async () => {
    // This test verifies that when minPlayers is set to 2, the game can continue
    // after a player is eliminated, and the button rotates correctly
    const buttonPositions = [];
    const handEndCount = { count: 0 };

    // Track button positions
    table.on('hand:started', (data) => {
      buttonPositions.push(data.dealerButton);
    });

    // Track hand endings
    table.on('hand:ended', () => {
      handEndCount.count++;
    });

    // Add players
    players.forEach((player) => table.addPlayer(player));

    // Play multiple hands
    for (let i = 0; i < 4; i++) {
      table.tryStartGame();

      // Wait for hand to complete
      await waitForHandEnd(events);

      // Small delay between hands
      await new Promise((resolve) => setTimeout(resolve, 100));

      // If we have less than minPlayers, stop
      if (table.getPlayerCount() < table.config.minPlayers) {
        break;
      }
    }

    // Verify button positions advanced
    expect(buttonPositions.length).toBeGreaterThanOrEqual(2);

    // Check that button positions are different (showing rotation)
    const uniquePositions = [...new Set(buttonPositions)];
    expect(uniquePositions.length).toBeGreaterThan(1);
  });

  it('should handle heads-up button rotation correctly', async () => {
    const buttonPositions = [];

    // Create only 2 players for heads-up
    const headsUpResult = createTestTable('headsUp', {
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
      dealerButton: 0,
    });
    const headsUpTable = headsUpResult.table;
    const headsUpEvents = setupEventCapture(headsUpTable);

    const headsUpPlayers = [
      new StrategicPlayer({ id: 'player-1', name: 'Player 1', strategy: STRATEGIES.alwaysCall }),
      new StrategicPlayer({ id: 'player-2', name: 'Player 2', strategy: STRATEGIES.alwaysCall }),
    ];

    // Track button positions
    headsUpTable.on('hand:started', (data) => {
      buttonPositions.push(data.dealerButton);
    });

    // Add players
    headsUpPlayers.forEach((player) => headsUpTable.addPlayer(player));

    // Play multiple hands
    for (let i = 0; i < 3; i++) {
      headsUpTable.tryStartGame();
      await waitForHandEnd(headsUpEvents);
      
      // Small delay between hands
      if (i < 2) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Verify button rotated correctly in heads-up
    expect(buttonPositions).toHaveLength(3);
    expect(buttonPositions[0]).toBe(0); // First hand: position 0
    expect(buttonPositions[1]).toBe(1); // Second hand: position 1
    expect(buttonPositions[2]).toBe(0); // Third hand: back to position 0

    cleanupTables(headsUpResult.manager);
  });
});
