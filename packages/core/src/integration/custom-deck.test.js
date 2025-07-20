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

    // Set up custom deck following real poker dealing order
    // deck.draw() uses shift() (takes from beginning)
    // Deal order: 1 card to each player, then 1 more to each player
    // Then burn + flop, burn + turn, burn + river
    const customDeck = [
      // First card to each player
      { rank: 'A', suit: 's', toString() { return 'As'; } }, // P1 first card
      { rank: 'K', suit: 's', toString() { return 'Ks'; } }, // P2 first card
      { rank: 'Q', suit: 's', toString() { return 'Qs'; } }, // P3 first card
      { rank: '2', suit: 'c', toString() { return '2c'; } }, // P4 first card
      // Second card to each player
      { rank: 'A', suit: 'h', toString() { return 'Ah'; } }, // P1 second card
      { rank: 'K', suit: 'h', toString() { return 'Kh'; } }, // P2 second card
      { rank: 'Q', suit: 'h', toString() { return 'Qh'; } }, // P3 second card
      { rank: '3', suit: 'c', toString() { return '3c'; } }, // P4 second card
      // Burn card before flop
      { rank: '8', suit: 'd', toString() { return '8d'; } }, // Burn
      // Flop (3 cards)
      { rank: '4', suit: 'c', toString() { return '4c'; } }, // Flop card 1
      { rank: '5', suit: 'c', toString() { return '5c'; } }, // Flop card 2
      { rank: '6', suit: 'c', toString() { return '6c'; } }, // Flop card 3
      // Burn card before turn
      { rank: '8', suit: 'h', toString() { return '8h'; } }, // Burn
      // Turn
      { rank: '7', suit: 'c', toString() { return '7c'; } }, // Turn
      // Burn card before river
      { rank: '8', suit: 's', toString() { return '8s'; } }, // Burn
      // River
      { rank: '9', suit: 'c', toString() { return '9c'; } }, // River
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
      // First card to each player
      { rank: 'A', suit: 's', toString() { return 'As'; } },
      { rank: 'K', suit: 's', toString() { return 'Ks'; } },
      // Second card to each player
      { rank: 'A', suit: 'h', toString() { return 'Ah'; } },
      { rank: 'K', suit: 'h', toString() { return 'Kh'; } },
      // Burn + Flop
      { rank: '2', suit: 'd', toString() { return '2d'; } }, // Burn
      { rank: 'Q', suit: 'c', toString() { return 'Qc'; } },
      { rank: 'J', suit: 'c', toString() { return 'Jc'; } },
      { rank: 'T', suit: 'c', toString() { return 'Tc'; } },
      // Burn + Turn
      { rank: '3', suit: 'd', toString() { return '3d'; } }, // Burn
      { rank: '9', suit: 'c', toString() { return '9c'; } },
      // Burn + River
      { rank: '4', suit: 'd', toString() { return '4d'; } }, // Burn
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