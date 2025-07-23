/**
 * 6-Player Simple Test (Using Test Utilities)
 * 
 * Basic test to ensure a 6-player game can complete successfully
 * with simple fold/check behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  createTestTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  STRATEGIES,
  cleanupTables,
} from '../test-utils/index.js';

describe('6-Player Simple Test (v2)', () => {
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

  it('should complete a simple 6-player game', async () => {
    // Create 6-player table
    const result = createTestTable('standard', {
      minPlayers: 6,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Create 6 players using the built-in always fold strategy
    const players = Array.from({ length: 6 }, (_, i) => 
      new StrategicPlayer({
        name: `Player ${i + 1}`,
        strategy: STRATEGIES.alwaysFold,
      })
    );

    // Add players
    players.forEach(p => table.addPlayer(p));

    // Start game
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Verify game completed successfully
    expect(events.gameStarted).toBe(true);
    expect(events.handEnded).toBe(true);
    expect(events.actions.length).toBeGreaterThan(0);
    expect(events.winners.length).toBeGreaterThan(0);
  });
});