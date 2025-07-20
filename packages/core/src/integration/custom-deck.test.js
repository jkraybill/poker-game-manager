/**
 * Custom Deck Tests
 * 
 * Tests that the custom deck functionality works correctly, ensuring
 * cards are dealt in the expected order to players and community cards.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('Custom Deck Tests', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach(table => table.close());
  });

  it('should deal cards in correct order from custom deck', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 4,
      dealerButton: 0, // Deterministic positioning
    });

    let gameStarted = false;
    let handEnded = false;
    let winner = null;
    const playerHands = new Map();
    let communityCards = [];

    // Set up custom deck
    // IMPORTANT: deck.draw() uses pop() which takes from the END
    // dealHoleCards() deals 2 cards at once to each player!
    // So for 4 players: P1 gets 2 cards, P2 gets 2 cards, etc.
    const customDeck = [
      // These go at the BEGINNING (dealt last)
      { rank: '9', suit: 'c', toString() { return '9c'; } }, // River
      { rank: '7', suit: 'c', toString() { return '7c'; } }, // Turn
      { rank: '6', suit: 'c', toString() { return '6c'; } }, // Flop card 3
      { rank: '5', suit: 'c', toString() { return '5c'; } }, // Flop card 2
      { rank: '4', suit: 'c', toString() { return '4c'; } }, // Flop card 1
      // Player 4's cards (dealt 4th)
      { rank: '3', suit: 'c', toString() { return '3c'; } }, // P4 second card
      { rank: '2', suit: 'c', toString() { return '2c'; } }, // P4 first card
      // Player 3's cards (dealt 3rd)
      { rank: 'Q', suit: 'h', toString() { return 'Qh'; } }, // P3 second card
      { rank: 'Q', suit: 's', toString() { return 'Qs'; } }, // P3 first card
      // Player 2's cards (dealt 2nd)
      { rank: 'K', suit: 'h', toString() { return 'Kh'; } }, // P2 second card
      { rank: 'K', suit: 's', toString() { return 'Ks'; } }, // P2 first card
      // Player 1's cards (dealt 1st) - these go at END
      { rank: 'A', suit: 'h', toString() { return 'Ah'; } }, // P1 second card
      { rank: 'A', suit: 's', toString() { return 'As'; } }, // P1 first card (dealt first)
    ];

    table.setCustomDeck(customDeck);

    // Simple player that checks/calls
    class TestPlayer extends Player {
      constructor(config) {
        super(config);
        this.seatNumber = config.seatNumber;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        if (toCall > 0) {
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          };
        }

        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }

      receivePrivateCards(cards) {
        playerHands.set(this.seatNumber, cards);
      }
    }

    // Track game events
    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('cards:community', ({ cards }) => {
      communityCards = cards;
    });

    table.on('hand:ended', ({ winners }) => {
      if (!handEnded) {
        handEnded = true;
        winner = winners[0];
        setTimeout(() => table.close(), 10);
      }
    });

    // Create 4 players
    const players = [
      new TestPlayer({ name: 'Player 1', seatNumber: 1 }),
      new TestPlayer({ name: 'Player 2', seatNumber: 2 }),
      new TestPlayer({ name: 'Player 3', seatNumber: 3 }),
      new TestPlayer({ name: 'Player 4', seatNumber: 4 }),
    ];

    players.forEach(p => table.addPlayer(p));

    // Wait for game to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Verify hole cards were dealt correctly
    const p1Cards = playerHands.get(1);
    expect(p1Cards).toBeDefined();
    expect(p1Cards[0].toString()).toBe('As');
    expect(p1Cards[1].toString()).toBe('Ah');

    const p2Cards = playerHands.get(2);
    expect(p2Cards).toBeDefined();
    expect(p2Cards[0].toString()).toBe('Ks');
    expect(p2Cards[1].toString()).toBe('Kh');

    const p3Cards = playerHands.get(3);
    expect(p3Cards).toBeDefined();
    expect(p3Cards[0].toString()).toBe('Qs');
    expect(p3Cards[1].toString()).toBe('Qh');

    const p4Cards = playerHands.get(4);
    expect(p4Cards).toBeDefined();
    expect(p4Cards[0].toString()).toBe('2c');
    expect(p4Cards[1].toString()).toBe('3c');

    // Verify community cards
    expect(communityCards).toHaveLength(5);
    expect(communityCards[0].toString()).toBe('4c');
    expect(communityCards[1].toString()).toBe('5c');
    expect(communityCards[2].toString()).toBe('6c');
    expect(communityCards[3].toString()).toBe('7c');
    expect(communityCards[4].toString()).toBe('9c');

    // Verify winner
    expect(winner).toBeDefined();
    // Player 4 should win with a straight flush (2-3-4-5-6 of clubs)
    expect(winner.playerId).toBe(players[3].id); // Player 4 is at index 3
    expect(winner.hand.rank).toBe(9); // Straight flush rank
    expect(winner.hand.description).toContain('Straight Flush');

    table.close();
  });

  it('should handle custom deck with exact card count', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;

    // Minimal deck with just enough cards for 2 players
    const customDeck = [
      // Player 1 cards
      { rank: 'A', suit: 's', toString() { return 'As'; } },
      { rank: 'A', suit: 'h', toString() { return 'Ah'; } },
      // Player 2 cards
      { rank: 'K', suit: 's', toString() { return 'Ks'; } },
      { rank: 'K', suit: 'h', toString() { return 'Kh'; } },
      // Flop
      { rank: 'Q', suit: 'c', toString() { return 'Qc'; } },
      { rank: 'J', suit: 'c', toString() { return 'Jc'; } },
      { rank: 'T', suit: 'c', toString() { return 'Tc'; } },
      // Turn
      { rank: '9', suit: 'c', toString() { return '9c'; } },
      // River
      { rank: '8', suit: 'c', toString() { return '8c'; } },
    ];

    table.setCustomDeck(customDeck);

    class SimplePlayer extends Player {
      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        if (toCall > 0) {
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
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

    table.on('hand:ended', () => {
      if (!handEnded) {
        handEnded = true;
        setTimeout(() => table.close(), 10);
      }
    });

    const players = [
      new SimplePlayer({ name: 'Player 1' }),
      new SimplePlayer({ name: 'Player 2' }),
    ];

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Test passes if game completes without error
    expect(handEnded).toBe(true);

    table.close();
  });
});