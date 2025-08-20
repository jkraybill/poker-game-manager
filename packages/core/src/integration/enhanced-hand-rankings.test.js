/**
 * Tests for enhanced hand:ended event with detailed rankings (#48)
 * Comprehensive test suite using event-based testing for enhanced winner data
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action, HandRank } from '../types/index.js';
import { RiggedDeck } from '../game/RiggedDeck.js';
import { setupEventCapture, waitForHandEnd } from '../test-utils/index.js';

// Helper function to create proper rigged deck with enough cards
function createShowdownDeck(playerCards, communityCards) {
  const cards = [
    ...playerCards, // Hole cards for all players
    'Jh', // Burn before flop
    ...communityCards.slice(0, 3), // Flop (3 cards)
    'Jc', // Burn before turn
    communityCards[3] || '9c', // Turn (1 card)
    'Jd', // Burn before river
    communityCards[4] || 'Ts', // River (1 card)
  ];
  return new RiggedDeck({ cards, dealAlternating: false });
}

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

describe('Enhanced Hand Rankings in hand:ended Event', () => {
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

  describe('Basic enhanced structure', () => {
    it('should include enhanced ranking data in winners array', async () => {
      // Set up a scenario where P1 gets a pair, P2 gets high card
      const riggedDeck = createShowdownDeck(
        ['As', 'Ad', 'Kh', '7c'], // P1 gets AA, P2 gets K7
        ['2s', '3d', '8h', '9c', 'Ts'], // Community cards
      );
      table.setDeck(riggedDeck);

      const player1 = new RankingTestPlayer('player1', 'call');
      const player2 = new RankingTestPlayer('player2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      // Use event-based testing for enhanced winner data
      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      expect(Array.isArray(eventCapture.winners)).toBe(true);
      expect(eventCapture.winners.length).toBeGreaterThan(0);

      const winner = eventCapture.winners[0];

      // Enhanced structure requirements
      expect(winner).toHaveProperty('playerId');
      expect(winner).toHaveProperty('handRank');
      expect(winner).toHaveProperty('handDescription');
      expect(winner).toHaveProperty('cards');
      expect(winner).toHaveProperty('holeCards');
      expect(winner).toHaveProperty('wonAmount');

      // Backward compatibility
      expect(winner).toHaveProperty('amount'); // Should still exist

      // Type validation
      expect(typeof winner.playerId).toBe('string');
      expect(typeof winner.handRank).toBe('number');
      expect(typeof winner.handDescription).toBe('string');
      expect(Array.isArray(winner.cards)).toBe(true);
      expect(Array.isArray(winner.holeCards)).toBe(true);
      expect(typeof winner.wonAmount).toBe('number');
      expect(typeof winner.amount).toBe('number');

      // Structure validation
      expect(winner.cards.length).toBe(5); // Best 5-card hand
      expect(winner.holeCards.length).toBe(2); // Player's hole cards
      expect(winner.wonAmount).toBe(winner.amount); // Should be same value
    });

    it('should include correct hand ranking for pair of aces', async () => {
      const riggedDeck = createShowdownDeck(
        ['As', 'Ad', 'Kh', '7c'], // P1 gets AA, P2 gets K7
        ['2s', '3d', '8h', '9c', 'Ts'], // Community cards
      );
      table.setDeck(riggedDeck);

      const player1 = new RankingTestPlayer('player1', 'call');
      const player2 = new RankingTestPlayer('player2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const winner = eventCapture.winners[0];
      expect(winner.playerId).toBe('player1'); // P1 should win with AA
      expect(winner.handRank).toBe(HandRank.PAIR);
      expect(winner.handDescription.toLowerCase()).toContain('pair');
      expect(winner.handDescription.toLowerCase()).toContain('a'); // 'pair, a's' contains 'a'

      // Verify hole cards
      expect(winner.holeCards).toMatchObject([
        { rank: 'A', suit: 's' },
        { rank: 'A', suit: 'd' },
      ]);

      // Verify best 5-card hand includes the pair
      const handRanks = winner.cards.map((card) => card.rank);
      expect(handRanks.filter((rank) => rank === 'A')).toHaveLength(2);
    });
  });

  describe('Different hand types', () => {
    it('should correctly rank high card hands', async () => {
      const riggedDeck = createShowdownDeck(
        ['Ah', '3c', 'Kh', '7c'], // P1 gets A3, P2 gets K7
        ['2s', '5d', '8h', '9c', 'Ts'], // Community cards
      );
      table.setDeck(riggedDeck);

      const player1 = new RankingTestPlayer('player1', 'call');
      const player2 = new RankingTestPlayer('player2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const winner = eventCapture.winners[0];
      expect(winner.playerId).toBe('player1'); // P1 should win with ace high
      expect(winner.handRank).toBe(HandRank.HIGH_CARD);
      expect(winner.handDescription.toLowerCase()).toContain('high');
    });

    it('should correctly rank two pair', async () => {
      const riggedDeck = createShowdownDeck(
        ['As', '8c', 'Kh', '7c'], // P1 gets A8, P2 gets K7
        ['2s', 'Ad', '8h', '9c', 'Ts'], // Community: 2, A, 8, 9, T (gives P1 two pair A's and 8's)
      );
      table.setDeck(riggedDeck);

      const player1 = new RankingTestPlayer('player1', 'call');
      const player2 = new RankingTestPlayer('player2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const winner = eventCapture.winners[0];
      expect(winner.playerId).toBe('player1');
      expect(winner.handRank).toBe(HandRank.TWO_PAIR);
      expect(winner.handDescription.toLowerCase()).toContain('two pair');
    });

    it('should correctly rank three of a kind', async () => {
      const riggedDeck = createShowdownDeck(
        ['As', 'Ac', 'Kh', '7c'], // P1 gets AA, P2 gets K7
        ['2s', 'Ad', '8h', '9c', 'Ts'], // Community: 2, A, 8, 9, T (gives P1 three aces)
      );
      table.setDeck(riggedDeck);

      const player1 = new RankingTestPlayer('player1', 'call');
      const player2 = new RankingTestPlayer('player2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const winner = eventCapture.winners[0];
      expect(winner.playerId).toBe('player1');
      expect(winner.handRank).toBe(HandRank.THREE_OF_A_KIND);
      expect(winner.handDescription.toLowerCase()).toContain('three of a kind');
    });

    it('should correctly rank straight', async () => {
      const riggedDeck = createShowdownDeck(
        ['5s', '6c', 'Kh', '7c'], // P1 gets 56, P2 gets K7
        ['2s', '3d', '4h', '7h', '8s'], // Community: 2, 3, 4, 7, 8 (gives P1 straight 2-6)
      );
      table.setDeck(riggedDeck);

      const player1 = new RankingTestPlayer('player1', 'call');
      const player2 = new RankingTestPlayer('player2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const winner = eventCapture.winners[0];
      expect(winner.playerId).toBe('player1');
      expect(winner.handRank).toBe(HandRank.STRAIGHT);
      expect(winner.handDescription.toLowerCase()).toContain('straight');
    });

    it('should correctly rank flush', async () => {
      const riggedDeck = createShowdownDeck(
        ['As', '5s', 'Kh', '7c'], // P1 gets A5 spades, P2 gets K7 off-suit
        ['2s', '8s', '9s', 'Jc', 'Td'], // Community: 2s, 8s, 9s, J, T (gives P1 flush in spades)
      );
      table.setDeck(riggedDeck);

      const player1 = new RankingTestPlayer('player1', 'call');
      const player2 = new RankingTestPlayer('player2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const winner = eventCapture.winners[0];
      expect(winner.playerId).toBe('player1');
      expect(winner.handRank).toBe(HandRank.FLUSH);
      expect(winner.handDescription.toLowerCase()).toContain('flush');
    });

    it('should correctly rank full house', async () => {
      const riggedDeck = createShowdownDeck(
        ['As', 'Ac', 'Kh', '7c'], // P1 gets AA, P2 gets K7
        ['2s', 'Ad', '2h', '2c', 'Ts'], // Community: 2, A, 2, 2, T (gives P1 full house A's over 2's)
      );
      table.setDeck(riggedDeck);

      const player1 = new RankingTestPlayer('player1', 'call');
      const player2 = new RankingTestPlayer('player2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const winner = eventCapture.winners[0];
      expect(winner.playerId).toBe('player1');
      expect(winner.handRank).toBe(HandRank.FULL_HOUSE);
      expect(winner.handDescription.toLowerCase()).toContain('full house');
    });

    it('should correctly rank four of a kind', async () => {
      const riggedDeck = createShowdownDeck(
        ['As', 'Ac', 'Kh', '7c'], // P1 gets AA, P2 gets K7
        ['2s', 'Ad', 'Ah', '9c', 'Ts'], // Community: 2, A, A, 9, T (gives P1 quad aces)
      );
      table.setDeck(riggedDeck);

      const player1 = new RankingTestPlayer('player1', 'call');
      const player2 = new RankingTestPlayer('player2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const winner = eventCapture.winners[0];
      expect(winner.playerId).toBe('player1');
      expect(winner.handRank).toBe(HandRank.FOUR_OF_A_KIND);
      expect(winner.handDescription.toLowerCase()).toContain('four of a kind');
    });

    it('should correctly rank straight flush', async () => {
      const riggedDeck = createShowdownDeck(
        ['5s', '6s', 'Kh', '7c'], // P1 gets 56 spades, P2 gets K7
        ['2s', '3s', '4s', '7h', 'Td'], // Community: 2s, 3s, 4s, 7, T (gives P1 straight flush 2-6 spades)
      );
      table.setDeck(riggedDeck);

      const player1 = new RankingTestPlayer('player1', 'call');
      const player2 = new RankingTestPlayer('player2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const winner = eventCapture.winners[0];
      expect(winner.playerId).toBe('player1');
      expect(winner.handRank).toBe(HandRank.STRAIGHT_FLUSH);
      expect(winner.handDescription.toLowerCase()).toContain('straight flush');
    });
  });

  describe('Edge cases and special scenarios', () => {
    it('should handle split pots with same hand ranking', async () => {
      // Both players get the same pair
      const riggedDeck = createShowdownDeck(
        ['As', 'Kc', 'Ah', 'Kd'], // P1 gets AK, P2 gets AK (same hand)
        ['2s', '3d', '8h', '9c', 'Ts'], // Community cards
      );
      table.setDeck(riggedDeck);

      const player1 = new RankingTestPlayer('player1', 'call');
      const player2 = new RankingTestPlayer('player2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      // Both players should be winners in a split pot
      expect(eventCapture.winners.length).toBeGreaterThan(0);

      // Each winner should have enhanced ranking data
      eventCapture.winners.forEach((winner) => {
        expect(winner).toHaveProperty('handRank');
        expect(winner).toHaveProperty('handDescription');
        expect(winner).toHaveProperty('cards');
        expect(winner).toHaveProperty('holeCards');
        expect(winner).toHaveProperty('wonAmount');
        expect(winner.handRank).toBe(HandRank.HIGH_CARD); // AK high
      });
    });

    it('should handle hands won by folding', async () => {
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

      // Should still have enhanced structure even for fold wins
      expect(winner).toHaveProperty('handRank');
      expect(winner).toHaveProperty('handDescription');
      expect(winner).toHaveProperty('cards');
      expect(winner).toHaveProperty('holeCards');
      expect(winner).toHaveProperty('wonAmount');

      // For fold wins, handRank should be null
      expect(winner.handRank).toBe(null);
      expect(winner.handDescription).toBe('Won by fold');
      expect(Array.isArray(winner.holeCards)).toBe(true);
      expect(winner.holeCards.length).toBe(2);
    });

    it('should maintain backward compatibility with existing fields', async () => {
      const player1 = new RankingTestPlayer('player1', 'fold');
      const player2 = new RankingTestPlayer('player2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const winner = eventCapture.winners[0];

      // Legacy fields should still exist
      expect(winner).toHaveProperty('playerId');
      expect(winner).toHaveProperty('amount');
      expect(winner).toHaveProperty('hand'); // Legacy hand description
      expect(winner).toHaveProperty('cards');

      // New and old amount fields should have same value
      expect(winner.wonAmount).toBe(winner.amount);
    });
  });

  describe('Multi-player scenarios', () => {
    it('should handle three-player showdown with different rankings', async () => {
      const riggedDeck = createShowdownDeck(
        ['As', 'Ad', 'Kh', 'Qc', '8s', '8d'], // P1 gets AA (pair), P2 gets KQ (high card), P3 gets 88 (pair, but lower)
        ['2s', '3h', '7c', '9d', 'Ts'], // Community
      );
      table.setDeck(riggedDeck);

      const player1 = new RankingTestPlayer('player1', 'call');
      const player2 = new RankingTestPlayer('player2', 'call');
      const player3 = new RankingTestPlayer('player3', 'call');
      player1.chips = 1000;
      player2.chips = 1000;
      player3.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);
      table.addPlayer(player3);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const winner = eventCapture.winners[0];
      expect(winner.playerId).toBe('player1'); // P1 should win with AA
      expect(winner.handRank).toBe(HandRank.PAIR);
      expect(winner.handDescription.toLowerCase()).toContain('pair');
      expect(winner.handDescription.toLowerCase()).toContain('a'); // 'pair, a's' contains 'a'
    });
  });
});
