/**
 * Poker Test Assertions Utility
 *
 * Provides reusable assertion functions for common poker test scenarios.
 * Reduces duplication and provides clear, descriptive error messages.
 */

import { expect } from 'vitest';
import { Action } from '../types/index.js';

/**
 * Assert that a pot split is correct for multiple winners
 * @param {Array} winners - Array of winner objects with amount and playerId
 * @param {number} expectedTotal - Expected total pot amount
 * @param {Object} options - Assertion options
 */
export function assertPotSplit(winners, expectedTotal, options = {}) {
  const {
    allowOddChip = true,
    maxOddChip = 1,
    description = 'pot split',
  } = options;

  expect(winners).toBeInstanceOf(Array);
  expect(winners.length).toBeGreaterThan(0);

  // Verify total pot
  const actualTotal = winners.reduce((sum, winner) => sum + winner.amount, 0);
  expect(actualTotal).toBe(expectedTotal);

  if (winners.length === 1) {
    // Single winner gets everything
    expect(winners[0].amount).toBe(expectedTotal);
  } else {
    // Multiple winners - check split distribution
    const expectedEach = Math.floor(expectedTotal / winners.length);
    const remainder = expectedTotal % winners.length;

    const amounts = winners.map((w) => w.amount).sort((a, b) => b - a);

    if (remainder === 0) {
      // Even split
      amounts.forEach((amount) => {
        expect(amount).toBe(expectedEach);
      });
    } else if (allowOddChip && remainder <= maxOddChip) {
      // Some winners get odd chip
      expect(amounts[0]).toBe(expectedEach + 1); // Winner with odd chip
      amounts.slice(1).forEach((amount) => {
        expect(amount).toBe(expectedEach);
      });
    } else {
      throw new Error(`Unexpected remainder ${remainder} in ${description}`);
    }
  }
}

/**
 * Assert that winners have specific hand strengths
 * @param {Array} winners - Array of winner objects with hand property
 * @param {number|Array} expectedRanks - Expected hand rank(s)
 * @param {Object} options - Assertion options
 */
export function assertHandStrengths(winners, expectedRanks, options = {}) {
  const {
    _allowTies = true, // API consistency - not yet implemented
    _description = 'hand strengths', // API consistency - not yet implemented
  } = options;

  expect(winners).toBeInstanceOf(Array);

  if (typeof expectedRanks === 'number') {
    // All winners should have same rank
    winners.forEach((winner) => {
      expect(winner.hand).toBeDefined();
      expect(winner.hand.rank).toBe(expectedRanks);
    });
  } else if (Array.isArray(expectedRanks)) {
    // Different ranks for different winners
    expect(winners.length).toBe(expectedRanks.length);
    winners.forEach((winner, index) => {
      expect(winner.hand).toBeDefined();
      expect(winner.hand.rank).toBe(expectedRanks[index]);
    });
  }
}

/**
 * Assert that a sequence of actions occurred in the correct order
 * @param {Array} actions - Array of action objects
 * @param {Array} expectedSequence - Expected sequence of actions
 * @param {Object} options - Assertion options
 */
export function assertActionSequence(actions, expectedSequence, options = {}) {
  const {
    allowAdditionalActions = true,
    _strictOrder = true, // API consistency - not yet implemented
    _description = 'action sequence', // API consistency - not yet implemented
  } = options;

  expect(actions).toBeInstanceOf(Array);

  let actionIndex = 0;
  let sequenceIndex = 0;

  while (
    sequenceIndex < expectedSequence.length &&
    actionIndex < actions.length
  ) {
    const expectedAction = expectedSequence[sequenceIndex];
    const actualAction = actions[actionIndex];

    if (matchesActionPattern(actualAction, expectedAction)) {
      sequenceIndex++;
    } else if (!allowAdditionalActions) {
      expect.fail(
        `Expected action ${JSON.stringify(expectedAction)} at position ${actionIndex}, got ${JSON.stringify(actualAction)}`,
      );
    }

    actionIndex++;
  }

  if (sequenceIndex < expectedSequence.length) {
    expect.fail(
      `Missing expected actions: ${JSON.stringify(expectedSequence.slice(sequenceIndex))}`,
    );
  }
}

/**
 * Helper to match action patterns
 * @param {Object} actualAction - Actual action taken
 * @param {Object} expectedPattern - Expected action pattern
 * @returns {boolean} Whether action matches pattern
 */
