/**
 * Table Factory Utility
 *
 * Provides standardized table creation and configuration for poker tests.
 * Eliminates duplication of table setup code across test files.
 */

import { PokerGameManager } from '../PokerGameManager.js';

/**
 * Common table configurations used across tests
 */
export const TABLE_CONFIGS = {
  // Standard cash game tables
  standard: {
    blinds: { small: 10, big: 20 },
    minBuyIn: 1000,
    maxBuyIn: 1000,
    minPlayers: 2,
    dealerButton: 0,
  },

  // Heads-up specific configuration
  headsUp: {
    blinds: { small: 10, big: 20 },
    minBuyIn: 1000,
    maxBuyIn: 1000,
    minPlayers: 2,
    maxPlayers: 2,
    dealerButton: 0,
  },

  // Multi-table tournament style
  tournament: {
    blinds: { small: 25, big: 50 },
    minBuyIn: 1500,
    maxBuyIn: 1500,
    minPlayers: 6,
    dealerButton: 0,
  },

  // High stakes table
  highStakes: {
    blinds: { small: 50, big: 100 },
    minBuyIn: 5000,
    maxBuyIn: 10000,
    minPlayers: 3,
    dealerButton: 0,
  },

  // Short stack focused table
  shortStack: {
    blinds: { small: 10, big: 20 },
    minBuyIn: 100,
    maxBuyIn: 500,
    minPlayers: 3,
    dealerButton: 0,
  },

  // Odd chip scenarios (for split pot testing)
  oddChip: {
    blinds: { small: 5, big: 10 },
    minBuyIn: 1000,
    maxBuyIn: 1000,
    minPlayers: 3,
    dealerButton: 0,
  },

  // Large field tournament
  largeTournament: {
    blinds: { small: 10, big: 20 },
    minBuyIn: 1000,
    maxBuyIn: 1000,
    minPlayers: 8,
    dealerButton: 0,
  },

  // Side pot testing (different stack sizes)
  sidePot: {
    blinds: { small: 10, big: 20 },
    minBuyIn: 100,
    maxBuyIn: 1000,
    minPlayers: 3,
    dealerButton: 0,
  },
};

/**
 * Creates a poker game manager and table with specified configuration
 * @param {string|Object} config - Config name from TABLE_CONFIGS or custom config object
 * @param {Object} overrides - Optional overrides for the config
 * @returns {Object} Object containing manager and table
 */
export function createTestTable(config = 'standard', overrides = {}) {
  const manager = new PokerGameManager();

  // Get base config
  const baseConfig = typeof config === 'string' ? TABLE_CONFIGS[config] : config;
  if (!baseConfig) {
    throw new Error(
      `Unknown table config: ${config}. Available configs: ${Object.keys(TABLE_CONFIGS).join(', ')}`,
    );
  }

  // Apply overrides
  const finalConfig = { ...baseConfig, ...overrides };

  const table = manager.createTable(finalConfig);

  return {
    manager,
    table,
    config: finalConfig,
  };
}

/**
 * Creates a table with custom chip amounts for players
 * @param {string|Object} config - Table configuration
 * @param {Array<number>} chipAmounts - Array of chip amounts for each player
 * @param {Object} overrides - Optional config overrides
 * @returns {Object} Table setup with chip override capability
 */
export function createChipStackTable(
  config = 'standard',
  chipAmounts = [],
  overrides = {},
) {
  const {
    manager,
    table,
    config: finalConfig,
  } = createTestTable(config, overrides);

  // Store original addPlayer method
  const originalAddPlayer = table.addPlayer.bind(table);
  let playerIndex = 0;

  // Override addPlayer to set custom chip amounts
  table.addPlayer = function (player) {
    const result = originalAddPlayer(player);
    const playerData = this.players.get(player.id);

    if (playerData && chipAmounts[playerIndex] !== undefined) {
      playerData.chips = chipAmounts[playerIndex];
    }

    playerIndex++;
    return result;
  };

  return {
    manager,
    table,
    config: finalConfig,
    chipAmounts,
  };
}

