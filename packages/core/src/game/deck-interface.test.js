/**
 * Tests for Deck interface compliance
 * Any deck implementation must pass these tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Deck } from './Deck.js';
// import { BaseDeck } from './BaseDeck.js';  // Will be created later
// import { RiggedDeck } from './RiggedDeck.js'; // Will be created later

/**
 * Test suite that any Deck implementation must pass
 * @param {Function} DeckClass - The deck class to test
 */
function testDeckInterface(DeckClass) {
  describe('Deck Interface Compliance', () => {
    let deck;

    beforeEach(() => {
      deck = new DeckClass();
    });

    describe('Required methods exist', () => {
      it('should have shuffle method', () => {
        expect(typeof deck.shuffle).toBe('function');
      });

      it('should have dealHoleCards method', () => {
        expect(typeof deck.dealHoleCards).toBe('function');
      });

      it('should have dealFlop method', () => {
        expect(typeof deck.dealFlop).toBe('function');
      });

      it('should have dealTurn method', () => {
        expect(typeof deck.dealTurn).toBe('function');
      });

      it('should have dealRiver method', () => {
        expect(typeof deck.dealRiver).toBe('function');
      });

      it('should have reset method', () => {
        expect(typeof deck.reset).toBe('function');
      });

      it('should have getRemaining method', () => {
        expect(typeof deck.getRemaining).toBe('function');
      });
    });

    describe('Method behaviors', () => {
      it('dealHoleCards should return exactly 2 cards', () => {
        const cards = deck.dealHoleCards('player1', 0);
        expect(Array.isArray(cards)).toBe(true);
        expect(cards).toHaveLength(2);
        expect(cards[0]).toHaveProperty('rank');
        expect(cards[0]).toHaveProperty('suit');
        expect(cards[1]).toHaveProperty('rank');
        expect(cards[1]).toHaveProperty('suit');
      });

      it('dealFlop should return exactly 3 cards', () => {
        // Deal some hole cards first
        deck.dealHoleCards('player1', 0);
        deck.dealHoleCards('player2', 1);

        const flop = deck.dealFlop();
        expect(Array.isArray(flop)).toBe(true);
        expect(flop).toHaveLength(3);
        flop.forEach((card) => {
          expect(card).toHaveProperty('rank');
          expect(card).toHaveProperty('suit');
        });
      });

      it('dealTurn should return exactly 1 card', () => {
        // Deal hole cards and flop first
        deck.dealHoleCards('player1', 0);
        deck.dealHoleCards('player2', 1);
        deck.dealFlop();

        const turn = deck.dealTurn();
        expect(turn).toHaveProperty('rank');
        expect(turn).toHaveProperty('suit');
      });

      it('dealRiver should return exactly 1 card', () => {
        // Deal hole cards, flop, and turn first
        deck.dealHoleCards('player1', 0);
        deck.dealHoleCards('player2', 1);
        deck.dealFlop();
        deck.dealTurn();

        const river = deck.dealRiver();
        expect(river).toHaveProperty('rank');
        expect(river).toHaveProperty('suit');
      });

      it('reset should restore deck to initial state', () => {
        // Deal some cards
        deck.dealHoleCards('player1', 0);
        deck.dealHoleCards('player2', 1);
        const remaining1 = deck.getRemaining();

        // Reset
        deck.reset();
        const remaining2 = deck.getRemaining();

        // Should have more cards after reset
        expect(remaining2).toBeGreaterThan(remaining1);
      });

      it('getRemaining should return a number', () => {
        const remaining = deck.getRemaining();
        expect(typeof remaining).toBe('number');
        expect(remaining).toBeGreaterThanOrEqual(0);
      });

      it('should deal unique cards (no duplicates)', () => {
        const dealtCards = new Set();

        // Deal multiple hands
        for (let i = 0; i < 5; i++) {
          const hole = deck.dealHoleCards(`player${i}`, i);
          hole.forEach((card) => {
            const cardStr = `${card.rank}${card.suit}`;
            expect(dealtCards.has(cardStr)).toBe(false);
            dealtCards.add(cardStr);
          });
        }

        // Deal community cards
        const flop = deck.dealFlop();
        flop.forEach((card) => {
          const cardStr = `${card.rank}${card.suit}`;
          expect(dealtCards.has(cardStr)).toBe(false);
          dealtCards.add(cardStr);
        });

        const turn = deck.dealTurn();
        const turnStr = `${turn.rank}${turn.suit}`;
        expect(dealtCards.has(turnStr)).toBe(false);
        dealtCards.add(turnStr);

        const river = deck.dealRiver();
        const riverStr = `${river.rank}${river.suit}`;
        expect(dealtCards.has(riverStr)).toBe(false);
      });

      it('shuffle should be callable', () => {
        expect(() => deck.shuffle()).not.toThrow();
      });

      it('should handle multiple consecutive resets', () => {
        deck.reset();
        deck.reset();
        deck.reset();
        expect(deck.getRemaining()).toBeGreaterThan(0);
      });
    });

    describe('Card format', () => {
      it('cards should have valid ranks', () => {
        const validRanks = [
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
        ];
        const cards = deck.dealHoleCards('player1', 0);
        cards.forEach((card) => {
          expect(validRanks).toContain(card.rank);
        });
      });

      it('cards should have valid suits', () => {
        const validSuits = ['h', 'd', 'c', 's'];
        const cards = deck.dealHoleCards('player1', 0);
        cards.forEach((card) => {
          expect(validSuits).toContain(card.suit);
        });
      });

      it('cards should have toString method', () => {
        const cards = deck.dealHoleCards('player1', 0);
        cards.forEach((card) => {
          expect(typeof card.toString).toBe('function');
          const str = card.toString();
          expect(typeof str).toBe('string');
          expect(str).toBe(`${card.rank}${card.suit}`);
        });
      });
    });
  });
}

