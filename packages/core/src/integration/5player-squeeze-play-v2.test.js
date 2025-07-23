/**
 * 5-Player Squeeze Play Scenario (Using Test Utilities)
 *
 * Tests an advanced poker concept called "squeeze play" where a player in the blinds
 * re-raises (squeezes) after there has been a raise and a call, exploiting the fact
 * that both opponents are likely to have weaker holdings and will fold to pressure.
 *
 * Expected flow:
 * 1. UTG (1000 chips) raises to 60
 * 2. MP (900 chips) folds to the raise
 * 3. Button (800 chips) calls the raise
 * 4. SB (600 chips) squeezes to 180 (seeing raise + call weakness)
 * 5. BB (700 chips) folds to the squeeze
 * 6. UTG folds to the squeeze
 * 7. Button folds to the squeeze
 * 8. SB wins pot (180 + 20 + 60 + 60 + 10 = 330)
 *
 * This tests:
 * - Advanced pre-flop strategy (squeeze play)
 * - lastAction tracking functionality
 * - Complex decision making based on action history
 * - Multi-way pot dynamics
 * - Fold equity exploitation
 *
 * Technical note: This test uses lastAction data to detect when there has been
 * both a raise and a call, which is the key condition for a squeeze play.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createChipStackTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  Action,
  cleanupTables,
} from '../test-utils/index.js';

describe('5-Player Squeeze Play (v2)', () => {
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

  it('should handle SB squeeze play after raise and call', async () => {
    // Create table with specific chip stacks
    // With dealerButton=0, positions will be:
    // Player 0: Button (800 chips)
    // Player 1: SB (600 chips)
    // Player 2: BB (700 chips)
    // Player 3: UTG (1000 chips)
    // Player 4: MP (900 chips)
    const chipAmounts = [800, 600, 700, 1000, 900];
    const result = createChipStackTable('standard', chipAmounts, {
      minPlayers: 5,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Create array to hold players (will be populated below)
    const players = [];

    // Create squeeze play strategy
    const squeezePlayStrategy = ({ player, gameState, myState, toCall }) => {
      // Use player ID to determine role since positions are fixed with dealerButton=0
      const playerId = player.id;
      const playerIndex = players.findIndex(p => p.id === playerId);
      
      // Map player index to their role based on the expected chip stacks
      // Player 0: Button (800 chips)
      // Player 1: SB (600 chips)
      // Player 2: BB (700 chips)
      // Player 3: UTG (1000 chips)
      // Player 4: MP (900 chips)
      
      // UTG (Player 3 with 1000 chips) raises to 60
      if (
        playerIndex === 3 &&
        gameState.currentBet === 20 &&
        !myState.hasActed
      ) {
        return { action: Action.RAISE, amount: 60 };
      }

      // MP (Player 4 with 900 chips) folds to UTG raise
      if (playerIndex === 4 && toCall > 0 && gameState.currentBet > 20) {
        return { action: Action.FOLD };
      }

      // Button (Player 0 with 800 chips) calls the raise
      if (
        playerIndex === 0 &&
        toCall > 0 &&
        toCall <= 60 &&
        gameState.currentBet === 60 &&
        !myState.hasActed
      ) {
        return { action: Action.CALL, amount: toCall };
      }

      // SB (Player 1 with 600 chips) squeezes after detecting raise and call
      if (
        playerIndex === 1 &&
        gameState.currentBet === 60 &&
        !myState.hasActed
      ) {
        // Use lastAction tracking to detect squeeze opportunity
        const playerStates = Object.values(gameState.players);
        const hasRaiser = playerStates.some(
          (p) => p.lastAction === Action.RAISE && p.bet === 60,
        );
        const hasCaller = playerStates.some(
          (p) => p.lastAction === Action.CALL && p.bet === 60,
        );

        if (hasRaiser && hasCaller) {
          return { action: Action.RAISE, amount: 180 }; // Squeeze size: 3x the original raise
        }
      }

      // Everyone folds to the squeeze
      if (toCall > 0 && gameState.currentBet >= 180) {
        return { action: Action.FOLD };
      }

      // BB (Player 2 with 700 chips) folds to any raise
      if (playerIndex === 2 && toCall > 0 && gameState.currentBet > 20) {
        return { action: Action.FOLD };
      }

      // Default: check if no bet to call
      if (toCall === 0) {
        return { action: Action.CHECK };
      }

      // Otherwise fold
      return { action: Action.FOLD };
    };

    // Create players with specific stack sizes
    const playerConfigs = [
      { name: 'Button Player', stackSize: 'button' },
      { name: 'SB Player', stackSize: 'sb' },
      { name: 'BB Player', stackSize: 'bb' },
      { name: 'UTG Player', stackSize: 'utg' },
      { name: 'MP Player', stackSize: 'mp' },
    ];

    // Populate the players array
    playerConfigs.forEach((config) => {
      const player = new StrategicPlayer({
        name: config.name,
        strategy: squeezePlayStrategy,
      });
      // Set stackSize property directly on player instance
      player.stackSize = config.stackSize;
      players.push(player);
    });

    // Add players to table
    players.forEach((p) => table.addPlayer(p));

    // Start the game
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { winners, actions } = events;

    // Debug: log actions to see what happened
    console.log('Total actions:', actions.length);
    console.log(
      'Actions:',
      actions.map((a) => ({ action: a.action, amount: a.amount })),
    );

    // Verify the squeeze play sequence occurred
    const raiseAction = actions.find(
      (a) => a.action === Action.RAISE && a.amount === 60,
    );
    const callAction = actions.find((a) => a.action === Action.CALL);
    const squeezeAction = actions.find(
      (a) => a.action === Action.RAISE && a.amount === 180,
    );

    expect(raiseAction).toBeDefined();
    expect(callAction).toBeDefined();
    expect(squeezeAction).toBeDefined();

    // Verify proper sequence: raise, then call, then squeeze
    const raiseIndex = actions.indexOf(raiseAction);
    const callIndex = actions.indexOf(callAction);
    const squeezeIndex = actions.indexOf(squeezeAction);

    expect(raiseIndex).toBeLessThan(callIndex);
    expect(callIndex).toBeLessThan(squeezeIndex);

    // After the squeeze, everyone should fold
    const actionsAfterSqueeze = actions.slice(squeezeIndex + 1);
    const foldsAfterSqueeze = actionsAfterSqueeze.filter(
      (a) => a.action === Action.FOLD,
    );
    expect(foldsAfterSqueeze.length).toBeGreaterThanOrEqual(2); // At least BB and UTG fold

    // SB (600 chip player) should win the pot
    const sbPlayer = players[1]; // Position 1 is SB
    expect(winners).toHaveLength(1);
    expect(winners[0].playerId).toBe(sbPlayer.id);

    // Verify pot calculation:
    // SB squeeze 180 + BB blind 20 + UTG raise 60 + Button call 60 + SB blind 10 = 330
    expect(winners[0].amount).toBe(330);

    // Verify we had the expected number of folds (MP, BB, UTG, Button all fold)
    const totalFolds = actions.filter((a) => a.action === Action.FOLD);
    expect(totalFolds.length).toBeGreaterThanOrEqual(4);
  });
});
