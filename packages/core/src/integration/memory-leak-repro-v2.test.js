/**
 * Memory Leak Reproduction Test (Using Test Utilities)
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

describe('Table Auto-Start Behavior (v2)', () => {
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

      let gameCount = 0;
      let handCount = 0;
      const gameStarts = [];
      const handEnds = [];

      // Simple fold strategy
      const foldStrategy = (gameState, playerId) => {
        console.log(
          `Player ${playerId} acting in game ${gameCount}, hand ${handCount}`,
        );
        return {
          playerId,
          action: Action.FOLD,
          timestamp: Date.now(),
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
      const player1 = new StrategicPlayer({
        name: 'Player 1',
        strategy: foldStrategy,
      });
      const player2 = new StrategicPlayer({
        name: 'Player 2',
        strategy: foldStrategy,
      });

      table.addPlayer(player1);
      table.addPlayer(player2);

      // Wait to see if game auto-starts (it shouldn't)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify no game started automatically
      expect(gameCount).toBe(0);

      // Now explicitly start a game
      events = setupEventCapture(table);
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

      const actions = [];
      let raisesDetected = 0;

      // Strategy that raises in first action, folds afterward
      const timingTestStrategy = (() => {
        let actionCount = 0;
        return (gameState, playerId) => {
          actionCount++;

          // First action: raise if facing big blind
          if (actionCount === 1 && gameState.currentBet === 20) {
            return {
              playerId,
              action: Action.RAISE,
              amount: 60,
              timestamp: Date.now(),
            };
          }

          // All other actions: fold
          return {
            playerId,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        };
      })();

      table.on('player:action', ({ playerId: _playerId, action, amount }) => {
        actions.push({ action, amount });
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
        strategy: timingTestStrategy,
      });
      const player2 = new StrategicPlayer({
        name: 'Player 2',
        strategy: (gameState, playerId) => ({
          playerId,
          action: Action.FOLD,
          timestamp: Date.now(),
        }),
      });

      table.addPlayer(player1);
      table.addPlayer(player2);

      // Start first game explicitly
      events = setupEventCapture(table);
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

    let gameCount = 0;
    let handEnded = false;

    const quickFoldStrategy = (gameState, playerId) => ({
      playerId,
      action: Action.FOLD,
      timestamp: Date.now(),
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

    const player1 = new StrategicPlayer({
      name: 'Player 1',
      strategy: quickFoldStrategy,
    });
    const player2 = new StrategicPlayer({
      name: 'Player 2',
      strategy: quickFoldStrategy,
    });

    table.addPlayer(player1);
    table.addPlayer(player2);

    // Start game explicitly
    events = setupEventCapture(table);
    table.tryStartGame();

    await vi.waitFor(() => handEnded, { timeout: 1000 });

    // Wait to ensure no second game starts
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(`\n✅ Final game count: ${gameCount}`);
    expect(gameCount).toBe(1); // This should pass!
  });
});