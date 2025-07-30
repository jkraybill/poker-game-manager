import { describe, it, expect, beforeEach } from 'vitest'
import { Deck } from '../../src/game/Deck.js'

describe('Deck', () => {
  let deck

  beforeEach(() => {
    deck = new Deck()
  })

  describe('constructor and reset', () => {
    it('should create a deck with 52 cards', () => {
      expect(deck.getRemaining()).toBe(52)
    })

    it('should create cards with all combinations of suits and ranks', () => {
      const expectedSuits = ['h', 'd', 'c', 's']
      const expectedRanks = [
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        'T',
        'J',
        'Q',
        'K',
        'A',
      ]

      const cards = [...deck.cards]
      expect(cards).toHaveLength(52)

      // Check that all suits are represented
      const suits = new Set(cards.map((card) => card.suit))
      expect([...suits].sort()).toEqual(expectedSuits.sort())

      // Check that all ranks are represented
      const ranks = new Set(cards.map((card) => card.rank))
      expect([...ranks].sort()).toEqual(expectedRanks.sort())

      // Check that each suit has all 13 ranks
      for (const suit of expectedSuits) {
        const suitCards = cards.filter((card) => card.suit === suit)
        expect(suitCards).toHaveLength(13)
        const suitRanks = suitCards.map((card) => card.rank)
        expect(suitRanks.sort()).toEqual(expectedRanks.sort())
      }
    })

    it('should reset deck to original state', () => {
      // Draw some cards
      deck.draw()
      deck.draw()
      deck.draw()
      expect(deck.getRemaining()).toBe(49)

      // Reset
      deck.reset()
      expect(deck.getRemaining()).toBe(52)
    })

    it('should create cards with correct toString() method', () => {
      const card = deck.cards[0]
      expect(card.toString()).toBe(`${card.rank}${card.suit}`)

      // Test specific cards
      const aceOfSpades = deck.cards.find(
        (c) => c.rank === 'A' && c.suit === 's'
      )
      expect(aceOfSpades.toString()).toBe('As')

      const tenOfHearts = deck.cards.find(
        (c) => c.rank === 'T' && c.suit === 'h'
      )
      expect(tenOfHearts.toString()).toBe('Th')
    })
  })

  describe('shuffle', () => {
    it('should maintain 52 cards after shuffle', () => {
      deck.shuffle()
      expect(deck.getRemaining()).toBe(52)
    })

    it('should maintain all unique cards after shuffle', () => {
      const originalCards = deck.cards.map((c) => c.toString()).sort()
      deck.shuffle()
      const shuffledCards = deck.cards.map((c) => c.toString()).sort()
      expect(shuffledCards).toEqual(originalCards)
    })

    it('should change card order (statistically)', () => {
      // Get original order
      const originalOrder = deck.cards.map((c) => c.toString()).join(',')

      // Shuffle multiple times and check that we get different orders
      let differentOrders = 0
      for (let i = 0; i < 10; i++) {
        deck.reset()
        deck.shuffle()
        const newOrder = deck.cards.map((c) => c.toString()).join(',')
        if (newOrder !== originalOrder) {
          differentOrders++
        }
      }

      // Should get different order at least 9 out of 10 times (statistically)
      expect(differentOrders).toBeGreaterThanOrEqual(9)
    })

    it('should produce different results on consecutive shuffles', () => {
      deck.shuffle()
      const firstShuffle = deck.cards.map((c) => c.toString()).join(',')

      deck.shuffle()
      const secondShuffle = deck.cards.map((c) => c.toString()).join(',')

      expect(firstShuffle).not.toBe(secondShuffle)
    })
  })

  describe('draw', () => {
    it('should draw a card from the deck', () => {
      const initialCount = deck.getRemaining()
      const card = deck.draw()

      expect(card).toBeDefined()
      expect(card).toHaveProperty('rank')
      expect(card).toHaveProperty('suit')
      expect(deck.getRemaining()).toBe(initialCount - 1)
    })

    it('should draw cards in FIFO order (from the beginning)', () => {
      const firstCard = deck.cards[0]
      const drawnCard = deck.draw()

      expect(drawnCard).toEqual(firstCard)
    })

    it('should draw all 52 cards sequentially', () => {
      const drawnCards = []
      for (let i = 0; i < 52; i++) {
        drawnCards.push(deck.draw())
      }

      expect(drawnCards).toHaveLength(52)
      expect(deck.getRemaining()).toBe(0)

      // Check all cards are unique
      const cardStrings = drawnCards.map((c) => c.toString())
      const uniqueCards = new Set(cardStrings)
      expect(uniqueCards.size).toBe(52)
    })

    it('should throw error when drawing from empty deck', () => {
      // Draw all cards
      for (let i = 0; i < 52; i++) {
        deck.draw()
      }

      expect(() => deck.draw()).toThrow('Cannot draw from empty deck')
    })

    it('should maintain deck integrity during multiple draws', () => {
      const drawn = []

      // Draw half the deck
      for (let i = 0; i < 26; i++) {
        drawn.push(deck.draw().toString())
      }

      // Remaining cards should not include drawn cards
      const remaining = deck.cards.map((c) => c.toString())
      for (const drawnCard of drawn) {
        expect(remaining).not.toContain(drawnCard)
      }

      expect(remaining.length + drawn.length).toBe(52)
    })
  })

  describe('getRemaining', () => {
    it('should return correct count initially', () => {
      expect(deck.getRemaining()).toBe(52)
    })

    it('should update count after drawing', () => {
      deck.draw()
      expect(deck.getRemaining()).toBe(51)

      deck.draw()
      deck.draw()
      expect(deck.getRemaining()).toBe(49)
    })

    it('should return 0 when deck is empty', () => {
      for (let i = 0; i < 52; i++) {
        deck.draw()
      }
      expect(deck.getRemaining()).toBe(0)
    })

    it('should reset to 52 after reset()', () => {
      // Draw some cards
      for (let i = 0; i < 10; i++) {
        deck.draw()
      }
      expect(deck.getRemaining()).toBe(42)

      // Reset
      deck.reset()
      expect(deck.getRemaining()).toBe(52)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle multiple resets', () => {
      deck.reset()
      deck.reset()
      deck.reset()
      expect(deck.getRemaining()).toBe(52)
    })

    it('should handle shuffle on empty deck', () => {
      // Draw all cards
      for (let i = 0; i < 52; i++) {
        deck.draw()
      }

      // Should not throw
      expect(() => deck.shuffle()).not.toThrow()
      expect(deck.getRemaining()).toBe(0)
    })

    it('should handle shuffle on partially drawn deck', () => {
      // Draw half the deck
      for (let i = 0; i < 26; i++) {
        deck.draw()
      }

      const remainingCount = deck.getRemaining()
      deck.shuffle()
      expect(deck.getRemaining()).toBe(remainingCount)
    })
  })

  describe('Fisher-Yates algorithm verification', () => {
    it('should implement proper Fisher-Yates shuffle', () => {
      // This test verifies the algorithm produces uniform distribution
      // by checking card positions over multiple shuffles
      const positionCounts = {}
      const iterations = 100000
      const testCard = 'As' // Ace of spades

      for (let i = 0; i < iterations; i++) {
        deck.reset()
        deck.shuffle()

        const position = deck.cards.findIndex((c) => c.toString() === testCard)
        positionCounts[position] = (positionCounts[position] || 0) + 1
      }

      // Each position should have roughly equal probability (1/52)
      const expectedCount = iterations / 52
      const tolerance = expectedCount * 0.2 // 20% tolerance for statistical variance

      for (let pos = 0; pos < 52; pos++) {
        const count = positionCounts[pos] || 0
        expect(count).toBeGreaterThan(expectedCount - tolerance)
        expect(count).toBeLessThan(expectedCount + tolerance)
      }
    })
  })

  describe('performance and reliability', () => {
    it('should handle many consecutive operations without degradation', () => {
      const startTime = Date.now()

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        deck.reset()
        deck.shuffle()

        // Draw and verify some cards
        const drawn = []
        for (let j = 0; j < 5; j++) {
          drawn.push(deck.draw())
        }

        expect(deck.getRemaining()).toBe(47)
        expect(drawn).toHaveLength(5)
      }

      const elapsed = Date.now() - startTime
      // Should complete in reasonable time (less than 1 second)
      expect(elapsed).toBeLessThan(1000)
    })

    it('should maintain performance for shuffle operation', () => {
      const iterations = 10000
      const startTime = Date.now()

      for (let i = 0; i < iterations; i++) {
        deck.shuffle()
      }

      const elapsed = Date.now() - startTime
      const avgTime = elapsed / iterations

      // Average shuffle should be very fast (less than 0.1ms)
      expect(avgTime).toBeLessThan(0.1)
    })
  })

  describe('card immutability and state consistency', () => {
    it('should not allow modification of drawn cards to affect deck', () => {
      const drawnCard = deck.draw()
      const originalRank = drawnCard.rank
      const originalSuit = drawnCard.suit

      // Try to modify the drawn card
      drawnCard.rank = 'MODIFIED'
      drawnCard.suit = 'MODIFIED'

      // Reset deck and verify the card is back to original
      deck.reset()
      const foundCard = deck.cards.find(
        (c) => c.rank === originalRank && c.suit === originalSuit
      )

      expect(foundCard).toBeDefined()
      expect(foundCard.rank).toBe(originalRank)
      expect(foundCard.suit).toBe(originalSuit)
    })

    it('should handle complex operation sequences', () => {
      // Complex sequence: shuffle, draw some, shuffle again, draw more, reset
      deck.shuffle()

      const firstDraw = []
      for (let i = 0; i < 10; i++) {
        firstDraw.push(deck.draw().toString())
      }
      expect(deck.getRemaining()).toBe(42)

      deck.shuffle() // Shuffle remaining 42 cards

      const secondDraw = []
      for (let i = 0; i < 10; i++) {
        secondDraw.push(deck.draw().toString())
      }
      expect(deck.getRemaining()).toBe(32)

      deck.reset()
      expect(deck.getRemaining()).toBe(52)

      // Verify all cards are back
      const allCards = deck.cards.map((c) => c.toString())
      for (const card of firstDraw.concat(secondDraw)) {
        expect(allCards).toContain(card)
      }
    })
  })

  describe('advanced shuffle verification', () => {
    it('should show no correlation between consecutive cards', () => {
      // Test that knowing one card doesn't help predict the next
      const pairCounts = {}
      const iterations = 10000

      for (let i = 0; i < iterations; i++) {
        deck.reset()
        deck.shuffle()

        // Look at first two cards
        const first = deck.cards[0].toString()
        const second = deck.cards[1].toString()
        const pair = `${first}-${second}`

        pairCounts[pair] = (pairCounts[pair] || 0) + 1
      }

      // With 52 cards, there are 52*51 = 2652 possible pairs
      // Each should appear roughly iterations/2652 times
      const expectedCount = iterations / 2652

      // Check a sample of pairs
      const pairValues = Object.values(pairCounts)
      const maxCount = Math.max(...pairValues)

      // Statistical check: with 10k iterations, max should be reasonable
      // Using 5x expected as upper bound (very generous for randomness)
      expect(maxCount).toBeLessThan(expectedCount * 5)

      // Verify we're seeing a good variety of pairs (at least 1000 different pairs)
      expect(Object.keys(pairCounts).length).toBeGreaterThan(1000)
    })
  })

  describe('additional edge cases', () => {
    it('should handle rapid reset and shuffle operations', () => {
      // Rapid operations shouldn't cause issues
      for (let i = 0; i < 100; i++) {
        deck.reset()
        deck.shuffle()
        deck.reset()
      }

      expect(deck.getRemaining()).toBe(52)
      expect(deck.cards).toHaveLength(52)
    })

    it('should maintain unique card references after reset', () => {
      const card1 = deck.draw()
      const remaining1 = deck.getRemaining()

      deck.reset()

      const card2 = deck.draw()
      const remaining2 = deck.getRemaining()

      // Same position should give same card value but different object
      expect(card1.toString()).toBe(card2.toString())
      expect(card1).not.toBe(card2) // Different object references
      expect(remaining1).toBe(remaining2)
    })

    it('should properly handle drawing all cards then shuffling', () => {
      // Draw all cards
      const drawnCards = []
      while (deck.getRemaining() > 0) {
        drawnCards.push(deck.draw())
      }

      expect(drawnCards).toHaveLength(52)
      expect(deck.getRemaining()).toBe(0)

      // Shuffling empty deck should work
      expect(() => deck.shuffle()).not.toThrow()

      // But drawing should still fail
      expect(() => deck.draw()).toThrow('Cannot draw from empty deck')

      // Reset should restore everything
      deck.reset()
      expect(deck.getRemaining()).toBe(52)
    })
  })
})
