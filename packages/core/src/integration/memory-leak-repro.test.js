/**
 * Memory Leak Reproduction Test
 *
 * This test demonstrates the timing and memory leak issues
 * caused by automatic game restarts in the Table class.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  StrategicPlayer,
  cleanupTables,
  waitForHandEnd,
  Action,
} from '../test-utils/index.js';

describe('Table Auto-Start Behavior', () => {
  let manager, table, events;

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

  it(
    'should NOT auto-start games anymore - requires explicit start',
    { timeout: 10000 },
    async () => {
      ({ manager, table } = createTestTable('standard', {
        blinds: { small: 10, big: 20 },
        minBuyIn: 1000,
        maxBuyIn: 1000,
        minPlayers: 2,
      }));
      events = setupEventCapture(table);

      let gameCount = 0;
      let handCount = 0;
      const gameStarts = [];
      const handEnds = [];

      // Simple strategy that just folds
      const foldStrategy = ({ player }) => {
        console.log(
          `Player ${player.id} acting in game ${gameCount}, hand ${handCount}`,
        );
        return {
          action: Action.FOLD,
        };
      };

      table.on('game:started', () => {
        gameCount++;
        gameStarts.push(Date.now());
        console.log(`🎮 Game ${gameCount} started`);
      });

      table.on('hand:ended', ({ winners: _winners }) => {
        handCount++;
        handEnds.push(Date.now());
        console.log(`🏁 Hand ${handCount} ended`);

        // Log the automatic restart timer
        console.log('⏰ 5-second timer started for next game...');
      });

      // Add two players
      const players = [
        new StrategicPlayer({ name: 'Player 1', strategy: foldStrategy }),
        new StrategicPlayer({ name: 'Player 2', strategy: foldStrategy }),
      ];
      players.forEach((p) => table.addPlayer(p));

      // Wait to see if game auto-starts (it shouldn't)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify no game started automatically
      expect(gameCount).toBe(0);

      // Now explicitly start a game
      table.tryStartGame();

      // Wait for game to complete
      await waitForHandEnd(events);

      // Wait a bit to see if another game starts automatically
      console.log('⏳ Waiting 1 second to verify no automatic restart...');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log('\n📊 Final stats:');
      console.log(`Games started: ${gameCount}`);
      console.log(`Hands ended: ${handCount}`);

      // With the fix, we should have exactly 1 game (no auto-restart)
      expect(gameCount).toBe(1);
      expect(handCount).toBe(1);

    },
  );

  it(
    'should show why tests capture actions from multiple games',
    { timeout: 10000 },
    async () => {
      ({ manager, table } = createTestTable('standard', {
        blinds: { small: 10, big: 20 },
        minBuyIn: 1000,
        maxBuyIn: 1000,
        minPlayers: 2,
      }));
      events = setupEventCapture(table);

      const actions = [];
      let raisesDetected = 0;

      // Strategy that raises in first action, folds in subsequent actions
      const createTimingStrategy = () => {
        let actionCount = 0;
        return ({ gameState, player }) => {
          actionCount++;
          console.log(`📊 Strategy called: actionCount=${actionCount}, currentBet=${gameState.currentBet}, playerId=${player.id}`);

          // First action when facing big blind: raise
          if (actionCount === 1 && gameState.currentBet === 20) {
            console.log('🎲 Returning RAISE action');
            return {
              action: Action.RAISE,
              amount: 60,
            };
          }

          // All other situations: fold
          return {
            action: Action.FOLD,
          };
        };
      };

      table.on('player:action', ({ playerId: _playerId, action, amount }) => {
        actions.push({ action, amount });
        console.log(`📍 Action detected: ${action}, amount: ${amount}`);
        if (action === Action.RAISE) {
          raisesDetected++;
          console.log(`🎯 Raise detected! Total raises: ${raisesDetected}`);
        }
      });

      table.on('hand:ended', () => {
        console.log(`🏁 Hand ended. Total actions so far: ${actions.length}`);
      });

      // Add players
      const player1 = new StrategicPlayer({ 
        name: 'Player 1', 
        strategy: createTimingStrategy(), 
      });
      const player2 = new StrategicPlayer({ 
        name: 'Player 2', 
        strategy: createTimingStrategy(), 
      });
      table.addPlayer(player1);
      table.addPlayer(player2);

      // Start first game explicitly
      table.tryStartGame();

      // Wait for first game to complete
      await waitForHandEnd(events);

      // Wait to see if another game starts automatically
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log('\n🔍 Actions captured after 1 second:');
      console.log(`Total actions: ${actions.length}`);
      console.log(`Raises: ${raisesDetected}`);

      // With the fix, we should only have actions from the first game
      console.log(
        '\n✅  No more automatic restarts - only explicit game starts!',
      );

      // We should have exactly 2 actions (first game: raise + fold = 2)
      expect(actions.length).toBe(2);
      expect(raisesDetected).toBe(1);
    },
  );

  it('should show how to prevent the leak with immediate table close', async () => {
    ({ manager, table } = createTestTable('standard', {
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
    }));
    events = setupEventCapture(table);

    let gameCount = 0;
    let handEnded = false;

    // Quick fold strategy
    const quickFoldStrategy = () => ({
      action: Action.FOLD,
    });

    table.on('game:started', () => {
      gameCount++;
      console.log(`✅ Game ${gameCount} started`);
    });

    table.on('hand:ended', () => {
      if (!handEnded) {
        handEnded = true;
        console.log('✅ Hand ended, immediately closing table');
        table.close(); // Close immediately to prevent restart
      }
    });

    const players = [
      new StrategicPlayer({ name: 'Player 1', strategy: quickFoldStrategy }),
      new StrategicPlayer({ name: 'Player 2', strategy: quickFoldStrategy }),
    ];
    players.forEach((p) => table.addPlayer(p));

    // Start game explicitly
    table.tryStartGame();

    await vi.waitFor(() => handEnded, { timeout: 1000 });

    // Wait to ensure no second game starts
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(`\n✅ Final game count: ${gameCount}`);
    expect(gameCount).toBe(1); // This should pass!
  });
});
