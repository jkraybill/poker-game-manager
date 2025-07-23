/**
 * 3-Player Poker Scenarios (Using Test Utilities)
 * 
 * Tests for 3-player games covering position dynamics, button raises, and blind defense.
 * In 3-player, the button is also UTG (under the gun).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  createTestTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  Action,
  cleanupTables,
  assignPositions,
} from '../test-utils/index.js';

describe('3-Player Scenarios (v2)', () => {
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

  describe('Button raise dynamics', () => {
    it('should handle Button raising and blinds folding', async () => {
      // Create 3-player table
      const result = createTestTable('standard', {
        minPlayers: 3,
        dealerButton: 0,
      });
      manager = result.manager;
      table = result.table;

      // Set up event capture
      events = setupEventCapture(table);

      // Create position-aware strategy
      const positionStrategy = ({ player, position, gameState, toCall }) => {
        const myState = gameState.players[player.id];

        // Only raise if we're the button/UTG and haven't raised yet
        if (position === 'button' && !player.hasRaised && gameState.currentBet <= 20) {
          player.hasRaised = true;
          return {
            action: Action.RAISE,
            amount: 100,
          };
        }

        // If we're not button and face a raise, fold
        if (position !== 'button' && toCall > 0 && gameState.currentBet > 20) {
          return {
            action: Action.FOLD,
          };
        }

        // Otherwise call/check
        if (toCall > 0) {
          const callAmount = Math.min(toCall, myState.chips);
          return {
            action: callAmount === myState.chips ? Action.ALL_IN : Action.CALL,
            amount: callAmount,
          };
        }

        return {
          action: Action.CHECK,
        };
      };

      // Create 3 position-aware players
      const players = Array.from({ length: 3 }, (_, i) => 
        new StrategicPlayer({
          name: `Player ${i + 1}`,
          strategy: positionStrategy,
        })
      );

      // Track dealer button
      let dealerButtonPos = -1;
      table.on('hand:started', ({ dealerButton }) => {
        dealerButtonPos = dealerButton;
        assignPositions(players, dealerButton, 3);
      });

      // Add players
      players.forEach(p => table.addPlayer(p));

      // Start game
      table.tryStartGame();

      // Wait for hand to complete
      await waitForHandEnd(events);

      // Extract results
      const { winners, actions } = events;

      // Ensure dealerButton was set
      expect(dealerButtonPos).toBeGreaterThanOrEqual(0);
      expect(dealerButtonPos).toBeLessThan(3);

      // Check that we had exactly one raise and two folds
      const raiseAction = actions.find(a => a.action === Action.RAISE);
      expect(raiseAction).toBeDefined();
      expect(raiseAction.amount).toBe(100);

      const foldActions = actions.filter(a => a.action === Action.FOLD);
      expect(foldActions).toHaveLength(2);
      
      // The winner should be whoever raised (since others folded)
      expect(winners).toHaveLength(1);
      expect(winners[0].playerId).toBe(raiseAction.playerId);
      expect(winners[0].amount).toBe(130); // Raiser's $100 + SB $10 + BB $20
    });
  });
});