function matchesActionPattern(actualAction, expectedPattern) {
  if (
    expectedPattern.action &&
    actualAction.action !== expectedPattern.action
  ) {
    return false;
  }

  if (
    expectedPattern.amount !== undefined &&
    actualAction.amount !== expectedPattern.amount
  ) {
    return false;
  }

  if (
    expectedPattern.playerId &&
    actualAction.playerId !== expectedPattern.playerId
  ) {
    return false;
  }

  return true;
}

/**
 * Assert that specific actions occurred (without strict ordering)
 * @param {Array} actions - Array of action objects
 * @param {Array} expectedActions - Expected actions to find
 * @param {Object} options - Assertion options
 */
export function assertActionsOccurred(actions, expectedActions, options = {}) {
  const {
    _description = 'expected actions', // API consistency - not yet implemented
  } = options;

  expectedActions.forEach((expectedAction) => {
    const found = actions.some((action) =>
      matchesActionPattern(action, expectedAction),
    );
    expect(found).toBe(true);
  });
}

/**
 * Assert player chip counts after a hand
 * @param {Array} players - Array of player objects
 * @param {Object} expectedChips - Object mapping playerId to expected chip count
 * @param {Object} options - Assertion options
 */
export function assertPlayerChips(players, expectedChips, options = {}) {
  const {
    allowApproximate = false,
    tolerance = 0,
    _description = 'player chip counts', // API consistency - not yet implemented
  } = options;

  Object.entries(expectedChips).forEach(([playerId, expectedAmount]) => {
    const player = players.find((p) => p.id === playerId);
    expect(player).toBeDefined();

    if (allowApproximate) {
      expect(player.chips).toBeCloseTo(expectedAmount, tolerance);
    } else {
      expect(player.chips).toBe(expectedAmount);
    }
  });
}

/**
 * Assert that a showdown occurred (or didn't occur)
 * @param {Array} winners - Array of winner objects
 * @param {boolean} shouldHaveShowdown - Whether showdown should have occurred
 * @param {Object} options - Assertion options
 */
export function assertShowdown(winners, shouldHaveShowdown, options = {}) {
  const {
    _description = 'showdown occurrence', // API consistency - not yet implemented
  } = options;

  if (shouldHaveShowdown) {
    winners.forEach((winner) => {
      expect(winner.hand).toBeDefined();
      expect(winner.hand.rank).toBeDefined();
    });
  } else {
    // If no showdown, winners might not have hand info
    // This is more flexible for fold scenarios
    expect(winners.length).toBeGreaterThan(0);
  }
}

/**
 * Assert side pot distribution is correct
 * @param {Array} winners - Array of winner objects with potType information
 * @param {Object} expectedDistribution - Expected distribution by pot type
 * @param {Object} options - Assertion options
 */
export function assertSidePots(winners, expectedDistribution, options = {}) {
  const {
    _description = 'side pot distribution', // API consistency - not yet implemented
  } = options;

  // Group winners by pot type
  const winnersByPot = winners.reduce((acc, winner) => {
    const potType = winner.potType || 'main';
    if (!acc[potType]) {
      acc[potType] = [];
    }
    acc[potType].push(winner);
    return acc;
  }, {});

  Object.entries(expectedDistribution).forEach(([potType, expectedTotal]) => {
    expect(winnersByPot[potType]).toBeDefined();
    const potWinners = winnersByPot[potType];
    const actualTotal = potWinners.reduce((sum, w) => sum + w.amount, 0);
    expect(actualTotal).toBe(expectedTotal);
  });
}

/**
 * Assert betting round completion
 * @param {Array} actions - Array of action objects
 * @param {Array} expectedRounds - Expected betting rounds
 * @param {Object} options - Assertion options
 */
export function assertBettingRounds(actions, expectedRounds, options = {}) {
  const {
    _allowIncomplete = false, // API consistency - not yet implemented
    _description = 'betting rounds', // API consistency - not yet implemented
  } = options;

  const roundActions = groupActionsByRound(actions);

  expectedRounds.forEach((expectedRound, index) => {
    expect(roundActions[index]).toBeDefined();

    if (expectedRound.minActions) {
      expect(roundActions[index].length).toBeGreaterThanOrEqual(
        expectedRound.minActions,
      );
    }

    if (expectedRound.maxActions) {
      expect(roundActions[index].length).toBeLessThanOrEqual(
        expectedRound.maxActions,
      );
    }

    if (expectedRound.lastAction) {
      const lastAction = roundActions[index][roundActions[index].length - 1];
      expect(lastAction.action).toBe(expectedRound.lastAction);
    }
  });
}

