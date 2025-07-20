/**
 * Table Test Helpers
 * 
 * Utilities for managing tables in tests with the new explicit start API
 */

import { vi } from 'vitest';

/**
 * Creates a table and sets up automatic game start on table:ready
 * This maintains backward compatibility for tests
 */
export function createAutoStartTable(manager, config) {
  const table = manager.createTable(config);
  
  // Auto-start when ready (mimics old behavior for tests)
  table.on('table:ready', () => {
    table.tryStartGame();
  });
  
  return table;
}

/**
 * Creates a table with manual game control
 * Returns both table and a start function
 */
export function createManualTable(manager, config) {
  const table = manager.createTable(config);
  let isReady = false;
  
  table.on('table:ready', () => {
    isReady = true;
  });
  
  return {
    table,
    isReady: () => isReady,
    startGame: () => {
      if (isReady) {
        table.tryStartGame();
      } else {
        throw new Error('Table not ready - need minimum players');
      }
    },
  };
}

/**
 * Wait for table to be ready and start game
 */
export async function waitForTableReadyAndStart(table, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Table did not become ready in time'));
    }, timeout);
    
    table.once('table:ready', () => {
      clearTimeout(timer);
      table.tryStartGame();
      resolve();
    });
  });
}

/**
 * Helper to add players and start game when ready
 */
export async function setupTableWithPlayers(manager, config, players) {
  const table = createAutoStartTable(manager, config);
  
  // Add all players
  players.forEach(player => table.addPlayer(player));
  
  // Wait for game to start
  await vi.waitFor(() => table.state === 'PLAYING', { timeout: 2000 });
  
  return table;
}