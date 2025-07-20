/**
 * Split Pot Scenarios
 * 
 * Tests situations where multiple players have identical hand strengths,
 * resulting in the pot being split between winners. This is a critical
 * game mechanic that must handle:
 * - Exact even splits
 * - Odd chip distribution (remainder handling)
 * - Multiple winner scenarios
 * - Split pots with side pots
 * - Board play situations (all players have same hand)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('Split Pot Scenarios', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach(table => table.close());
  });

  it('should handle 2-player split pot with identical straights', async () => {
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
    let showdownOccurred = false;

    // Players who will both make straights
    class StraightPlayer extends Player {
      constructor(config) {
        super(config);
        this.position = config.position;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // Preflop: Button raises, BB calls
        if (gameState.phase === 'PRE_FLOP') {
          if (this.position === 'BUTTON' && gameState.currentBet === 20) {
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 60,
              timestamp: Date.now(),
            };
          }
          if (toCall > 0) {
            return {
              playerId: this.id,
              action: Action.CALL,
              amount: toCall,
              timestamp: Date.now(),
            };
          }
        }

        // Post-flop: Both check down
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    // Override deck for deterministic cards
    table.on('game:started', () => {
      gameStarted = true;
      
      // Override deck after game starts
      if (table.gameEngine && table.gameEngine.deck) {
        const deck = table.gameEngine.deck;
        console.log('Original deck cards:', deck.cards.slice(0, 10).map(c => c.toString()));
        
        // Both players get different cards that make same straight
        // Player 1: 8h 9h
        // Player 2: 8d 9d
        // Board: 5c 6s 7h Tc Jc (making 5-9 straight for both)
        deck.cards = [
          // Player 1 cards
          { rank: '8', suit: 'hearts', toString() { return '8h'; } },
          { rank: '9', suit: 'hearts', toString() { return '9h'; } },
          // Player 2 cards
          { rank: '8', suit: 'diamonds', toString() { return '8d'; } },
          { rank: '9', suit: 'diamonds', toString() { return '9d'; } },
          // Flop
          { rank: '5', suit: 'clubs', toString() { return '5c'; } },
          { rank: '6', suit: 'spades', toString() { return '6s'; } },
          { rank: '7', suit: 'hearts', toString() { return '7h'; } },
          // Turn
          { rank: 'T', suit: 'clubs', toString() { return 'Tc'; } },
          // River
          { rank: 'J', suit: 'clubs', toString() { return 'Jc'; } },
          // Rest of deck...
          ...deck.cards.slice(9),
        ];
        
        console.log('Modified deck cards:', deck.cards.slice(0, 10).map(c => c.toString()));
      }
    });

    table.on('hand:ended', ({ winners: handWinners }) => {
      if (!handEnded) {
        handEnded = true;
        winners.push(...handWinners);
        showdownOccurred = handWinners[0]?.hand != null;
        
        // Debug: log winner details
        console.log('Winners:', handWinners.map(w => ({
          playerId: w.playerId,
          handRank: w.hand?.rank,
          handDescription: w.hand?.description,
          amount: w.amount,
        })));
        
        setTimeout(() => table.close(), 10);
      }
    });

    // Create 2 players
    const players = [
      new StraightPlayer({ name: 'Player 1', position: 'BUTTON' }),
      new StraightPlayer({ name: 'Player 2', position: 'BB' }),
    ];

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Verify split pot
    expect(winners).toHaveLength(2); // Both players win
    expect(showdownOccurred).toBe(true);
    
    // Each player should get half the pot (60 + 60 = 120 total)
    expect(winners[0].amount).toBe(60);
    expect(winners[1].amount).toBe(60);
    
    // Verify both have straights
    expect(winners[0].hand.rank).toBe(5); // Straight rank
    expect(winners[1].hand.rank).toBe(5); // Straight rank

    table.close();
  });

  it('should handle 3-way split pot where all players play the board', async () => {
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

    class BoardPlayer extends Player {
      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // Everyone calls preflop
        if (gameState.phase === 'PRE_FLOP' && toCall > 0) {
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          };
        }

        // Check all streets
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    // Override deck for board play scenario
    const originalAddPlayer = table.addPlayer.bind(table);
    let playersAdded = 0;
    table.addPlayer = function(player) {
      const result = originalAddPlayer(player);
      playersAdded++;
      
      if (playersAdded === 3 && this.gameEngine) {
        const deck = this.gameEngine.deck;
        if (deck && deck.cards) {
          // All players get weak cards
          // Board will be a royal flush that beats everything
          deck.cards = [
            // Player 1: 2h 3h
            { rank: '2', suit: 'hearts' },
            { rank: '3', suit: 'hearts' },
            // Player 2: 2d 3d
            { rank: '2', suit: 'diamonds' },
            { rank: '3', suit: 'diamonds' },
            // Player 3: 2c 3c
            { rank: '2', suit: 'clubs' },
            { rank: '3', suit: 'clubs' },
            // Board: As Ks Qs Js Ts (royal flush)
            { rank: 'A', suit: 'spades' },
            { rank: 'K', suit: 'spades' },
            { rank: 'Q', suit: 'spades' },
            { rank: 'J', suit: 'spades' },
            { rank: 'T', suit: 'spades' },
            ...deck.cards.slice(11),
          ];
        }
      }
      
      return result;
    };

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
    const players = [
      new BoardPlayer({ name: 'Player 1' }),
      new BoardPlayer({ name: 'Player 2' }),
      new BoardPlayer({ name: 'Player 3' }),
    ];

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // All 3 players should win
    expect(winners).toHaveLength(3);
    
    // Each gets 1/3 of pot (20 × 3 = 60)
    winners.forEach(winner => {
      expect(winner.amount).toBe(20);
      expect(winner.hand.rank).toBe(10); // Royal flush rank
    });

    table.close();
  });

  it('should handle split pot with odd chip distribution', async () => {
    const table = manager.createTable({
      blinds: { small: 5, big: 10 }, // Use blinds that create odd pot
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 3,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    const winners = [];

    class OddChipPlayer extends Player {
      constructor(config) {
        super(config);
        this.position = config.position;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // UTG raises to create odd pot
        if (gameState.phase === 'PRE_FLOP') {
          if (this.position === 'UTG' && gameState.currentBet === 10) {
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 25, // Creates pot of 65 (not evenly divisible by 2)
              timestamp: Date.now(),
            };
          }
          if (toCall > 0) {
            return {
              playerId: this.id,
              action: Action.CALL,
              amount: toCall,
              timestamp: Date.now(),
            };
          }
        }

        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    // Set up for 2-way split with odd chip
    const originalAddPlayer = table.addPlayer.bind(table);
    let playersAdded = 0;
    table.addPlayer = function(player) {
      const result = originalAddPlayer(player);
      playersAdded++;
      
      if (playersAdded === 3 && this.gameEngine) {
        const deck = this.gameEngine.deck;
        if (deck && deck.cards) {
          // Players 1 and 2 get AA, player 3 gets junk
          deck.cards = [
            // Player 1: As Ah
            { rank: 'A', suit: 'spades' },
            { rank: 'A', suit: 'hearts' },
            // Player 2: Ac Ad
            { rank: 'A', suit: 'clubs' },
            { rank: 'A', suit: 'diamonds' },
            // Player 3: 2h 3d
            { rank: '2', suit: 'hearts' },
            { rank: '3', suit: 'diamonds' },
            // Board: K K Q J 9 (AA wins)
            { rank: 'K', suit: 'hearts' },
            { rank: 'K', suit: 'clubs' },
            { rank: 'Q', suit: 'spades' },
            { rank: 'J', suit: 'diamonds' },
            { rank: '9', suit: 'clubs' },
            ...deck.cards.slice(11),
          ];
        }
      }
      
      return result;
    };

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
    const players = [
      new OddChipPlayer({ name: 'Player 1 (Button)', position: 'BUTTON' }),
      new OddChipPlayer({ name: 'Player 2 (SB)', position: 'SB' }),
      new OddChipPlayer({ name: 'Player 3 (UTG)', position: 'UTG' }),
    ];

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Two players should win (both have AA)
    expect(winners).toHaveLength(2);
    
    // Pot is 75 (25 × 3), split between 2 = 37 each with 1 remainder
    // First winner gets the odd chip
    const amounts = winners.map(w => w.amount).sort((a, b) => b - a);
    expect(amounts[0]).toBe(38); // Gets odd chip
    expect(amounts[1]).toBe(37); // Regular share
    expect(amounts[0] + amounts[1]).toBe(75); // Total pot

    table.close();
  });

  it('should handle split main pot with side pot going to different player', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 100,
      maxBuyIn: 1000,
      minPlayers: 3,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    const winners = [];

    class SplitSidePlayer extends Player {
      constructor(config) {
        super(config);
        this.targetChips = config.chips;
        this.position = config.position;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];

        // Short stack goes all-in, others call
        if (gameState.phase === 'PRE_FLOP') {
          if (this.position === 'SHORT' && !myState.hasActed) {
            return {
              playerId: this.id,
              action: Action.ALL_IN,
              amount: myState.chips,
              timestamp: Date.now(),
            };
          }
          
          const toCall = gameState.currentBet - myState.bet;
          if (toCall > 0) {
            return {
              playerId: this.id,
              action: Action.CALL,
              amount: toCall,
              timestamp: Date.now(),
            };
          }
        }

        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    // Override for custom chips and cards
    const originalAddPlayer = table.addPlayer.bind(table);
    let playersAdded = 0;
    table.addPlayer = function(player) {
      const result = originalAddPlayer(player);
      const playerData = this.players.get(player.id);
      if (playerData && player.targetChips) {
        playerData.chips = player.targetChips;
      }
      playersAdded++;
      
      if (playersAdded === 3 && this.gameEngine) {
        const deck = this.gameEngine.deck;
        if (deck && deck.cards) {
          // Short stack and Player 2 get AA (split main pot)
          // Player 3 gets KK (wins side pot)
          deck.cards = [
            // Short stack: As Ah
            { rank: 'A', suit: 'spades' },
            { rank: 'A', suit: 'hearts' },
            // Player 2: Ac Ad  
            { rank: 'A', suit: 'clubs' },
            { rank: 'A', suit: 'diamonds' },
            // Player 3: Ks Kh
            { rank: 'K', suit: 'spades' },
            { rank: 'K', suit: 'hearts' },
            // Board: Q J T 9 8 (AA beats KK)
            { rank: 'Q', suit: 'clubs' },
            { rank: 'J', suit: 'diamonds' },
            { rank: 'T', suit: 'hearts' },
            { rank: '9', suit: 'spades' },
            { rank: '8', suit: 'clubs' },
            ...deck.cards.slice(11),
          ];
        }
      }
      
      return result;
    };

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

    // Create players with different stacks
    const players = [
      new SplitSidePlayer({ 
        name: 'Short Stack', 
        position: 'SHORT',
        chips: 100, // Will go all-in
      }),
      new SplitSidePlayer({ 
        name: 'Player 2', 
        position: 'P2',
        chips: 500,
      }),
      new SplitSidePlayer({ 
        name: 'Player 3', 
        position: 'P3',
        chips: 500,
      }),
    ];

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Should have 2 winners (both AA players)
    expect(winners).toHaveLength(2);
    
    // Main pot: 100 × 3 = 300, split between 2 AA holders = 150 each
    const aaWinners = winners.filter(w => w.hand.rank === 7); // Full house (AA with board)
    expect(aaWinners).toHaveLength(2);
    
    // Total winnings should equal pot size
    const totalWon = winners.reduce((sum, w) => sum + w.amount, 0);
    expect(totalWon).toBe(300); // All chips in play

    table.close();
  });
});