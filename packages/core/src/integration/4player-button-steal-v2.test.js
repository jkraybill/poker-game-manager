/**
 * 4-Player Button Steal Scenario (Using Test Utilities)
 *
 * Tests the classic "button steal" move where the Button position attempts to steal
 * the blinds by raising after all players before them have folded. This is a
 * fundamental positional play concept in poker.
 *
 * Expected flow:
 * 1. UTG folds (weak hand)
 * 2. Button raises to 50 (2.5x BB) to steal blinds
 * 3. Small Blind folds to the raise
 * 4. Big Blind folds to the raise
 * 5. Button wins pot (50 + 10 + 20 = 80 chips)
 *
 * This tests:
 * - Position-based decision making
 * - Fold equity in late position
 * - Basic blind stealing mechanics
 * - Pre-flop pot winning without showdown
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestScenario,
  StrategicPlayer,
  assignPositions,
  assertActionSequence,
  Action,
} from '../test-utils/index.js';

describe('4-Player Button Steal (v2)', () => {
  let scenario;

  beforeEach(() => {
    // Initialize scenario but don't create it yet
    scenario = null;
  });

  afterEach(() => {
    // Clean up if scenario was created
    if (scenario) {
      scenario.cleanup();
    }
  });

  it('should handle Button stealing blinds after UTG folds', async () => {
    // Create test scenario with standard 4-player setup
    scenario = createTestScenario({
      tableConfig: 'standard',
      tableOverrides: {
        minPlayers: 4,
        dealerButton: 0,
      },
    });

    // Create strategy for button steal scenario
    const buttonStealStrategy = ({ position, gameState, toCall }) => {
      // UTG folds immediately (simulating weak hand or tight play)
      if (position === 'utg') {
        return { action: Action.FOLD };
      }

      // Button raises to steal blinds after UTG folds
      if (position === 'button' && gameState.currentBet === 20) {
        return { action: Action.RAISE, amount: 50 }; // 2.5x BB steal sizing
      }

      // Blinds fold to button steal attempt
      if (
        ['sb', 'bb'].includes(position) &&
        toCall > 0 &&
        gameState.currentBet > 20
      ) {
        return { action: Action.FOLD };
      }

      // Call blinds if needed (shouldn't happen in this scenario)
      if (toCall > 0) {
        return { action: Action.CALL, amount: toCall };
      }

      return { action: Action.CHECK };
    };

    // Create 4 players with the button steal strategy
    const players = Array.from(
      { length: 4 },
      (_, i) =>
        new StrategicPlayer({
          name: `Player ${i + 1}`,
          strategy: buttonStealStrategy,
        }),
    );

    // Add position assignment listener
    scenario.table.on('hand:started', ({ dealerButton }) => {
      assignPositions(players, dealerButton, 4);
    });

    // Add players to the table
    scenario.addPlayers(players);

    // Start the game
    scenario.startGame();

    // Wait for hand to complete
    await scenario.waitForEnd();

    // Extract results
    const { winners, actions } = scenario.events;
    const buttonPlayer = players.find((p) => p.position === 'button');

    // Verify results: Button should win the pot
    expect(winners).toHaveLength(1);
    expect(winners[0].playerId).toBe(buttonPlayer.id);

    // Pot calculation for button steal:
    // - UTG folded (no contribution)
    // - Button raised to 50
    // - SB folded after posting 10
    // - BB folded after posting 20
    // Total pot = 50 + 10 + 20 = 80
    expect(winners[0].amount).toBe(80);

    // Verify action sequence using assertion helper
    const raiseAction = actions.find((a) => a.action === Action.RAISE);
    expect(raiseAction).toBeDefined();
    expect(raiseAction.amount).toBe(50);
    expect(raiseAction.playerId).toBe(buttonPlayer.id);

    // Should have exactly 3 folds (UTG, SB, BB)
    const foldActions = actions.filter((a) => a.action === Action.FOLD);
    expect(foldActions).toHaveLength(3);

    // Verify proper action sequence: UTG fold, then Button raise, then SB/BB folds
    assertActionSequence(actions.slice(0, 4), [
      Action.FOLD, // UTG folds first
      Action.RAISE, // Button raises
      Action.FOLD, // SB folds
      Action.FOLD, // BB folds
    ]);
  });
});
