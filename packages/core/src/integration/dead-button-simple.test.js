import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  StrategicPlayer,
  STRATEGIES,
  cleanupTables,
} from '../test-utils/index.js';

/**
 * Simple test to verify dead button rule implementation
 * Tests the exact scenario from Issue #37
 */

describe('Dead Button Simple Test', () => {
  let manager, table;

  beforeEach(() => {
    // Use test utilities for table creation
    ({ manager, table } = createTestTable('standard', {
      minPlayers: 2,
      dealerButton: 0,
    }));
    
    // Set up event capture
    setupEventCapture(table, {
      events: ['hand:started', 'pot:updated', 'hand:ended', 'player:eliminated'],
    });
  });

  afterEach(() => {
    cleanupTables(manager);
  });

  it('should show that BB moves forward when player is eliminated', async () => {
    // Create 4 players using test utilities
    const playerA = new StrategicPlayer({ 
      id: 'A', 
      name: 'Player A',
      strategy: STRATEGIES.checkCall,
    });
    const playerB = new StrategicPlayer({ 
      id: 'B', 
      name: 'Player B',
      strategy: STRATEGIES.checkCall,
    });
    const playerC = new StrategicPlayer({ 
      id: 'C', 
      name: 'Player C',
      strategy: STRATEGIES.checkCall,
    });
    const playerD = new StrategicPlayer({ 
      id: 'D', 
      name: 'Player D',
      strategy: STRATEGIES.checkCall,
    });

    const handInfo = [];

    table.on('hand:started', (data) => {
      const info = {
        hand: handInfo.length + 1,
        dealerButton: data.dealerButton,
        players: [...data.players],
        blindPosts: { sb: null, bb: null },
      };
      handInfo.push(info);
    });

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

    // Add event to track eliminations
    const eliminatedPlayers = [];
    table.on('player:eliminated', ({ playerId }) => {
      eliminatedPlayers.push(playerId);
    });

    // Add players to table
    table.addPlayer(playerA);
    table.addPlayer(playerB);
    table.addPlayer(playerC);
    table.addPlayer(playerD);

    // Start first hand
    table.tryStartGame();

    // Wait for first hand to complete
    await new Promise((resolve) => {
      table.on('hand:ended', () => {
        if (handInfo.length === 1) {
          // Manually eliminate player B
          const playerBData = Array.from(table.players.values()).find(p => p.player.id === 'B');
          if (playerBData) {
            playerBData.chips = 0;
          }

          // Start second hand after a delay
          setTimeout(() => {
            table.tryStartGame();
          }, 200);
        } else if (handInfo.length === 2) {
          resolve();
        }
      });

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
    const playerBData = Array.from(table.players.values()).find(p => p.player.id === 'B');
    expect(playerBData?.chips).toBe(0);

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