// Test the standard Deck implementation
describe('Standard Deck', () => {
  testDeckInterface(Deck);
});

// Test the base deck implementation (when created)
// describe.skip('BaseDeck', () => {
//   testDeckInterface(BaseDeck);
// });

// Test the rigged deck implementation (when created)
// describe.skip('RiggedDeck', () => {
//   testDeckInterface(RiggedDeck);

// Additional RiggedDeck-specific tests
/*describe('RiggedDeck specific features', () => {
    it('should deal specified hole cards when configured', () => {
      const riggedDeck = new RiggedDeck({
        holeCards: {
          0: ['As', 'Ad'],
          1: ['Ks', 'Kd']
        }
      });
      
      const player0Cards = riggedDeck.dealHoleCards('player0', 0);
      expect(player0Cards[0].toString()).toBe('As');
      expect(player0Cards[1].toString()).toBe('Ad');
      
      const player1Cards = riggedDeck.dealHoleCards('player1', 1);
      expect(player1Cards[0].toString()).toBe('Ks');
      expect(player1Cards[1].toString()).toBe('Kd');
    });
    
    it('should deal specified community cards when configured', () => {
      const riggedDeck = new RiggedDeck({
        community: ['7c', '3h', '2d', 'Ts', '5h']
      });
      
      const flop = riggedDeck.dealFlop();
      expect(flop[0].toString()).toBe('7c');
      expect(flop[1].toString()).toBe('3h');
      expect(flop[2].toString()).toBe('2d');
      
      const turn = riggedDeck.dealTurn();
      expect(turn.toString()).toBe('Ts');
      
      const river = riggedDeck.dealRiver();
      expect(river.toString()).toBe('5h');
    });
    
    it('should deal random cards for unspecified positions', () => {
      const riggedDeck = new RiggedDeck({
        holeCards: {
          0: ['As', 'Ad']
        }
      });
      
      // Player 0 gets specified cards
      const player0Cards = riggedDeck.dealHoleCards('player0', 0);
      expect(player0Cards[0].toString()).toBe('As');
      expect(player0Cards[1].toString()).toBe('Ad');
      
      // Player 1 gets random cards
      const player1Cards = riggedDeck.dealHoleCards('player1', 1);
      expect(player1Cards).toHaveLength(2);
      // Should not get the same cards as player 0
      expect(player1Cards[0].toString()).not.toBe('As');
      expect(player1Cards[1].toString()).not.toBe('Ad');
    });
  });*/
// });
