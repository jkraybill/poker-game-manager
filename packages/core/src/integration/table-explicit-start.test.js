/**
 * Table Explicit Start API Tests
 * 
 * Tests the new explicit game start API that replaced automatic game starts.
 * This prevents memory leaks and gives consumers full control over game flow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('Table Explicit Start API', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach(table => table.close());
  });

  it('should NOT auto-start games when players join', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
    });

    let gameStarted = false;
    let tableReady = false;

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('table:ready', () => {
      tableReady = true;
    });

    // Simple player that just folds
    class TestPlayer extends Player {
      getAction() {
        return {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now(),
        };
      }
    }

    // Add players
    const players = [
      new TestPlayer({ name: 'Player 1' }),
      new TestPlayer({ name: 'Player 2' }),
    ];
    players.forEach(p => table.addPlayer(p));

    // Wait to see if game auto-starts
    await new Promise(resolve => setTimeout(resolve, 500));

    // Table should be ready but game should NOT have started
    expect(tableReady).toBe(true);
    expect(gameStarted).toBe(false);
    expect(table.state).toBe('WAITING');
    
    table.close();
  });

  it('should start game only when explicitly requested', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
    });

    let gameStarted = false;
    let tableReadyData = null;

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('table:ready', (data) => {
      tableReadyData = data;
    });

    class TestPlayer extends Player {
      getAction() {
        return {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now(),
        };
      }
    }

    // Add players
    table.addPlayer(new TestPlayer({ name: 'Player 1' }));
    table.addPlayer(new TestPlayer({ name: 'Player 2' }));

    await vi.waitFor(() => tableReadyData !== null, { timeout: 500 });

    // Verify ready event data
    expect(tableReadyData).toEqual({
      playerCount: 2,
      minPlayers: 2,
    });

    // Game should not have started yet
    expect(gameStarted).toBe(false);

    // Now explicitly start the game
    table.tryStartGame();

    await vi.waitFor(() => gameStarted, { timeout: 500 });

    expect(gameStarted).toBe(true);
    expect(table.state).toBe('IN_PROGRESS');
    
    table.close();
  });

  it('should NOT auto-restart after hand ends', { timeout: 10000 }, async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
    });

    let gameCount = 0;
    let handCount = 0;

    class TestPlayer extends Player {
      getAction() {
        return {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now(),
        };
      }
    }

    // Add debugging for all events
    table.on('game:started', () => {
      gameCount++;
      console.log(`Game ${gameCount} started`);
    });

    table.on('hand:started', ({ players, dealerButton }) => {
      console.log('Hand started with players:', players, 'dealer button:', dealerButton);
    });
    
    table.on('error', (error) => {
      console.error('Table error:', error);
    });
    
    table.on('game:error', (error) => {
      console.error('Game error:', error);
    });

    table.on('hand:ended', () => {
      handCount++;
      console.log(`Hand ${handCount} ended`);
    });

    // Create promise to wait for hand end
    const handResult = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('Test timeout - game state:', table.state);
        console.log('Game engine:', table.gameEngine ? 'exists' : 'null');
        console.log('Player count:', table.players.size);
        reject(new Error('Hand did not end in time'));
      }, 9000);
      
      table.once('hand:ended', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Add players
    table.addPlayer(new TestPlayer({ name: 'Player 1' }));
    table.addPlayer(new TestPlayer({ name: 'Player 2' }));

    // Wait for table ready
    console.log('Waiting for table:ready event...');
    const tableReadyPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('Table ready timeout - table state:', table.state);
        console.log('Player count:', table.players.size);
        reject(new Error('Table ready event not received'));
      }, 2000);
      
      table.once('table:ready', () => {
        console.log('Table ready event received!');
        clearTimeout(timeout);
        resolve();
      });
    });
    
    try {
      await tableReadyPromise;
    } catch (error) {
      console.error('Table ready failed:', error.message);
      // Continue anyway to see what happens
    }

    // Start first game manually
    console.log('About to call tryStartGame, table state:', table.state);
    console.log('Player count:', table.players.size, 'min players:', table.config.minPlayers);
    table.tryStartGame();
    console.log('After tryStartGame, table state:', table.state);

    // Wait for hand to end
    try {
      await handResult;
    } catch (error) {
      console.error('Test failed:', error.message);
      throw error;
    }

    // Wait to see if another game starts automatically
    console.log('Waiting 1 second to verify no auto-restart...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Should still be only 1 game
    expect(gameCount).toBe(1);
    expect(handCount).toBe(1);
    
    table.close();
  });

  it('should allow manual restart after hand ends', { timeout: 5000 }, async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
    });

    let gameCount = 0;
    let handCount = 0;
    let secondHandComplete = false;

    class TestPlayer extends Player {
      getAction() {
        return {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now(),
        };
      }
    }

    // Set up event handlers
    table.on('game:started', () => {
      gameCount++;
      console.log(`Game ${gameCount} started`);
    });

    table.on('hand:ended', () => {
      handCount++;
      console.log(`Hand ${handCount} ended`);
      
      // Manually start next game
      if (handCount === 1) {
        console.log('Manually starting second game...');
        setTimeout(() => table.tryStartGame(), 100);
      }
    });

    // Create promise to wait for two hands
    const twoHandsResult = new Promise((resolve, reject) => {
      let resolveTimeout = null;
      const checkComplete = () => {
        if (handCount >= 2) {
          secondHandComplete = true;
          if (resolveTimeout) {
clearTimeout(resolveTimeout);
}
          resolve();
        }
      };
      
      table.on('hand:ended', checkComplete);
      
      // Safety timeout
      resolveTimeout = setTimeout(() => {
        console.log('Test timeout - hands completed:', handCount);
        reject(new Error('Two hands did not complete in time'));
      }, 4000);
    });

    // Add players and start first game
    table.addPlayer(new TestPlayer({ name: 'Player 1' }));
    table.addPlayer(new TestPlayer({ name: 'Player 2' }));
    
    const tableReadyPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Table ready timeout'));
      }, 1000);
      
      table.once('table:ready', () => {
        clearTimeout(timeout);
        console.log('Table ready, starting first game...');
        table.tryStartGame();
        resolve();
      });
    });
    
    try {
      await tableReadyPromise;
    } catch (error) {
      console.error('Table ready failed:', error.message);
      // Start game anyway
      console.log('Starting game despite table:ready timeout...');
      table.tryStartGame();
    }

    // Wait for two hands
    try {
      await twoHandsResult;
    } catch (error) {
      console.error('Test failed:', error.message);
      throw error;
    }

    expect(gameCount).toBe(2);
    expect(handCount).toBe(2);
    expect(secondHandComplete).toBe(true);
    
    table.close();
  });

  it('should emit table:ready each time minimum players is reached', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 3,
    });

    const readyEvents = [];

    table.on('table:ready', (data) => {
      readyEvents.push(data);
    });

    class TestPlayer extends Player {
      getAction() {
        return { playerId: this.id, action: Action.FOLD };
      }
    }

    // Add 2 players - not enough
    table.addPlayer(new TestPlayer({ name: 'Player 1' }));
    table.addPlayer(new TestPlayer({ name: 'Player 2' }));

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(readyEvents).toHaveLength(0);

    // Add 3rd player - should trigger ready
    table.addPlayer(new TestPlayer({ name: 'Player 3' }));

    await vi.waitFor(() => readyEvents.length === 1, { timeout: 500 });
    
    expect(readyEvents[0]).toEqual({
      playerCount: 3,
      minPlayers: 3,
    });

    // Add 4th player - should not trigger another ready
    table.addPlayer(new TestPlayer({ name: 'Player 4' }));

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(readyEvents).toHaveLength(1);
    
    table.close();
  });
});