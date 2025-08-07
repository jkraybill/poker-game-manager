import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createChipStackTable, cleanupTables, StrategicPlayer, STRATEGIES } from '../test-utils/index.js';

/**
 * Simple TDD reproduction of the race condition without complex custom decks
 * 
 * The Race Condition:
 * 1. GameEngine completes and emits hand:complete
 * 2. Table immediately forwards as hand:ended
 * 3. External listeners (like tournament managers) immediately check chip counts
 * 4. Table's elimination processing runs asynchronously via process.nextTick()
 * 5. Result: External systems see inconsistent state
 */

describe('Race Condition - Simple Reproduction', () => {
  let manager, table;

  beforeEach(() => {
    manager = null;
    table = null;
  });

  afterEach(() => {
    if (manager) {
      cleanupTables(manager);
    }
  });

  it('should demonstrate the timing issue between hand:ended and elimination processing', async () => {
    // Create minimal elimination scenario
    const chipAmounts = [100, 30]; // Small difference to force elimination
    const totalChipsExpected = 130;
    
    ({ manager, table } = createChipStackTable('headsUp', chipAmounts, {
      id: 'race-simple',
      blinds: { small: 10, big: 20 }, // Big blind is 20, so small stack only has 10 left
      dealerButton: 0,
    }));

    // Add players with simple all-in strategy to guarantee elimination
    const player1 = new StrategicPlayer({ 
      name: 'Big Stack',
      strategy: STRATEGIES.alwaysCall,
    });
    const player2 = new StrategicPlayer({ 
      name: 'Small Stack', 
      strategy: STRATEGIES.alwaysCall, 
    });
    
    table.addPlayer(player1);
    table.addPlayer(player2);

    // Track the race condition
    let handEndedChipCount = 0;
    let handEndedPlayerCount = 0;
    let eliminationFired = false;

    // This simulates what external tournament managers do:
    // They immediately check state when hand:ended fires
    table.on('hand:ended', ({ winners }) => {
      handEndedChipCount = Array.from(table.players.values())
        .reduce((sum, pd) => sum + pd.player.chips, 0);
      handEndedPlayerCount = table.players.size;
      
      console.log('\\n📅 hand:ended fired:');
      console.log(`   Chip count: ${handEndedChipCount}/${totalChipsExpected}`);
      console.log(`   Players: ${handEndedPlayerCount}`);
      console.log('   Winners:', winners.map(w => ({ id: w.playerId, amount: w.amount })));
      
      // Check each player's state
      Array.from(table.players.values()).forEach(pd => {
        console.log(`   ${pd.player.name}: ${pd.player.chips} chips`);
      });
    });

    table.on('player:eliminated', ({ playerId }) => {
      eliminationFired = true;
      const remainingChips = Array.from(table.players.values())
        .reduce((sum, pd) => sum + pd.player.chips, 0);
      
      console.log('\\n🚨 player:eliminated fired:');
      console.log(`   Eliminated: ${playerId}`);
      console.log(`   Remaining chips: ${remainingChips}`);
      console.log(`   Players left: ${table.players.size}`);
    });

    // Override both players to go all-in immediately
    Array.from(table.players.values()).forEach(pd => {
      pd.player.getAction = () => {
        return Promise.resolve({
          action: 'ALL_IN',
          playerId: pd.player.id,
          timestamp: Date.now(),
        });
      };
    });

    // Wait for hand completion
    const handEndedPromise = new Promise(resolve => {
      table.on('hand:ended', resolve);
    });

    console.log('🎮 Starting race condition test...');
    table.tryStartGame();
    
    await handEndedPromise;
    console.log('✅ hand:ended event completed');

    // Wait for elimination to potentially fire
    await new Promise(resolve => setTimeout(resolve, 200));

    console.log('\\n=== RACE CONDITION ANALYSIS ===');
    console.log(`hand:ended chip count: ${handEndedChipCount}/${totalChipsExpected}`);
    console.log(`hand:ended player count: ${handEndedPlayerCount}`);
    console.log(`Elimination fired: ${eliminationFired}`);

    // The key insight: If elimination hasn't fired yet when hand:ended fires,
    // external systems might see players that should be eliminated
    if (handEndedPlayerCount > 1 && eliminationFired) {
      console.log('🚨 RACE CONDITION: hand:ended fired while eliminated players still in table!');
    }

    // For now, let's just verify the game completed
    // The real test will be when we fix the synchronization
    expect(handEndedChipCount).toBeGreaterThan(0);
    expect(handEndedPlayerCount).toBeGreaterThanOrEqual(1);
  });

  it('should show current behavior: hand:ended fires immediately after GameEngine', async () => {
    // This test documents the current behavior to establish baseline
    const chipAmounts = [200, 50];
    
    ({ manager, table } = createChipStackTable('headsUp', chipAmounts, {
      id: 'behavior-test',
      blinds: { small: 5, big: 10 },
      dealerButton: 0,
    }));

    const player1 = new StrategicPlayer({ name: 'Winner', strategy: STRATEGIES.alwaysCall });
    const player2 = new StrategicPlayer({ name: 'Loser', strategy: STRATEGIES.alwaysCall });
    
    table.addPlayer(player1);
    table.addPlayer(player2);

    const eventSequence = [];

    // Set up a one-time listener for game:started to hook into gameEngine
    table.once('game:started', () => {
      // Now gameEngine exists, hook into its hand:complete event
      table.gameEngine.on('hand:complete', ({ winners }) => {
        eventSequence.push({
          event: 'GameEngine.hand:complete',
          timestamp: Date.now(),
          winners: winners.map(w => ({ id: w.playerId, amount: w.amount })),
        });
        console.log('🔧 GameEngine.hand:complete fired');
      });
    });

    // Hook into Table's hand:ended (external event)  
    table.on('hand:ended', ({ winners }) => {
      const timeSinceComplete = eventSequence.length > 0 ? 
        Date.now() - eventSequence[0].timestamp : 0;
      
      eventSequence.push({
        event: 'Table.hand:ended',
        timestamp: Date.now(),
        timeSinceComplete,
        winners: winners.map(w => ({ id: w.playerId, amount: w.amount })),
      });
      console.log(`📡 Table.hand:ended fired (+${timeSinceComplete}ms after GameEngine)`);
    });

    table.on('player:eliminated', ({ playerId }) => {
      const timeSinceComplete = eventSequence.length > 0 ? 
        Date.now() - eventSequence[0].timestamp : 0;
      
      eventSequence.push({
        event: 'Table.player:eliminated',
        timestamp: Date.now(),
        timeSinceComplete,
        playerId,
      });
      console.log(`🗑️  Table.player:eliminated fired (+${timeSinceComplete}ms after GameEngine)`);
    });

    // Force all-in
    Array.from(table.players.values()).forEach(pd => {
      pd.player.getAction = () => Promise.resolve({
        action: 'ALL_IN',
        playerId: pd.player.id,
        timestamp: Date.now(),
      });
    });

    const handEndedPromise = new Promise(resolve => table.on('hand:ended', resolve));
    
    console.log('🎮 Starting behavior documentation test...');
    table.tryStartGame();
    await handEndedPromise;

    // Wait for all async processing
    await new Promise(resolve => setTimeout(resolve, 300));

    console.log('\\n=== EVENT SEQUENCE ===');
    eventSequence.forEach((event, i) => {
      console.log(`${i + 1}. ${event.event} (+${event.timeSinceComplete}ms)`);
    });

    // Document the current timing behavior
    expect(eventSequence.length).toBeGreaterThan(0);
    const handCompleteEvent = eventSequence.find(e => e.event === 'GameEngine.hand:complete');
    const handEndedEvent = eventSequence.find(e => e.event === 'Table.hand:ended');
    
    expect(handCompleteEvent).toBeTruthy();
    expect(handEndedEvent).toBeTruthy();
    
    // The timing gap between GameEngine completion and Table's hand:ended should be minimal
    console.log(`\\nTiming gap: GameEngine → Table = ${handEndedEvent.timeSinceComplete}ms`);
  });
});