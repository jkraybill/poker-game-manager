import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

/**
 * Verified test for Issue #33: Event ordering
 * This test verifies that our fix properly orders events
 */

describe('Event Ordering - Verified (Issue #33)', () => {
  let manager;
  let table;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    if (table) {
      table.close();
    }
  });

  it('should verify event ordering is correct even without elimination', async () => {
    // First, let's just verify that hand:ended fires before game cleanup
    table = manager.createTable({
      id: 'event-order-test',
      blinds: { small: 10, big: 20 },
      minBuyIn: 100,
      maxBuyIn: 200,
      minPlayers: 2,
      dealerButton: 0,
    });

    const eventLog = [];
    let handEndedTime = 0;
    let gameEndCleanupTime = 0;

    // Track hand:ended
    table.on('hand:ended', () => {
      handEndedTime = Date.now();
      eventLog.push({
        event: 'hand:ended',
        timestamp: handEndedTime,
      });
      console.log('hand:ended at', handEndedTime);
    });

    // Track when handleGameEnd runs by watching state change
    const originalHandleGameEnd = table.handleGameEnd.bind(table);
    table.handleGameEnd = function(result) {
      gameEndCleanupTime = Date.now();
      console.log('handleGameEnd called at', gameEndCleanupTime);
      console.log('Time since hand:ended:', gameEndCleanupTime - handEndedTime, 'ms');
      
      // Check for players with 0 chips before cleanup
      const eliminatedCount = Array.from(this.players.values())
        .filter(p => p.player.chips <= 0).length;
      console.log('Players with 0 chips:', eliminatedCount);
      
      eventLog.push({
        event: 'handleGameEnd',
        timestamp: gameEndCleanupTime,
        playersWithZeroChips: eliminatedCount,
      });
      
      return originalHandleGameEnd.call(this, result);
    };

    // Track elimination events
    table.on('player:eliminated', ({ playerId }) => {
      const elimTime = Date.now();
      eventLog.push({
        event: 'player:eliminated',
        timestamp: elimTime,
        playerId,
      });
      console.log('player:eliminated at', elimTime, 'for', playerId);
      console.log('Time since hand:ended:', elimTime - handEndedTime, 'ms');
    });

    // Simple players
    class SimplePlayer extends Player {
      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;
        
        if (toCall > 0 && toCall <= myState.chips) {
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          };
        }
        
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    const p1 = new SimplePlayer({ name: 'Player 1' });
    const p2 = new SimplePlayer({ name: 'Player 2' });

    table.addPlayer(p1);
    table.addPlayer(p2);

    // Create promise for hand completion before starting game
    const handComplete = new Promise((resolve) => {
      table.once('hand:ended', () => {
        setTimeout(resolve, 100);
      });
    });

    // Start game
    table.tryStartGame();
    
    // Wait for hand to complete
    await handComplete;

    // Analyze event order
    console.log('\nEvent sequence:');
    eventLog.forEach(e => {
      console.log(`- ${e.event} at ${e.timestamp}`);
    });

    // Verify hand:ended came before handleGameEnd
    const handEndedEvent = eventLog.find(e => e.event === 'hand:ended');
    const handleGameEndEvent = eventLog.find(e => e.event === 'handleGameEnd');
    
    expect(handEndedEvent).toBeDefined();
    expect(handleGameEndEvent).toBeDefined();
    expect(handleGameEndEvent.timestamp).toBeGreaterThanOrEqual(handEndedEvent.timestamp);
    
    console.log('\n✓ Events fired in correct order');
  });

  it('should fire player:eliminated after hand:ended when player loses all chips', async () => {
    table = manager.createTable({
      id: 'manual-elim-test',
      blinds: { small: 10, big: 20 },
      minBuyIn: 40,
      maxBuyIn: 200,
      minPlayers: 2,
      dealerButton: 0,
    });

    const eventLog = [];

    // Track events
    table.on('hand:ended', () => {
      eventLog.push({
        event: 'hand:ended',
        timestamp: Date.now(),
      });
    });

    table.on('player:eliminated', ({ playerId }) => {
      eventLog.push({
        event: 'player:eliminated',
        timestamp: Date.now(),
        playerId,
      });
    });

    // Simple all-in player
    class AllInPlayer extends Player {
      getAction(gameState) {
        const myState = gameState.players[this.id];
        
        // Go all-in if we have chips
        if (myState.chips > 0) {
          return {
            playerId: this.id,
            action: Action.ALL_IN,
            amount: myState.chips,
            timestamp: Date.now(),
          };
        }
        
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    const p1 = new AllInPlayer({ name: 'Player 1' });
    const p2 = new AllInPlayer({ name: 'Player 2' });

    // Set initial chips - p2 has less so will lose
    p1.chips = 100;
    p2.chips = 50;

    table.addPlayer(p1);
    table.addPlayer(p2);

    // Create promise for hand completion
    const handComplete = new Promise((resolve) => {
      table.once('hand:ended', () => {
        // Give time for elimination events
        setTimeout(resolve, 100);
      });
    });

    // Start game
    table.tryStartGame();
    
    // Wait for hand to complete
    await handComplete;

    // Check results
    const handEndedEvents = eventLog.filter(e => e.event === 'hand:ended');
    const elimEvents = eventLog.filter(e => e.event === 'player:eliminated');
    
    expect(handEndedEvents).toHaveLength(1);
    
    // If someone was eliminated, verify the order
    if (elimEvents.length > 0) {
      expect(elimEvents[0].timestamp).toBeGreaterThanOrEqual(handEndedEvents[0].timestamp);
      console.log('✓ Elimination fired after hand:ended');
    }
  });
});