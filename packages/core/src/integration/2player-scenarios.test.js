/**
 * 2-Player (Heads-Up) Poker Scenarios
 * 
 * Tests specific to heads-up play where one player is SB/Button and the other is BB.
 * These scenarios test the fundamental mechanics of poker betting in the simplest format.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

describe('2-Player (Heads-Up) Scenarios', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    // Clean up any open tables
    manager.tables.forEach(table => table.close());
  });

  describe('Basic heads-up mechanics', () => {
    it('should handle SB/Button folding to BB', async () => {
      const table = manager.createTable({
        blinds: { small: 10, big: 20 },
        minBuyIn: 1000,
        maxBuyIn: 1000,
        minPlayers: 2,
        dealerButton: 0, // Deterministic for testing
      });

      const sbPlayer = new AlwaysFoldPlayer({ name: 'SB/Button' });
      const bbPlayer = new AlwaysFoldPlayer({ name: 'Big Blind' });

      // Track dealer button position
      let dealerButtonPos = -1;
      table.on('hand:started', ({ dealerButton }) => {
        dealerButtonPos = dealerButton;
      });

      // Create a promise that resolves when hand ends
      const handEndPromise = new Promise((resolve) => {
        table.on('hand:ended', ({ winners }) => {
          resolve({
            winnerId: winners[0]?.playerId,
            winnerAmount: winners[0]?.amount,
            dealerButton: dealerButtonPos,
          });
        });
      });

      // Track actions
      const actions = [];
      table.on('player:action', ({ playerId, action, amount }) => {
        actions.push({ playerId, action, amount });
      });

      // Add players
      table.addPlayer(sbPlayer);
      table.addPlayer(bbPlayer);

      // Wait for hand to complete
      const { winnerId, winnerAmount, dealerButton } = await handEndPromise;

      // In heads-up, if dealerButton is 0, then player at position 0 is SB/Button
      // and player at position 1 is BB
      const expectedWinner = dealerButton === 0 ? bbPlayer : sbPlayer;

      // Verify results
      expect(winnerId).toBe(expectedWinner.id);
      expect(winnerAmount).toBe(30); // SB $10 + BB $20
      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe(Action.FOLD);
      
      // In heads-up, the SB/Button should fold
      const actualSbPlayer = dealerButton === 0 ? sbPlayer : bbPlayer;
      expect(actions[0].playerId).toBe(actualSbPlayer.id);

      table.close();
    });
  });
});