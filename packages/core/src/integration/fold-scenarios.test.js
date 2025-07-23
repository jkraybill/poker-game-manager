/**
 * Fold Scenarios
 *
 * Tests for scenarios where all players fold, testing the basic mechanics
 * of blind posting and automatic wins by the big blind.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

// Simple test player that always folds to any bet
class AlwaysFoldPlayer extends Player {
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

describe('Fold Scenarios', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    // Clean up any open tables
    manager.tables.forEach((table) => table.close());
  });

  describe('All players fold', () => {
    it('should handle all 3 players folding to big blind', async () => {
      const table = manager.createTable({
        blinds: { small: 10, big: 20 },
        minBuyIn: 1000,
        maxBuyIn: 1000,
        dealerButton: 0, // Deterministic for testing
      });

      // Track results
      let gameStarted = false;
      let handEnded = false;
      let winnerId = null;
      let winnerAmount = 0;
      let dealerButton = -1;

      // Set up event listeners BEFORE adding players
      table.on('game:started', () => {
        gameStarted = true;
      });

      table.on('hand:started', ({ dealerButton: db }) => {
        dealerButton = db;
      });

      table.on('hand:ended', ({ winners }) => {
        if (!handEnded) {
          handEnded = true;
          if (winners && winners.length > 0) {
            winnerId = winners[0].playerId;
            winnerAmount = winners[0].amount;
          }
          setTimeout(() => table.close(), 100);
        }
      });

      const player1 = new AlwaysFoldPlayer({ name: 'Player 1' });
      const player2 = new AlwaysFoldPlayer({ name: 'Player 2' });
      const player3 = new AlwaysFoldPlayer({ name: 'Player 3' });

      // Add players and start game
      table.addPlayer(player1);
      table.addPlayer(player2);
      table.addPlayer(player3);
      table.tryStartGame();

      // Wait for game to start
      await vi.waitFor(() => gameStarted, {
        timeout: 1000,
        interval: 50,
      });

      // Wait for dealer button to be set
      await vi.waitFor(() => dealerButton >= 0, {
        timeout: 500,
        interval: 50,
      });

      // Wait for hand to complete
      await vi.waitFor(() => handEnded, { timeout: 1000 });

      // Wait a bit for all processing to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Big blind should win (when everyone folds, BB wins by default)
      const players = [player1, player2, player3];
      const bbPos = (dealerButton + 2) % 3;
      const bbPlayer = players[bbPos];

      expect(winnerId).toBe(bbPlayer.id);
      expect(winnerAmount).toBe(30); // SB $10 + BB $20

      table.close();
    });
  });
});
