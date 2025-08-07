import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createChipStackTable, cleanupTables, StrategicPlayer, STRATEGIES } from '../test-utils/index.js';

/**
 * TDD Test for Event Timing Race Condition Bug
 * 
 * The Issue: hand:ended fires before Table's elimination processing completes,
 * causing external tournament managers to see inconsistent chip states.
 * 
 * The Race Condition:
 * 1. GameEngine completes chip distribution 
 * 2. GameEngine emits hand:complete
 * 3. Table forwards as hand:ended IMMEDIATELY 
 * 4. External listeners check chip counts NOW ← TOO EARLY!
 * 5. Table schedules elimination processing via process.nextTick()
 * 6. Elimination processing removes eliminated players
 * 
 * Result: External systems see temporary "missing" chips from eliminated players
 */

describe('Event Timing Race Condition (Issue #??)', () => {
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

  it('should reproduce the race condition: hand:ended fires before elimination processing', async () => {
    // Create elimination scenario: big stack vs small stack
    const chipAmounts = [1000, 50]; // Small stack will be eliminated
    const totalChipsExpected = 1050;
    
    ({ manager, table } = createChipStackTable('headsUp', chipAmounts, {
      id: 'race-condition-test',
      blinds: { small: 10, big: 20 },
      dealerButton: 0,
    }));

    // Add players - small stack will lose and be eliminated
    const player1 = new StrategicPlayer({ 
      name: 'Big Stack',
      strategy: STRATEGIES.alwaysCall, 
    });
    const player2 = new StrategicPlayer({ 
      name: 'Small Stack (will be eliminated)', 
      strategy: STRATEGIES.alwaysCall, 
    });
    
    table.addPlayer(player1);
    table.addPlayer(player2);

    // Set up custom deck so Big Stack wins with AA vs Small Stack's 72o
    const customDeck = [
      // Big Stack gets AA
      { rank: 'A', suit: 'hearts' },
      { rank: 'A', suit: 'spades' },
      
      // Small Stack gets worst hand
      { rank: '7', suit: 'clubs' },
      { rank: '2', suit: 'diamonds' },
      
      // Board that doesn't help Small Stack
      { rank: 'K', suit: 'hearts' },
      { rank: 'Q', suit: 'spades' },
      { rank: 'J', suit: 'clubs' },
      { rank: 'T', suit: 'diamonds' },
      { rank: '9', suit: 'hearts' },
      
      // Rest of deck
      ...Array.from({ length: 42 }, (_, i) => ({ 
        rank: '8', 
        suit: ['clubs', 'diamonds', 'hearts', 'spades'][i % 4], 
      })),
    ];
    table.setCustomDeck(customDeck);

    // Track the timing of events and chip counts
    const eventTimeline = [];
    let handEndedChipCount = 0;

    // 1. Capture chips IMMEDIATELY when hand:ended fires (this is what external systems do)
    table.on('hand:ended', ({ winners }) => {
      const timestamp = Date.now();
      
      // Count chips across ALL players still in table.players (including eliminated ones)
      handEndedChipCount = Array.from(table.players.values())
        .reduce((sum, pd) => sum + pd.player.chips, 0);
      
      const playerDetails = Array.from(table.players.values()).map(pd => ({
        id: pd.player.id,
        name: pd.player.name,
        chips: pd.player.chips,
      }));
      
      eventTimeline.push({
        event: 'hand:ended',
        timestamp,
        totalChips: handEndedChipCount,
        playerCount: table.players.size,
        playerDetails,
        winners: winners.map(w => ({ id: w.playerId, amount: w.amount })),
      });
      
      console.log(`\\n🕐 hand:ended fired at ${timestamp}`);
      console.log(`   Players in table: ${table.players.size}`);
      console.log(`   Total chips visible: ${handEndedChipCount}/${totalChipsExpected}`);
      console.log('   Player details:', playerDetails);
    });

    // 2. Track elimination processing
    table.on('player:eliminated', ({ playerId }) => {
      const timestamp = Date.now();
      
      const currentChipCount = Array.from(table.players.values())
        .reduce((sum, pd) => sum + pd.player.chips, 0);
      
      eventTimeline.push({
        event: 'player:eliminated',
        timestamp,
        eliminatedPlayerId: playerId,
        totalChips: currentChipCount,
        playerCount: table.players.size,
      });
      
      console.log(`\\n🚨 player:eliminated fired at ${timestamp} (${timestamp - eventTimeline[0]?.timestamp}ms after hand:ended)`);
      console.log(`   Eliminated player: ${playerId}`);
      console.log(`   Players remaining: ${table.players.size}`);
      console.log(`   Total chips now: ${currentChipCount}/${totalChipsExpected}`);
    });

    // Make both players go all-in to guarantee elimination
    Array.from(table.players.values()).forEach(pd => {
      pd.player.getAction = () => {
        return Promise.resolve({
          action: 'ALL_IN',
          playerId: pd.player.id,
          timestamp: Date.now(),
        });
      };
    });

    // Start the game and wait for both events
    const handEndedPromise = new Promise(resolve => {
      table.on('hand:ended', resolve);
    });
    
    const eliminationPromise = new Promise(resolve => {
      table.on('player:eliminated', resolve);
    });

    console.log('🎮 Starting elimination game...');
    table.tryStartGame();
    
    await handEndedPromise;
    console.log('✅ hand:ended completed');
    
    await eliminationPromise;
    console.log('✅ player:eliminated completed');

    // Give time for all async processing
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('\\n=== RACE CONDITION ANALYSIS ===');
    eventTimeline.forEach((event, i) => {
      const timeDiff = i > 0 ? event.timestamp - eventTimeline[0].timestamp : 0;
      console.log(`${i + 1}. ${event.event} (+${timeDiff}ms): ${event.totalChips}/${totalChipsExpected} chips (${event.playerCount} players)`);
    });

    // THE BUG DEMONSTRATION:
    // If hand:ended fires before elimination processing,
    // external systems will see the wrong chip count
    const handEndedEvent = eventTimeline.find(e => e.event === 'hand:ended');
    const eliminationEvent = eventTimeline.find(e => e.event === 'player:eliminated');
    
    expect(handEndedEvent).toBeTruthy();
    expect(eliminationEvent).toBeTruthy();
    
    console.log('\\n=== BUG CHECK ===');
    console.log(`hand:ended chip count: ${handEndedEvent.totalChips}`);
    console.log(`Expected chip count: ${totalChipsExpected}`);
    console.log(`Elimination happened: ${eliminationEvent ? 'YES' : 'NO'}`);
    
    // THE CRITICAL ASSERTION: This will FAIL with the current bug
    // because hand:ended fires before elimination processing removes the eliminated player
    if (handEndedEvent.totalChips !== totalChipsExpected) {
      console.log('🚨 BUG REPRODUCED: hand:ended fired before elimination processing completed!');
      console.log('   This causes external tournament managers to see incorrect chip counts');
    }
    
    // This assertion demonstrates the race condition
    // With the bug: this fails because eliminated player's chips are still counted
    // After fix: this passes because elimination happens before hand:ended
    expect(handEndedEvent.totalChips).toBe(totalChipsExpected);
  });

  it('should demonstrate the synchronization fix prevents race conditions', async () => {
    // This test will pass after we implement the fix
    // It ensures that hand:ended only fires after ALL Table processing is complete
    
    const chipAmounts = [500, 100, 50]; // Multi-elimination scenario
    const totalChipsExpected = 650;
    
    ({ manager, table } = createChipStackTable('standard', chipAmounts, {
      id: 'sync-fix-test',
      blinds: { small: 10, big: 20 },
      dealerButton: 0,
      minPlayers: 3,
    }));

    // Add players
    const players = [
      new StrategicPlayer({ name: 'Winner', strategy: STRATEGIES.alwaysCall }),
      new StrategicPlayer({ name: 'Loser 1', strategy: STRATEGIES.alwaysCall }),
      new StrategicPlayer({ name: 'Loser 2', strategy: STRATEGIES.alwaysCall }),
    ];
    players.forEach(p => table.addPlayer(p));

    // Set up deck so Winner wins with strong hand
    const customDeck = [
      // Winner gets pocket aces
      { rank: 'A', suit: 'hearts' }, { rank: 'A', suit: 'spades' },
      
      // Losers get weak hands
      { rank: '7', suit: 'clubs' }, { rank: '2', suit: 'diamonds' },
      { rank: '8', suit: 'clubs' }, { rank: '3', suit: 'diamonds' },
      
      // Board with no help for losers
      { rank: 'K', suit: 'hearts' }, { rank: 'Q', suit: 'spades' },
      { rank: 'J', suit: 'clubs' }, { rank: 'T', suit: 'diamonds' }, { rank: '9', suit: 'hearts' },
      
      ...Array.from({ length: 39 }, (_, i) => ({ 
        rank: '4', 
        suit: ['clubs', 'diamonds', 'hearts', 'spades'][i % 4], 
      })),
    ];
    table.setCustomDeck(customDeck);

    let handEndedChipCount = 0;
    let eliminationCount = 0;

    table.on('hand:ended', () => {
      // With the fix: this should always see the correct chip count
      handEndedChipCount = Array.from(table.players.values())
        .reduce((sum, pd) => sum + pd.player.chips, 0);
      
      console.log(`hand:ended: ${handEndedChipCount}/${totalChipsExpected} chips, ${table.players.size} players`);
    });

    table.on('player:eliminated', () => {
      eliminationCount++;
    });

    // Force all-in
    Array.from(table.players.values()).forEach(pd => {
      pd.player.getAction = () => Promise.resolve({
        action: 'ALL_IN',
        playerId: pd.player.id,
        timestamp: Date.now(),
      });
    });

    // Wait for all events
    const handEndedPromise = new Promise(resolve => table.on('hand:ended', resolve));
    
    table.tryStartGame();
    await handEndedPromise;

    // Wait for eliminations to process
    await new Promise(resolve => setTimeout(resolve, 300));

    console.log('\\nFINAL RESULTS:');
    console.log(`- hand:ended chip count: ${handEndedChipCount}`);
    console.log(`- Expected chip count: ${totalChipsExpected}`);
    console.log(`- Eliminations processed: ${eliminationCount}`);

    // After the fix: this should always pass
    expect(handEndedChipCount).toBe(totalChipsExpected);
  });
});