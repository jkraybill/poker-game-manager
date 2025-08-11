import { describe, it, expect, beforeEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

/**
 * Test for concurrent table starts - verifies the fix for the race condition
 * reported by the pokersim team where gameEngine.start() was not awaited
 */
describe('Concurrent Table Starts', () => {
  let manager;
  let tables;
  let players;

  beforeEach(() => {
    manager = new PokerGameManager();
    tables = [];
    players = [];
  });

  it('should handle multiple tables starting concurrently without race conditions', async () => {
    // Create 4 tables like in the pokersim scenario
    for (let tableId = 0; tableId < 4; tableId++) {
      const table = manager.createTable({
        id: `table-${tableId}`,
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
        maxPlayers: 8,
      });
      tables.push(table);

      // Add 8 players per table
      for (let playerId = 0; playerId < 8; playerId++) {
        const globalId = tableId * 8 + playerId;
        const player = new Player({ 
          id: `player-${globalId}`, 
          name: `P${globalId}` 
        });
        player.chips = 10000;
        
        // Track decisions per player to detect infinite loops
        player.decisionCount = new Map();
        player.getAction = async function(gameState) {
          const stateKey = `${gameState.phase}-${gameState.currentBet}-${gameState.pot}`;
          const count = (this.decisionCount.get(stateKey) || 0) + 1;
          this.decisionCount.set(stateKey, count);
          
          // Fail if asked for same decision too many times
          if (count > 3) {
            throw new Error(`Infinite loop detected: Player ${this.id} asked for same decision ${count} times`);
          }
          
          // Simple strategy
          const toCall = gameState.currentBet - gameState.players[this.id].bet;
          if (toCall > 0) {
            return { action: Action.CALL };
          }
          return { action: Action.CHECK };
        };
        
        table.addPlayer(player);
        players.push(player);
      }
    }

    // Track game starts
    let gamesStarted = 0;
    let gamesEnded = 0;
    
    tables.forEach(table => {
      table.on('game:started', () => {
        gamesStarted++;
      });
      
      table.on('hand:ended', () => {
        gamesEnded++;
      });
    });

    // Start all tables concurrently - this is where the bug would manifest
    const startPromises = tables.map(table => table.tryStartGame());
    
    // All starts should complete without errors
    const results = await Promise.all(startPromises);
    
    // All tables should have started successfully
    expect(results).toHaveLength(4);
    results.forEach(result => {
      expect(result).toBe(true);
    });
    
    // Wait for games to process a bit
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify no infinite loops occurred
    expect(gamesStarted).toBe(4);
    
    // Check that no player was asked for the same decision too many times
    players.forEach(player => {
      if (player.decisionCount) {
        for (const [state, count] of player.decisionCount.entries()) {
          expect(count).toBeLessThanOrEqual(3);
        }
      }
    });
  });

  it('should properly await gameEngine.start() preventing race conditions', async () => {
    // Create a simple 2-table scenario
    const table1 = manager.createTable({
      id: 'table-1',
      blinds: { small: 10, big: 20 },
    });
    
    const table2 = manager.createTable({
      id: 'table-2',
      blinds: { small: 10, big: 20 },
    });
    
    // Add players
    for (let i = 0; i < 4; i++) {
      const player1 = new Player({ id: `t1-p${i}`, name: `T1P${i}` });
      player1.chips = 1000;
      player1.getAction = async () => ({ action: Action.FOLD });
      table1.addPlayer(player1);
      
      const player2 = new Player({ id: `t2-p${i}`, name: `T2P${i}` });
      player2.chips = 1000;
      player2.getAction = async () => ({ action: Action.FOLD });
      table2.addPlayer(player2);
    }
    
    // Track events to ensure proper sequencing
    const events = [];
    
    table1.on('game:started', () => events.push('t1:started'));
    table1.on('hand:started', () => events.push('t1:hand:started'));
    table2.on('game:started', () => events.push('t2:started'));
    table2.on('hand:started', () => events.push('t2:hand:started'));
    
    // Start both tables concurrently
    const [r1, r2] = await Promise.all([
      table1.tryStartGame(),
      table2.tryStartGame()
    ]);
    
    expect(r1).toBe(true);
    expect(r2).toBe(true);
    
    // Wait for events to settle
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Both games should have started properly
    expect(events).toContain('t1:started');
    expect(events).toContain('t2:started');
    expect(events).toContain('t1:hand:started');
    expect(events).toContain('t2:hand:started');
  });
});