import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createChipStackTable,
  cleanupTables,
  StrategicPlayer,
  STRATEGIES,
} from '../test-utils/index.js';

/**
 * Simple test to reproduce the chip conservation bug reported in v3.0.1
 *
 * Issue: hand:ended event fires before chip distribution is complete,
 * causing temporary chip losses.
 */

describe('Chip Conservation Bug - Simple Reproduction', () => {
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

  it('should preserve total chips during hand:ended event', async () => {
    // Create simple 2-player heads-up scenario
    const chipAmounts = [1000, 500];
    const totalChipsExpected = 1500;

    ({ manager, table } = createChipStackTable('headsUp', chipAmounts, {
      id: 'chip-conservation-simple',
      blinds: { small: 10, big: 20 },
      dealerButton: 0,
    }));

    // Add simple players
    const player1 = new StrategicPlayer({
      name: 'Big Stack',
      strategy: STRATEGIES.alwaysCall, // Call everything to get to showdown
    });
    const player2 = new StrategicPlayer({
      name: 'Small Stack',
      strategy: STRATEGIES.alwaysCall, // Call everything to get to showdown
    });

    table.addPlayer(player1);
    table.addPlayer(player2);

    let handEndedChipCount = 0;
    let handEndedFired = false;

    // The critical test: capture chips at the exact moment hand:ended fires
    table.on('hand:ended', ({ winners }) => {
      console.log('\\n=== hand:ended event fired ===');
      handEndedFired = true;

      // Count total chips across all players at this exact moment
      handEndedChipCount = Array.from(table.players.values()).reduce(
        (sum, pd) => sum + pd.player.chips,
        0,
      );

      console.log(
        'Winners:',
        winners.map((w) => ({ id: w.playerId, amount: w.amount })),
      );
      console.log('Player chips at hand:ended:');
      Array.from(table.players.values()).forEach((pd) => {
        console.log(`  ${pd.player.name}: ${pd.player.chips} chips`);
      });
      console.log(`Total chips at hand:ended: ${handEndedChipCount}`);
      console.log(`Expected total: ${totalChipsExpected}`);

      const difference = totalChipsExpected - handEndedChipCount;
      if (difference !== 0) {
        console.log(
          `🚨 CHIP CONSERVATION VIOLATION: ${difference} chips ${difference > 0 ? 'MISSING' : 'EXTRA'}`,
        );
      }
    });

    // Start the game and wait for completion
    const handEndedPromise = new Promise((resolve) => {
      table.on('hand:ended', resolve);
    });

    table.tryStartGame();
    await handEndedPromise;

    // Give time for any background processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // THE CRITICAL ASSERTION: Chip conservation must hold
    console.log('\\n=== FINAL VERIFICATION ===');
    console.log(`hand:ended fired: ${handEndedFired}`);
    console.log(`Chip count when hand:ended fired: ${handEndedChipCount}`);
    console.log(`Expected chip count: ${totalChipsExpected}`);

    // This test will FAIL if the bug exists
    expect(handEndedChipCount).toBe(totalChipsExpected);
  });

  it('should demonstrate chip count changes over multiple events', async () => {
    // Create 3-player scenario to see if chips fluctuate
    const chipAmounts = [800, 400, 200];
    const totalChipsExpected = 1400;

    ({ manager, table } = createChipStackTable('standard', chipAmounts, {
      id: 'chip-fluctuation-test',
      blinds: { small: 10, big: 20 },
      dealerButton: 0,
      minPlayers: 3,
    }));

    // Add players
    const players = [
      new StrategicPlayer({
        name: 'Player 1',
        strategy: STRATEGIES.alwaysCall,
      }),
      new StrategicPlayer({
        name: 'Player 2',
        strategy: STRATEGIES.alwaysCall,
      }),
      new StrategicPlayer({
        name: 'Player 3',
        strategy: STRATEGIES.alwaysCall,
      }),
    ];

    players.forEach((p) => table.addPlayer(p));

    const chipCountLog = [];

    // Log chips at multiple events to see the timing
    ['hand:started', 'hand:ended', 'player:eliminated'].forEach((eventName) => {
      table.on(eventName, (_data) => {
        const totalChips = Array.from(table.players.values()).reduce(
          (sum, pd) => sum + pd.player.chips,
          0,
        );

        chipCountLog.push({
          event: eventName,
          timestamp: Date.now(),
          totalChips,
          expectedChips: totalChipsExpected,
          difference: totalChipsExpected - totalChips,
          playerCount: table.players.size,
        });

        console.log(
          `${eventName}: ${totalChips}/${totalChipsExpected} chips (${table.players.size} players)`,
        );
      });
    });

    // Start the game
    const handEndedPromise = new Promise((resolve) => {
      table.on('hand:ended', resolve);
    });

    table.tryStartGame();
    await handEndedPromise;

    // Wait for any elimination events
    await new Promise((resolve) => setTimeout(resolve, 300));

    console.log('\\n=== CHIP COUNT TIMELINE ===');
    chipCountLog.forEach((log, i) => {
      const status = log.difference === 0 ? '✅' : '🚨';
      console.log(
        `${i + 1}. ${status} ${log.event}: ${log.totalChips} chips (diff: ${log.difference})`,
      );
    });

    // Look for any chip conservation violations during the sequence
    const violations = chipCountLog.filter((log) => log.difference !== 0);
    if (violations.length > 0) {
      console.log('\\n🚨 CHIP CONSERVATION VIOLATIONS DETECTED:');
      violations.forEach((v) => {
        console.log(
          `  ${v.event}: ${v.difference} chips ${v.difference > 0 ? 'missing' : 'extra'}`,
        );
      });
    }

    // Final assertion: all events should preserve chip conservation
    const handEndedEvent = chipCountLog.find(
      (log) => log.event === 'hand:ended',
    );
    expect(handEndedEvent).toBeTruthy();
    expect(handEndedEvent.totalChips).toBe(totalChipsExpected);
  });
});
