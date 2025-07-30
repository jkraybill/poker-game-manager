/**
 * 3-Player Button Raises Blinds Fold Test (Using Test Utilities)
 *
 * Tests a simple 3-player scenario where:
 * 1. Button raises to $100
 * 2. Small blind folds
 * 3. Big blind folds
 * 4. Button wins the pot
 *
 * This tests basic positional raising and folding.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  Action,
  cleanupTables,
} from '../test-utils/index.js';

describe('3-player: Button raises, blinds fold (v2)', () => {
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

  it('should handle Button raising to $100 and both blinds folding', async () => {
    // Create 3-player table
    const result = createTestTable('standard', {
      minPlayers: 3,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Positional raise strategy
    const positionalRaiseStrategy = ({ gameState, myState, toCall }) => {
      // Only raise if we're first to act and facing just the big blind
      if (gameState.currentBet === 20 && myState.bet === 0) {
        return { action: Action.RAISE, amount: 100 };
      }

      // Fold to raises if we're not the raiser
      if (gameState.currentBet > 20 && toCall > 0) {
        return { action: Action.FOLD };
      }

      // Otherwise call/check
      if (toCall > 0) {
        const callAmount = Math.min(toCall, myState.chips);
        return {
          action: callAmount === myState.chips ? Action.ALL_IN : Action.CALL,
          amount: callAmount,
        };
      }

      return { action: Action.CHECK };
    };

    // Create players with the same strategy
    // Button will raise, blinds will fold
    const players = Array.from(
      { length: 3 },
      (_, i) =>
        new StrategicPlayer({
          name: `Player ${i + 1}`,
          strategy: positionalRaiseStrategy,
        }),
    );

    // Track positions and button player
    let buttonPlayer = null;
    const positions = {};

    table.on('hand:started', ({ dealerButton }) => {
      const sbPos = (dealerButton + 1) % 3;
      const bbPos = (dealerButton + 2) % 3;

      positions[dealerButton] = 'Button/UTG';
      positions[sbPos] = 'Small Blind';
      positions[bbPos] = 'Big Blind';

      buttonPlayer = players[dealerButton];
    });

    // Add players and start
    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { winners, actions } = events;

    // Verify the button player won
    expect(winners).toHaveLength(1);
    expect(winners[0].playerId).toBe(buttonPlayer.id);
    expect(winners[0].amount).toBe(130); // Button's $100 + SB's $10 + BB's $20

    // Verify action sequence
    const raiseAction = actions.find((a) => a.action === Action.RAISE);
    expect(raiseAction).toBeDefined();
    expect(raiseAction.amount).toBe(100);
    expect(raiseAction.playerId).toBe(buttonPlayer.id);

    const foldActions = actions.filter((a) => a.action === Action.FOLD);
    expect(foldActions).toHaveLength(2);

    // Verify blinds folded
    const sbPlayer = players[(0 + 1) % 3];
    const bbPlayer = players[(0 + 2) % 3];
    expect(foldActions.some((a) => a.playerId === sbPlayer.id)).toBe(true);
    expect(foldActions.some((a) => a.playerId === bbPlayer.id)).toBe(true);
  });
});
