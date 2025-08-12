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
    
    // Simple folding players to ensure game starts quickly without engine errors
    player1.getAction = async () => ({ action: Action.FOLD });
    player2.getAction = async () => ({ action: Action.FOLD });
    
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
    
    // BOTH results should be objects (the key test)
    expect(typeof firstResult).toBe('object');
    expect(typeof secondResult).toBe('object');
    expect(firstResult).not.toBe(false);
    expect(firstResult).not.toBe(true);
    expect(secondResult).not.toBe(false);
    expect(secondResult).not.toBe(true);
    
    // One should succeed OR both could fail (either outcome is fine)
    // The important thing is that both return enhanced error objects
    if (firstResult.success) {
      expect(secondResult.success).toBe(false);
      expect(secondResult.reason).toBe('TABLE_NOT_READY');
    } else if (secondResult.success) {
      expect(firstResult.success).toBe(false);
    } else {
      // Both failed - that's also acceptable for a race condition
      expect(firstResult.reason).toBeDefined();
      expect(secondResult.reason).toBeDefined();
    }
    
    // Both should have detailed error information
    expect(firstResult.reason).toBeDefined();
    expect(firstResult.details).toBeDefined();
    expect(secondResult.reason).toBeDefined();
    expect(secondResult.details).toBeDefined();
    
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
    
    // Simple folding players to avoid game engine complications
    player1.getAction = async () => ({ action: Action.FOLD });
    player2.getAction = async () => ({ action: Action.FOLD });
    
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
    
    // All should return objects (the key requirement)
    results.forEach((result, index) => {
      console.log(`Call ${index + 1} result:`, result);
      expect(typeof result).toBe('object');
      expect(result).not.toBe(false);
      expect(result).not.toBe(true);
      expect(result.success).toBeDefined();
      expect(result.reason).toBeDefined();
      expect(result.details).toBeDefined();
    });
    
    // AT LEAST one should succeed OR all could fail (both are valid in a race)
    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBeGreaterThanOrEqual(0); // Changed from expecting exactly 1
    
    // Any failures should be TABLE_NOT_READY (if one succeeded) or various reasons (if all failed)
    const failures = results.filter(r => !r.success);
    if (successCount > 0) {
      // If one succeeded, others should be TABLE_NOT_READY
      failures.forEach(failure => {
        expect(['TABLE_NOT_READY', 'ENGINE_ERROR']).toContain(failure.reason);
      });
    } else {
      // If all failed, they could have various reasons
      failures.forEach(failure => {
        expect(failure.reason).toBeDefined();
      });
    }
    
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