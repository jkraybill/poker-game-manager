import { describe, it, expect } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

/**
 * Performance test to ensure no setTimeout delays in hand processing
 * This test ensures we don't regress on the performance fix for v4.0.3
 */
describe('Performance - No setTimeout Regression', () => {
  it('should complete 50 hands in under 2 seconds', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
    });

    // Simple player that makes instant decisions
    class FastPlayer extends Player {
      // eslint-disable-next-line require-await
      async getAction(gameState) {
        const toCall = gameState.currentBet - gameState.players[this.id].bet;

        // Vary actions to create realistic game flow
        const rand = Math.random();
        if (rand < 0.3 && toCall > 0) {
          return { action: Action.FOLD };
        }
        if (toCall > 0) {
          return { action: Action.CALL };
        }
        return { action: Action.CHECK };
      }
    }

    const player1 = new FastPlayer({ id: 'p1', name: 'Fast 1' });
    const player2 = new FastPlayer({ id: 'p2', name: 'Fast 2' });

    player1.chips = 10000;
    player2.chips = 10000;

    table.addPlayer(player1);
    table.addPlayer(player2);

    let handsCompleted = 0;
    const targetHands = 50;

    table.on('hand:ended', () => {
      handsCompleted++;
      // Auto-start next hand
      if (handsCompleted < targetHands) {
        setImmediate(async () => {
          const result = await table.tryStartGame();
          if (!result.success) {
            console.error('Failed to start next hand:', result.reason);
          }
        });
      }
    });

    const startTime = Date.now();

    // Start first game
    const startResult = await table.tryStartGame();
    expect(startResult.success).toBe(true);

    // Wait for all hands to complete
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (handsCompleted >= targetHands) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 10);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });

    const elapsed = Date.now() - startTime;
    const timePerHand = elapsed / handsCompleted;

    console.log(`Completed ${handsCompleted} hands in ${elapsed}ms`);
    console.log(`Average time per hand: ${timePerHand.toFixed(1)}ms`);

    // Verify performance
    expect(handsCompleted).toBe(targetHands);
    expect(elapsed).toBeLessThan(2000); // Should complete in under 2 seconds
    expect(timePerHand).toBeLessThan(40); // Each hand should take < 40ms

    // Clean up
    table.close();
  });
});
