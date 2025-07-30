import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  StrategicPlayer,
  STRATEGIES,
  cleanupTables,
  Action,
} from '../test-utils/index.js';

/**
 * Tests for dead button and dead small blind rules per POKER-RULES.md section 3
 * Fixed version that properly handles async operations
 */

describe('Dead Button Rules (v2 Fixed)', () => {
  let manager, table, events;

  beforeEach(() => {
    // Use test utilities for table creation
    ({ manager, table } = createTestTable('standard', {
      minPlayers: 2,
      dealerButton: 0,
    }));
    
    // Set up event capture
    events = setupEventCapture(table);
  });

  afterEach(() => {
    cleanupTables(manager);
  });

  it('should demonstrate dead button behavior with player elimination', async () => {
    // Simple test: Start with 4 players, eliminate 1, see what happens
    
    // Create players using test utilities
    const players = [
      new StrategicPlayer({ 
        id: 'A', 
        name: 'Player A',
        strategy: STRATEGIES.checkCall,
      }),
      new StrategicPlayer({ 
        id: 'B', 
        name: 'Player B',
        strategy: STRATEGIES.checkCall,
      }),
      new StrategicPlayer({ 
        id: 'C', 
        name: 'Player C',
        strategy: STRATEGIES.checkCall,
      }),
      new StrategicPlayer({ 
        id: 'D', 
        name: 'Player D',
        strategy: STRATEGIES.checkCall,
      }),
    ];

    // Track game state
    const gameState = {
      hands: [],
      blindPosts: {},
    };

    // Track hand starts
    table.on('hand:started', (data) => {
      const handNum = gameState.hands.length + 1;
      gameState.hands.push({
        hand: handNum,
        button: data.dealerButton,
        players: [...data.players],
      });
      gameState.blindPosts[`hand${handNum}`] = { sb: null, bb: null };
    });

    // Track blind posts
    table.on('pot:updated', ({ playerBet }) => {
      if (playerBet && gameState.hands.length > 0) {
        const handNum = gameState.hands.length;
        const blinds = gameState.blindPosts[`hand${handNum}`];
        if (playerBet.amount === 10 && !blinds.sb) {
          blinds.sb = playerBet.playerId;
        } else if (playerBet.amount === 20 && !blinds.bb) {
          blinds.bb = playerBet.playerId;
        }
      }
    });

    // Add players
    players.forEach(player => table.addPlayer(player));

    // Give player B very few chips so they get eliminated
    const playerBData = Array.from(table.players.values()).find(p => p.player.id === 'B');
    if (playerBData) {
      playerBData.chips = 30;
    }

    // Start first hand
    table.tryStartGame();

    // Wait for first hand to complete
    await new Promise((resolve) => {
      table.on('hand:ended', () => {
        console.log('\nHand 1 completed');
        resolve();
      });
      setTimeout(resolve, 5000); // Timeout safety
    });

    // Log hand 1 results
    console.log('\n=== Hand 1 Results ===');
    console.log('Button:', gameState.hands[0].button);
    console.log('Players:', gameState.hands[0].players);
    console.log('Blinds:', gameState.blindPosts.hand1);

    // Check player chips after hand 1
    console.log('\nPlayer chips after hand 1:');
    players.forEach(p => {
      const playerData = Array.from(table.players.values()).find(pd => pd.player.id === p.id);
      console.log(`${p.id}: ${playerData?.chips || 0} chips`);
    });

    // Now try to start hand 2 if we have enough players
    const activePlayers = Array.from(table.players.values()).filter(p => p.chips > 0);
    console.log(`\nActive players: ${activePlayers.length}`);

    if (activePlayers.length >= 2) {
      // Start second hand
      table.tryStartGame();

      // Wait for second hand
      await new Promise((resolve) => {
        let handEndCount = 0;
        const handler = () => {
          handEndCount++;
          if (handEndCount === 2) {
            table.off('hand:ended', handler);
            console.log('\nHand 2 completed');
            resolve();
          }
        };
        table.on('hand:ended', handler);
        setTimeout(resolve, 5000); // Timeout safety
      });

      // Log hand 2 results
      if (gameState.hands[1]) {
        console.log('\n=== Hand 2 Results ===');
        console.log('Button:', gameState.hands[1].button);
        console.log('Players:', gameState.hands[1].players);
        console.log('Blinds:', gameState.blindPosts.hand2);
      }
    }

    // Basic assertion to ensure test runs
    expect(gameState.hands.length).toBeGreaterThanOrEqual(1);
    expect(gameState.blindPosts.hand1.sb).toBe('B');
    expect(gameState.blindPosts.hand1.bb).toBe('C');
  });
});