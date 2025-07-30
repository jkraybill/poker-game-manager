import { describe, it, expect } from 'vitest'
import { HandEvaluator } from './HandEvaluator.js'
import { HandRank } from '../types/index.js'

// Helper to create card objects
const card = (rank, suit) => ({
  rank,
  suit,
  toString() {
    return `${this.rank}${this.suit}`
  },
})

describe('HandEvaluator', () => {
  describe('cardToPokersolverFormat', () => {
    it('should convert card format correctly', () => {
      const card1 = {
        rank: 'A',
        suit: 's',
        toString() {
          return `${this.rank}${this.suit}`
        },
      }
      const card2 = {
        rank: 'T',
        suit: 'h',
        toString() {
          return `${this.rank}${this.suit}`
        },
      }
      const card3 = {
        rank: 'K',
        suit: 'd',
        toString() {
          return `${this.rank}${this.suit}`
        },
      }
      const card4 = {
        rank: '2',
        suit: 'c',
        toString() {
          return `${this.rank}${this.suit}`
        },
      }

      expect(HandEvaluator.cardToPokersolverFormat(card1)).toBe('As')
      expect(HandEvaluator.cardToPokersolverFormat(card2)).toBe('Th') // Pokersolver uses T for 10
      expect(HandEvaluator.cardToPokersolverFormat(card3)).toBe('Kd')
      expect(HandEvaluator.cardToPokersolverFormat(card4)).toBe('2c')
    })
  })

  describe('evaluate', () => {
    it('should throw error with less than 5 cards', () => {
      const cards = [
        card('A', 's'),
        card('K', 's'),
        card('Q', 's'),
        card('J', 's'),
      ]
      expect(() => HandEvaluator.evaluate(cards)).toThrow(
        'Need at least 5 cards to evaluate'
      )
    })

    it('should detect royal flush', () => {
      const cards = [
        card('A', 's'),
        card('K', 's'),
        card('Q', 's'),
        card('J', 's'),
        card('T', 's'),
        card('2', 'h'),
        card('3', 'd'),
      ]
      const result = HandEvaluator.evaluate(cards)
      expect(result.rank).toBe(HandRank.ROYAL_FLUSH)
    })

    it('should detect straight flush', () => {
      const cards = [
        card('9', 'h'),
        card('8', 'h'),
        card('7', 'h'),
        card('6', 'h'),
        card('5', 'h'),
        card('A', 'c'),
        card('K', 'd'),
      ]
      const result = HandEvaluator.evaluate(cards)
      expect(result.rank).toBe(HandRank.STRAIGHT_FLUSH)
    })

    it('should detect four of a kind', () => {
      const cards = [
        card('A', 's'),
        card('A', 'h'),
        card('A', 'd'),
        card('A', 'c'),
        card('K', 's'),
      ]
      const result = HandEvaluator.evaluate(cards)
      expect(result.rank).toBe(HandRank.FOUR_OF_A_KIND)
    })

    it('should detect full house', () => {
      const cards = [
        card('A', 's'),
        card('A', 'h'),
        card('A', 'd'),
        card('K', 'c'),
        card('K', 's'),
      ]
      const result = HandEvaluator.evaluate(cards)
      expect(result.rank).toBe(HandRank.FULL_HOUSE)
    })

    it('should detect flush', () => {
      const cards = [
        card('A', 's'),
        card('T', 's'),
        card('7', 's'),
        card('4', 's'),
        card('2', 's'),
      ]
      const result = HandEvaluator.evaluate(cards)
      expect(result.rank).toBe(HandRank.FLUSH)
    })

    it('should detect straight', () => {
      const cards = [
        card('9', 'h'),
        card('8', 's'),
        card('7', 'd'),
        card('6', 'c'),
        card('5', 'h'),
      ]
      const result = HandEvaluator.evaluate(cards)
      expect(result.rank).toBe(HandRank.STRAIGHT)
    })

    it('should detect wheel straight (A-2-3-4-5)', () => {
      const cards = [
        card('A', 'h'),
        card('2', 's'),
        card('3', 'd'),
        card('4', 'c'),
        card('5', 'h'),
      ]
      const result = HandEvaluator.evaluate(cards)
      expect(result.rank).toBe(HandRank.STRAIGHT)
    })

    it('should detect three of a kind', () => {
      const cards = [
        card('A', 's'),
        card('A', 'h'),
        card('A', 'd'),
        card('K', 'c'),
        card('Q', 's'),
      ]
      const result = HandEvaluator.evaluate(cards)
      expect(result.rank).toBe(HandRank.THREE_OF_A_KIND)
    })

    it('should detect two pair', () => {
      const cards = [
        card('A', 's'),
        card('A', 'h'),
        card('K', 'd'),
        card('K', 'c'),
        card('Q', 's'),
      ]
      const result = HandEvaluator.evaluate(cards)
      expect(result.rank).toBe(HandRank.TWO_PAIR)
    })

    it('should detect one pair', () => {
      const cards = [
        card('A', 's'),
        card('A', 'h'),
        card('K', 'd'),
        card('Q', 'c'),
        card('J', 's'),
      ]
      const result = HandEvaluator.evaluate(cards)
      expect(result.rank).toBe(HandRank.PAIR)
    })

    it('should detect high card', () => {
      const cards = [
        card('A', 's'),
        card('K', 'h'),
        card('Q', 'd'),
        card('J', 'c'),
        card('9', 's'),
      ]
      const result = HandEvaluator.evaluate(cards)
      expect(result.rank).toBe(HandRank.HIGH_CARD)
    })

    it('should return best 5-card hand from 7 cards', () => {
      const cards = [
        // Hole cards
        card('A', 's'),
        card('A', 'h'),
        // Board
        card('A', 'd'),
        card('K', 'c'),
        card('K', 's'),
        card('2', 'h'),
        card('3', 'd'),
      ]
      const result = HandEvaluator.evaluate(cards)
      expect(result.rank).toBe(HandRank.FULL_HOUSE)
      expect(result.cards).toHaveLength(5)
    })
  })

  describe('findWinners', () => {
    it('should return empty array for no players', () => {
      expect(HandEvaluator.findWinners([])).toEqual([])
    })

    it('should return single player if only one', () => {
      const playerHands = [
        {
          player: { id: 'player1' },
          cards: [
            card('A', 's'),
            card('K', 's'),
            card('Q', 's'),
            card('J', 's'),
            card('T', 's'),
          ],
          hand: {},
        },
      ]
      const winners = HandEvaluator.findWinners(playerHands)
      expect(winners).toHaveLength(1)
      expect(winners[0].player.id).toBe('player1')
    })

    it('should find winner with better hand', () => {
      const playerHands = [
        {
          player: { id: 'player1' },
          cards: [
            card('A', 's'),
            card('A', 'h'),
            card('K', 'd'),
            card('K', 'c'),
            card('Q', 's'),
          ],
        },
        {
          player: { id: 'player2' },
          cards: [
            card('J', 's'),
            card('J', 'h'),
            card('T', 'd'),
            card('T', 'c'),
            card('9', 's'),
          ],
        },
      ]
      const winners = HandEvaluator.findWinners(playerHands)
      expect(winners).toHaveLength(1)
      expect(winners[0].player.id).toBe('player1')
    })

    it('should handle ties correctly', () => {
      const playerHands = [
        {
          player: { id: 'player1' },
          cards: [
            card('A', 's'),
            card('K', 'h'),
            card('Q', 'd'),
            card('J', 'c'),
            card('T', 's'),
          ],
        },
        {
          player: { id: 'player2' },
          cards: [
            card('A', 'h'),
            card('K', 's'),
            card('Q', 'c'),
            card('J', 'd'),
            card('T', 'h'),
          ],
        },
      ]
      const winners = HandEvaluator.findWinners(playerHands)
      expect(winners).toHaveLength(2)
      expect(winners.map((w) => w.player.id).sort()).toEqual([
        'player1',
        'player2',
      ])
    })
  })

  describe('compareHands', () => {
    it('should return 1 when hand1 wins', () => {
      const hand1 = {
        cards: [
          card('A', 's'),
          card('A', 'h'),
          card('K', 'd'),
          card('K', 'c'),
          card('Q', 's'),
        ],
      }
      const hand2 = {
        cards: [
          card('J', 's'),
          card('J', 'h'),
          card('T', 'd'),
          card('T', 'c'),
          card('9', 's'),
        ],
      }
      expect(HandEvaluator.compareHands(hand1, hand2)).toBe(1)
    })

    it('should return -1 when hand2 wins', () => {
      const hand1 = {
        cards: [
          card('J', 's'),
          card('J', 'h'),
          card('T', 'd'),
          card('T', 'c'),
          card('9', 's'),
        ],
      }
      const hand2 = {
        cards: [
          card('A', 's'),
          card('A', 'h'),
          card('K', 'd'),
          card('K', 'c'),
          card('Q', 's'),
        ],
      }
      expect(HandEvaluator.compareHands(hand1, hand2)).toBe(-1)
    })

    it('should return 0 for tie', () => {
      const hand1 = {
        cards: [
          card('A', 's'),
          card('K', 'h'),
          card('Q', 'd'),
          card('J', 'c'),
          card('T', 's'),
        ],
      }
      const hand2 = {
        cards: [
          card('A', 'h'),
          card('K', 's'),
          card('Q', 'c'),
          card('J', 'd'),
          card('T', 'h'),
        ],
      }
      expect(HandEvaluator.compareHands(hand1, hand2)).toBe(0)
    })
  })
})
