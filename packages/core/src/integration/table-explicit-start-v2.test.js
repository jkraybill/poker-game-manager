/**
 * Table Explicit Start API Tests (Using Test Utilities)
 * 
 * Tests the new explicit game start API that replaced automatic game starts.
 * This prevents memory leaks and gives consumers full control over game flow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  createTestTable,
  setupEventCapture,
  StrategicPlayer,
  STRATEGIES,
  cleanupTables,
} from '../test-utils/index.js';

describe('Table Explicit Start API (v2)', () => {
  let manager;
  let table;
  let events;

  beforeEach(() => {
    // Initialize but don't create yet
    manager = null;
    table = null;
    events = null;
  });

  afterEach(() => {
    // Clean up if created
    if (manager) {
      cleanupTables(manager);
    }
  });

  it('should NOT auto-start games when players join', async () => {
    // Create table
    const result = createTestTable('standard', {
      minPlayers: 2,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    let tableReady = false;
    table.on('table:ready', () => {
      tableReady = true;
    });

    // Add players
    const players = Array.from({ length: 2 }, (_, i) => 
      new StrategicPlayer({
        name: `Player ${i + 1}`,
        strategy: STRATEGIES.alwaysFold,
      })
    );
    players.forEach(p => table.addPlayer(p));

    // Wait to see if game auto-starts
    await new Promise(resolve => setTimeout(resolve, 500));

    // Table should be ready but game should NOT have started
    expect(tableReady).toBe(true);
    expect(events.gameStarted).toBe(false);
    expect(table.state).toBe('WAITING');
  });

  it('should start game only when explicitly requested', async () => {
    // Create table
    const result = createTestTable('standard', {
      minPlayers: 2,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    let tableReadyData = null;
    table.on('table:ready', (data) => {
      tableReadyData = data;
    });

    // Add players
    const players = Array.from({ length: 2 }, (_, i) => 
      new StrategicPlayer({
        name: `Player ${i + 1}`,
        strategy: STRATEGIES.alwaysFold,
      })
    );
    players.forEach(p => table.addPlayer(p));

    await vi.waitFor(() => tableReadyData !== null, { timeout: 500 });

    // Verify ready event data
    expect(tableReadyData).toEqual({
      playerCount: 2,
      minPlayers: 2,
    });

    // Game should not have started yet
    expect(events.gameStarted).toBe(false);

    // Now explicitly start the game
    table.tryStartGame();

    await vi.waitFor(() => events.gameStarted, { timeout: 500 });

    expect(events.gameStarted).toBe(true);
    expect(table.state).toBe('IN_PROGRESS');
  });

  it('should NOT auto-restart after hand ends', async () => {
    // Create table
    const result = createTestTable('standard', {
      minPlayers: 2,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    let gameCount = 0;
    let handCount = 0;

    table.on('game:started', () => {
      gameCount++;
    });

    table.on('hand:ended', () => {
      handCount++;
    });

    // Add players
    const players = Array.from({ length: 2 }, (_, i) => 
      new StrategicPlayer({
        name: `Player ${i + 1}`,
        strategy: STRATEGIES.alwaysFold,
      })
    );
    players.forEach(p => table.addPlayer(p));

    // Wait for table ready then start game
    await vi.waitFor(() => table.state === 'WAITING', { timeout: 500 });
    table.tryStartGame();

    // Wait for hand to end
    await vi.waitFor(() => events.handEnded, { timeout: 2000 });

    // Wait to see if another game starts automatically
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Should still be only 1 game
    expect(gameCount).toBe(1);
    expect(handCount).toBe(1);
  });

  it('should allow manual restart after hand ends', { timeout: 5000 }, async () => {
    // Create table
    const result = createTestTable('standard', {
      minPlayers: 2,
    });
    manager = result.manager;
    table = result.table;

    let gameCount = 0;
    let handCount = 0;
    let secondHandComplete = false;

    table.on('game:started', () => {
      gameCount++;
    });

    table.on('hand:ended', () => {
      handCount++;
      // Manually start next game after first hand
      if (handCount === 1) {
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
        reject(new Error('Two hands did not complete in time'));
      }, 4000);
    });

    // Add players
    const players = Array.from({ length: 2 }, (_, i) => 
      new StrategicPlayer({
        name: `Player ${i + 1}`,
        strategy: STRATEGIES.alwaysFold,
      })
    );
    players.forEach(p => table.addPlayer(p));

    // Wait for table ready then start first game
    await vi.waitFor(() => table.state === 'WAITING', { timeout: 500 });
    table.tryStartGame();

    // Wait for two hands to complete
    await twoHandsResult;

    expect(gameCount).toBe(2);
    expect(handCount).toBe(2);
    expect(secondHandComplete).toBe(true);
  });

  it('should emit table:ready each time minimum players is reached', async () => {
    // Create table requiring 3 players
    const result = createTestTable('standard', {
      minPlayers: 3,
    });
    manager = result.manager;
    table = result.table;

    const readyEvents = [];
    table.on('table:ready', (data) => {
      readyEvents.push(data);
    });

    // Create players
    const players = Array.from({ length: 4 }, (_, i) => 
      new StrategicPlayer({
        name: `Player ${i + 1}`,
        strategy: STRATEGIES.alwaysFold,
      })
    );

    // Add 2 players - not enough
    table.addPlayer(players[0]);
    table.addPlayer(players[1]);

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(readyEvents).toHaveLength(0);

    // Add 3rd player - should trigger ready
    table.addPlayer(players[2]);

    await vi.waitFor(() => readyEvents.length === 1, { timeout: 500 });
    
    expect(readyEvents[0]).toEqual({
      playerCount: 3,
      minPlayers: 3,
    });

    // Add 4th player - should not trigger another ready
    table.addPlayer(players[3]);

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(readyEvents).toHaveLength(1);
  });
});