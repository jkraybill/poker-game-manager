/**
 * 5-Player Family Pot Scenario (Using Test Utilities)
 *
 * Tests a "family pot" situation where all players limp in pre-flop (call the big blind)
 * and then check down all streets to showdown. This creates a multi-way pot with
 * minimal betting action, testing showdown mechanics with many players.
 *
 * Expected flow:
 * Pre-flop:
 * 1. UTG calls big blind (20)
 * 2. MP calls big blind (20)
 * 3. CO calls big blind (20)
 * 4. Button calls big blind (20)
 * 5. SB calls (10 more to complete)
 * 6. BB checks (already posted 20)
 *
 * Flop, Turn, River:
 * 7. All 5 players check each street
 * 8. Hand goes to showdown
 * 9. Best hand wins the pot (5 × 20 = 100 chips)
 *
 * This tests:
 * - Multi-way limped pots
 * - Check-down scenarios
 * - 5-player showdown mechanics
 * - Pot calculation with multiple callers
 * - Phase tracking across all betting rounds
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  Action,
  cleanupTables,
  createRiggedDeckFromArray,
} from '../test-utils/index.js';

describe('5-Player Family Pot (v2)', () => {
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

  it('should handle family pot where everyone calls to see flop and checks to showdown', async () => {
    // Create 5-player table
    const result = createTestTable('standard', {
      minPlayers: 5,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Create family pot strategy - everyone limps and checks down
    const familyPotStrategy = ({ gameState, toCall }) => {
      // Pre-flop: everyone limps (calls the big blind)
      if (gameState.phase === 'PRE_FLOP') {
        if (toCall > 0 && toCall <= 20) {
          return { action: Action.CALL, amount: toCall };
        }
      }

      // Post-flop: everyone checks every street
      if (['FLOP', 'TURN', 'RIVER'].includes(gameState.phase)) {
        return { action: Action.CHECK };
      }

      // Default check
      return { action: Action.CHECK };
    };

    // Create 5 players for family pot
    const players = Array.from(
      { length: 5 },
      (_, i) =>
        new StrategicPlayer({
          name: `Player ${i + 1}`,
          strategy: familyPotStrategy,
        }),
    );

    // Track showdown
    let showdownOccurred = false;
    table.on('hand:ended', ({ winners }) => {
      if (winners && winners.length > 0 && winners[0].hand) {
        showdownOccurred = true;
      }
    });

    // Add players
    players.forEach((p) => table.addPlayer(p));

    // Set up custom deck to ensure exactly one winner (Player 1 gets the nuts)
    // Player 1 will have AA, others will have weaker hands
    const customDeckArray = [
      // First card to each player (starting from dealer+1)
      {
        rank: 'A',
        suit: 's',
        toString() {
          return 'As';
        },
      }, // P1 first card
      {
        rank: 'K',
        suit: 'h',
        toString() {
          return 'Kh';
        },
      }, // P2 first card
      {
        rank: 'Q',
        suit: 'd',
        toString() {
          return 'Qd';
        },
      }, // P3 first card
      {
        rank: 'J',
        suit: 'c',
        toString() {
          return 'Jc';
        },
      }, // P4 first card
      {
        rank: 'T',
        suit: 's',
        toString() {
          return 'Ts';
        },
      }, // P5 first card
      // Second card to each player
      {
        rank: 'A',
        suit: 'h',
        toString() {
          return 'Ah';
        },
      }, // P1 second card (pocket aces)
      {
        rank: 'K',
        suit: 'd',
        toString() {
          return 'Kd';
        },
      }, // P2 second card
      {
        rank: 'Q',
        suit: 'c',
        toString() {
          return 'Qc';
        },
      }, // P3 second card
      {
        rank: 'J',
        suit: 's',
        toString() {
          return 'Js';
        },
      }, // P4 second card
      {
        rank: 'T',
        suit: 'h',
        toString() {
          return 'Th';
        },
      }, // P5 second card
      // Burn card
      {
        rank: '2',
        suit: 'c',
        toString() {
          return '2c';
        },
      },
      // Flop (3 cards) - low cards that don't help anyone
      {
        rank: '2',
        suit: 's',
        toString() {
          return '2s';
        },
      },
      {
        rank: '3',
        suit: 'd',
        toString() {
          return '3d';
        },
      },
      {
        rank: '4',
        suit: 'h',
        toString() {
          return '4h';
        },
      },
      // Burn card
      {
        rank: '5',
        suit: 'c',
        toString() {
          return '5c';
        },
      },
      // Turn - another low card
      {
        rank: '6',
        suit: 's',
        toString() {
          return '6s';
        },
      },
      // Burn card
      {
        rank: '7',
        suit: 'd',
        toString() {
          return '7d';
        },
      },
      // River - another low card
      {
        rank: '8',
        suit: 'h',
        toString() {
          return '8h';
        },
      },
    ];
    const customDeck = createRiggedDeckFromArray(customDeckArray);

    table.setDeck(customDeck);

    // Start game
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { winners, actions } = events;

    // Verify a showdown occurred (hand went to river)
    expect(showdownOccurred).toBe(true);

    // Verify action breakdown
    const calls = actions.filter((a) => a.action === Action.CALL);
    const checks = actions.filter((a) => a.action === Action.CHECK);

    // Should have 4 calls (UTG, MP, CO, Button) + SB completing
    // BB already posted and just checks
    expect(calls.length).toBeGreaterThanOrEqual(4);

    // Should have many checks (all post-flop action)
    // 5 players × 3 streets = 15 checks minimum
    expect(checks.length).toBeGreaterThanOrEqual(15);

    // Verify phase-specific actions
    const preflopActions = events.getActionsByPhase('PRE_FLOP');
    const flopActions = events.getActionsByPhase('FLOP');
    const turnActions = events.getActionsByPhase('TURN');
    const riverActions = events.getActionsByPhase('RIVER');

    // Pre-flop should have calls and maybe one check (BB)
    expect(
      preflopActions.filter((a) => a.action === Action.CALL).length,
    ).toBeGreaterThanOrEqual(4);

    // Post-flop streets should have only checks
    expect(flopActions.every((a) => a.action === Action.CHECK)).toBe(true);
    expect(turnActions.every((a) => a.action === Action.CHECK)).toBe(true);
    expect(riverActions.every((a) => a.action === Action.CHECK)).toBe(true);

    // Verify we had a true 5-way pot
    // Each player puts in 20 chips (BB), so total pot = 5 × 20 = 100
    expect(winners).toHaveLength(1);
    expect(winners[0].amount).toBe(100);

    // Verify no raises or folds occurred (pure family pot)
    const raises = actions.filter((a) => a.action === Action.RAISE);
    const folds = actions.filter((a) => a.action === Action.FOLD);
    expect(raises).toHaveLength(0);
    expect(folds).toHaveLength(0);
  });
});
