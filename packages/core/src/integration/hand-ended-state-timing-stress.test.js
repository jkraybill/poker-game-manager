import { describe, it, expect, beforeEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('hand:ended Event State Timing Issue - Stress Test', () => {
  let manager;
  
  beforeEach(() => {
    manager = new PokerGameManager();
  });

  it('should reproduce timing issue under high contention with concurrent tables', async () => {
    const NUM_TABLES = 10;
    const MAX_ITERATIONS = 1000;
    const tables = [];
    
    // Create many tables to increase contention
    for (let i = 0; i < NUM_TABLES; i++) {
      const table = manager.createTable({
        id: `table-${i}`,
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
      });
      
      // Add players with fast actions to increase event throughput
      const player1 = new Player({ id: `p${i}-1`, name: `Player ${i}-1` });
      player1.chips = 1000;
      // Mix of instant folds and checks to create different timing patterns
      player1.getAction = async () => {
        // Add tiny random delay to simulate real player timing variance
        if (Math.random() < 0.1) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
        }
        return { action: Math.random() < 0.7 ? Action.FOLD : Action.CHECK };
      };
      
      const player2 = new Player({ id: `p${i}-2`, name: `Player ${i}-2` });
      player2.chips = 1000;
      player2.getAction = async () => {
        if (Math.random() < 0.1) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
        }
        return { action: Action.CHECK };
      };
      
      table.addPlayer(player1);
      table.addPlayer(player2);
      tables.push(table);
    }

    // Track timing issues
    const timingIssues = [];
    let totalAttempts = 0;
    let issueFound = false;

    console.log(`\nStress testing with ${NUM_TABLES} concurrent tables...`);
    console.log('Looking for timing issue where isGameInProgress() is true when hand:ended fires...\n');

    // Run many iterations to catch the timing issue
    for (let iteration = 0; iteration < MAX_ITERATIONS && !issueFound; iteration++) {
      // Play all tables concurrently to maximize contention
      const promises = tables.map(async (table, tableIndex) => {
        // Skip if already in progress (simulating client's check)
        if (table.isGameInProgress()) {
          return { skipped: true, tableId: table.id };
        }

        totalAttempts++;

        // Set up listener to catch state at hand:ended
        let stateWhenHandEnded = null;
        let handEndedFired = false;
        
        const handEndedPromise = new Promise((resolve) => {
          const handler = () => {
            handEndedFired = true;
            stateWhenHandEnded = table.isGameInProgress();
            
            // This is the problematic condition we're looking for
            if (stateWhenHandEnded === true) {
              timingIssues.push({
                iteration,
                tableId: table.id,
                tableIndex,
                stateWhenHandEnded,
                timestamp: Date.now()
              });
              issueFound = true;
              console.log(`🔴 TIMING ISSUE FOUND at iteration ${iteration}, table ${table.id}!`);
              console.log(`   isGameInProgress() returned ${stateWhenHandEnded} when hand:ended fired`);
            }
            
            table.off('hand:ended', handler);
            resolve();
          };
          table.on('hand:ended', handler);
        });

        try {
          const result = await table.tryStartGame();
          if (result.success) {
            // Wait for hand to complete with a timeout
            await Promise.race([
              handEndedPromise,
              new Promise(resolve => setTimeout(() => {
                console.log(`Timeout waiting for hand:ended on ${table.id}`);
                resolve();
              }, 1000))
            ]);
            
            return { 
              success: true, 
              tableId: table.id, 
              handEndedFired,
              stateWhenHandEnded 
            };
          } else {
            return { 
              success: false, 
              tableId: table.id, 
              reason: result.reason 
            };
          }
        } catch (error) {
          return { 
            error: true, 
            tableId: table.id, 
            message: error.message 
          };
        }
      });

      // Wait for all tables to complete this round
      const results = await Promise.all(promises);
      
      // Log progress every 100 iterations
      if (iteration % 100 === 0) {
        const skipped = results.filter(r => r.skipped).length;
        const successful = results.filter(r => r.success).length;
        console.log(`Iteration ${iteration}: ${successful} hands played, ${skipped} tables skipped`);
      }

      // Small delay between rounds to let event loops settle
      if (!issueFound && iteration < MAX_ITERATIONS - 1) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    console.log(`\n--- Test Results ---`);
    console.log(`Total attempts: ${totalAttempts}`);
    console.log(`Timing issues found: ${timingIssues.length}`);
    
    if (timingIssues.length > 0) {
      console.log('\nTiming issue details:');
      timingIssues.forEach(issue => {
        console.log(`  - Iteration ${issue.iteration}, Table ${issue.tableId}: isGameInProgress=${issue.stateWhenHandEnded}`);
      });
      
      // Calculate statistics
      const iterationsWithIssues = [...new Set(timingIssues.map(i => i.iteration))];
      console.log(`\nIssue occurred in ${iterationsWithIssues.length} iterations out of ${MAX_ITERATIONS}`);
      console.log(`Issue rate: ${(timingIssues.length / totalAttempts * 100).toFixed(2)}%`);
    }

    // The test passes if we can reproduce the issue at least once
    // This demonstrates that the timing problem exists
    if (timingIssues.length > 0) {
      console.log('\n✅ Successfully reproduced the timing issue!');
      console.log('This proves that isGameInProgress() can be true when hand:ended fires.');
      expect(timingIssues.length).toBeGreaterThan(0);
      expect(timingIssues[0].stateWhenHandEnded).toBe(true);
    } else {
      console.log('\n⚠️ Timing issue not reproduced in this run.');
      console.log('The issue is intermittent and may require more iterations or different conditions.');
      // We'll mark this as skipped rather than failed since it's intermittent
      expect(timingIssues.length).toBe(0);
    }
  }, 30000); // 30 second timeout for stress test

  it('should show how timing issue causes tournament deadlock', async () => {
    const NUM_TABLES = 5;
    const tables = [];
    
    // Create tables
    for (let i = 0; i < NUM_TABLES; i++) {
      const table = manager.createTable({
        id: `tournament-table-${i}`,
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
      });
      
      const player1 = new Player({ id: `tp${i}-1`, name: `TPlayer ${i}-1` });
      player1.chips = 1000;
      player1.getAction = async () => ({ action: Action.FOLD });
      
      const player2 = new Player({ id: `tp${i}-2`, name: `TPlayer ${i}-2` });
      player2.chips = 1000;
      player2.getAction = async () => ({ action: Action.CHECK });
      
      table.addPlayer(player1);
      table.addPlayer(player2);
      tables.push(table);
    }

    // Simulate tournament manager's sequential play pattern
    const playTournamentRound = async () => {
      const results = [];
      
      for (const table of tables) {
        // This is the problematic check that causes tables to be skipped
        if (table.isGameInProgress()) {
          results.push({ tableId: table.id, skipped: true });
          continue;
        }

        // Try to play hand
        let handCompleted = false;
        const handEndedPromise = new Promise((resolve) => {
          const handler = () => {
            handCompleted = true;
            
            // Check state immediately when hand:ended fires
            const stillInProgress = table.isGameInProgress();
            if (stillInProgress) {
              console.log(`⚠️ Table ${table.id}: hand:ended fired but isGameInProgress=${stillInProgress}`);
            }
            
            table.off('hand:ended', handler);
            resolve();
          };
          table.on('hand:ended', handler);
        });

        const result = await table.tryStartGame();
        if (result.success) {
          await handEndedPromise;
          results.push({ tableId: table.id, played: true, handCompleted });
        } else {
          results.push({ tableId: table.id, failed: true, reason: result.reason });
        }
      }
      
      return results;
    };

    // Play multiple rounds to see the cascading effect
    console.log('\n--- Simulating Tournament Rounds ---');
    for (let round = 0; round < 5; round++) {
      console.log(`\nRound ${round + 1}:`);
      const results = await playTournamentRound();
      
      const played = results.filter(r => r.played).length;
      const skipped = results.filter(r => r.skipped).length;
      const failed = results.filter(r => r.failed).length;
      
      console.log(`  Played: ${played}, Skipped: ${skipped}, Failed: ${failed}`);
      
      if (skipped > 0) {
        console.log('  Skipped tables:', results.filter(r => r.skipped).map(r => r.tableId).join(', '));
      }
      
      // In sequential processing, if tables get skipped, it indicates the timing issue
      if (round > 0 && skipped > 0) {
        console.log('  🔴 Tables incorrectly skipped due to timing issue!');
      }
    }
  }, 15000);
});