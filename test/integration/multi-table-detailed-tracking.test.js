import { describe, it, expect } from 'vitest';
import { PokerGameManager } from '../../packages/core/src/PokerGameManager.js';
import { Player } from '../../packages/core/src/Player.js';
import { Action } from '../../packages/core/src/types/index.js';

describe('Multi-Table Chip Conservation - Detailed Tracking', () => {
  // Simple, validated player that won't cause BET/RAISE errors
  class ValidatedPlayer extends Player {
    constructor(config) {
      super(config);
      this.chips = config.chips || 1000;
      this.actionLog = [];
    }

    async getAction(gameState) {
      const myState = gameState.players[this.id];
      
      // Log every action for debugging
      const decision = this.makeDecision(gameState, myState);
      this.actionLog.push({
        phase: gameState.phase,
        toCall: gameState.toCall,
        currentBet: gameState.currentBet,
        decision: decision.action,
        amount: decision.amount
      });
      
      return decision;
    }
    
    makeDecision(gameState, myState) {
      // Very simple strategy that avoids BET/RAISE confusion
      if (gameState.toCall > 0) {
        // We need to call, raise, or fold
        if (gameState.toCall <= 20) {
          // Call small amounts
          return { action: Action.CALL, timestamp: Date.now() };
        } else {
          // Fold to larger bets
          return { action: Action.FOLD, timestamp: Date.now() };
        }
      } else {
        // We're caught up - check
        return { action: Action.CHECK, timestamp: Date.now() };
      }
    }
  }

  function countTotalChips(tables, includePots = false) {
    let total = 0;
    
    // Count chips in player stacks
    for (const table of tables) {
      for (const [playerId, playerInfo] of table.players) {
        total += playerInfo.player.chips;
      }
      
      // Include chips in pots if requested
      if (includePots && table.gameEngine && table.gameEngine.potManager) {
        const pots = table.gameEngine.potManager.pots;
        for (const pot of pots) {
          total += pot.amount;
        }
      }
    }
    
    return total;
  }
  
  function getDetailedChipSnapshot(tables) {
    const snapshot = {
      timestamp: Date.now(),
      tables: []
    };
    
    for (const table of tables) {
      const tableData = {
        id: table.id,
        state: table.state,
        players: {},
        pots: [],
        totalTableChips: 0
      };
      
      // Get player chips
      for (const [playerId, playerInfo] of table.players) {
        tableData.players[playerId] = {
          chips: playerInfo.player.chips,
          bet: playerInfo.player.bet || 0,
          state: playerInfo.player.state
        };
        tableData.totalTableChips += playerInfo.player.chips;
      }
      
      // Get pot information if game is in progress
      if (table.gameEngine && table.gameEngine.potManager) {
        const pots = table.gameEngine.potManager.pots;
        for (const pot of pots) {
          tableData.pots.push({
            id: pot.id,
            amount: pot.amount,
            eligible: pot.eligiblePlayers.length
          });
          tableData.totalTableChips += pot.amount;
        }
      }
      
      snapshot.tables.push(tableData);
    }
    
    snapshot.totalChips = snapshot.tables.reduce((sum, t) => sum + t.totalTableChips, 0);
    return snapshot;
  }

  it('should track chips throughout entire hand lifecycle', { timeout: 30000 }, async () => {
    const manager = new PokerGameManager();
    const tableCount = 8;
    const playersPerTable = 6;
    const chipsPerPlayer = 1000;
    const expectedTotal = tableCount * playersPerTable * chipsPerPlayer;
    
    const tables = [];
    const snapshots = [];
    
    // Create tables
    for (let t = 0; t < tableCount; t++) {
      const table = manager.createTable({
        id: `lifecycle-table-${t}`,
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
        maxPlayers: playersPerTable,
        dealerButton: 0
      });
      tables.push(table);

      for (let p = 0; p < playersPerTable; p++) {
        const player = new ValidatedPlayer({ 
          id: `t${t}-p${p}`, 
          chips: chipsPerPlayer
        });
        await table.addPlayer(player);
      }
    }

    // Initial snapshot
    snapshots.push({
      phase: 'initial',
      ...getDetailedChipSnapshot(tables)
    });
    
    console.log(`Initial total: ${snapshots[0].totalChips}`);
    expect(snapshots[0].totalChips).toBe(expectedTotal);

    // Set up continuous monitoring during play
    let monitoringActive = true;
    const monitoringSnapshots = [];
    
    const monitorInterval = setInterval(() => {
      if (!monitoringActive) return;
      
      const snapshot = getDetailedChipSnapshot(tables);
      if (snapshot.totalChips !== expectedTotal) {
        monitoringSnapshots.push({
          ...snapshot,
          violation: true,
          difference: snapshot.totalChips - expectedTotal
        });
        console.log(`⚠️ Violation detected: ${snapshot.totalChips} (diff: ${snapshot.totalChips - expectedTotal})`);
      }
    }, 10); // Check every 10ms for maximum resolution

    // Start all tables simultaneously
    const gamePromises = tables.map(async (table, index) => {
      // Track events for each table
      const tableEvents = [];
      
      // Listen to all relevant events
      table.on('hand:started', () => {
        tableEvents.push({ event: 'hand:started', timestamp: Date.now() });
      });
      
      table.on('betting:round-start', (data) => {
        tableEvents.push({ event: 'betting:round-start', phase: data.phase, timestamp: Date.now() });
      });
      
      table.on('betting:round-end', (data) => {
        tableEvents.push({ event: 'betting:round-end', phase: data.phase, timestamp: Date.now() });
      });
      
      table.on('pot:updated', (data) => {
        tableEvents.push({ event: 'pot:updated', amount: data.amount, timestamp: Date.now() });
      });
      
      table.on('hand:ended', () => {
        tableEvents.push({ event: 'hand:ended', timestamp: Date.now() });
        
        // Take snapshot after hand ends
        const snapshot = getDetailedChipSnapshot([table]);
        if (snapshot.totalChips !== chipsPerPlayer * playersPerTable) {
          console.log(`Table ${index} chip violation after hand: ${snapshot.totalChips}`);
        }
      });
      
      // Play one hand
      await new Promise((resolve) => {
        table.once('hand:ended', () => {
          setTimeout(resolve, 50);
        });
        table.tryStartGame();
      });
      
      return { tableId: table.id, events: tableEvents };
    });

    // Wait for all games to complete
    const results = await Promise.all(gamePromises);
    monitoringActive = false;
    clearInterval(monitorInterval);

    // Final snapshot
    snapshots.push({
      phase: 'final',
      ...getDetailedChipSnapshot(tables)
    });
    
    console.log(`\n=== RESULTS ===`);
    console.log(`Initial chips: ${snapshots[0].totalChips}`);
    console.log(`Final chips: ${snapshots[1].totalChips}`);
    console.log(`Monitoring violations: ${monitoringSnapshots.length}`);
    
    if (monitoringSnapshots.length > 0) {
      console.log(`\n=== VIOLATIONS DETECTED ===`);
      console.log(`First violation: ${monitoringSnapshots[0].difference} chips`);
      console.log(`Last violation: ${monitoringSnapshots[monitoringSnapshots.length - 1].difference} chips`);
      
      // Analyze pattern
      const differences = monitoringSnapshots.map(s => s.difference);
      const uniqueDiffs = [...new Set(differences)];
      console.log(`Unique difference values: ${uniqueDiffs.join(', ')}`);
      
      // Check which tables had issues
      const tablesWithIssues = new Set();
      monitoringSnapshots.forEach(snapshot => {
        snapshot.tables.forEach((table, idx) => {
          const expected = chipsPerPlayer * playersPerTable;
          if (table.totalTableChips !== expected) {
            tablesWithIssues.add(idx);
          }
        });
      });
      console.log(`Tables with issues: ${[...tablesWithIssues].join(', ')}`);
    }
    
    // Verify conservation
    expect(monitoringSnapshots.length).toBe(0);
    expect(snapshots[1].totalChips).toBe(expectedTotal);
  });

  it('should maintain conservation with pot calculations', { timeout: 30000 }, async () => {
    const manager = new PokerGameManager();
    const tables = [];
    
    // Create just 2 tables for detailed analysis
    for (let t = 0; t < 2; t++) {
      const table = manager.createTable({
        id: `pot-table-${t}`,
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
        maxPlayers: 4,
        dealerButton: 0
      });
      tables.push(table);

      for (let p = 0; p < 4; p++) {
        const player = new ValidatedPlayer({ 
          id: `pot-t${t}-p${p}`, 
          chips: 1000
        });
        await table.addPlayer(player);
      }
    }

    const expectedTotal = 2 * 4 * 1000; // 8000 total chips
    
    // Track chips including pots
    const trackingData = [];
    
    // Start games and monitor
    const promises = tables.map(async (table) => {
      return new Promise(async (resolve) => {
        // Monitor during game
        table.on('betting:player-acted', () => {
          const withPots = countTotalChips([table], true);
          const withoutPots = countTotalChips([table], false);
          trackingData.push({
            tableId: table.id,
            event: 'player-acted',
            chipsInStacks: withoutPots,
            chipsIncludingPots: withPots,
            timestamp: Date.now()
          });
        });
        
        table.once('hand:ended', () => {
          setTimeout(resolve, 100);
        });
        
        await table.tryStartGame();
      });
    });
    
    await Promise.all(promises);
    
    // Analyze tracking data
    console.log(`\n=== POT TRACKING ANALYSIS ===`);
    console.log(`Total tracking entries: ${trackingData.length}`);
    
    // Check if chips + pots always equals expected
    const violationsWithPots = trackingData.filter(d => d.chipsIncludingPots !== 4000);
    const violationsWithoutPots = trackingData.filter(d => d.chipsInStacks === 4000);
    
    console.log(`Violations (chips + pots != 4000): ${violationsWithPots.length}`);
    console.log(`Times when stacks alone = 4000: ${violationsWithoutPots.length}`);
    
    if (violationsWithPots.length > 0) {
      console.log(`\nFirst violation:`);
      console.log(violationsWithPots[0]);
    }
    
    // Final check
    const finalWithPots = countTotalChips(tables, true);
    const finalWithoutPots = countTotalChips(tables, false);
    
    console.log(`\nFinal chips in stacks: ${finalWithoutPots}`);
    console.log(`Final chips including pots: ${finalWithPots}`);
    
    expect(finalWithoutPots).toBe(expectedTotal);
    expect(violationsWithPots.length).toBe(0);
  });
});