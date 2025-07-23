/**
 * Fold Scenarios (Using Test Utilities)
 * 
 * Tests for scenarios where all players fold, testing the basic mechanics
 * of blind posting and automatic wins by the big blind.
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

describe('Fold Scenarios (v2)', () => {
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

  describe('All players fold', () => {
    it('should handle all 3 players folding to big blind', async () => {
      // Create 3-player table
      const result = createTestTable('standard', {
        minPlayers: 3,
        dealerButton: 0,
      });
      manager = result.manager;
      table = result.table;

      // Set up event capture
      events = setupEventCapture(table);

      // Track dealer button
      let dealerButtonPos = -1;
      table.on('hand:started', ({ dealerButton }) => {
        dealerButtonPos = dealerButton;
      });

      // Create 3 players using the built-in always fold strategy
      const players = Array.from({ length: 3 }, (_, i) => 
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

      // Extract results
      const { winners } = events;

      // Big blind should win (when everyone folds, BB wins by default)
      const bbPos = (dealerButtonPos + 2) % 3;
      const bbPlayer = players[bbPos];

      expect(winners).toHaveLength(1);
      expect(winners[0].playerId).toBe(bbPlayer.id);
      expect(winners[0].amount).toBe(30); // SB $10 + BB $20
    });
  });
});