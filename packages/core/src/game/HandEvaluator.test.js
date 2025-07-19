import { describe, it, expect } from 'vitest';
import { HandEvaluator } from './HandEvaluator.js';
import { HandRank } from '../types/index.js';

describe('HandEvaluator', () => {
  describe('cardToPokersolverFormat', () => {
    it('should convert card format correctly', () => {
      expect(HandEvaluator.cardToPokersolverFormat({ rank: 'A', suit: 'spades' })).toBe('As');
      expect(HandEvaluator.cardToPokersolverFormat({ rank: '10', suit: 'hearts' })).toBe('Th'); // Pokersolver uses T for 10
      expect(HandEvaluator.cardToPokersolverFormat({ rank: 'K', suit: 'diamonds' })).toBe('Kd');
      expect(HandEvaluator.cardToPokersolverFormat({ rank: '2', suit: 'clubs' })).toBe('2c');
    });
  });

  describe('evaluate', () => {
    it('should throw error with less than 5 cards', () => {
      const cards = [
        { rank: 'A', suit: 'spades' },
        { rank: 'K', suit: 'spades' },
        { rank: 'Q', suit: 'spades' },
        { rank: 'J', suit: 'spades' }
      ];
      expect(() => HandEvaluator.evaluate(cards)).toThrow('Need at least 5 cards to evaluate');
    });

    it('should detect royal flush', () => {
      const cards = [
        { rank: 'A', suit: 'spades' },
        { rank: 'K', suit: 'spades' },
        { rank: 'Q', suit: 'spades' },
        { rank: 'J', suit: 'spades' },
        { rank: '10', suit: 'spades' },
        { rank: '2', suit: 'hearts' },
        { rank: '3', suit: 'diamonds' }
      ];
      const result = HandEvaluator.evaluate(cards);
      expect(result.rank).toBe(HandRank.ROYAL_FLUSH);
    });

    it('should detect straight flush', () => {
      const cards = [
        { rank: '9', suit: 'hearts' },
        { rank: '8', suit: 'hearts' },
        { rank: '7', suit: 'hearts' },
        { rank: '6', suit: 'hearts' },
        { rank: '5', suit: 'hearts' },
        { rank: 'A', suit: 'clubs' },
        { rank: 'K', suit: 'diamonds' }
      ];
      const result = HandEvaluator.evaluate(cards);
      expect(result.rank).toBe(HandRank.STRAIGHT_FLUSH);
    });

    it('should detect four of a kind', () => {
      const cards = [
        { rank: 'A', suit: 'spades' },
        { rank: 'A', suit: 'hearts' },
        { rank: 'A', suit: 'diamonds' },
        { rank: 'A', suit: 'clubs' },
        { rank: 'K', suit: 'spades' }
      ];
      const result = HandEvaluator.evaluate(cards);
      expect(result.rank).toBe(HandRank.FOUR_OF_A_KIND);
    });

    it('should detect full house', () => {
      const cards = [
        { rank: 'A', suit: 'spades' },
        { rank: 'A', suit: 'hearts' },
        { rank: 'A', suit: 'diamonds' },
        { rank: 'K', suit: 'clubs' },
        { rank: 'K', suit: 'spades' }
      ];
      const result = HandEvaluator.evaluate(cards);
      expect(result.rank).toBe(HandRank.FULL_HOUSE);
    });

    it('should detect flush', () => {
      const cards = [
        { rank: 'A', suit: 'spades' },
        { rank: '10', suit: 'spades' },
        { rank: '7', suit: 'spades' },
        { rank: '4', suit: 'spades' },
        { rank: '2', suit: 'spades' }
      ];
      const result = HandEvaluator.evaluate(cards);
      expect(result.rank).toBe(HandRank.FLUSH);
    });

    it('should detect straight', () => {
      const cards = [
        { rank: '9', suit: 'hearts' },
        { rank: '8', suit: 'spades' },
        { rank: '7', suit: 'diamonds' },
        { rank: '6', suit: 'clubs' },
        { rank: '5', suit: 'hearts' }
      ];
      const result = HandEvaluator.evaluate(cards);
      expect(result.rank).toBe(HandRank.STRAIGHT);
    });

    it('should detect wheel straight (A-2-3-4-5)', () => {
      const cards = [
        { rank: 'A', suit: 'hearts' },
        { rank: '2', suit: 'spades' },
        { rank: '3', suit: 'diamonds' },
        { rank: '4', suit: 'clubs' },
        { rank: '5', suit: 'hearts' }
      ];
      const result = HandEvaluator.evaluate(cards);
      expect(result.rank).toBe(HandRank.STRAIGHT);
    });

    it('should detect three of a kind', () => {
      const cards = [
        { rank: 'A', suit: 'spades' },
        { rank: 'A', suit: 'hearts' },
        { rank: 'A', suit: 'diamonds' },
        { rank: 'K', suit: 'clubs' },
        { rank: 'Q', suit: 'spades' }
      ];
      const result = HandEvaluator.evaluate(cards);
      expect(result.rank).toBe(HandRank.THREE_OF_A_KIND);
    });

    it('should detect two pair', () => {
      const cards = [
        { rank: 'A', suit: 'spades' },
        { rank: 'A', suit: 'hearts' },
        { rank: 'K', suit: 'diamonds' },
        { rank: 'K', suit: 'clubs' },
        { rank: 'Q', suit: 'spades' }
      ];
      const result = HandEvaluator.evaluate(cards);
      expect(result.rank).toBe(HandRank.TWO_PAIR);
    });

    it('should detect one pair', () => {
      const cards = [
        { rank: 'A', suit: 'spades' },
        { rank: 'A', suit: 'hearts' },
        { rank: 'K', suit: 'diamonds' },
        { rank: 'Q', suit: 'clubs' },
        { rank: 'J', suit: 'spades' }
      ];
      const result = HandEvaluator.evaluate(cards);
      expect(result.rank).toBe(HandRank.PAIR);
    });

    it('should detect high card', () => {
      const cards = [
        { rank: 'A', suit: 'spades' },
        { rank: 'K', suit: 'hearts' },
        { rank: 'Q', suit: 'diamonds' },
        { rank: 'J', suit: 'clubs' },
        { rank: '9', suit: 'spades' }
      ];
      const result = HandEvaluator.evaluate(cards);
      expect(result.rank).toBe(HandRank.HIGH_CARD);
    });

    it('should return best 5-card hand from 7 cards', () => {
      const cards = [
        // Hole cards
        { rank: 'A', suit: 'spades' },
        { rank: 'A', suit: 'hearts' },
        // Board
        { rank: 'A', suit: 'diamonds' },
        { rank: 'K', suit: 'clubs' },
        { rank: 'K', suit: 'spades' },
        { rank: '2', suit: 'hearts' },
        { rank: '3', suit: 'diamonds' }
      ];
      const result = HandEvaluator.evaluate(cards);
      expect(result.rank).toBe(HandRank.FULL_HOUSE);
      expect(result.cards).toHaveLength(5);
    });
  });

  describe('findWinners', () => {
    it('should return empty array for no players', () => {
      expect(HandEvaluator.findWinners([])).toEqual([]);
    });

    it('should return single player if only one', () => {
      const playerHands = [{
        playerData: { player: { id: 'player1' } },
        cards: [
          { rank: 'A', suit: 'spades' },
          { rank: 'K', suit: 'spades' },
          { rank: 'Q', suit: 'spades' },
          { rank: 'J', suit: 'spades' },
          { rank: '10', suit: 'spades' }
        ],
        hand: {}
      }];
      const winners = HandEvaluator.findWinners(playerHands);
      expect(winners).toHaveLength(1);
      expect(winners[0].playerData.player.id).toBe('player1');
    });

    it('should find winner with better hand', () => {
      const playerHands = [
        {
          playerData: { player: { id: 'player1' } },
          cards: [
            { rank: 'A', suit: 'spades' },
            { rank: 'A', suit: 'hearts' },
            { rank: 'K', suit: 'diamonds' },
            { rank: 'K', suit: 'clubs' },
            { rank: 'Q', suit: 'spades' }
          ]
        },
        {
          playerData: { player: { id: 'player2' } },
          cards: [
            { rank: 'J', suit: 'spades' },
            { rank: 'J', suit: 'hearts' },
            { rank: '10', suit: 'diamonds' },
            { rank: '10', suit: 'clubs' },
            { rank: '9', suit: 'spades' }
          ]
        }
      ];
      const winners = HandEvaluator.findWinners(playerHands);
      expect(winners).toHaveLength(1);
      expect(winners[0].playerData.player.id).toBe('player1');
    });

    it('should handle ties correctly', () => {
      const playerHands = [
        {
          playerData: { player: { id: 'player1' } },
          cards: [
            { rank: 'A', suit: 'spades' },
            { rank: 'K', suit: 'hearts' },
            { rank: 'Q', suit: 'diamonds' },
            { rank: 'J', suit: 'clubs' },
            { rank: '10', suit: 'spades' }
          ]
        },
        {
          playerData: { player: { id: 'player2' } },
          cards: [
            { rank: 'A', suit: 'hearts' },
            { rank: 'K', suit: 'spades' },
            { rank: 'Q', suit: 'clubs' },
            { rank: 'J', suit: 'diamonds' },
            { rank: '10', suit: 'hearts' }
          ]
        }
      ];
      const winners = HandEvaluator.findWinners(playerHands);
      expect(winners).toHaveLength(2);
      expect(winners.map(w => w.playerData.player.id).sort()).toEqual(['player1', 'player2']);
    });
  });

  describe('compareHands', () => {
    it('should return 1 when hand1 wins', () => {
      const hand1 = {
        cards: [
          { rank: 'A', suit: 'spades' },
          { rank: 'A', suit: 'hearts' },
          { rank: 'K', suit: 'diamonds' },
          { rank: 'K', suit: 'clubs' },
          { rank: 'Q', suit: 'spades' }
        ]
      };
      const hand2 = {
        cards: [
          { rank: 'J', suit: 'spades' },
          { rank: 'J', suit: 'hearts' },
          { rank: '10', suit: 'diamonds' },
          { rank: '10', suit: 'clubs' },
          { rank: '9', suit: 'spades' }
        ]
      };
      expect(HandEvaluator.compareHands(hand1, hand2)).toBe(1);
    });

    it('should return -1 when hand2 wins', () => {
      const hand1 = {
        cards: [
          { rank: 'J', suit: 'spades' },
          { rank: 'J', suit: 'hearts' },
          { rank: '10', suit: 'diamonds' },
          { rank: '10', suit: 'clubs' },
          { rank: '9', suit: 'spades' }
        ]
      };
      const hand2 = {
        cards: [
          { rank: 'A', suit: 'spades' },
          { rank: 'A', suit: 'hearts' },
          { rank: 'K', suit: 'diamonds' },
          { rank: 'K', suit: 'clubs' },
          { rank: 'Q', suit: 'spades' }
        ]
      };
      expect(HandEvaluator.compareHands(hand1, hand2)).toBe(-1);
    });

    it('should return 0 for tie', () => {
      const hand1 = {
        cards: [
          { rank: 'A', suit: 'spades' },
          { rank: 'K', suit: 'hearts' },
          { rank: 'Q', suit: 'diamonds' },
          { rank: 'J', suit: 'clubs' },
          { rank: '10', suit: 'spades' }
        ]
      };
      const hand2 = {
        cards: [
          { rank: 'A', suit: 'hearts' },
          { rank: 'K', suit: 'spades' },
          { rank: 'Q', suit: 'clubs' },
          { rank: 'J', suit: 'diamonds' },
          { rank: '10', suit: 'hearts' }
        ]
      };
      expect(HandEvaluator.compareHands(hand1, hand2)).toBe(0);
    });
  });
});