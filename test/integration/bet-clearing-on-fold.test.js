import { describe, it, expect, beforeEach } from 'vitest';
import { Table } from '../../packages/core/src/Table.js';
import { Player } from '../../packages/core/src/Player.js';
import { Action } from '../../packages/core/src/types/index.js';

describe('Bet Clearing When Hand Ends by Fold', () => {
  
  // Simple test player that can be configured to fold or call
  class TestPlayer extends Player {
    constructor(config) {
      super(config);
      this.chips = config.chips;
      this.shouldFold = config.shouldFold || false;
    }
    
    async getAction(gameState) {
      // Player configured to fold will fold to any bet
      if (this.shouldFold && gameState.toCall > 0) {
        return { action: Action.FOLD, amount: 0, timestamp: Date.now() };
      }
      
      // Otherwise check/call
      if (gameState.validActions.includes(Action.CHECK)) {
        return { action: Action.CHECK, amount: 0, timestamp: Date.now() };
      }
      if (gameState.validActions.includes(Action.CALL)) {
        return { action: Action.CALL, amount: gameState.toCall, timestamp: Date.now() };
      }
      
      // Fallback to fold
      return { action: Action.FOLD, amount: 0, timestamp: Date.now() };
    }
  }

  it('should clear all player bets when hand ends by fold', async () => {
    const table = new Table({
      id: 'test-table',
      maxPlayers: 2,
      minPlayers: 2,
      blinds: { small: 100, big: 200 },
      dealerButton: 0
    });

    // Create two players - P1 will fold, P2 will win
    const p1 = new TestPlayer({ 
      id: 1, 
      name: 'Player1_Folds', 
      chips: 10000, 
      shouldFold: true  // This player will fold
    });
    
    const p2 = new TestPlayer({ 
      id: 2, 
      name: 'Player2_Wins', 
      chips: 10000, 
      shouldFold: false  // This player will win
    });

    // Add players to table
    await table.addPlayer(p1, 0);
    await table.addPlayer(p2, 1);

    // Verify initial state
    expect(p1.chips).toBe(10000);
    expect(p2.chips).toBe(10000);
    expect(p1.bet).toBe(0);
    expect(p2.bet).toBe(0);

    // Start the game
    const handEndedPromise = new Promise(resolve => {
      table.once('hand:ended', resolve);
    });
    
    await table.tryStartGame();
    
    // Wait for hand to complete
    await handEndedPromise;

    // CRITICAL ASSERTIONS: All bets should be cleared after hand ends
    expect(p1.bet).toBe(0);  // Should be 0, not 100 (small blind)
    expect(p2.bet).toBe(0);  // Should be 0, not 200 (big blind)
    
    // Chip conservation check
    const totalChips = p1.chips + p2.chips + p1.bet + p2.bet;
    expect(totalChips).toBe(20000);  // Total chips should be conserved
    
    // Winner should have received the pot
    expect(p2.chips).toBeGreaterThan(10000);  // P2 should have won
    expect(p1.chips).toBeLessThan(10000);     // P1 should have lost
  });

  it('should maintain chip conservation across multiple folded hands', async () => {
    const table = new Table({
      id: 'test-table-multi',
      maxPlayers: 2,
      minPlayers: 2,
      blinds: { small: 100, big: 200 },
      dealerButton: 0
    });

    const p1 = new TestPlayer({ 
      id: 1, 
      name: 'Player1', 
      chips: 10000, 
      shouldFold: true
    });
    
    const p2 = new TestPlayer({ 
      id: 2, 
      name: 'Player2', 
      chips: 10000, 
      shouldFold: false
    });

    await table.addPlayer(p1, 0);
    await table.addPlayer(p2, 1);

    const initialTotal = 20000;
    
    // Run 5 hands where player folds each time
    for (let i = 0; i < 5; i++) {
      const handEndedPromise = new Promise(resolve => {
        table.once('hand:ended', resolve);
      });
      
      await table.tryStartGame();
      await handEndedPromise;
      
      // After each hand, bets should be cleared
      expect(p1.bet).toBe(0);
      expect(p2.bet).toBe(0);
      
      // Total chips should never change
      const currentTotal = p1.chips + p2.chips + p1.bet + p2.bet;
      expect(currentTotal).toBe(initialTotal);
    }
  });

  it('should clear bets when hand ends at any betting round by fold', async () => {
    // Test player that will fold after flop
    class FlopFoldPlayer extends Player {
      constructor(config) {
        super(config);
        this.chips = config.chips;
        this.shouldFoldOnFlop = config.shouldFoldOnFlop || false;
      }
      
      async getAction(gameState) {
        // Fold on flop if configured
        if (this.shouldFoldOnFlop && gameState.phase === 'FLOP' && gameState.toCall > 0) {
          return { action: Action.FOLD, amount: 0, timestamp: Date.now() };
        }
        
        // Call preflop
        if (gameState.phase === 'PRE_FLOP' && gameState.toCall > 0) {
          return { action: Action.CALL, amount: gameState.toCall, timestamp: Date.now() };
        }
        
        // Bet on flop if we're not folding
        if (gameState.phase === 'FLOP' && gameState.toCall === 0) {
          return { action: Action.BET, amount: 200, timestamp: Date.now() };
        }
        
        // Check otherwise
        if (gameState.validActions.includes(Action.CHECK)) {
          return { action: Action.CHECK, amount: 0, timestamp: Date.now() };
        }
        
        return { action: Action.FOLD, amount: 0, timestamp: Date.now() };
      }
    }

    const table = new Table({
      id: 'test-table-flop',
      maxPlayers: 2,
      minPlayers: 2,
      blinds: { small: 100, big: 200 },
      dealerButton: 0
    });

    const p1 = new FlopFoldPlayer({ 
      id: 1, 
      name: 'Player1', 
      chips: 10000, 
      shouldFoldOnFlop: true  // Will fold on flop
    });
    
    const p2 = new FlopFoldPlayer({ 
      id: 2, 
      name: 'Player2', 
      chips: 10000, 
      shouldFoldOnFlop: false  // Will bet on flop
    });

    await table.addPlayer(p1, 0);
    await table.addPlayer(p2, 1);

    const handEndedPromise = new Promise(resolve => {
      table.once('hand:ended', resolve);
    });
    
    await table.tryStartGame();
    await handEndedPromise;

    // Bets should be cleared regardless of which round the fold occurred
    expect(p1.bet).toBe(0);
    expect(p2.bet).toBe(0);
    
    // Chip conservation
    const totalChips = p1.chips + p2.chips + p1.bet + p2.bet;
    expect(totalChips).toBe(20000);
  });

  it('should clear bets for all players in multi-way pot when someone folds', async () => {
    const table = new Table({
      id: 'test-table-multiway',
      maxPlayers: 4,
      minPlayers: 4,
      blinds: { small: 100, big: 200 },
      dealerButton: 0
    });

    // Multiple players, one will fold
    const players = [];
    for (let i = 0; i < 4; i++) {
      const player = new TestPlayer({ 
        id: i + 1, 
        name: `Player${i + 1}`, 
        chips: 10000, 
        shouldFold: i === 2  // Player 3 will fold
      });
      players.push(player);
      await table.addPlayer(player, i);
    }

    const handEndedPromise = new Promise(resolve => {
      table.once('hand:ended', resolve);
    });
    
    await table.tryStartGame();
    await handEndedPromise;

    // All player bets should be cleared
    for (const player of players) {
      expect(player.bet).toBe(0);
    }
    
    // Total chip conservation
    const totalChips = players.reduce((sum, p) => sum + p.chips + p.bet, 0);
    expect(totalChips).toBe(40000);
  });
});