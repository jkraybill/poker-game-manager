import { describe, it, expect } from 'vitest';
import { PokerGameManager } from '../../packages/core/src/PokerGameManager.js';
import { Player } from '../../packages/core/src/Player.js';
import { Action } from '../../packages/core/src/types/index.js';

describe('Customer Exact Scenario - Chip Conservation During Hands', () => {
  // Player that exactly mimics customer's validated implementation
  class CustomerPlayer extends Player {
    constructor(config) {
      super(config);
      this.chips = config.chips || 1000;
    }

    async getAction(gameState) {
      // Customer claims they fixed BET/RAISE issues, so use only valid actions
      if (gameState.toCall > 0) {
        // Must call, raise or fold
        if (gameState.toCall <= 30) {
          return { action: Action.CALL, timestamp: Date.now() };
        }
        return { action: Action.FOLD, timestamp: Date.now() };
      }
      
      // No amount to call - check
      return { action: Action.CHECK, timestamp: Date.now() };
    }
  }

  // Count chips ONLY in player stacks (not pots) - as customer might be doing
  function countPlayerStacksOnly(tables) {
    let total = 0;
    for (const table of tables) {
      for (const [playerId, playerInfo] of table.players) {
        total += playerInfo.player.chips;
      }
    }
    return total;
  }

  // Count chips in pots only
  function countPotsOnly(tables) {
    let total = 0;
    for (const table of tables) {
      if (table.gameEngine && table.gameEngine.potManager) {
        const pots = table.gameEngine.potManager.pots;
        for (const pot of pots) {
          total += pot.amount;
        }
      }
    }
    return total;
  }

  // Count total chips (stacks + pots)
  function countTotalChips(tables) {
    return countPlayerStacksOnly(tables) + countPotsOnly(tables);
  }

  it('should reproduce customer chip conservation issue', { timeout: 30000 }, async () => {
    const manager = new PokerGameManager();
    const tableCount = 8;
    const playersPerTable = 6;
    const chipsPerPlayer = 1000;
    const expectedTotal = tableCount * playersPerTable * chipsPerPlayer; // 48000
    
    const tables = [];
    
    // Create tables exactly as customer would
    for (let t = 0; t < tableCount; t++) {
      const table = manager.createTable({
        id: `customer-table-${t}`,
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
        maxPlayers: playersPerTable,
        dealerButton: 0
      });
      tables.push(table);

      for (let p = 0; p < playersPerTable; p++) {
        const player = new CustomerPlayer({ 
          id: `t${t}-p${p}`, 
          chips: chipsPerPlayer
        });
        await table.addPlayer(player);
      }
    }

    // Initial count
    const initialStacks = countPlayerStacksOnly(tables);
    const initialPots = countPotsOnly(tables);
    const initialTotal = countTotalChips(tables);
    
    console.log(`=== INITIAL STATE ===`);
    console.log(`Player stacks: ${initialStacks}`);
    console.log(`Pots: ${initialPots}`);
    console.log(`Total: ${initialTotal}`);
    expect(initialTotal).toBe(expectedTotal);

    // Track violations during play
    const violations = [];
    let checkCount = 0;
    
    // Start all tables simultaneously
    const gamePromises = tables.map(async (table) => {
      return new Promise(async (resolve) => {
        // Set up monitoring for this specific table
        let handInProgress = false;
        
        table.on('hand:started', () => {
          handInProgress = true;
        });
        
        table.on('hand:ended', () => {
          handInProgress = false;
          resolve();
        });
        
        // Start the game
        await table.tryStartGame();
      });
    });

    // Monitor chips DURING gameplay (customer's observation window)
    const monitorPromise = new Promise((resolve) => {
      const interval = setInterval(() => {
        checkCount++;
        
        const stacks = countPlayerStacksOnly(tables);
        const pots = countPotsOnly(tables);
        const total = stacks + pots;
        
        // Check if customer might be seeing "missing" chips
        if (stacks < expectedTotal && pots > 0) {
          // Chips are in pots, not lost!
          violations.push({
            check: checkCount,
            stacksOnly: stacks,
            potsOnly: pots,
            total: total,
            apparentLoss: expectedTotal - stacks,
            actualLoss: expectedTotal - total
          });
        }
        
        // Stop monitoring after a reasonable time
        if (checkCount > 100) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
      
      // Also resolve when all games end
      Promise.all(gamePromises).then(() => {
        clearInterval(interval);
        resolve();
      });
    });

    // Wait for monitoring to complete
    await monitorPromise;
    await Promise.all(gamePromises);

    // Final count (customer says chips "restore" here)
    const finalStacks = countPlayerStacksOnly(tables);
    const finalPots = countPotsOnly(tables);
    const finalTotal = countTotalChips(tables);
    
    console.log(`\n=== AFTER ALL HANDS COMPLETE ===`);
    console.log(`Player stacks: ${finalStacks}`);
    console.log(`Pots: ${finalPots}`);
    console.log(`Total: ${finalTotal}`);
    console.log(`Checks performed: ${checkCount}`);
    
    if (violations.length > 0) {
      console.log(`\n=== APPARENT VIOLATIONS (Customer's View) ===`);
      console.log(`Total "violations": ${violations.length}`);
      console.log(`First violation:`);
      console.log(`  - Stacks only: ${violations[0].stacksOnly} (-${violations[0].apparentLoss})`);
      console.log(`  - Pots: ${violations[0].potsOnly}`);
      console.log(`  - Actual total: ${violations[0].total}`);
      console.log(`  - Real loss: ${violations[0].actualLoss}`);
      
      const maxApparentLoss = Math.max(...violations.map(v => v.apparentLoss));
      const avgApparentLoss = violations.reduce((sum, v) => sum + v.apparentLoss, 0) / violations.length;
      console.log(`\nMax apparent loss: ${maxApparentLoss}`);
      console.log(`Avg apparent loss: ${avgApparentLoss.toFixed(2)}`);
      
      // Check if any REAL violations occurred
      const realViolations = violations.filter(v => v.actualLoss !== 0);
      console.log(`\nREAL violations (total != ${expectedTotal}): ${realViolations.length}`);
      
      if (realViolations.length > 0) {
        console.log(`⚠️ REAL CHIP CONSERVATION VIOLATION DETECTED!`);
        console.log(realViolations[0]);
      }
    }
    
    // The key assertion - total chips should always be conserved
    expect(finalTotal).toBe(expectedTotal);
    
    // Check if there were any REAL violations (not just chips in pots)
    const realViolations = violations.filter(v => v.actualLoss !== 0);
    expect(realViolations.length).toBe(0);
    
    // Customer might be checking stacks only
    if (finalStacks !== expectedTotal && finalPots === 0) {
      console.log(`\n⚠️ Customer might see: Stacks show ${finalStacks} instead of ${expectedTotal}`);
      console.log(`But this is after pots were distributed to winners!`);
    }
  });

  it('should test customer counting methodology', { timeout: 30000 }, async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'single-table-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
      maxPlayers: 4,
      dealerButton: 0
    });

    // Add 4 players with 1000 chips each
    for (let p = 0; p < 4; p++) {
      const player = new CustomerPlayer({ 
        id: `player-${p}`, 
        chips: 1000
      });
      await table.addPlayer(player);
    }

    const expectedTotal = 4000;
    
    console.log(`\n=== SINGLE TABLE DETAILED TRACKING ===`);
    
    // Track chip movement through entire hand
    const snapshots = [];
    
    table.on('hand:started', () => {
      snapshots.push({
        event: 'hand:started',
        stacks: countPlayerStacksOnly([table]),
        pots: countPotsOnly([table]),
        total: countTotalChips([table])
      });
    });
    
    table.on('betting:player-acted', (data) => {
      snapshots.push({
        event: 'player-acted',
        player: data.playerId,
        action: data.action,
        stacks: countPlayerStacksOnly([table]),
        pots: countPotsOnly([table]),
        total: countTotalChips([table])
      });
    });
    
    table.on('betting:round-end', (data) => {
      snapshots.push({
        event: 'round-end',
        phase: data.phase,
        stacks: countPlayerStacksOnly([table]),
        pots: countPotsOnly([table]),
        total: countTotalChips([table])
      });
    });
    
    table.on('hand:ended', () => {
      snapshots.push({
        event: 'hand:ended',
        stacks: countPlayerStacksOnly([table]),
        pots: countPotsOnly([table]),
        total: countTotalChips([table])
      });
    });

    // Play one hand
    await new Promise(async (resolve) => {
      table.once('hand:ended', () => {
        setTimeout(resolve, 100);
      });
      await table.tryStartGame();
    });

    // Analyze snapshots
    console.log(`Total snapshots: ${snapshots.length}`);
    
    // Find moments where stacks < 4000 (customer's "violation")
    const apparentViolations = snapshots.filter(s => s.stacks < expectedTotal);
    const realViolations = snapshots.filter(s => s.total !== expectedTotal);
    
    console.log(`\nApparent violations (stacks < 4000): ${apparentViolations.length}`);
    console.log(`Real violations (total != 4000): ${realViolations.length}`);
    
    if (apparentViolations.length > 0) {
      console.log(`\nDuring hand, chips move from stacks to pots:`);
      apparentViolations.slice(0, 3).forEach(s => {
        console.log(`  ${s.event}: Stacks=${s.stacks}, Pots=${s.pots}, Total=${s.total}`);
      });
    }
    
    // All totals should equal 4000
    const allTotalsCorrect = snapshots.every(s => s.total === expectedTotal);
    expect(allTotalsCorrect).toBe(true);
    
    if (!allTotalsCorrect) {
      const wrongTotals = snapshots.filter(s => s.total !== expectedTotal);
      console.log(`\n⚠️ REAL VIOLATIONS FOUND:`);
      wrongTotals.forEach(s => {
        console.log(`  ${s.event}: Total=${s.total} (should be ${expectedTotal})`);
      });
    }
  });
});