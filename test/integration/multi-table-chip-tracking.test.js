import { describe, it, expect } from 'vitest';
import { PokerGameManager } from '../../packages/core/src/PokerGameManager.js';
import { Player } from '../../packages/core/src/Player.js';
import { Action } from '../../packages/core/src/types/index.js';

describe('Multi-Table Chip Conservation - Continuous Monitoring', () => {
  class TestPlayer extends Player {
    constructor(config) {
      super(config);
      this.chips = config.chips || 1000;
      this.strategy = config.strategy || 'normal';
    }

    async getAction(gameState) {
      const myState = gameState.players[this.id];
      
      // Different strategies for different players to create variety
      switch (this.strategy) {
        case 'aggressive':
          if (gameState.toCall === 0) {
            // Must use BET when there's no current bet, not RAISE
            return { action: Action.BET, amount: 40, timestamp: Date.now() };
          }
          if (gameState.toCall <= 40) {
            return { action: Action.CALL, timestamp: Date.now() };
          }
          return { action: Action.FOLD, timestamp: Date.now() };
          
        case 'passive':
          if (gameState.toCall > 20) {
            return { action: Action.FOLD, timestamp: Date.now() };
          }
          if (gameState.toCall > 0) {
            return { action: Action.CALL, timestamp: Date.now() };
          }
          return { action: Action.CHECK, timestamp: Date.now() };
          
        default:
          // Normal strategy - call small amounts
          if (gameState.toCall > 40) {
            return { action: Action.FOLD, timestamp: Date.now() };
          }
          if (gameState.toCall > 0) {
            return { action: Action.CALL, timestamp: Date.now() };
          }
          return { action: Action.CHECK, timestamp: Date.now() };
      }
    }
  }

  function countTotalChips(tables) {
    let total = 0;
    for (const table of tables) {
      for (const [playerId, playerInfo] of table.players) {
        total += playerInfo.player.chips;
      }
    }
    return total;
  }

  it('should detect chip conservation violations during simultaneous play', { timeout: 30000 }, async () => {
    const manager = new PokerGameManager();
    const tableCount = 8;
    const playersPerTable = 6;
    const chipsPerPlayer = 1000;
    const expectedTotal = tableCount * playersPerTable * chipsPerPlayer;
    
    const tables = [];
    const chipViolations = [];
    let checkCount = 0;
    
    // Create tables with varied player strategies
    for (let t = 0; t < tableCount; t++) {
      const table = manager.createTable({
        id: `table-${t}`,
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
        maxPlayers: playersPerTable,
        dealerButton: 0
      });
      tables.push(table);

      for (let p = 0; p < playersPerTable; p++) {
        const strategies = ['aggressive', 'passive', 'normal'];
        const strategy = strategies[p % strategies.length];
        const player = new TestPlayer({ 
          id: `t${t}-p${p}`, 
          chips: chipsPerPlayer,
          strategy
        });
        await table.addPlayer(player);
      }
    }

    // Verify initial chip count
    const initialChips = countTotalChips(tables);
    console.log(`Initial chips: ${initialChips} (expected: ${expectedTotal})`);
    expect(initialChips).toBe(expectedTotal);

    // Start continuous chip monitoring
    const monitorInterval = setInterval(() => {
      checkCount++;
      const currentChips = countTotalChips(tables);
      const difference = currentChips - expectedTotal;
      
      if (difference !== 0) {
        chipViolations.push({
          checkNumber: checkCount,
          timestamp: Date.now(),
          totalChips: currentChips,
          expectedChips: expectedTotal,
          difference: difference,
          percentageLoss: ((difference / expectedTotal) * 100).toFixed(2)
        });
        console.log(`⚠️ CHECK ${checkCount}: Chip violation detected!`);
        console.log(`   Current: ${currentChips}, Expected: ${expectedTotal}, Diff: ${difference} (${((difference / expectedTotal) * 100).toFixed(2)}%)`);
      }
    }, 50); // Check every 50ms

    // Start all tables simultaneously
    const gamePromises = tables.map(async (table, index) => {
      // Set up event listeners before starting
      let handsPlayed = 0;
      const maxHands = 3;
      
      return new Promise(async (resolve) => {
        const playNextHand = async () => {
          if (handsPlayed >= maxHands) {
            resolve();
            return;
          }
          
          // Listen for hand end
          table.once('hand:ended', () => {
            handsPlayed++;
            console.log(`Table ${index} completed hand ${handsPlayed}/${maxHands}`);
            setTimeout(playNextHand, 100); // Small delay before next hand
          });
          
          // Start the game
          const result = await table.tryStartGame();
          if (!result.success) {
            console.log(`Table ${index} failed to start: ${result.reason}`);
            console.log(`Error details: ${result.details.error}`);
            console.log(`Error name: ${result.details.errorName}`);
            resolve();
          }
        };
        
        // Start first hand
        await playNextHand();
      });
    });

    // Wait for all games to complete
    await Promise.all(gamePromises);
    clearInterval(monitorInterval);

    // Final chip count
    const finalChips = countTotalChips(tables);
    console.log(`\n=== FINAL RESULTS ===`);
    console.log(`Total checks performed: ${checkCount}`);
    console.log(`Chip violations detected: ${chipViolations.length}`);
    console.log(`Final chips: ${finalChips} (expected: ${expectedTotal})`);
    
    if (chipViolations.length > 0) {
      console.log(`\n=== CHIP VIOLATIONS ===`);
      chipViolations.forEach(v => {
        console.log(`Check ${v.checkNumber}: ${v.difference} chips (${v.percentageLoss}% loss)`);
      });
      
      // Find pattern
      const avgLoss = chipViolations.reduce((sum, v) => sum + v.difference, 0) / chipViolations.length;
      console.log(`\nAverage chip loss during violations: ${avgLoss.toFixed(2)}`);
      
      // Check if it matches customer's -4800 pattern (100 chips per player)
      if (Math.abs(avgLoss) === 100 * tableCount * playersPerTable / tableCount) {
        console.log(`⚠️ MATCHES CUSTOMER BUG PATTERN: Loss of 100 chips per table!`);
      }
    }
    
    // Assert no violations occurred
    expect(chipViolations.length).toBe(0);
    expect(finalChips).toBe(expectedTotal);
  });

  it('should handle stress test with rapid table operations', { timeout: 30000 }, async () => {
    const manager = new PokerGameManager();
    const operations = [];
    const chipSnapshots = [];
    const expectedChips = new Map(); // Track expected chips per table
    
    // Perform 20 rapid operations
    for (let op = 0; op < 20; op++) {
      operations.push(async () => {
        const tableId = `stress-table-${op}`;
        const table = manager.createTable({
          id: tableId,
          blinds: { small: 5, big: 10 },
          minPlayers: 2,
          maxPlayers: 4,
          dealerButton: 0
        });
        
        // Add 2-4 players randomly
        const playerCount = 2 + Math.floor(Math.random() * 3);
        let tableChips = 0;
        
        for (let p = 0; p < playerCount; p++) {
          const chips = 500 + Math.floor(Math.random() * 1000);
          tableChips += chips;
          const player = new TestPlayer({ 
            id: `stress-${op}-p${p}`, 
            chips,
            strategy: Math.random() > 0.5 ? 'aggressive' : 'passive'
          });
          await table.addPlayer(player);
        }
        
        expectedChips.set(tableId, tableChips);
        
        // Play 1-2 hands
        const handsToPlay = 1 + Math.floor(Math.random() * 2);
        for (let h = 0; h < handsToPlay; h++) {
          const handPromise = new Promise(resolve => {
            table.once('hand:ended', () => {
              // Take snapshot of chips after each hand
              let currentTableChips = 0;
              for (const [_, playerInfo] of table.players) {
                currentTableChips += playerInfo.player.chips;
              }
              chipSnapshots.push({
                tableId,
                handNumber: h + 1,
                chips: currentTableChips,
                expected: tableChips,
                difference: currentTableChips - tableChips
              });
              setTimeout(resolve, 50);
            });
          });
          
          await table.tryStartGame();
          await handPromise;
        }
        
        return table;
      });
    }
    
    // Execute all operations in parallel
    console.log('Starting stress test with 20 simultaneous table operations...');
    const tables = await Promise.all(operations.map(op => op()));
    
    // Analyze results
    const violations = chipSnapshots.filter(s => s.difference !== 0);
    console.log(`\n=== STRESS TEST RESULTS ===`);
    console.log(`Total snapshots: ${chipSnapshots.length}`);
    console.log(`Violations found: ${violations.length}`);
    
    if (violations.length > 0) {
      console.log(`\n=== VIOLATIONS ===`);
      violations.forEach(v => {
        console.log(`Table ${v.tableId}, Hand ${v.handNumber}: ${v.difference} chip difference`);
      });
    }
    
    // Verify final state
    let totalFinalChips = 0;
    let totalExpectedChips = 0;
    
    for (const table of tables) {
      for (const [_, playerInfo] of table.players) {
        totalFinalChips += playerInfo.player.chips;
      }
      totalExpectedChips += expectedChips.get(table.id);
    }
    
    console.log(`\nFinal chips: ${totalFinalChips}`);
    console.log(`Expected chips: ${totalExpectedChips}`);
    console.log(`Difference: ${totalFinalChips - totalExpectedChips}`);
    
    expect(violations.length).toBe(0);
    expect(totalFinalChips).toBe(totalExpectedChips);
  });
});