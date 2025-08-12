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
  table.on('table:ready', async () => {
    const result = await table.tryStartGame();
    if (!result.success) {
      // Silently fail in tests - tests should check for failures explicitly
      // console.error('Failed to auto-start game:', result.reason, result.details);
    }
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
    startGame: async () => {
      if (isReady) {
        const result = await table.tryStartGame();
        if (!result.success) {
          throw new Error(`Failed to start game: ${result.reason} - ${result.details.message}`);
        }
        return result;
      } else {
        throw new Error('Table not ready - need minimum players');
      }
    },
  };
}

/**
 * Wait for table to be ready and start game
 */
export function waitForTableReadyAndStart(table, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Table did not become ready in time'));
    }, timeout);

    table.once('table:ready', async () => {
      clearTimeout(timer);
      const result = await table.tryStartGame();
      if (result.success) {
        resolve(result);
      } else {
        reject(new Error(`Failed to start game: ${result.reason} - ${result.details.message}`));
      }
    });
  });
}

/**
 * Helper to add players and start game when ready
 */
export async function setupTableWithPlayers(manager, config, players) {
  const table = createAutoStartTable(manager, config);

  // Add all players
  players.forEach((player) => table.addPlayer(player));

  // Wait for game to start
  await vi.waitFor(() => table.state === 'PLAYING', { timeout: 500 });

  return table;
}
