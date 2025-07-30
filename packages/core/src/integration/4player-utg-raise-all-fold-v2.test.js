/**
 * 4-Player UTG Raise All Fold Scenario (Using Test Utilities)
 *
 * Tests the specific case where UTG (Under The Gun) raises and all other players fold.
 * This tests early position aggression and fold equity in 4-player games.
 *
 * Expected flow:
 * 1. UTG raises to 60 (3x BB)
 * 2. Button folds to raise
 * 3. SB folds to raise
 * 4. BB folds to raise
 * 5. UTG wins pot (60 + 10 + 20 = 90)
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

describe('4-Player UTG Raise All Fold (v2)', () => {
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

  it('should handle UTG raising and everyone folding', async () => {
    // Create 4-player table
    const result = createTestTable('standard', {
      minPlayers: 4,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Create UTG raise strategy
    const utgRaiseStrategy = ({ position, gameState, toCall }) => {
      // UTG raises to 60 (3x BB)
      if (position === 'utg' && gameState.currentBet === 20) {
        return { action: Action.RAISE, amount: 60 };
      }

      // Everyone else folds to raises
      if (toCall > 0 && gameState.currentBet > 20) {
        return { action: Action.FOLD };
      }

      // Call blinds if needed
      if (toCall > 0) {
        return { action: Action.CALL, amount: toCall };
      }

      return { action: Action.CHECK };
    };

    // Create 4 players
    const players = Array.from(
      { length: 4 },
      (_, i) =>
        new StrategicPlayer({
          name: `Player ${i + 1}`,
          strategy: utgRaiseStrategy,
        }),
    );

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

    // Find UTG player
    const utgPos = (dealerButtonPos + 3) % 4;
    const utgPlayer = players[utgPos];

    // Verify results: UTG should win the pot
    expect(winners).toHaveLength(1);
    expect(winners[0].playerId).toBe(utgPlayer.id);
    expect(winners[0].amount).toBe(90); // UTG's $60 + SB $10 + BB $20

    // Verify action sequence
    const raiseAction = actions.find((a) => a.action === Action.RAISE);
    expect(raiseAction).toBeDefined();
    expect(raiseAction.amount).toBe(60);
    expect(raiseAction.playerId).toBe(utgPlayer.id);

    // Should have exactly 3 folds (Button, SB, BB)
    const foldActions = actions.filter((a) => a.action === Action.FOLD);
    expect(foldActions).toHaveLength(3);
  });
});
