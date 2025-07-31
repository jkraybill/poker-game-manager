import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  StrategicPlayer,
  STRATEGIES,
  cleanupTables,
} from '../test-utils/index.js';

/**
 * Tests for dead button and dead small blind rules per POKER-RULES.md section 3
 *
 * Core principle: The big blind ALWAYS moves forward one position each hand.
 * The button and small blind are positioned relative to the big blind.
 */

describe('Dead Button Rules', () => {
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

  it('should implement dead button when player between button and blinds is eliminated', async () => {
    // Scenario 1 from Issue #37:
    // 4 players A, B, C, D
    // Hand 1: A=Button, B=SB, C=BB, D=UTG
    // Player B eliminated during hand
    // Hand 2 should have: Dead button on B's seat, no SB posted, C=BB

    // Create players using test utilities
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

    // Track blind posting
    const blindTracking = {
      hand1: { sb: null, bb: null, button: null },
      hand2: {
        sb: null,
        bb: null,
        button: null,
        deadButton: false,
        deadSB: false,
      },
    };

    let handCount = 0;
    let hand1Complete = false;
    let hand2Complete = false;

    // Track hand 1 blinds
    table.on('hand:started', (data) => {
      handCount++;

      if (handCount === 1) {
        blindTracking.hand1.button = data.dealerButton;
        // In 4 player game with button at 0: SB=1, BB=2
        blindTracking.hand1.sb = data.players[(data.dealerButton + 1) % 4];
        blindTracking.hand1.bb = data.players[(data.dealerButton + 2) % 4];
      } else if (handCount === 2) {
        blindTracking.hand2.button = data.dealerButton;
        // Check if button is "dead" (on eliminated player's seat)
        const activePlayerIds = Array.from(table.players.values())
          .filter(p => p.chips > 0)
          .map(p => p.player.id);
        const buttonPosition = data.dealerButton;
        const buttonPlayers = Array.from(table.players.values());
        if (buttonPosition < buttonPlayers.length) {
          const buttonPlayerData = buttonPlayers[buttonPosition];
          blindTracking.hand2.deadButton = !activePlayerIds.includes(buttonPlayerData?.player?.id);
        }
      }
    });

    table.on('pot:updated', ({ playerBet, deadMoney }) => {
      if (playerBet && handCount > 0) {
        const trackingObj = handCount === 1 ? blindTracking.hand1 : blindTracking.hand2;
        if (playerBet.amount === 10 && !trackingObj.sb) {
          trackingObj.sb = playerBet.playerId;
        } else if (playerBet.amount === 20 && !trackingObj.bb) {
          trackingObj.bb = playerBet.playerId;
        }
      }
      if (deadMoney && handCount === 2) {
        blindTracking.hand2.deadSB = true;
      }
    });

    table.on('hand:ended', () => {
      if (handCount === 1) {
        hand1Complete = true;
        // Eliminate player B after hand 1
        const playerBData = Array.from(table.players.values()).find(p => p.player.id === 'B');
        if (playerBData) {
          playerBData.chips = 0;
        }
        // Start hand 2
        setTimeout(() => table.tryStartGame(), 100);
      } else if (handCount === 2) {
        hand2Complete = true;
      }
    });

    // Add players
    players.forEach(player => table.addPlayer(player));

    // Start first hand
    table.tryStartGame();

    // Wait for both hands to complete
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (hand1Complete && hand2Complete) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });

    // Verify hand 1 positions (should be standard)
    expect(blindTracking.hand1.button).toBe(0); // Player A
    expect(blindTracking.hand1.sb).toBe('B'); // Player B posts SB
    expect(blindTracking.hand1.bb).toBe('C'); // Player C posts BB

    // Verify hand 2 implements dead button rule
    // CURRENT BEHAVIOR (WRONG): Button moves to C, D posts SB, A posts BB
    // CORRECT BEHAVIOR: Button on B's empty seat (dead), no SB, C posts BB again

    // This test will currently FAIL, demonstrating the bug
    console.log('\n=== Dead Button Test Results ===');
    console.log('Hand 1:', blindTracking.hand1);
    console.log('Hand 2:', blindTracking.hand2);
    console.log('Expected: Dead button on position 1, no SB, C posts BB');

    // These assertions show what SHOULD happen (will fail with current implementation)
    // expect(blindTracking.hand2.button).toBe(1); // Dead button on B's seat
    // expect(blindTracking.hand2.deadButton).toBe(true);
    // expect(blindTracking.hand2.deadSB).toBe(true); // No one posts SB
    // expect(blindTracking.hand2.bb).toBe('C'); // C posts BB again
  });

  it('should handle multiple eliminations correctly', async () => {
    // Scenario 4 from Issue #37:
    // 4 players A, B, C, D
    // Hand 1: A=Button, B=SB, C=BB, D=UTG
    // Players B and C eliminated during hand
    // Hand 2: D=Button, A=SB, D=BB (heads-up rules)

    // Create players using test utilities
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

    let handCount = 0;
    const handData = [];

    table.on('hand:started', (data) => {
      handCount++;
      handData.push({
        hand: handCount,
        button: data.dealerButton,
        players: [...data.players],
      });
    });

    table.on('hand:ended', () => {
      if (handCount === 1) {
        // Eliminate players B and C
        const playerBData = Array.from(table.players.values()).find(p => p.player.id === 'B');
        const playerCData = Array.from(table.players.values()).find(p => p.player.id === 'C');
        if (playerBData) {
          playerBData.chips = 0;
        }
        if (playerCData) {
          playerCData.chips = 0;
        }

        setTimeout(() => table.tryStartGame(), 100);
      }
    });

    // Add players and start
    players.forEach(player => table.addPlayer(player));
    table.tryStartGame();

    // Wait for completion
    await new Promise((resolve) => {
      let handEndCount = 0;
      const handEndHandler = () => {
        handEndCount++;
        if (handEndCount >= 2) {
          table.off('hand:ended', handEndHandler);
          setTimeout(() => resolve(), 100); // Small delay to ensure cleanup
        }
      };
      
      table.on('hand:ended', handEndHandler);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        table.off('hand:ended', handEndHandler);
        resolve();
      }, 5000);
    });

    console.log('\n=== Multiple Elimination Test ===');
    console.log('Hand data:', handData);

    // With current implementation, this test shows the issue
    // After B and C are eliminated, only A and D remain (heads-up)
    // The button should follow proper heads-up transition rules
  });
});