/**
 * Creates a heads-up table with specific configurations for testing
 * @param {Object} options - Heads-up specific options
 * @returns {Object} Heads-up table setup
 */
export function createHeadsUpTable(options = {}) {
  const {
    buttonChips = 1000,
    bbChips = 1000,
    blinds = { small: 10, big: 20 },
    ...otherOptions
  } = options;

  return createChipStackTable('headsUp', [buttonChips, bbChips], {
    blinds,
    ...otherOptions,
  });
}

/**
 * Creates a table optimized for all-in scenarios
 * @param {number} playerCount - Number of players
 * @param {Array<number>} chipAmounts - Stack sizes for each player
 * @param {Object} options - Additional options
 * @returns {Object} All-in optimized table
 */
export function createAllInTable(playerCount, chipAmounts, options = {}) {
  const config = {
    blinds: { small: 10, big: 20 },
    minBuyIn: Math.min(...chipAmounts),
    maxBuyIn: Math.max(...chipAmounts),
    minPlayers: playerCount,
    dealerButton: 0,
    ...options,
  };

  return createChipStackTable(config, chipAmounts);
}

/**
 * Creates a table setup for split pot testing
 * @param {number} playerCount - Number of players
 * @param {Object} options - Split pot specific options
 * @returns {Object} Split pot table setup
 */
export function createSplitPotTable(playerCount = 3, options = {}) {
  const {
    useOddChips = false,
    chipAmounts = new Array(playerCount).fill(1000),
    ...otherOptions
  } = options;

  const configName = useOddChips ? 'oddChip' : 'standard';

  return createChipStackTable(configName, chipAmounts, {
    minPlayers: playerCount,
    ...otherOptions,
  });
}

/**
 * Creates a tournament-style table with specific blind structure
 * @param {Object} options - Tournament options
 * @returns {Object} Tournament table setup
 */
export function createTournamentTable(options = {}) {
  const {
    blindLevel = 1,
    playerCount = 8,
    startingChips = 1500,
    ...otherOptions
  } = options;

  // Blind progression (typical tournament structure)
  const blindLevels = [
    { small: 25, big: 50 },
    { small: 50, big: 100 },
    { small: 75, big: 150 },
    { small: 100, big: 200 },
    { small: 150, big: 300 },
  ];

  const blinds = blindLevels[blindLevel - 1] || blindLevels[0];
  const chipAmounts = new Array(playerCount).fill(startingChips);

  return createChipStackTable('tournament', chipAmounts, {
    blinds,
    minPlayers: playerCount,
    ...otherOptions,
  });
}

/**
 * Cleanup helper for test afterEach hooks
 * @param {PokerGameManager} manager - Game manager to clean up
 */
export function cleanupTables(manager) {
  if (manager && manager.tables) {
    manager.tables.forEach((table) => {
      try {
        table.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  }
}

/**
 * Helper to create multiple tables for multi-table scenarios
 * @param {number} tableCount - Number of tables to create
 * @param {string|Object} config - Table configuration
 * @param {Object} overrides - Config overrides
 * @returns {Object} Multi-table setup
 */
export function createMultiTableSetup(
  tableCount = 2,
  config = 'standard',
  overrides = {},
) {
  const manager = new PokerGameManager();
  const tables = [];

  for (let i = 0; i < tableCount; i++) {
    const baseConfig =
      typeof config === 'string' ? TABLE_CONFIGS[config] : config;
    const finalConfig = { ...baseConfig, ...overrides, id: `table-${i + 1}` };
    const table = manager.createTable(finalConfig);
    tables.push(table);
  }

  return {
    manager,
    tables,
    primaryTable: tables[0],
  };
}

/**
 * Helper to wait for common game conditions with sensible defaults
 * @param {Object} conditions - Conditions to wait for
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Object} Wait helper object
 */
export function createWaitHelper(conditions = {}, timeout = 5000) {
  return {
    gameStart: timeout * 0.4, // 40% of total timeout for game start
    handEnd: timeout, // Full timeout for hand completion
    playerAction: timeout * 0.2, // 20% for individual actions
    ...conditions,
  };
}
