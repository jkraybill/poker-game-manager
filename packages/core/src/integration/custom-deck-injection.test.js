/**
 * Tests for custom deck injection feature
 * Ensures Table can accept and use custom deck implementations
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Table } from '../Table.js';
import { Player } from '../Player.js';
import { Deck } from '../game/Deck.js';
import { BaseDeck } from '../game/BaseDeck.js';
import { Action } from '../types/index.js';

// Mock custom deck for testing
class MockCustomDeck extends BaseDeck {
  constructor(fixedCards = []) {
    super();
    this.fixedCards = fixedCards;
    this.dealtCount = 0;
    this.shuffleCalled = false;
    this.resetCalled = false;
    this.cards = [];
    this.reset();
  }

  reset() {
    this.resetCalled = true;
    this.dealtCount = 0;
    this.cards = [];

    // Create a standard deck but mark specific cards
    const suits = ['h', 'd', 'c', 's'];
    const ranks = [
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

    for (const suit of suits) {
      for (const rank of ranks) {
        this.cards.push(this.createCard(rank, suit));
      }
    }
  }

  shuffle() {
    this.shuffleCalled = true;
    // Don't actually shuffle for testing predictability
  }

  dealHoleCards(playerId, seatPosition) {
    // Return fixed cards if specified for this position
    if (this.fixedCards[seatPosition]) {
      return this.fixedCards[seatPosition].map((cardStr) =>
        this.parseCard(cardStr),
      );
    }
    // Otherwise deal from top
    return [this.draw(), this.draw()];
  }

  dealFlop() {
    return [this.draw(), this.draw(), this.draw()];
  }

  dealTurn() {
    return this.draw();
  }

  dealRiver() {
    return this.draw();
  }

  draw() {
    if (this.cards.length === 0) {
      throw new Error('No cards left in deck');
    }
    this.dealtCount++;
    return this.cards.shift();
  }

  getRemaining() {
    return this.cards.length;
  }
}

// Simple test player
class TestPlayer extends Player {
  constructor(id, strategy) {
    super({ id, name: id });
    this.strategy = strategy;
  }

  getAction(gameState) {
    if (typeof this.strategy === 'function') {
      return this.strategy(gameState);
    }
    return { action: Action.CHECK };
  }
}

describe('Custom Deck Injection', () => {
  describe('Table constructor with deck option', () => {
    it('should accept a deck in constructor options', () => {
      const customDeck = new MockCustomDeck();
      const table = new Table({
        blinds: { small: 10, big: 20 },
        deck: customDeck,
      });

      expect(table.deck).toBe(customDeck);
    });

    it('should create default Deck if no deck provided', () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
      });

      expect(table.deck).toBeInstanceOf(Deck);
    });

    it('should validate that provided deck extends BaseDeck', () => {
      const invalidDeck = { shuffle: () => {} }; // Not a BaseDeck

      expect(() => {
        new Table({
          blinds: { small: 10, big: 20 },
          deck: invalidDeck,
        });
      }).toThrow('Provided deck must extend BaseDeck');
    });
  });

  describe('Table.setDeck() method', () => {
    let table;

    beforeEach(() => {
      table = new Table({
        blinds: { small: 10, big: 20 },
      });
    });

    it('should allow setting a custom deck', () => {
      const customDeck = new MockCustomDeck();
      table.setDeck(customDeck);
      expect(table.deck).toBe(customDeck);
    });

    it('should validate deck extends BaseDeck', () => {
      const invalidDeck = { shuffle: () => {} };

      expect(() => {
        table.setDeck(invalidDeck);
      }).toThrow('Provided deck must extend BaseDeck');
    });

    it('should not allow changing deck during active game', async () => {
      // Create players who will complete the game quickly
      const player1 = new TestPlayer('p1', (gameState) => {
        if (gameState.toCall > 0) {
          return { action: Action.FOLD };
        }
        return { action: Action.CHECK };
      });
      const player2 = new TestPlayer('p2', (gameState) => {
        if (gameState.toCall > 0) {
          return { action: Action.CALL };
        }
        return { action: Action.CHECK };
      });

      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      // Listen for action:requested event to know when game is in progress
      let gameInProgress = false;
      table.once('action:requested', () => {
        gameInProgress = true;
        // Try to change deck while game is requesting an action
        const customDeck = new MockCustomDeck();
        expect(() => {
          table.setDeck(customDeck);
        }).toThrow('Cannot change deck while game is in progress');
      });

      // Set up hand:ended listener before starting
      const handEndPromise = new Promise((resolve) => {
        table.once('hand:ended', resolve);
      });

      const startResult = await table.tryStartGame();
      expect(startResult.success).toBe(true);

      // Wait for hand to complete
      await handEndPromise;

      // Verify that we did test the in-progress state
      expect(gameInProgress).toBe(true);
    });
  });

  describe('Custom deck usage in game', () => {
    it('should use custom deck for dealing cards', async () => {
      const customDeck = new MockCustomDeck();
      const table = new Table({
        blinds: { small: 10, big: 20 },
        deck: customDeck,
      });

      const player1 = new TestPlayer('p1', () => ({ action: Action.FOLD }));
      const player2 = new TestPlayer('p2', () => {
        return { action: Action.CHECK };
      });

      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      // Track dealt cards
      const dealtCards = [];
      player1.receivePrivateCards = (cards) => {
        dealtCards.push(...cards);
      };
      player2.receivePrivateCards = (cards) => {
        dealtCards.push(...cards);
      };

      // Set up hand:ended listener before starting
      const handEndPromise = new Promise((resolve) => {
        table.once('hand:ended', resolve);
      });

      await table.tryStartGame();

      // Wait for hand to complete
      await handEndPromise;

      // Check that custom deck was used
      expect(customDeck.shuffleCalled).toBe(true);
      expect(customDeck.dealtCount).toBeGreaterThan(0);
      expect(dealtCards.length).toBe(4); // 2 cards per player
    });

    it('should use fixed cards from custom deck', async () => {
      // Create deck with specific cards for each player
      const fixedCards = {
        0: ['As', 'Ad'], // Player 1 gets pocket aces
        1: ['Ks', 'Kd'], // Player 2 gets pocket kings
      };

      const customDeck = new MockCustomDeck(fixedCards);
      const table = new Table({
        blinds: { small: 10, big: 20 },
        deck: customDeck,
        dealerButton: 0, // Deterministic dealer
      });

      const player1 = new TestPlayer('p1', () => ({ action: Action.ALL_IN }));
      const player2 = new TestPlayer('p2', () => ({ action: Action.CALL }));

      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      // Track dealt cards
      let p1Cards = [];
      let p2Cards = [];
      player1.receivePrivateCards = (cards) => {
        p1Cards = cards;
      };
      player2.receivePrivateCards = (cards) => {
        p2Cards = cards;
      };

      // Set up hand:ended listener before starting
      const handEndPromise = new Promise((resolve) => {
        table.once('hand:ended', resolve);
      });

      await table.tryStartGame();

      // Wait for hand to complete
      await handEndPromise;

      // Verify specific cards were dealt
      expect(p1Cards.map((c) => c.toString())).toEqual(['As', 'Ad']);
      expect(p2Cards.map((c) => c.toString())).toEqual(['Ks', 'Kd']);
    });
  });

  describe('Deck validation', () => {
    it('should check for required deck methods', async () => {
      class IncompleteDeck extends BaseDeck {
        // Missing required methods - will throw when called
        shuffle() {}
        reset() {}
        getRemaining() {
          return 52;
        }
        // dealHoleCards not implemented - will throw from BaseDeck
      }

      const incompleteDeck = new IncompleteDeck();
      const table = new Table({
        blinds: { small: 10, big: 20 },
        deck: incompleteDeck,
      });

      const player1 = new TestPlayer('p1', () => ({ action: Action.FOLD }));
      const player2 = new TestPlayer('p2', () => {
        return { action: Action.CHECK };
      });

      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      // Should fail when trying to use the incomplete deck
      const result = await table.tryStartGame();
      expect(result.success).toBe(false);
      expect(result.details.error).toContain(
        'dealHoleCards() must be implemented',
      );
    });
  });

  describe('Default deck usage', () => {
    it('should work with default deck when no custom deck provided', async () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
      });

      const player1 = new TestPlayer('p1', (gameState) => {
        if (gameState.toCall > 0) {
          return { action: Action.CALL };
        }
        return { action: Action.CHECK };
      });
      const player2 = new TestPlayer('p2', (gameState) => {
        if (gameState.toCall > 0) {
          return { action: Action.CALL };
        }
        return { action: Action.CHECK };
      });

      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      const result = await table.tryStartGame();
      if (!result.success) {
        console.error('Start failed:', result);
      }
      expect(result.success).toBe(true);
    }, 15000);
  });
});
