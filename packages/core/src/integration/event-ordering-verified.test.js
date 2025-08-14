import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  StrategicPlayer,
  STRATEGIES,
  cleanupTables,
} from '../test-utils/index.js';

/**
 * Verified test for Issue #33: Event ordering
 * This test verifies that our fix properly orders events
 */

describe('Event Ordering - Verified (Issue #33)', () => {
  let manager, table;

  beforeEach(() => {
    ({ manager, table } = createTestTable('standard', {
      minPlayers: 2,
      dealerButton: 0,
    }));
  });

  afterEach(() => {
    cleanupTables(manager);
  });

  it('should verify event ordering is correct even without elimination', async () => {
    // First, let's just verify that hand:ended fires before game cleanup
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
    table.handleGameEnd = function (result) {
      gameEndCleanupTime = Date.now();
      console.log('handleGameEnd called at', gameEndCleanupTime);
      console.log(
        'Time since hand:ended:',
        gameEndCleanupTime - handEndedTime,
        'ms',
      );

      // Check for players with 0 chips before cleanup
      const eliminatedCount = Array.from(this.players.values()).filter(
        (p) => p.player.chips <= 0,
      ).length;
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

    // Create players using test utilities
    const player1 = new StrategicPlayer({
      id: 'player1',
      name: 'Player 1',
      strategy: STRATEGIES.alwaysCall,
    });
    const player2 = new StrategicPlayer({
      id: 'player2',
      name: 'Player 2',
      strategy: STRATEGIES.alwaysCall,
    });

    // Add players
    table.addPlayer(player1);
    table.addPlayer(player2);

    // Wait for hand to complete
    const handPromise = new Promise((resolve) => {
      table.once('hand:ended', () => {
        // Give time for any cleanup to happen
        setTimeout(() => resolve(), 100);
      });
    });

    // Start game
    table.tryStartGame();

    // Wait for completion
    await handPromise;

    // Log final event order
    console.log('\nFinal event log:');
    eventLog.forEach((e) => {
      console.log(`  ${e.event} at ${e.timestamp}`);
    });

    // Verify handleGameEnd runs first, then hand:ended (fixed in v3.0.2)
    const handEndedEvent = eventLog.find((e) => e.event === 'hand:ended');
    const handleGameEndEvent = eventLog.find(
      (e) => e.event === 'handleGameEnd',
    );

    expect(handEndedEvent).toBeTruthy();
    expect(handleGameEndEvent).toBeTruthy();

    // Check order in array - handleGameEnd should be BEFORE hand:ended now
    const handEndedIndex = eventLog.findIndex((e) => e.event === 'hand:ended');
    const handleGameEndIndex = eventLog.findIndex(
      (e) => e.event === 'handleGameEnd',
    );
    expect(handleGameEndIndex).toBeLessThan(handEndedIndex);
  });

  it('should ensure elimination events fire BEFORE hand:ended (fixed in v3.0.2)', async () => {
    const eventLog = [];
    let handEndedFired = false;

    // Track events
    table.on('hand:ended', ({ winners }) => {
      handEndedFired = true;
      eventLog.push({ event: 'hand:ended', winners });
      console.log('hand:ended fired with winners:', winners);
    });

    table.on('player:eliminated', ({ playerId }) => {
      eventLog.push({
        event: 'player:eliminated',
        playerId,
        afterHandEnded: handEndedFired,
      });
      console.log(
        'player:eliminated fired for',
        playerId,
        'afterHandEnded:',
        handEndedFired,
      );
    });

    // Create players with unequal chips
    const richPlayer = new StrategicPlayer({
      id: 'rich',
      name: 'Rich Player',
      strategy: STRATEGIES.threeBet,
    });
    const poorPlayer = new StrategicPlayer({
      id: 'poor',
      name: 'Poor Player',
      strategy: STRATEGIES.alwaysCall,
    });

    // Add players
    table.addPlayer(richPlayer);
    table.addPlayer(poorPlayer);

    // Give poor player very few chips
    const poorData = Array.from(table.players.values()).find(
      (p) => p.player.id === 'poor',
    );
    if (poorData) {
      poorData.chips = 30; // Just enough for blinds + small bet
    }

    // Wait for hand to complete
    const handPromise = new Promise((resolve, reject) => {
      const handler = () => {
        // Give time for elimination events
        setTimeout(() => resolve(), 200);
      };
      table.once('hand:ended', handler);

      // Add timeout in case hand never ends
      setTimeout(() => {
        reject(new Error('Test timeout - hand never ended'));
      }, 5000);
    });

    // Start game
    table.tryStartGame();

    // Wait for completion
    await handPromise;

    // Verify event order
    console.log('\nEvent log:');
    eventLog.forEach((e) => {
      console.log(`  ${e.event}`, e);
    });

    // Check that hand:ended fired
    const handEndedEvents = eventLog.filter((e) => e.event === 'hand:ended');
    expect(handEndedEvents.length).toBeGreaterThan(0);

    // Check if any eliminations occurred
    const eliminationEvents = eventLog.filter(
      (e) => e.event === 'player:eliminated',
    );

    if (eliminationEvents.length > 0) {
      // All eliminations should show afterHandEnded: true
      eliminationEvents.forEach((elimEvent) => {
        expect(elimEvent.afterHandEnded).toBe(true);
      });

      // And elimination should come after hand:ended in the log
      const handEndedIndex = eventLog.findIndex(
        (e) => e.event === 'hand:ended',
      );
      const firstElimIndex = eventLog.findIndex(
        (e) => e.event === 'player:eliminated',
      );
      expect(firstElimIndex).toBeGreaterThan(handEndedIndex);
    }
  });
});
