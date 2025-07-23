/**
 * Test Utilities - Main Export
 *
 * Centralized exports for all poker test utilities.
 * Provides convenient access to table creation, event capture,
 * deck building, player implementations, and assertions.
 */

// Table Factory exports
export {
  createTestTable,
  createChipStackTable,
  createHeadsUpTable,
  createAllInTable,
  createSplitPotTable,
  createTournamentTable,
  createMultiTableSetup,
  cleanupTables,
  createWaitHelper,
  TABLE_CONFIGS,
} from './tableFactory.js';

// Event Capture exports
export {
  setupEventCapture,
  setupSimpleCapture,
  waitForConditions,
  waitForHandEnd,
  waitForGameStart,
} from './eventCapture.js';

// Deck Builder exports
export { DeckBuilder, createDeck, DECK_SCENARIOS } from './deckBuilder.js';

// Player Implementation exports
export {
  StrategicPlayer,
  PhaseAwarePlayer,
  ConditionalPlayer,
  TournamentPlayer,
  STRATEGIES,
  PLAYER_TYPES,
  assignPositions,
} from './players.js';

// Assertion exports
export {
  assertPotSplit,
  assertHandStrengths,
  assertActionSequence,
  assertActionsOccurred,
  assertPlayerChips,
  assertShowdown,
  assertSidePots,
  assertBettingRounds,
  assertAllInScenario,
  assertTournamentState,
  assertPokerScenario,
} from './assertions.js';

// Import local modules for internal use
import {
  createTestTable,
  createChipStackTable,
  createWaitHelper,
  cleanupTables,
} from './tableFactory.js';
import {
  setupEventCapture,
  waitForGameStart,
  waitForHandEnd,
} from './eventCapture.js';
import { DeckBuilder } from './deckBuilder.js';
import {
  PLAYER_TYPES,
  StrategicPlayer,
  TournamentPlayer,
  STRATEGIES,
} from './players.js';

// Import Action for convenience
export { Action } from '../types/index.js';

// Table helpers for new explicit start API
export {
  createAutoStartTable,
  createManualTable,
  waitForTableReadyAndStart,
  setupTableWithPlayers,
} from './tableHelpers.js';

/**
 * Complete test scenario setup - combines table, events, and players
 * @param {Object} config - Test scenario configuration
 * @returns {Object} Complete test setup
 */
export function createTestScenario(config = {}) {
  const {
    tableConfig = 'standard',
    tableOverrides = {},
    chipAmounts = [],
    _players = [], // API consistency - not yet implemented
    customDeck = null,
    eventOptions = {},
    timeout = 5000,
  } = config;

  // Create table
  const { manager, table } =
    chipAmounts.length > 0
      ? createChipStackTable(tableConfig, chipAmounts, tableOverrides)
      : createTestTable(tableConfig, tableOverrides);

  // Set custom deck if provided
  if (customDeck) {
    table.setCustomDeck(customDeck);
  }

  // Set up event capture
  const events = setupEventCapture(table, eventOptions);

  // Create wait helpers
  const waitHelpers = createWaitHelper({}, timeout);

  return {
    manager,
    table,
    events,
    waitHelpers,

    // Convenience methods
    addPlayers: (playerList) => {
      playerList.forEach((player) => table.addPlayer(player));
    },

    startGame: () => table.tryStartGame(),

    waitForStart: () => waitForGameStart(events, waitHelpers.gameStart),
    waitForEnd: () => waitForHandEnd(events, waitHelpers.handEnd),

    cleanup: () => {
      cleanupTables(manager);
    },
  };
}

/**
 * Quick setup for heads-up scenarios
 * @param {Object} config - Heads-up configuration
 * @returns {Object} Heads-up test setup
 */
export function createHeadsUpScenario(config = {}) {
  const {
    buttonChips = 1000,
    bbChips = 1000,
    playerTypes = ['station', 'nit'],
    customDeck = null,
    ...otherConfig
  } = config;

  const scenario = createTestScenario({
    tableConfig: 'headsUp',
    chipAmounts: [buttonChips, bbChips],
    customDeck,
    ...otherConfig,
  });

  // Add players if types specified
  if (playerTypes.length >= 2) {
    const player1 = PLAYER_TYPES[playerTypes[0]]('Button Player');
    const player2 = PLAYER_TYPES[playerTypes[1]]('BB Player');
    scenario.addPlayers([player1, player2]);
  }

  return scenario;
}

/**
 * Quick setup for split pot scenarios
 * @param {Object} config - Split pot configuration
 * @returns {Object} Split pot test setup
 */
