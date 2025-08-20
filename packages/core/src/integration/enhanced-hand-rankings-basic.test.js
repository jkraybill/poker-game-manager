/**
 * Tests for enhanced hand:ended event with detailed rankings (#48)
 * This file tests the working scenarios: fold wins and backward compatibility
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';
import { setupEventCapture, waitForHandEnd } from '../test-utils/index.js';

// Test player that follows a simple strategy
class RankingTestPlayer extends Player {
  constructor(id, strategy = 'call') {
    super({ id, name: id });
    this.strategy = strategy;
  }

  getAction(gameState) {
    if (this.strategy === 'call') {
      if (gameState.toCall > 0) {
        return { action: Action.CALL };
      }
      return { action: Action.CHECK };
    }

    if (this.strategy === 'fold') {
      if (gameState.toCall > 0) {
        return { action: Action.FOLD };
      }
      return { action: Action.CHECK };
    }

    return { action: Action.CHECK };
  }
}

describe('Enhanced Hand Rankings in hand:ended Event (Basic)', () => {
  let manager;
  let table;
  let eventCapture;

  beforeEach(() => {
    manager = new PokerGameManager();
    table = manager.createTable({
      id: 'test-rankings',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
      simulationMode: true,
      dealerButton: 0,
    });
    eventCapture = setupEventCapture(table);
  });

  describe('Fold scenarios (working)', () => {
    it('should handle hands won by folding with enhanced structure', async () => {
      const player1 = new RankingTestPlayer('player1', 'fold'); // player1 folds to bets
      const player2 = new RankingTestPlayer('player2', 'call'); // player2 calls/checks
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const winner = eventCapture.winners[0];
      expect(winner.playerId).toBe('player2');

      // Should have enhanced structure even for fold wins
      expect(winner).toHaveProperty('handRank');
      expect(winner).toHaveProperty('handDescription');
      expect(winner).toHaveProperty('cards');
      expect(winner).toHaveProperty('holeCards');
      expect(winner).toHaveProperty('wonAmount');

      // Verify enhanced structure for fold wins
      expect(winner.handRank).toBe(null); // No hand rank for fold wins
      expect(winner.handDescription).toBe('Won by fold');
      expect(Array.isArray(winner.cards)).toBe(true);
      expect(winner.cards.length).toBe(0); // No best hand for fold wins
      expect(Array.isArray(winner.holeCards)).toBe(true);
      expect(winner.holeCards.length).toBe(2); // Player's hole cards
      expect(typeof winner.wonAmount).toBe('number');
      expect(winner.wonAmount).toBeGreaterThan(0);
    });

    it('should maintain backward compatibility with existing fields', async () => {
      const player1 = new RankingTestPlayer('player1', 'fold'); // player1 folds
      const player2 = new RankingTestPlayer('player2', 'call'); // player2 wins by fold
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const winner = eventCapture.winners[0];
      expect(winner.playerId).toBe('player2'); // player2 should win by fold

      // Legacy fields should still exist
      expect(winner).toHaveProperty('playerId');
      expect(winner).toHaveProperty('amount');
      expect(winner).toHaveProperty('hand'); // Legacy hand description
      expect(winner).toHaveProperty('cards');

      // New enhanced fields should exist
      expect(winner).toHaveProperty('handRank');
      expect(winner).toHaveProperty('handDescription');
      expect(winner).toHaveProperty('holeCards');
      expect(winner).toHaveProperty('wonAmount');

      // New and old amount fields should have same value
      expect(winner.wonAmount).toBe(winner.amount);

      // Legacy hand field should match new handDescription for fold wins
      expect(winner.hand).toBe('Won by fold');
      expect(winner.handDescription).toBe('Won by fold');
    });

    it('should include proper hole cards for fold winners', async () => {
      const player1 = new RankingTestPlayer('player1', 'fold');
      const player2 = new RankingTestPlayer('player2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const winner = eventCapture.winners[0];
      expect(winner.playerId).toBe('player2');

      // Hole cards should be actual card objects
      expect(Array.isArray(winner.holeCards)).toBe(true);
      expect(winner.holeCards.length).toBe(2);

      // Each hole card should have rank and suit
      winner.holeCards.forEach((card) => {
        expect(card).toHaveProperty('rank');
        expect(card).toHaveProperty('suit');
        expect(typeof card.rank).toBe('string');
        expect(typeof card.suit).toBe('string');
      });
    });
  });
});
