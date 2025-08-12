import { describe, it, expect } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

/**
 * Test to reproduce TournamentManagerRaceCondition scenario
 */
describe('TournamentManager Race Condition - tryStartGame', () => {
  it('should always return enhanced error object, never boolean false', async () => {
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
    
    // Players that take time to respond
    player1.getAction = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { action: Action.CHECK };
    };
    player2.getAction = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { action: Action.CHECK };
    };
    
    table.addPlayer(player1);
    table.addPlayer(player2);

    // Start first game
    const firstStartPromise = table.tryStartGame();
    
    // Immediately try to start again (race condition)
    const secondStartPromise = table.tryStartGame();
    
    // Both should return objects, not booleans
    const [firstResult, secondResult] = await Promise.all([
      firstStartPromise,
      secondStartPromise,
    ]);
    
    console.log('First result:', firstResult);
    console.log('Second result:', secondResult);
    
    // First should succeed
    expect(typeof firstResult).toBe('object');
    expect(firstResult.success).toBe(true);
    
    // Second should fail with enhanced error, NOT boolean false
    expect(typeof secondResult).toBe('object');
    expect(secondResult).not.toBe(false);
    expect(secondResult).not.toBe(true);
    expect(secondResult.success).toBe(false);
    expect(secondResult.reason).toBe('TABLE_NOT_READY');
    
    // Clean up
    table.close();
  });

  it('should handle rapid successive calls correctly', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'rapid-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
    });

    const player1 = new Player({ id: 'p1', name: 'Player 1' });
    const player2 = new Player({ id: 'p2', name: 'Player 2' });
    player1.chips = 1000;
    player2.chips = 1000;
    
    // eslint-disable-next-line require-await
    player1.getAction = async () => ({ action: Action.CHECK });
    // eslint-disable-next-line require-await
    player2.getAction = async () => ({ action: Action.CHECK });
    
    table.addPlayer(player1);
    table.addPlayer(player2);

    // Make 5 rapid calls
    const results = await Promise.all([
      table.tryStartGame(),
      table.tryStartGame(),
      table.tryStartGame(),
      table.tryStartGame(),
      table.tryStartGame(),
    ]);
    
    // All should return objects
    results.forEach((result, index) => {
      console.log(`Call ${index + 1} result:`, result);
      expect(typeof result).toBe('object');
      expect(result).not.toBe(false);
      expect(result).not.toBe(true);
      expect(result.success).toBeDefined();
      expect(result.reason).toBeDefined();
      expect(result.details).toBeDefined();
    });
    
    // Only one should succeed
    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBe(1);
    
    // Others should fail with TABLE_NOT_READY
    const failures = results.filter(r => !r.success);
    failures.forEach(failure => {
      expect(failure.reason).toBe('TABLE_NOT_READY');
    });
    
    // Clean up
    table.close();
  });

  it('should handle backward compatibility check properly', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'compat-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
    });

    // No players - should fail
    const result = await table.tryStartGame();
    
    // Common mistake: checking result === false (old v3 style)
    // This should NOT work anymore
    expect(result === false).toBe(false); // result is NOT false
    expect(result === true).toBe(false);  // result is NOT true
    
    // Correct v4.1+ way
    expect(result.success).toBe(false);
    expect(result.reason).toBe('INSUFFICIENT_PLAYERS');
    
    // If client code is doing this, it will break:
    if (result === false) {
      throw new Error('This code path should never execute in v4.1+');
    }
    
    // Correct way:
    if (!result.success) {
      console.log('Correctly detected failure:', result.reason);
    }
  });
});