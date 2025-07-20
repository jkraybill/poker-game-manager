/**
 * Split Pot Deterministic Tests
 * 
 * Tests split pot scenarios using a custom test table that allows
 * deck injection for deterministic testing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';
import { Deck } from '../game/Deck.js';

// Custom deck that doesn't shuffle and returns cards in order
class DeterministicDeck extends Deck {
  constructor(orderedCards) {
    super();
    this.cards = orderedCards;
  }

  shuffle() {
    // Don't shuffle - keep cards in the order we set
  }

  draw() {
    if (this.cards.length === 0) {
      throw new Error('No more cards in deck');
    }
    return this.cards.shift();
  }
}

describe('Split Pot Deterministic Tests', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach(table => table.close());
  });

  it('should split pot between two players with identical hands', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
      dealerButton: 0,
    });

    let gameStarted = false;
    let deckInjected = false;
    let handEnded = false;
    const winners = [];

    // Simple betting players
    class BettingPlayer extends Player {
      constructor(config) {
        super(config);
        this.isButton = config.isButton;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        if (gameState.phase === 'PRE_FLOP') {
          // Button raises
          if (this.isButton && gameState.currentBet === 20) {
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 60,
              timestamp: Date.now(),
            };
          }
          // BB calls
          if (toCall > 0) {
            return {
              playerId: this.id,
              action: Action.CALL,
              amount: toCall,
              timestamp: Date.now(),
            };
          }
        }

        // Check post-flop
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    // Inject custom deck before game starts
    table.on('table:initialized', () => {
      // Override the table's game creation to inject our deck
      const originalStartGame = table.startGame.bind(table);
      table.startGame = function() {
        originalStartGame();
        
        // Immediately after game creation, inject our deck
        if (this.gameEngine && !deckInjected) {
          deckInjected = true;
          
          // Create cards that will result in a split pot
          // Both players get AA, board has low cards
          const orderedCards = [
            // Player 1 (Button) hole cards
            { rank: 'A', suit: 'spades', toString() { return 'As'; } },
            { rank: 'A', suit: 'hearts', toString() { return 'Ah'; } },
            // Player 2 (BB) hole cards
            { rank: 'A', suit: 'clubs', toString() { return 'Ac'; } },
            { rank: 'A', suit: 'diamonds', toString() { return 'Ad'; } },
            // Flop
            { rank: '2', suit: 'clubs', toString() { return '2c'; } },
            { rank: '3', suit: 'spades', toString() { return '3s'; } },
            { rank: '4', suit: 'hearts', toString() { return '4h'; } },
            // Turn
            { rank: '5', suit: 'diamonds', toString() { return '5d'; } },
            // River
            { rank: '7', suit: 'clubs', toString() { return '7c'; } },
          ];
          
          this.gameEngine.deck = new DeterministicDeck(orderedCards);
          
          // Re-initialize the hand with our custom deck
          this.gameEngine.initializeHand();
          this.gameEngine.startBettingRound();
        }
      };
    });

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('hand:ended', ({ winners: handWinners }) => {
      if (!handEnded) {
        handEnded = true;
        winners.push(...handWinners);
        setTimeout(() => table.close(), 10);
      }
    });

    // Create 2 players
    const players = [
      new BettingPlayer({ name: 'Player 1', isButton: true }),
      new BettingPlayer({ name: 'Player 2', isButton: false }),
    ];

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Both players should win with AA
    expect(winners).toHaveLength(2);
    
    // Each should get half the pot (120 / 2 = 60)
    expect(winners[0].amount).toBe(60);
    expect(winners[1].amount).toBe(60);
    
    // Both should have the same hand rank (full house or two pair with board)
    expect(winners[0].hand.rank).toBe(winners[1].hand.rank);

    table.close();
  });

  it('should split pot three ways with identical hands', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 3,
      dealerButton: 0,
    });

    let gameStarted = false;
    let deckInjected = false;
    let handEnded = false;
    const winners = [];

    class LimpingPlayer extends Player {
      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // Everyone limps/calls preflop
        if (gameState.phase === 'PRE_FLOP' && toCall > 0 && toCall <= 20) {
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          };
        }

        // Check otherwise
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    // Inject custom deck
    table.on('table:initialized', () => {
      const originalStartGame = table.startGame.bind(table);
      table.startGame = function() {
        originalStartGame();
        
        if (this.gameEngine && !deckInjected) {
          deckInjected = true;
          
          // All players get pocket pairs, board makes everyone have same two pair
          const orderedCards = [
            // Player 1: 22
            { rank: '2', suit: 'spades', toString() { return '2s'; } },
            { rank: '2', suit: 'hearts', toString() { return '2h'; } },
            // Player 2: 33
            { rank: '3', suit: 'clubs', toString() { return '3c'; } },
            { rank: '3', suit: 'diamonds', toString() { return '3d'; } },
            // Player 3: 44
            { rank: '4', suit: 'spades', toString() { return '4s'; } },
            { rank: '4', suit: 'hearts', toString() { return '4h'; } },
            // Board: AAKKQ - everyone plays the board
            { rank: 'A', suit: 'clubs', toString() { return 'Ac'; } },
            { rank: 'A', suit: 'diamonds', toString() { return 'Ad'; } },
            { rank: 'K', suit: 'clubs', toString() { return 'Kc'; } },
            { rank: 'K', suit: 'diamonds', toString() { return 'Kd'; } },
            { rank: 'Q', suit: 'spades', toString() { return 'Qs'; } },
          ];
          
          this.gameEngine.deck = new DeterministicDeck(orderedCards);
          this.gameEngine.initializeHand();
          this.gameEngine.startBettingRound();
        }
      };
    });

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('hand:ended', ({ winners: handWinners }) => {
      if (!handEnded) {
        handEnded = true;
        winners.push(...handWinners);
        setTimeout(() => table.close(), 10);
      }
    });

    // Create 3 players
    const players = Array.from({ length: 3 }, (_, i) => 
      new LimpingPlayer({ name: `Player ${i + 1}` })
    );

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // All three should win (playing the board)
    expect(winners).toHaveLength(3);
    
    // Each gets 1/3 of pot (60 / 3 = 20)
    winners.forEach(winner => {
      expect(winner.amount).toBe(20);
    });

    table.close();
  });
});