export function createSplitPotScenario(config = {}) {
  const {
    playerCount = 3,
    identicalHands = [
      ['8h', '9h'],
      ['8d', '9d'],
      ['8s', '9s'],
    ],
    communityCards = ['5c', '6s', '7h', 'Tc', 'Jc'],
    useOddChips = false,
    ...otherConfig
  } = config;

  // Create custom deck for split scenario
  const customDeck = DeckBuilder.createSplitPotDeck(
    identicalHands.slice(0, playerCount),
    communityCards,
  );

  const scenario = createTestScenario({
    tableConfig: useOddChips ? 'oddChip' : 'standard',
    tableOverrides: { minPlayers: playerCount },
    customDeck,
    ...otherConfig,
  });

  // Add calling players
  const players = Array.from({ length: playerCount }, (_, i) =>
    PLAYER_TYPES.station(`Player ${i + 1}`),
  );
  scenario.addPlayers(players);

  return scenario;
}

/**
 * Quick setup for all-in scenarios
 * @param {Object} config - All-in configuration
 * @returns {Object} All-in test setup
 */
export function createAllInScenario(config = {}) {
  const {
    playerCount = 4,
    chipAmounts = [1000, 500, 200, 100],
    playerStrategy = 'pushOrFold',
    ...otherConfig
  } = config;

  const scenario = createTestScenario({
    tableConfig: 'shortStack',
    chipAmounts: chipAmounts.slice(0, playerCount),
    ...otherConfig,
  });

  // Add aggressive players for all-in action
  const players = Array.from(
    { length: playerCount },
    (_, i) =>
      new StrategicPlayer({
        name: `Player ${i + 1}`,
        strategy: STRATEGIES[playerStrategy] || STRATEGIES.pushOrFold,
      }),
  );
  scenario.addPlayers(players);

  return scenario;
}

/**
 * Quick setup for tournament scenarios
 * @param {Object} config - Tournament configuration
 * @returns {Object} Tournament test setup
 */
export function createTournamentScenario(config = {}) {
  const {
    playerCount = 8,
    _blindLevel = 1, // API consistency - not yet implemented
    startingChips = 1500,
    tournamentStage = 'early',
    ...otherConfig
  } = config;

  const scenario = createTestScenario({
    tableConfig: 'tournament',
    chipAmounts: Array(playerCount).fill(startingChips),
    tableOverrides: { minPlayers: playerCount },
    ...otherConfig,
  });

  // Add tournament players
  const players = Array.from(
    { length: playerCount },
    (_, i) =>
      new TournamentPlayer({
        name: `Player ${i + 1}`,
        tournamentStage,
        playersRemaining: playerCount * 10, // Simulated field size
        avgStack: startingChips,
      }),
  );
  scenario.addPlayers(players);

  return scenario;
}

/**
 * Complete test execution helper
 * @param {Function} testSetup - Function that returns test scenario
 * @param {Function} testValidation - Function that validates results
 * @param {Object} options - Test execution options
 * @returns {Promise} Test execution promise
 */
export async function executePokerTest(
  testSetup,
  testValidation,
  options = {},
) {
  const {
    _timeout = 5000, // API consistency - not yet implemented
    cleanup = true,
  } = options;

  const scenario = testSetup();

  try {
    // Start the game (required by new API)
    scenario.startGame();

    // Wait for test completion
    await scenario.waitForStart();
    await scenario.waitForEnd();

    // Extract results
    const results = {
      winners: scenario.events.winners,
      actions: scenario.events.actions,
      events: scenario.events.events,
      totalPot: scenario.events.totalPot,
      showdownOccurred:
        scenario.events.winners.length > 0 &&
        scenario.events.winners[0].hand !== null,
    };

    // Validate results
    if (testValidation) {
      testValidation(results, scenario);
    }

    return results;
  } finally {
    if (cleanup) {
      scenario.cleanup();
    }
  }
}

/**
 * Batch test execution for multiple scenarios
 * @param {Array} testConfigs - Array of test configurations
 * @param {Object} options - Batch execution options
 * @returns {Promise<Array>} Array of test results
 */
export async function executeBatchTests(testConfigs, options = {}) {
  const { parallel = false, continueOnError = false } = options;

  if (parallel) {
    const promises = testConfigs.map((config) =>
      executePokerTest(config.setup, config.validation, config.options).catch(
        (error) => (continueOnError ? { error } : Promise.reject(error)),
      ),
    );
    return Promise.all(promises);
  } else {
    const results = [];
    for (const config of testConfigs) {
      try {
        const result = await executePokerTest(
          config.setup,
          config.validation,
          config.options,
        );
        results.push(result);
      } catch (error) {
        if (continueOnError) {
          results.push({ error });
        } else {
          throw error;
        }
      }
    }
    return results;
  }
}
