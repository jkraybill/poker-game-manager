import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createChipStackTable, cleanupTables, StrategicPlayer, Action } from '../test-utils/index.js';

/**
 * Test for the chip conservation bug reported in v3.0.1
 * 
 * Issue: hand:ended event fires before chip distribution is complete,
 * causing temporary and sometimes permanent chip losses.
 */

describe('Chip Conservation Bug (Issue #??)', () => {
  let manager, table;
  let playerChipsAtHandEnd = [];
  let totalChipsBeforeHand = 0;
  let totalChipsAfterHand = 0;

  beforeEach(() => {
    manager = null;
    table = null;
    playerChipsAtHandEnd = [];
    totalChipsBeforeHand = 0;
    totalChipsAfterHand = 0;
  });

  afterEach(() => {
    if (manager) {
      cleanupTables(manager);
    }
  });

  it('should maintain chip conservation during hand:ended event with side pots', async () => {
    // Create a scenario with multiple all-in players to create side pots
    // Use different stack sizes to force side pots: 1000, 300, 100
    const chipAmounts = [1000, 300, 100];
    
    ({ manager, table } = createChipStackTable('standard', chipAmounts, {
      id: 'chip-conservation-test',
      blinds: { small: 10, big: 20 },
      dealerButton: 0, // Deterministic
    }));

    // Add players to the table
    const player1 = new StrategicPlayer({ name: 'Big Stack' });
    const player2 = new StrategicPlayer({ name: 'Medium Stack' });
    const player3 = new StrategicPlayer({ name: 'Small Stack' });
    
    table.addPlayer(player1);
    table.addPlayer(player2);
    table.addPlayer(player3);

    // Track total chips before hand starts
    totalChipsBeforeHand = Array.from(table.players.values())
      .reduce((sum, pd) => sum + pd.player.chips, 0);

    console.log(`Total chips before hand: ${totalChipsBeforeHand}`);

    // Track chip counts when hand:ended fires
    table.on('hand:ended', ({ winners, sidePots }) => {
      console.log('\\n=== hand:ended event fired ===');
      
      // Capture chip counts at this exact moment
      playerChipsAtHandEnd = Array.from(table.players.values()).map(pd => ({
        id: pd.player.id,
        chips: pd.player.chips,
        name: pd.player.name,
      }));
      
      totalChipsAfterHand = playerChipsAtHandEnd.reduce((sum, p) => sum + p.chips, 0);
      
      console.log('Player chips at hand:ended:');
      playerChipsAtHandEnd.forEach(p => {
        console.log(`  ${p.name}: ${p.chips} chips`);
      });
      
      console.log(`Total chips at hand:ended: ${totalChipsAfterHand}`);
      console.log('Winners:', winners.map(w => ({ id: w.playerId, amount: w.amount })));
      console.log('Side pots:', sidePots);
      
      const chipDifference = totalChipsBeforeHand - totalChipsAfterHand;
      if (chipDifference !== 0) {
        console.log(`🚨 CHIP DISCREPANCY: ${chipDifference} chips ${chipDifference > 0 ? 'LOST' : 'GAINED'}`);
      }
    });

    // Set up aggressive all-in scenario using custom deck to ensure showdown
    const customDeck = [
      // Player 1 (Big Stack) - AA
      { rank: 'A', suit: 'hearts' },
      { rank: 'A', suit: 'spades' },
      
      // Player 2 (Medium Stack) - KK  
      { rank: 'K', suit: 'hearts' },
      { rank: 'K', suit: 'spades' },
      
      // Player 3 (Small Stack) - QQ
      { rank: 'Q', suit: 'hearts' },
      { rank: 'Q', suit: 'spades' },
      
      // Community cards - low cards to avoid interfering with pairs
      { rank: '2', suit: 'clubs' },
      { rank: '3', suit: 'diamonds' },
      { rank: '4', suit: 'clubs' },
      { rank: '5', suit: 'diamonds' },
      { rank: '7', suit: 'clubs' },
      
      // Rest of deck (unique cards)
      { rank: '8', suit: 'clubs' },
      { rank: '8', suit: 'diamonds' },
      { rank: '8', suit: 'hearts' },
      { rank: '8', suit: 'spades' },
      { rank: '9', suit: 'clubs' },
      { rank: '9', suit: 'diamonds' },
      { rank: '9', suit: 'hearts' },
      { rank: '9', suit: 'spades' },
      { rank: 'T', suit: 'clubs' },
      { rank: 'T', suit: 'diamonds' },
      { rank: 'T', suit: 'hearts' },
      { rank: 'T', suit: 'spades' },
      { rank: 'J', suit: 'clubs' },
      { rank: 'J', suit: 'diamonds' },
      { rank: 'J', suit: 'hearts' },
      { rank: 'J', suit: 'spades' },
      { rank: 'Q', suit: 'clubs' },
      { rank: 'Q', suit: 'diamonds' },
      { rank: 'K', suit: 'clubs' },
      { rank: 'K', suit: 'diamonds' },
      { rank: 'A', suit: 'clubs' },
      { rank: 'A', suit: 'diamonds' },
      { rank: '6', suit: 'clubs' },
      { rank: '6', suit: 'diamonds' },
      { rank: '6', suit: 'hearts' },
      { rank: '6', suit: 'spades' },
      { rank: '7', suit: 'diamonds' },
      { rank: '7', suit: 'hearts' },
      { rank: '7', suit: 'spades' },
      { rank: '5', suit: 'clubs' },
      { rank: '5', suit: 'hearts' },
      { rank: '5', suit: 'spades' },
      { rank: '4', suit: 'diamonds' },
      { rank: '4', suit: 'hearts' },
      { rank: '4', suit: 'spades' },
      { rank: '3', suit: 'clubs' },
      { rank: '3', suit: 'hearts' },
      { rank: '3', suit: 'spades' },
      { rank: '2', suit: 'diamonds' },
      { rank: '2', suit: 'hearts' },
      { rank: '2', suit: 'spades' },
    ];

    table.setCustomDeck(customDeck);

    // Override players with all-in strategy to create side pots
    Array.from(table.players.values()).forEach(pd => {
      pd.player.getAction = () => {
        return Promise.resolve({
          action: Action.ALL_IN,
          playerId: pd.player.id,
          timestamp: Date.now(),
        });
      };
    });

    // Force a scenario with side pots by making everyone go all-in
    const gameStartedPromise = new Promise(resolve => {
      table.on('game:started', resolve);
    });
    
    const handEndedPromise = new Promise(resolve => {
      table.on('hand:ended', resolve);
    });

    // Start the game
    table.tryStartGame();
    await gameStartedPromise;

    // Wait for hand to complete
    await handEndedPromise;

    // Give a moment for any async processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // THE CRITICAL TEST: Chip conservation must hold at the moment hand:ended fires
    console.log('\\n=== CHIP CONSERVATION TEST ===');
    console.log(`Before hand: ${totalChipsBeforeHand}`);
    console.log(`At hand:ended: ${totalChipsAfterHand}`);
    console.log(`Difference: ${totalChipsBeforeHand - totalChipsAfterHand}`);
    
    // This should NEVER fail in a correct poker implementation
    expect(totalChipsAfterHand).toBe(totalChipsBeforeHand);
    
    // Additional verification: no player should have negative chips
    playerChipsAtHandEnd.forEach(player => {
      expect(player.chips).toBeGreaterThanOrEqual(0);
    });
  });
  
  it('should demonstrate the timing issue with elimination scenarios', async () => {
    // Create a heads-up scenario where one player will be eliminated
    // Big stack vs small stack: 1000 vs 50
    const chipAmounts = [1000, 50];
    
    ({ manager, table } = createChipStackTable('headsUp', chipAmounts, {
      id: 'elimination-timing-test',
      blinds: { small: 10, big: 20 },
      dealerButton: 0,
    }));

    // Add players to the table
    const player1 = new StrategicPlayer({ name: 'Big Stack' });
    const player2 = new StrategicPlayer({ name: 'Small Stack' });
    
    table.addPlayer(player1);
    table.addPlayer(player2);

    const eventLog = [];

    // Track the sequence of events
    table.on('hand:ended', ({ winners: _winners }) => {
      const totalChipsNow = Array.from(table.players.values())
        .reduce((sum, pd) => sum + pd.player.chips, 0);
      
      eventLog.push({
        event: 'hand:ended',
        timestamp: Date.now(),
        totalChips: totalChipsNow,
        playerChips: Array.from(table.players.values()).map(pd => ({
          id: pd.player.id,
          chips: pd.player.chips,
        })),
      });
    });

    table.on('player:eliminated', ({ playerId }) => {
      const totalChipsNow = Array.from(table.players.values())
        .reduce((sum, pd) => sum + pd.player.chips, 0);
      
      eventLog.push({
        event: 'player:eliminated',
        timestamp: Date.now(),
        eliminatedPlayer: playerId,
        totalChips: totalChipsNow,
      });
    });

    // Set up the elimination scenario BEFORE starting
    const customDeck = [
      // Winner gets AA
      { rank: 'A', suit: 'hearts' },
      { rank: 'A', suit: 'spades' },
      
      // Loser gets 72o (worst hand)
      { rank: '7', suit: 'clubs' },
      { rank: '2', suit: 'diamonds' },
      
      // Board that doesn't help loser
      { rank: 'K', suit: 'hearts' },
      { rank: 'Q', suit: 'spades' },
      { rank: 'J', suit: 'clubs' },
      { rank: 'T', suit: 'diamonds' },
      { rank: '9', suit: 'hearts' },
      
      // Rest of unique cards
      { rank: '8', suit: 'clubs' },
      { rank: '8', suit: 'diamonds' },
      { rank: '8', suit: 'hearts' },
      { rank: '8', suit: 'spades' },
      { rank: '3', suit: 'clubs' },
      { rank: '3', suit: 'diamonds' },
      { rank: '3', suit: 'hearts' },
      { rank: '3', suit: 'spades' },
      { rank: '4', suit: 'clubs' },
      { rank: '4', suit: 'diamonds' },
      { rank: '4', suit: 'hearts' },
      { rank: '4', suit: 'spades' },
      { rank: '5', suit: 'clubs' },
      { rank: '5', suit: 'diamonds' },
      { rank: '5', suit: 'hearts' },
      { rank: '5', suit: 'spades' },
      { rank: '6', suit: 'clubs' },
      { rank: '6', suit: 'diamonds' },
      { rank: '6', suit: 'hearts' },
      { rank: '6', suit: 'spades' },
      { rank: '7', suit: 'diamonds' },
      { rank: '7', suit: 'hearts' },
      { rank: '7', suit: 'spades' },
      { rank: '2', suit: 'clubs' },
      { rank: '2', suit: 'hearts' },
      { rank: '2', suit: 'spades' },
      { rank: 'K', suit: 'clubs' },
      { rank: 'K', suit: 'diamonds' },
      { rank: 'Q', suit: 'clubs' },
      { rank: 'Q', suit: 'diamonds' },
      { rank: 'Q', suit: 'hearts' },
      { rank: 'J', suit: 'diamonds' },
      { rank: 'J', suit: 'hearts' },
      { rank: 'J', suit: 'spades' },
      { rank: 'T', suit: 'clubs' },
      { rank: 'T', suit: 'hearts' },
      { rank: 'T', suit: 'spades' },
      { rank: '9', suit: 'clubs' },
      { rank: '9', suit: 'diamonds' },
      { rank: '9', suit: 'spades' },
      { rank: 'A', suit: 'clubs' },
      { rank: 'A', suit: 'diamonds' },
      { rank: 'K', suit: 'spades' },
    ];

    table.setCustomDeck(customDeck);

    // Make both players go all-in
    Array.from(table.players.values()).forEach(pd => {
      pd.player.getAction = () => {
        return Promise.resolve({
          action: Action.ALL_IN,
          playerId: pd.player.id,
          timestamp: Date.now(),
        });
      };
    });

    // Start and complete the hand
    table.tryStartGame();
    
    await new Promise(resolve => {
      table.on('player:eliminated', resolve);
    });

    // Give time for all events to fire
    await new Promise(resolve => setTimeout(resolve, 200));

    console.log('\\n=== EVENT SEQUENCE ===');
    eventLog.forEach((event, i) => {
      console.log(`${i + 1}. ${event.event} - ${event.totalChips} chips`);
    });

    // Verify events fired in correct order
    expect(eventLog.length).toBeGreaterThanOrEqual(2);
    expect(eventLog[0].event).toBe('hand:ended');
    expect(eventLog[1].event).toBe('player:eliminated');

    // The key test: chips should be conserved at each step
    eventLog.forEach((event, i) => {
      console.log(`Step ${i + 1}: ${event.totalChips} chips`);
      expect(event.totalChips).toBe(1050); // Total starting chips
    });
  });
});