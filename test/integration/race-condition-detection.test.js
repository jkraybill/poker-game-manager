import { describe, it, expect } from 'vitest';
import { PokerGameManager } from '../../packages/core/src/PokerGameManager.js';
import { Player } from '../../packages/core/src/Player.js';
import { Action } from '../../packages/core/src/types/index.js';

describe('Race Condition Detection - Chip Conservation During Betting', () => {
  
  // Player that will trigger betting actions
  class BettingPlayer extends Player {
    constructor(config) {
      super(config);
      this.chips = config.chips || 1000;
      this.shouldBet = config.shouldBet || false;
      this.betAmount = config.betAmount || 40;
    }

    async getAction(gameState) {
      // First player in first round should bet to trigger the race condition
      if (this.shouldBet && gameState.phase === 'PRE_FLOP' && gameState.toCall === 0) {
        this.shouldBet = false; // Only bet once
        return { action: Action.BET, amount: this.betAmount, timestamp: Date.now() };
      }
      
      if (gameState.toCall > 0) {
        return { action: Action.CALL, timestamp: Date.now() };
      }
      
      return { action: Action.CHECK, timestamp: Date.now() };
    }
  }

  // Helper to count total chips including those in transition
  function countTotalChipsComplete(table) {
    let total = 0;
    
    // Count player chips
    for (const [playerId, playerInfo] of table.players) {
      total += playerInfo.player.chips;
      // Include chips that are in bet but not yet in pot
      total += playerInfo.player.bet || 0;
    }
    
    // Count pot chips
    if (table.gameEngine && table.gameEngine.potManager) {
      const pots = table.gameEngine.potManager.pots;
      for (const pot of pots) {
        total += pot.amount;
      }
    }
    
    return total;
  }

  // Helper to count only what customer might be counting (stacks + pots, not bets in transition)
  function countTotalChipsCustomerWay(table) {
    let total = 0;
    
    // Count player chips (but NOT the bet field)
    for (const [playerId, playerInfo] of table.players) {
      total += playerInfo.player.chips;
    }
    
    // Count pot chips
    if (table.gameEngine && table.gameEngine.potManager) {
      const pots = table.gameEngine.potManager.pots;
      for (const pot of pots) {
        total += pot.amount;
      }
    }
    
    return total;
  }

  it('should detect race condition in handleBet when counting chips', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'race-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
      maxPlayers: 4,
      dealerButton: 0
    });

    // Add players
    const player1 = new BettingPlayer({ 
      id: 'p1', 
      chips: 1000,
      shouldBet: true,
      betAmount: 100
    });
    const player2 = new BettingPlayer({ id: 'p2', chips: 1000 });
    const player3 = new BettingPlayer({ id: 'p3', chips: 1000 });
    const player4 = new BettingPlayer({ id: 'p4', chips: 1000 });
    
    await table.addPlayer(player1);
    await table.addPlayer(player2);
    await table.addPlayer(player3);
    await table.addPlayer(player4);

    const expectedTotal = 4000;
    let raceConditionDetected = false;
    let violationDetails = null;

    // Set up monitoring before starting the game
    let checksPerformed = 0;
    
    table.on('game:started', () => {
      // After game starts, monitor handleBet calls
      if (table.gameEngine) {
        const originalHandleBet = table.gameEngine.handleBet.bind(table.gameEngine);
        
        table.gameEngine.handleBet = function(player, amount, blindType) {
          // Store initial state
          const chipsBefore = player.chips;
          const betBefore = player.bet;
          
          // Call the original (possibly fixed) function
          const result = originalHandleBet(player, amount, blindType);
          
          // After the handleBet completes, check for conservation
          // If the implementation is correct, chips should always be conserved
          const customerCount = countTotalChipsCustomerWay(table);
          const completeCount = countTotalChipsComplete(table);
          checksPerformed++;
          
          if (customerCount < expectedTotal) {
            // Race condition detected! Chips are missing when counted customer way
            raceConditionDetected = true;
            violationDetails = {
              phase: 'after-handleBet-complete',
              playerId: player.id,
              amount: amount,
              chipsBefore,
              chipsAfter: player.chips,
              betBefore,
              betAfter: player.bet,
              customerCount,
              completeCount,
              difference: expectedTotal - customerCount,
              explanation: 'Chips missing after handleBet completed'
            };
          }
          
          return result;
        };
      }
    });
    
    // Start the game
    const gamePromise = new Promise(async (resolve) => {
      table.once('hand:ended', () => {
        setTimeout(resolve, 100);
      });
      await table.tryStartGame();
    });

    await gamePromise;

    // Check final state
    const finalCustomerCount = countTotalChipsCustomerWay(table);
    const finalCompleteCount = countTotalChipsComplete(table);

    console.log('\n=== RACE CONDITION TEST RESULTS ===');
    console.log(`Race condition detected: ${raceConditionDetected}`);
    if (violationDetails) {
      console.log('Violation details:', violationDetails);
    }
    console.log(`Final customer count: ${finalCustomerCount}`);
    console.log(`Final complete count: ${finalCompleteCount}`);

    // The test expects NO race condition (atomic operations)
    // This will FAIL with current buggy code (RED phase)
    // This will PASS when we fix the bug (GREEN phase)
    expect(raceConditionDetected).toBe(false);
    expect(violationDetails).toBeNull();
    
    // Final counts should be correct (chips eventually consistent)
    expect(finalCustomerCount).toBe(expectedTotal);
    expect(finalCompleteCount).toBe(expectedTotal);
  });

  it('should maintain atomic chip conservation during simultaneous multi-table betting', async () => {
    const manager = new PokerGameManager();
    const tableCount = 8;
    const tables = [];
    const violationsFound = [];

    // Create multiple tables
    for (let t = 0; t < tableCount; t++) {
      const table = manager.createTable({
        id: `atomic-test-${t}`,
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
        maxPlayers: 3,
        dealerButton: 0
      });
      
      // Add players who will bet
      for (let p = 0; p < 3; p++) {
        const player = new BettingPlayer({ 
          id: `t${t}-p${p}`, 
          chips: 1000,
          shouldBet: p === 0, // First player bets
          betAmount: 50
        });
        await table.addPlayer(player);
      }
      
      tables.push(table);
    }

    const expectedTotalPerTable = 3000;
    const expectedGrandTotal = tableCount * expectedTotalPerTable;

    // Monitor all tables for race conditions
    tables.forEach((table, idx) => {
      table.on('betting:player-acted', () => {
        const customerCount = countTotalChipsCustomerWay(table);
        const completeCount = countTotalChipsComplete(table);
        
        if (customerCount < expectedTotalPerTable) {
          violationsFound.push({
            tableId: idx,
            customerCount,
            completeCount,
            difference: expectedTotalPerTable - customerCount,
            timestamp: Date.now()
          });
        }
      });
    });

    // Start all games simultaneously
    const gamePromises = tables.map(table => {
      return new Promise(async (resolve) => {
        table.once('hand:ended', () => {
          setTimeout(resolve, 50);
        });
        await table.tryStartGame();
      });
    });

    await Promise.all(gamePromises);

    // Count total violations
    console.log(`\n=== MULTI-TABLE RACE CONDITION TEST ===`);
    console.log(`Tables tested: ${tableCount}`);
    console.log(`Race condition violations found: ${violationsFound.length}`);
    
    if (violationsFound.length > 0) {
      const avgDifference = violationsFound.reduce((sum, v) => sum + v.difference, 0) / violationsFound.length;
      console.log(`Average chip difference during violations: ${avgDifference}`);
      console.log(`First violation:`, violationsFound[0]);
    }

    // We expect NO violations (atomic operations)
    // This will FAIL with current buggy code (RED phase)
    // This will PASS when we fix the bug (GREEN phase)
    expect(violationsFound.length).toBe(0);
    
    // But final state should be correct
    const finalTotal = tables.reduce((sum, table) => sum + countTotalChipsCustomerWay(table), 0);
    expect(finalTotal).toBe(expectedGrandTotal);
  });
});