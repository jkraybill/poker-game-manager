/**
 * 4-Player UTG Button Showdown Scenario (Using Test Utilities)
 *
 * Tests a complete multi-street hand where UTG raises, Button calls, blinds fold,
 * then both players check to showdown through all streets.
 * This tests multi-street play and showdown mechanics.
 *
 * Expected flow:
 * Pre-flop: UTG raises to 60, Button calls, SB/BB fold
 * Flop/Turn/River: Both players check
 * Showdown: Best hand wins
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

describe('4-Player UTG Button Showdown (v2)', () => {
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

  it('should handle UTG raising, Button calling, blinds folding, check-check to showdown', async () => {
    // Create 4-player table
    const result = createTestTable('standard', {
      minPlayers: 4,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Showdown-aware strategy
    const showdownStrategy = ({ player, gameState, toCall }) => {
      // Pre-flop behavior
      if (gameState.phase === 'PRE_FLOP') {
        // UTG raises to 60
        if (
          player.position === 'utg' &&
          !player.hasRaisedPreflop &&
          gameState.currentBet === 20
        ) {
          player.hasRaisedPreflop = true;
          return { action: Action.RAISE, amount: 60 };
        }

        // Button calls raises
        if (
          player.position === 'button' &&
          toCall > 0 &&
          gameState.currentBet > 20
        ) {
          return { action: Action.CALL, amount: toCall };
        }

        // Blinds fold to raises
        if (
          ['sb', 'bb'].includes(player.position) &&
          toCall > 0 &&
          gameState.currentBet > 20
        ) {
          return { action: Action.FOLD };
        }

        // Call blinds if needed
        if (toCall > 0) {
          return { action: Action.CALL, amount: toCall };
        }
      }

      // Post-flop: check everything
      if (toCall === 0) {
        return { action: Action.CHECK };
      }

      // If there's something to call and we're not in pre-flop, call
      if (toCall > 0) {
        return { action: Action.CALL, amount: toCall };
      }

      return { action: Action.CHECK };
    };

    // Create players
    const players = Array.from({ length: 4 }, (_, i) => {
      const player = new StrategicPlayer({
        name: `Player ${i + 1}`,
        strategy: showdownStrategy,
      });
      player.hasRaisedPreflop = false;
      return player;
    });

    // Track dealer button and assign positions
    let dealerButtonPos = -1;
    table.on('hand:started', ({ dealerButton }) => {
      dealerButtonPos = dealerButton;
      assignPositions(players, dealerButton, 4);
    });

    // Add players and start
    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { winners, actions } = events;

    // Get phase-specific actions
    const phaseActions = {
      PRE_FLOP: actions.filter((a) => a.phase === 'PRE_FLOP'),
      FLOP: actions.filter((a) => a.phase === 'FLOP'),
      TURN: actions.filter((a) => a.phase === 'TURN'),
      RIVER: actions.filter((a) => a.phase === 'RIVER'),
    };

    // Find UTG player
    const utgPos = (dealerButtonPos + 3) % 4;
    const utgPlayer = players[utgPos];
    const buttonPlayer = players[dealerButtonPos];

    // Verify pre-flop action sequence - UTG should raise
    const utgRaise = phaseActions.PRE_FLOP.find(
      (a) => a.action === Action.RAISE,
    );
    expect(utgRaise).toBeDefined();
    expect(utgRaise.amount).toBe(60);
    expect(utgRaise.playerId).toBe(utgPlayer.id);

    // Button should call the raise
    const buttonCall = phaseActions.PRE_FLOP.find(
      (a) => a.action === Action.CALL && a.playerId === buttonPlayer.id,
    );
    expect(buttonCall).toBeDefined();
    expect(buttonCall.amount).toBe(60);

    // Should have 2 folds (SB and BB)
    const folds = actions.filter((a) => a.action === Action.FOLD);
    expect(folds).toHaveLength(2);

    // Should have multiple checks post-flop
    const checks = actions.filter((a) => a.action === Action.CHECK);
    expect(checks.length).toBeGreaterThanOrEqual(4); // At least 2 players checking twice

    // Someone should win a reasonable pot (or split pot)
    expect(winners.length).toBeGreaterThanOrEqual(1);

    // Pot calculation:
    // UTG raises to 60, Button calls 60, SB 10 (folded), BB 20 (folded)
    // Total: 60 + 60 + 10 + 20 = 150
    if (winners.length === 1) {
      // Single winner gets full pot
      expect(winners[0].amount).toBe(150);
    } else {
      // Split pot scenario - each winner gets half
      const totalWon = winners.reduce((sum, w) => sum + w.amount, 0);
      expect(totalWon).toBe(150);
      winners.forEach((w) => {
        expect(w.amount).toBe(75); // 150 / 2
      });
    }
  });
});
