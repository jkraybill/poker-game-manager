import { describe, it, expect } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { TableState } from '../types/index.js';

/**
 * Test to ensure tryStartGame ALWAYS returns an object, never throws
 */
describe('tryStartGame Always Returns Object', () => {
  it('should return object even if exception thrown in player iteration', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'exception-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
    });

    // Add a player with a broken chips getter
    const brokenPlayer = new Player({ id: 'broken', name: 'Broken' });
    Object.defineProperty(brokenPlayer, 'chips', {
      get() {
        throw new Error('Simulated chips getter error');
      },
      set(value) {
        // Allow setting but break getting
      }
    });
    
    brokenPlayer.chips = 1000; // Set works
    
    const normalPlayer = new Player({ id: 'normal', name: 'Normal' });
    normalPlayer.chips = 1000;
    
    table.addPlayer(brokenPlayer);
    table.addPlayer(normalPlayer);
    
    // This should NOT throw, should return error object
    let result;
    let threw = false;
    
    try {
      result = await table.tryStartGame();
    } catch (err) {
      threw = true;
      console.error('tryStartGame threw:', err);
    }
    
    expect(threw).toBe(false);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result.success).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.details).toBeDefined();
    
    console.log('Result for broken player:', JSON.stringify(result, null, 2));
  });

  it('should return object even if players Map is corrupted', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'corrupt-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
    });

    const player1 = new Player({ id: 'p1', name: 'Player 1' });
    const player2 = new Player({ id: 'p2', name: 'Player 2' });
    player1.chips = 1000;
    player2.chips = 1000;
    
    table.addPlayer(player1);
    table.addPlayer(player2);
    
    // Corrupt the players map
    const originalEntries = table.players.entries;
    table.players.entries = function() {
      throw new Error('Simulated Map corruption');
    };
    
    // This should NOT throw, should return error object
    let result;
    let threw = false;
    
    try {
      result = await table.tryStartGame();
    } catch (err) {
      threw = true;
      console.error('tryStartGame threw:', err);
    }
    
    expect(threw).toBe(false);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result.success).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.details).toBeDefined();
    
    console.log('Result for corrupted map:', JSON.stringify(result, null, 2));
    
    // Restore for cleanup
    table.players.entries = originalEntries;
  });

  it('should emit game:start-failed for all failure cases', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'event-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
    });

    let eventCount = 0;
    let lastEvent = null;
    
    table.on('game:start-failed', (data) => {
      eventCount++;
      lastEvent = data;
      console.log('game:start-failed event:', data.reason);
    });
    
    // Test 1: No players
    const result1 = await table.tryStartGame();
    expect(result1.success).toBe(false);
    expect(eventCount).toBe(1);
    expect(lastEvent.reason).toBe('INSUFFICIENT_PLAYERS');
    
    // Test 2: Table already in progress
    table.state = TableState.IN_PROGRESS;
    const result2 = await table.tryStartGame();
    expect(result2.success).toBe(false);
    expect(eventCount).toBe(2);
    expect(lastEvent.reason).toBe('TABLE_NOT_READY');
    table.state = TableState.WAITING;
    
    // Test 3: Players with no chips
    const player1 = new Player({ id: 'p1', name: 'Player 1' });
    const player2 = new Player({ id: 'p2', name: 'Player 2' });
    player1.chips = 0;
    player2.chips = 0;
    table.addPlayer(player1);
    table.addPlayer(player2);
    
    const result3 = await table.tryStartGame();
    expect(result3.success).toBe(false);
    expect(eventCount).toBe(3);
    expect(lastEvent.reason).toBe('INSUFFICIENT_ACTIVE_PLAYERS');
  });

  it('should handle Promise.race correctly', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'race-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
    });

    const player1 = new Player({ id: 'p1', name: 'Player 1' });
    const player2 = new Player({ id: 'p2', name: 'Player 2' });
    player1.chips = 1000;
    player2.chips = 1000;
    
    // eslint-disable-next-line require-await
    player1.getAction = async () => ({ action: 'CALL' });
    // eslint-disable-next-line require-await
    player2.getAction = async () => ({ action: 'CHECK' });
    
    table.addPlayer(player1);
    table.addPlayer(player2);
    
    // Simulate the client's Promise.race pattern
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 5000)
    );
    
    const result = await Promise.race([
      table.tryStartGame().then(res => {
        console.log('tryStartGame result in .then():', res);
        // MUST return the result!
        return res;
      }),
      timeoutPromise
    ]).catch(err => {
      console.log('Promise.race caught:', err.message);
      return { success: false, reason: 'TIMEOUT', details: { error: err.message } };
    });
    
    // Result should be defined and be an object
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result.success).toBeDefined();
    expect(result.reason).toBeDefined();
    expect(result.details).toBeDefined();
    
    console.log('Final result from Promise.race:', result);
  });
});