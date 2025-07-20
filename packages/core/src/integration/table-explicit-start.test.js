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

  it('should NOT auto-restart after hand ends', { timeout: 3000 }, async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
    });

    let gameCount = 0;
    let handCount = 0;

    table.on('game:started', () => {
      gameCount++;
      console.log(`Game ${gameCount} started`);
    });

    table.on('hand:ended', () => {
      handCount++;
      console.log(`Hand ${handCount} ended`);
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

    // Wait for table ready
    await new Promise((resolve) => {
      table.once('table:ready', resolve);
    });

    // Start first game manually
    table.tryStartGame();

    // Wait for hand to end
    await vi.waitFor(() => handCount === 1, { timeout: 1000 });

    // Wait to see if another game starts automatically
    console.log('Waiting 6 seconds to verify no auto-restart...');
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Should still be only 1 game
    expect(gameCount).toBe(1);
    expect(handCount).toBe(1);
    
    table.close();
  });

  it('should allow manual restart after hand ends', { timeout: 3000 }, async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
    });

    let gameCount = 0;
    let handCount = 0;

    table.on('game:started', () => {
      gameCount++;
    });

    table.on('hand:ended', () => {
      handCount++;
      
      // Manually start next game
      if (handCount === 1) {
        console.log('Manually starting second game...');
        table.tryStartGame();
      }
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

    // Add players and start first game
    table.addPlayer(new TestPlayer({ name: 'Player 1' }));
    table.addPlayer(new TestPlayer({ name: 'Player 2' }));
    
    await new Promise((resolve) => {
      table.once('table:ready', () => {
        table.tryStartGame();
        resolve();
      });
    });

    // Wait for two hands
    await vi.waitFor(() => handCount === 2, { timeout: 1500 });

    expect(gameCount).toBe(2);
    expect(handCount).toBe(2);
    
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