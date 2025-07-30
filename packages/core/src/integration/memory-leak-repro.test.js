/**
 * Memory Leak Reproduction Test
 *
 * This test demonstrates the timing and memory leak issues
 * caused by automatic game restarts in the Table class.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('Table Auto-Start Behavior', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach((table) => table.close());
  });

  it(
    'should NOT auto-start games anymore - requires explicit start',
    { timeout: 10000 },
    async () => {
      const table = manager.createTable({
        blinds: { small: 10, big: 20 },
        minBuyIn: 1000,
        maxBuyIn: 1000,
        minPlayers: 2,
      });

      let gameCount = 0;
      let handCount = 0;
      const gameStarts = [];
      const handEnds = [];

      // Simple player that just folds
      class LeakyPlayer extends Player {
        getAction(_gameState) {
          console.log(
            `Player ${this.id} acting in game ${gameCount}, hand ${handCount}`,
          );
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }
      }

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
        new LeakyPlayer({ name: 'Player 1' }),
        new LeakyPlayer({ name: 'Player 2' }),
      ];
      players.forEach((p) => table.addPlayer(p));

      // Wait to see if game auto-starts (it shouldn't)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify no game started automatically
      expect(gameCount).toBe(0);

      // Now explicitly start a game
      table.tryStartGame();

      // Create promise to wait for hand end
      const handResult = new Promise((resolve) => {
        table.once('hand:ended', () => {
          resolve();
        });
      });

      // Wait for game to complete
      await handResult;

      // Wait a bit to see if another game starts automatically
      console.log('⏳ Waiting 1 second to verify no automatic restart...');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log('\n📊 Final stats:');
      console.log(`Games started: ${gameCount}`);
      console.log(`Hands ended: ${handCount}`);

      // With the fix, we should have exactly 1 game (no auto-restart)
      expect(gameCount).toBe(1);
      expect(handCount).toBe(1);

      table.close();
    },
  );

  it(
    'should show why tests capture actions from multiple games',
    { timeout: 10000 },
    async () => {
      const table = manager.createTable({
        blinds: { small: 10, big: 20 },
        minBuyIn: 1000,
        maxBuyIn: 1000,
        minPlayers: 2,
      });

      const actions = [];
      let raisesDetected = 0;

      // Player that raises in first game, folds in subsequent games
      class TimingTestPlayer extends Player {
        constructor(config) {
          super(config);
          this.gameCount = 0;
        }

        getAction(gameState) {
          this.gameCount++;

          // First game: raise
          if (this.gameCount === 1 && gameState.currentBet === 20) {
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 60,
              timestamp: Date.now(),
            };
          }

          // All other games/situations: fold
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }
      }

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
      const player1 = new TimingTestPlayer({ name: 'Player 1' });
      const player2 = new TimingTestPlayer({ name: 'Player 2' });
      table.addPlayer(player1);
      table.addPlayer(player2);

      // Start first game explicitly
      table.tryStartGame();

      // Create promise to wait for first hand to end
      const handResult = new Promise((resolve) => {
        table.once('hand:ended', () => {
          resolve();
        });
      });

      // Wait for first game to complete
      await handResult;

      // Wait to see if another game starts automatically
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log('\n🔍 Actions captured after 6 seconds:');
      console.log(`Total actions: ${actions.length}`);
      console.log(`Raises: ${raisesDetected}`);

      // With the fix, we should only have actions from the first game
      console.log(
        '\n✅  No more automatic restarts - only explicit game starts!',
      );

      table.close();

      // We should have exactly 2 actions (first game: raise + fold = 2)
      expect(actions.length).toBe(2);
      expect(raisesDetected).toBe(1);
    },
  );

  it('should show how to prevent the leak with immediate table close', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
    });

    let gameCount = 0;
    let handEnded = false;

    class QuickPlayer extends Player {
      getAction(_gameState) {
        return {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now(),
        };
      }
    }

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
      new QuickPlayer({ name: 'Player 1' }),
      new QuickPlayer({ name: 'Player 2' }),
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
