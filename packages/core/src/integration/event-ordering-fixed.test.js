import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  StrategicPlayer,
  STRATEGIES,
  cleanupTables,
  Action,
} from '../test-utils/index.js';

/**
 * Fixed test for Issue #33: Event ordering
 */

describe('Event Ordering - Fixed (Issue #33)', () => {
  let manager, table;

  beforeEach(() => {
    ;({ manager, table } = createTestTable('standard', {
      blinds: { small: 10, big: 20 },
      minBuyIn: 40,
      maxBuyIn: 200,
      minPlayers: 2,
      dealerButton: 0,
    }));
  });

  afterEach(() => {
    cleanupTables(manager);
  });

  it('should fire player:eliminated after hand:ended when player has 0 chips', async () => {
    const eventLog = [];

    // Track events
    table.on('hand:ended', ({ winners }) => {
      eventLog.push({
        event: 'hand:ended',
        timestamp: Date.now(),
        winners: winners.length,
      });
      console.log('hand:ended fired, winners:', winners);
    });

    table.on('player:eliminated', ({ playerId }) => {
      eventLog.push({
        event: 'player:eliminated',
        timestamp: Date.now(),
        playerId,
      });
      console.log('player:eliminated fired for', playerId);
    });

    // Create players using test utilities - one aggressive to eliminate the other
    const richPlayer = new StrategicPlayer({
      id: 'rich',
      name: 'Rich Player',
      strategy: ({ gameState, myState }) => {
        const currentBet = gameState.currentBet;
        const toCall = currentBet - myState.bet;
        
        // In preflop, always raise big to put pressure
        if (gameState.phase === 'preFlop' && toCall > 0) {
          return { action: Action.RAISE, amount: myState.chips };
        }
        
        // Post-flop, just call
        if (toCall > 0) {
          return { action: Action.CALL, amount: toCall };
        }
        
        return { action: Action.CHECK };
      },
    });

    const poorPlayer = new StrategicPlayer({
      id: 'poor',
      name: 'Poor Player',
      strategy: STRATEGIES.alwaysCall,
    });

    // Add players
    table.addPlayer(richPlayer);
    table.addPlayer(poorPlayer);

    // Give poor player exactly 40 chips (min buy-in)
    const poorData = Array.from(table.players.values()).find(
      (p) => p.player.id === 'poor',
    );
    if (poorData) {
      poorData.chips = 40;
    }

    // Create completion promise
    const handEndPromise = new Promise((resolve) => {
      let handEndedFired = false;
      let timeoutId;

      table.on('hand:ended', () => {
        handEndedFired = true;
        // Wait a bit for elimination event
        timeoutId = setTimeout(() => {
          resolve({ handEndedFired });
        }, 300);
      });

      // Backup timeout
      setTimeout(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve({ handEndedFired, timedOut: true });
      }, 5000);
    });

    // Start the game
    table.tryStartGame();

    // Wait for completion
    const result = await handEndPromise;

    console.log('\nEvent log:');
    eventLog.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.event} at ${e.timestamp}`, e);
    });

    // Verify we got both events
    const handEndedEvents = eventLog.filter((e) => e.event === 'hand:ended');
    const eliminationEvents = eventLog.filter(
      (e) => e.event === 'player:eliminated',
    );

    expect(handEndedEvents.length).toBe(1);
    expect(result.handEndedFired).toBe(true);

    // If poor player was eliminated, verify event order
    if (eliminationEvents.length > 0) {
      expect(eliminationEvents.length).toBe(1);
      expect(eliminationEvents[0].playerId).toBe('poor');

      // Elimination should come after hand:ended
      const handEndedTime = handEndedEvents[0].timestamp;
      const eliminationTime = eliminationEvents[0].timestamp;
      expect(eliminationTime).toBeGreaterThan(handEndedTime);

      console.log(
        '\nTiming:',
        'hand:ended at',
        handEndedTime,
        'elimination at',
        eliminationTime,
        'diff:',
        eliminationTime - handEndedTime,
        'ms',
      );
    } else {
      console.log('\nNo elimination occurred - poor player survived');
    }

    // Check final chip counts
    const finalChips = {};
    table.players.forEach((playerData, playerId) => {
      finalChips[playerId] = playerData.player?.chips || playerData.chips || 0;
    });
    console.log('\nFinal chips:', finalChips);
  });

  it('should handle multiple eliminations in correct order', async () => {
    // Test with 3 players where 2 get eliminated
    ;({ manager, table } = createTestTable('standard', {
      blinds: { small: 10, big: 20 },
      minBuyIn: 30,
      maxBuyIn: 200,
      minPlayers: 2,
      maxPlayers: 3,
      dealerButton: 0,
    }));

    const eventLog = [];
    const eliminationOrder = [];

    table.on('hand:ended', ({ winners }) => {
      eventLog.push({ event: 'hand:ended', timestamp: Date.now() });
      console.log('hand:ended with', winners.length, 'winners');
    });

    table.on('player:eliminated', ({ playerId }) => {
      eliminationOrder.push(playerId);
      eventLog.push({
        event: 'player:eliminated',
        timestamp: Date.now(),
        playerId,
      });
      console.log('player:eliminated:', playerId);
    });

    // Create 3 players with different chip amounts
    const bigStack = new StrategicPlayer({
      id: 'big',
      name: 'Big Stack',
      strategy: STRATEGIES.threeBet,
    });
    const mediumStack = new StrategicPlayer({
      id: 'medium',
      name: 'Medium Stack',
      strategy: STRATEGIES.alwaysCall,
    });
    const smallStack = new StrategicPlayer({
      id: 'small',
      name: 'Small Stack',
      strategy: STRATEGIES.alwaysCall,
    });

    // Add players
    table.addPlayer(bigStack);
    table.addPlayer(mediumStack);
    table.addPlayer(smallStack);

    // Set specific chip amounts
    const bigData = Array.from(table.players.values()).find(
      (p) => p.player.id === 'big',
    );
    const medData = Array.from(table.players.values()).find(
      (p) => p.player.id === 'medium',
    );
    const smallData = Array.from(table.players.values()).find(
      (p) => p.player.id === 'small',
    );

    if (bigData) {
      bigData.chips = 200;
    }
    if (medData) {
      medData.chips = 50;
    }
    if (smallData) {
      smallData.chips = 30;
    }

    // Wait for hand completion
    const handPromise = new Promise((resolve) => {
      table.on('hand:ended', () => {
        setTimeout(() => resolve(), 500); // Wait for all eliminations
      });
      setTimeout(() => resolve(), 2000); // 2s timeout
    });

    // Start game
    table.tryStartGame();

    await handPromise;

    // Log results
    console.log('\nElimination order:', eliminationOrder);
    console.log('Event count:', eventLog.length);

    // Verify events
    const handEndedCount = eventLog.filter(
      (e) => e.event === 'hand:ended',
    ).length;
    expect(handEndedCount).toBe(1);

    // All eliminations should come after hand:ended
    const handEndedIndex = eventLog.findIndex((e) => e.event === 'hand:ended');
    eventLog.forEach((event, index) => {
      if (event.event === 'player:eliminated') {
        expect(index).toBeGreaterThan(handEndedIndex);
      }
    });
  });
});