/**
 * Helper to group actions by betting round
 * @param {Array} actions - Array of action objects
 * @returns {Array} Array of action arrays by round
 */
function groupActionsByRound(actions) {
  // This is a simplified implementation
  // In practice, you'd need phase information from game state
  const rounds = [];
  let currentRound = [];

  actions.forEach((action) => {
    currentRound.push(action);

    // Detect round end (simplified - actual implementation would be more sophisticated)
    if (action.action === Action.FOLD && currentRound.length > 1) {
      rounds.push([...currentRound]);
      currentRound = [];
    }
  });

  if (currentRound.length > 0) {
    rounds.push(currentRound);
  }

  return rounds;
}

/**
 * Assert all-in scenario outcomes
 * @param {Array} actions - Array of action objects
 * @param {Array} winners - Array of winner objects
 * @param {Object} expectedOutcome - Expected all-in outcome
 * @param {Object} options - Assertion options
 */
export function assertAllInScenario(
  actions,
  winners,
  expectedOutcome,
  options = {},
) {
  const {
    _description = 'all-in scenario', // API consistency - not yet implemented
  } = options;

  // Verify all-in actions occurred
  const allInActions = actions.filter(
    (action) => action.action === Action.ALL_IN,
  );
  expect(allInActions.length).toBeGreaterThanOrEqual(
    expectedOutcome.minAllIns || 1,
  );

  if (expectedOutcome.maxAllIns) {
    expect(allInActions.length).toBeLessThanOrEqual(expectedOutcome.maxAllIns);
  }

  // Verify pot distribution
  if (expectedOutcome.totalPot) {
    assertPotSplit(winners, expectedOutcome.totalPot, options);
  }

  // Verify side pots if specified
  if (expectedOutcome.sidePots) {
    assertSidePots(winners, expectedOutcome.sidePots, options);
  }
}

/**
 * Assert tournament-specific scenarios
 * @param {Object} gameState - Final game state
 * @param {Object} expectedState - Expected tournament state
 * @param {Object} options - Assertion options
 */
export function assertTournamentState(gameState, expectedState, options = {}) {
  const {
    _description = 'tournament state', // API consistency - not yet implemented
  } = options;

  if (expectedState.playersRemaining) {
    const activePlayers = Object.values(gameState.players).filter(
      (p) => p.chips > 0,
    );
    expect(activePlayers.length).toBe(expectedState.playersRemaining);
  }

  if (expectedState.chipLeader) {
    const chipCounts = Object.values(gameState.players).map((p) => p.chips);
    const maxChips = Math.max(...chipCounts);
    const chipLeader = Object.values(gameState.players).find(
      (p) => p.chips === maxChips,
    );
    expect(chipLeader.id).toBe(expectedState.chipLeader);
  }

  if (expectedState.totalChips) {
    const totalChips = Object.values(gameState.players).reduce(
      (sum, p) => sum + p.chips,
      0,
    );
    expect(totalChips).toBe(expectedState.totalChips);
  }
}

/**
 * Comprehensive assertion for common poker scenarios
 * @param {Object} testResult - Complete test result object
 * @param {Object} expected - Expected outcomes
 * @param {Object} options - Assertion options
 */
export function assertPokerScenario(testResult, expected, options = {}) {
  const {
    winners,
    actions,
    gameState,
    _showdownOccurred, // API consistency - not yet implemented
  } = testResult;

  // Pot assertions
  if (expected.totalPot) {
    assertPotSplit(winners, expected.totalPot, options);
  }

  // Hand strength assertions
  if (expected.handRanks) {
    assertHandStrengths(winners, expected.handRanks, options);
  }

  // Action sequence assertions
  if (expected.actionSequence) {
    assertActionSequence(actions, expected.actionSequence, options);
  }

  // Showdown assertions
  if (expected.showdown !== undefined) {
    assertShowdown(winners, expected.showdown, options);
  }

  // Side pot assertions
  if (expected.sidePots) {
    assertSidePots(winners, expected.sidePots, options);
  }

  // All-in assertions
  if (expected.allIn) {
    assertAllInScenario(actions, winners, expected.allIn, options);
  }

  // Tournament assertions
  if (expected.tournament && gameState) {
    assertTournamentState(gameState, expected.tournament, options);
  }
}
