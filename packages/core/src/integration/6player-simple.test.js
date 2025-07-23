import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('6-Player Simple Test', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach((table) => table.close());
  });

  it('should complete a simple 6-player game', { timeout: 10000 }, async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 6,
      dealerButton: 0, // Deterministic for testing
    });

    let gameStarted = false;
    let handEnded = false;
    let actionCount = 0;
    let errorOccurred = null;

    // Simple fold-only players
    class FoldPlayer extends Player {
      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        if (toCall > 0) {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }

        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('player:action', () => {
      actionCount++;
    });

    table.on('hand:ended', ({ winners }) => {
      if (!handEnded && winners && winners.length > 0) {
        handEnded = true;
      }
    });

    table.on('error', (error) => {
      errorOccurred = error;
    });

    table.on('game:error', (error) => {
      errorOccurred = error;
    });

    // Add 6 players
    for (let i = 0; i < 6; i++) {
      table.addPlayer(
        new FoldPlayer({
          name: `Player ${i + 1}`,
        }),
      );
    }
    table.tryStartGame();

    // Wait for game to start
    await vi.waitFor(() => gameStarted, { timeout: 1000 });

    if (errorOccurred) {
      throw new Error(`Game error occurred: ${errorOccurred}`);
    }

    // Wait for hand to end
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Hand did not end in time'));
      }, 5000);

      const checkInterval = setInterval(() => {
        if (handEnded) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });

    expect(gameStarted).toBe(true);
    expect(handEnded).toBe(true);
    expect(actionCount).toBeGreaterThan(0);
  });
});
