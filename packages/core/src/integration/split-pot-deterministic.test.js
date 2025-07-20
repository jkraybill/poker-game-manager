/**
 * Split Pot Deterministic Tests
 * 
 * Tests split pot scenarios using custom decks for deterministic testing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

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
    let handEnded = false;
    const winners = [];

    // Set custom deck BEFORE adding players
    // Both players get AA, board has low cards
    const customDeck = [
      // First card to each player
      { rank: 'A', suit: 's', toString() { return 'As'; } }, // P1 first card
      { rank: 'A', suit: 'c', toString() { return 'Ac'; } }, // P2 first card
      // Second card to each player
      { rank: 'A', suit: 'h', toString() { return 'Ah'; } }, // P1 second card
      { rank: 'A', suit: 'd', toString() { return 'Ad'; } }, // P2 second card
      // Burn + Flop
      { rank: '8', suit: 'c', toString() { return '8c'; } }, // Burn
      { rank: '2', suit: 'c', toString() { return '2c'; } }, // Flop 1
      { rank: '3', suit: 's', toString() { return '3s'; } }, // Flop 2
      { rank: '4', suit: 'h', toString() { return '4h'; } }, // Flop 3
      // Burn + Turn
      { rank: '8', suit: 'd', toString() { return '8d'; } }, // Burn
      { rank: '5', suit: 'd', toString() { return '5d'; } }, // Turn
      // Burn + River
      { rank: '8', suit: 'h', toString() { return '8h'; } }, // Burn
      { rank: '7', suit: 'c', toString() { return '7c'; } }, // River
    ];

    table.setCustomDeck(customDeck);

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
          // Button raises TO 60 total (already has 10 in as SB)
          if (this.isButton && gameState.currentBet === 20) {
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 50, // Raise BY 50 to make total 60
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
    await vi.waitFor(() => gameStarted, { timeout: 500 });
    await vi.waitFor(() => handEnded, { timeout: 1000 });

    // Both players should win with AA
    expect(winners).toHaveLength(2);
    
    // Each should get half the pot (120 / 2 = 60)
    expect(winners[0].amount).toBe(60);
    expect(winners[1].amount).toBe(60);
    
    // Both should have the same hand rank (two pair - AA with board)
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
    let handEnded = false;
    const winners = [];

    // Set custom deck BEFORE adding players
    // All players get pocket pairs, board makes everyone play the board
    const customDeck = [
      // First card to each player
      { rank: '2', suit: 's', toString() { return '2s'; } }, // P1 first card
      { rank: '3', suit: 'c', toString() { return '3c'; } }, // P2 first card
      { rank: '4', suit: 's', toString() { return '4s'; } }, // P3 first card
      // Second card to each player
      { rank: '2', suit: 'h', toString() { return '2h'; } }, // P1 second card
      { rank: '3', suit: 'd', toString() { return '3d'; } }, // P2 second card
      { rank: '4', suit: 'h', toString() { return '4h'; } }, // P3 second card
      // Burn + Flop
      { rank: '9', suit: 'c', toString() { return '9c'; } }, // Burn
      { rank: 'A', suit: 'c', toString() { return 'Ac'; } }, // Flop 1
      { rank: 'A', suit: 'd', toString() { return 'Ad'; } }, // Flop 2
      { rank: 'K', suit: 'c', toString() { return 'Kc'; } }, // Flop 3
      // Burn + Turn
      { rank: '9', suit: 'd', toString() { return '9d'; } }, // Burn
      { rank: 'K', suit: 'd', toString() { return 'Kd'; } }, // Turn
      // Burn + River
      { rank: '9', suit: 'h', toString() { return '9h'; } }, // Burn
      { rank: 'Q', suit: 's', toString() { return 'Qs'; } }, // River
    ];

    table.setCustomDeck(customDeck);

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
    await vi.waitFor(() => gameStarted, { timeout: 500 });
    await vi.waitFor(() => handEnded, { timeout: 1000 });

    // All three should win (playing the board - AAKKQ)
    expect(winners).toHaveLength(3);
    
    // Each gets 1/3 of pot (60 / 3 = 20)
    winners.forEach(winner => {
      expect(winner.amount).toBe(20);
    });

    table.close();
  });
});