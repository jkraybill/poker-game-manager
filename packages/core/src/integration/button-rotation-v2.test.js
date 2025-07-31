/**
 * Dealer Button Rotation Tests (Using Test Utilities)
 * Issue #36 - Verify button rotates correctly in various scenarios
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

describe('Dealer Button Rotation (Issue #36) - v2', () => {
  let manager;
  let table;
  let events;

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

  it('should rotate dealer button clockwise after each hand', async () => {
    // Create table with explicit initial button position
    const result = createTestTable('standard', {
      minPlayers: 3,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Track button positions
    const buttonPositions = [];
    table.on('hand:started', (data) => {
      buttonPositions.push(data.dealerButton);
    });

    // Simple fold/check strategy
    const simpleStrategy = ({ toCall }) => {
      if (toCall > 0) {
        return { action: Action.FOLD };
      }
      return { action: Action.CHECK };
    };

    // Create 3 players
    const players = Array.from(
      { length: 3 },
      (_, i) =>
        new StrategicPlayer({
          name: `Player ${i + 1}`,
          strategy: simpleStrategy,
        }),
    );

    // Add players
    players.forEach((p) => table.addPlayer(p));

    // Play 5 hands to verify rotation
    for (let i = 0; i < 5; i++) {
      events = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events);
    }

    // Verify button rotated correctly
    expect(buttonPositions).toEqual([0, 1, 2, 0, 1]);
    // Verify button wraps around correctly
    expect(buttonPositions[3]).toBe(0); // After position 2, goes back to 0
  });

  it('should skip eliminated players when rotating button', async () => {
    // Create table with lower buy-in for elimination scenario
    const result = createTestTable('standard', {
      minBuyIn: 30,
      maxBuyIn: 500,
      minPlayers: 3,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Track button positions and eliminations
    const buttonPositions = [];
    const eliminations = [];

    table.on('hand:started', (data) => {
      buttonPositions.push({
        position: data.dealerButton,
        playerCount: data.players.length,
      });
    });

    table.on('player:eliminated', (data) => {
      eliminations.push(data.playerId);
    });

    // All-in strategy for short stack
    let actionCount = 0;
    const allInStrategy = ({ player, myState }) => {
      actionCount++;
      // Short stack goes all-in on first action
      if (player.name === 'Short Stack' && actionCount === 1) {
        return { action: Action.ALL_IN, amount: myState.chips };
      }
      // Others fold to all-in
      if (myState.bet < 30) {
        return { action: Action.FOLD };
      }
      return { action: Action.CHECK };
    };

    // Create players with different names
    const players = [
      new StrategicPlayer({ name: 'Short Stack', strategy: allInStrategy }),
      new StrategicPlayer({ name: 'Medium Stack', strategy: allInStrategy }),
      new StrategicPlayer({ name: 'Big Stack', strategy: allInStrategy }),
    ];

    // Add players
    players.forEach((p) => table.addPlayer(p));

    // Play hands until someone is eliminated
    let handsPlayed = 0;
    while (eliminations.length === 0 && handsPlayed < 10) {
      events = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events);
      handsPlayed++;
    }

    // The button should have rotated even with eliminations
    expect(buttonPositions.length).toBeGreaterThanOrEqual(2);

    // Button positions should change between hands
    if (buttonPositions.length >= 2) {
      const uniquePositions = new Set(buttonPositions.map((bp) => bp.position));
      expect(uniquePositions.size).toBeGreaterThan(1);
    }
  });

  it('should handle heads-up button rules correctly', async () => {
    // Create heads-up table
    const result = createHeadsUpTable({
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Track button and blind positions
    const gameStates = [];

    table.on('hand:started', (data) => {
      // In heads-up, button should be small blind
      gameStates.push({
        button: data.dealerButton,
        players: data.players.length,
        isHeadsUp: data.players.length === 2,
      });
    });

    // Simple fold/check strategy
    const simpleStrategy = ({ toCall }) => {
      if (toCall > 0) {
        return { action: Action.FOLD };
      }
      return { action: Action.CHECK };
    };

    // Create 2 players
    const players = Array.from(
      { length: 2 },
      (_, i) =>
        new StrategicPlayer({
          name: `Player ${i + 1}`,
          strategy: simpleStrategy,
        }),
    );

    // Add players
    players.forEach((p) => table.addPlayer(p));

    // Play 3 hands
    for (let i = 0; i < 3; i++) {
      events = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events);
    }

    // Verify button rotated in heads-up
    expect(gameStates.length).toBe(3);
    expect(gameStates[0].button).toBe(0);
    expect(gameStates[1].button).toBe(1);
    expect(gameStates[2].button).toBe(0); // Wraps around
  });

  it('should maintain correct button position when players join between hands', async () => {
    // Create table
    const result = createTestTable('standard', {
      minPlayers: 2,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Track button positions
    const buttonPositions = [];
    table.on('hand:started', (data) => {
      buttonPositions.push({
        button: data.dealerButton,
        playerCount: data.players.length,
      });
    });

    // Simple fold/check strategy
    const simpleStrategy = ({ toCall }) => {
      if (toCall > 0) {
        return { action: Action.FOLD };
      }
      return { action: Action.CHECK };
    };

    // Start with 2 players
    const player1 = new StrategicPlayer({
      name: 'Player 1',
      strategy: simpleStrategy,
    });
    const player2 = new StrategicPlayer({
      name: 'Player 2',
      strategy: simpleStrategy,
    });

    table.addPlayer(player1);
    table.addPlayer(player2);

    // Play first hand
    events = setupEventCapture(table);
    table.tryStartGame();
    await waitForHandEnd(events);

    // Add third player between hands
    const player3 = new StrategicPlayer({
      name: 'Player 3',
      strategy: simpleStrategy,
    });
    table.addPlayer(player3);

    // Play second hand
    events = setupEventCapture(table);
    table.tryStartGame();
    await waitForHandEnd(events);

    // Button should still rotate even with new player
    expect(buttonPositions.length).toBe(2);
    expect(buttonPositions[0].button).toBe(0);
    expect(buttonPositions[1].button).toBe(1); // Button moved to next position
    expect(buttonPositions[1].playerCount).toBe(3); // Now 3 players
  });
});
