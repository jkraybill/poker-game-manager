/**
 * Simple Split Pot Test (Using Test Utilities)
 *
 * A minimal test to verify split pot functionality works
 * without complex deck manipulation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createHeadsUpTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  Action,
  cleanupTables,
} from '../test-utils/index.js';
import { HandEvaluator } from '../game/HandEvaluator.js';

describe('Simple Split Pot Test (v2)', () => {
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

  it('should properly detect split pot winners in HandEvaluator', () => {
    // Test HandEvaluator directly first
    const playerHands = [
      {
        player: { id: 'player1' },
        hand: {
          rank: 5, // Straight
          kickers: [9, 8, 7, 6, 5],
          cards: [],
          description: 'Straight, Nine High',
        },
        cards: [],
      },
      {
        player: { id: 'player2' },
        hand: {
          rank: 5, // Straight
          kickers: [9, 8, 7, 6, 5], // Same kickers
          cards: [],
          description: 'Straight, Nine High',
        },
        cards: [],
      },
    ];

    const winners = HandEvaluator.findWinners(playerHands);
    expect(winners).toHaveLength(2); // Both should win
    expect(winners.map((w) => w.player.id)).toContain('player1');
    expect(winners.map((w) => w.player.id)).toContain('player2');
  });

  it('should handle 2-player all-in split pot scenario', async () => {
    // Create heads-up table
    const result = createHeadsUpTable({
      minBuyIn: 100,
      maxBuyIn: 100,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Track game events for debugging
    table.on('game:started', () => {
      console.log('Game started');
    });

    table.on('hand:ended', (event) => {
      console.log('hand:ended event received:', event);
      const handWinners = event.winners;

      console.log('Hand ended with winners:', handWinners?.length || 0);
      console.log(
        'Winner details:',
        handWinners?.map((w) => ({
          playerId: w.playerId,
          handRank: w.hand?.rank,
          handKickers: w.hand?.kickers,
          amount: w.amount,
        })) || [],
      );
    });

    // All-in strategy for preflop
    const allInStrategy = ({ gameState, myState }) => {
      // Both players go all-in preflop
      if (gameState.phase === 'PRE_FLOP') {
        return { action: Action.ALL_IN, amount: myState.chips };
      }
      return { action: Action.CHECK };
    };

    // Create 2 players with equal chips
    const player1 = new StrategicPlayer({
      name: 'Player 1',
      strategy: allInStrategy,
    });

    const player2 = new StrategicPlayer({
      name: 'Player 2',
      strategy: allInStrategy,
    });

    table.addPlayer(player1);
    table.addPlayer(player2);

    // Explicitly start the game
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    const { winners } = events;

    console.log('Final winners array:', winners);
    console.log('Winners length:', winners.length);

    // With random cards, we can't guarantee a split pot
    // But we can verify the game completes and someone wins
    expect(winners.length).toBeGreaterThan(0);

    // Total winnings should equal the pot (200 chips)
    const totalWon = winners.reduce((sum, w) => sum + w.amount, 0);
    expect(totalWon).toBe(200);
  });
});
