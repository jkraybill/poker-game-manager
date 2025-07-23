import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

/**
 * Simplified test for Issue #33: Event ordering
 * Focus on verifying elimination events fire after hand:ended
 */

describe('Event Ordering - Simple (Issue #33)', () => {
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

  it('should fire player:eliminated after hand:ended', async () => {
    // Create table with 3 players
    table = manager.createTable({
      id: 'elimination-test',
      blinds: { small: 10, big: 20 },
      minBuyIn: 40,
      maxBuyIn: 200,
      minPlayers: 3,
      dealerButton: 0,
    });

    const eventLog = [];

    // Track events with timestamps
    table.on('hand:ended', ({ winners }) => {
      eventLog.push({
        event: 'hand:ended',
        timestamp: Date.now(),
        winners: winners.length,
      });
      console.log('hand:ended fired');
    });

    table.on('player:eliminated', ({ playerId }) => {
      eventLog.push({
        event: 'player:eliminated',
        timestamp: Date.now(),
        playerId,
      });
      console.log('player:eliminated fired for', playerId);
    });

    // Create players
    class FoldingPlayer extends Player {
      getAction() {
        // Always fold to ensure we lose
        return {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now(),
        };
      }
    }

    class RaisingPlayer extends Player {
      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;
        
        // Raise if we can
        if (gameState.currentBet < 50) {
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: 50,
            timestamp: Date.now(),
          };
        }
        
        // Otherwise call
        return {
          playerId: this.id,
          action: Action.CALL,
          amount: toCall,
          timestamp: Date.now(),
        };
      }
    }

    // Create all-in player who will be eliminated
    class AllInPlayer extends Player {
      getAction(gameState) {
        const myState = gameState.players[this.id];
        return {
          playerId: this.id,
          action: Action.ALL_IN,
          amount: myState.chips,
          timestamp: Date.now(),
        };
      }
    }

    const shortStack = new AllInPlayer({ name: 'ShortStack' });
    const medium = new RaisingPlayer({ name: 'Medium' });
    const bigStack = new RaisingPlayer({ name: 'BigStack' });

    // Add players
    table.addPlayer(shortStack);
    table.addPlayer(medium);
    table.addPlayer(bigStack);

    // Set shortStack to have just enough for blinds
    // They'll go all-in and likely lose
    table.players.get(shortStack.id).player.chips = 20; // As button, no blind
    table.players.get(medium.id).player.chips = 100;
    table.players.get(bigStack.id).player.chips = 200;

    console.log('Starting chips:', {
      shortStack: table.players.get(shortStack.id).player.chips,
      medium: table.players.get(medium.id).player.chips,
      bigStack: table.players.get(bigStack.id).player.chips,
    });

    // Wait for completion
    await new Promise((resolve) => {
      let resolved = false;
      
      // Set up a longer timeout to catch delayed events
      const checkComplete = () => {
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.log('Final chips:', {
              shortStack: table.players.get(shortStack.id)?.player.chips || 'removed',
              medium: table.players.get(medium.id)?.player.chips || 'removed',
              bigStack: table.players.get(bigStack.id)?.player.chips || 'removed',
            });
            resolve();
          }
        }, 1000);
      };

      table.on('hand:ended', checkComplete);
      
      // Start game
      table.tryStartGame();
    });

    // Analyze results
    console.log('Event log:', eventLog);

    // Find event types
    const handEndedEvents = eventLog.filter(e => e.event === 'hand:ended');
    const eliminationEvents = eventLog.filter(e => e.event === 'player:eliminated');

    // Should have exactly one hand:ended
    expect(handEndedEvents).toHaveLength(1);

    // Check if anyone was eliminated
    const shortStackData = table.players.get(shortStack.id);
    console.log('ShortStack still in table?', !!shortStackData);
    console.log('ShortStack chips:', shortStackData?.player.chips);

    // If someone was eliminated, verify event ordering
    if (eliminationEvents.length > 0) {
      const handEndedTime = handEndedEvents[0].timestamp;
      const eliminatedTime = eliminationEvents[0].timestamp;
      
      console.log('Time difference:', eliminatedTime - handEndedTime, 'ms');
      expect(eliminatedTime).toBeGreaterThan(handEndedTime);
      console.log('✓ Elimination event fired after hand:ended');
    } else {
      // If no elimination events but player has 0 chips, that's the bug
      if (!shortStackData || shortStackData?.player.chips === 0) {
        console.error('BUG: Player has 0 chips but no elimination event fired!');
        expect(eliminationEvents.length).toBeGreaterThan(0);
      }
    }
  });
});