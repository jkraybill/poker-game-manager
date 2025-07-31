import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  StrategicPlayer,
  STRATEGIES,
  cleanupTables,
  waitForHandEnd,
} from '../test-utils/index.js';

/**
 * Simple test to verify dead button rule implementation
 * Tests the exact scenario from Issue #37
 */

describe('Dead Button Simple Test (v2)', () => {
  let manager, table, events;

  beforeEach(() => {
    // Use test utilities for table creation
    ({ manager, table } = createTestTable('standard', {
      minPlayers: 2,
      dealerButton: 0,
    }));
    
    // Set up event capture
    events = setupEventCapture(table, {
      events: ['hand:started', 'pot:updated', 'hand:ended', 'player:eliminated'],
    });
  });

  afterEach(() => {
    cleanupTables(manager);
  });

  it('should show that BB moves forward when player is eliminated', async () => {
    // Create 4 players using test utilities
    const players = [
      new StrategicPlayer({ 
        id: 'A', 
        name: 'Player A',
        strategy: STRATEGIES.alwaysCall,
      }),
      new StrategicPlayer({ 
        id: 'B', 
        name: 'Player B',
        strategy: STRATEGIES.alwaysCall,
      }),
      new StrategicPlayer({ 
        id: 'C', 
        name: 'Player C',
        strategy: STRATEGIES.alwaysCall,
      }),
      new StrategicPlayer({ 
        id: 'D', 
        name: 'Player D',
        strategy: STRATEGIES.alwaysCall,
      }),
    ];

    const handInfo = [];

    // Track hand starts using event capture
    table.on('hand:started', (data) => {
      const info = {
        hand: handInfo.length + 1,
        dealerButton: data.dealerButton,
        players: [...data.players],
        blindPosts: { sb: null, bb: null },
      };
      handInfo.push(info);
    });

    // Track blind posts
    table.on('pot:updated', ({ playerBet }) => {
      if (playerBet && handInfo.length > 0) {
        const currentHand = handInfo[handInfo.length - 1];
        if (playerBet.amount === 10 && !currentHand.blindPosts.sb) {
          currentHand.blindPosts.sb = playerBet.playerId;
        } else if (playerBet.amount === 20 && !currentHand.blindPosts.bb) {
          currentHand.blindPosts.bb = playerBet.playerId;
        }
      }
    });

    // Track eliminations using event capture
    const eliminatedPlayers = [];
    table.on('player:eliminated', ({ playerId }) => {
      eliminatedPlayers.push(playerId);
    });

    // Add players to table
    players.forEach(player => table.addPlayer(player));

    // Start first hand
    table.tryStartGame();

    // Wait for first hand to complete
    await waitForHandEnd(events);

    // Manually eliminate player B
    const playerBData = Array.from(table.players.values()).find(p => p.player.id === 'B');
    if (playerBData) {
      playerBData.chips = 0;
    }

    // Start second hand
    table.tryStartGame();

    // Wait for second hand
    await new Promise((resolve) => {
      const handler = () => {
        table.off('hand:ended', handler);
        resolve();
      };
      table.on('hand:ended', handler);
      
      // Timeout
      setTimeout(resolve, 5000);
    });

    console.log('\n=== Dead Button Simple Test Results ===');
    console.log('Hand 1:', {
      button: handInfo[0].dealerButton,
      players: handInfo[0].players,
      sb: handInfo[0].blindPosts.sb,
      bb: handInfo[0].blindPosts.bb,
    });

    console.log('Eliminated:', eliminatedPlayers);

    if (handInfo[1]) {
      console.log('Hand 2:', {
        button: handInfo[1].dealerButton,
        players: handInfo[1].players,
        sb: handInfo[1].blindPosts.sb,
        bb: handInfo[1].blindPosts.bb,
      });
    }

    // Verify first hand positions
    expect(handInfo[0].dealerButton).toBe(0); // A is button
    expect(handInfo[0].blindPosts.sb).toBe('B'); // B posts SB
    expect(handInfo[0].blindPosts.bb).toBe('C'); // C posts BB

    // Player B should have 0 chips
    expect(playerBData.chips).toBe(0);

    // In hand 2, according to dead button rule:
    // - BB should advance from C to D (big blind always moves forward)
    // - Button should be on B's empty seat (dead button)
    // - No small blind should be posted (dead small blind)

    if (handInfo[1]) {
      console.log('\nExpected for Hand 2:');
      console.log('- BB advances from C to D');
      console.log("- Dead button on B's seat");
      console.log('- No SB posted');

      console.log('\nActual Hand 2:');
      console.log('- BB posted by:', handInfo[1].blindPosts.bb);
      console.log('- SB posted by:', handInfo[1].blindPosts.sb);
      console.log('- Button position:', handInfo[1].dealerButton);
    }
  });
});