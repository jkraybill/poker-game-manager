/**
 * 5-Player Family Pot Scenario
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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('5-Player Family Pot', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    // Clean up any open tables
    manager.tables.forEach((table) => table.close());
  });

  it('should handle family pot where everyone calls to see flop and checks to showdown', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 5,
      dealerButton: 0, // Deterministic for testing
    });

    // Track results
    let gameStarted = false;
    let handEnded = false;
    let winnerAmount = 0;
    let captureActions = true;
    let showdownOccurred = false;
    const actions = [];
    const phaseActions = {
      PRE_FLOP: [],
      FLOP: [],
      TURN: [],
      RIVER: [],
    };
    const potUpdates = [];

    // Set up event listeners
    table.on('game:started', () => {
      gameStarted = true;
    });

    let currentPhase = 'PRE_FLOP';

    table.on('round:started', ({ phase }) => {
      currentPhase = phase;
    });

    table.on('player:action', ({ playerId, action, amount }) => {
      if (captureActions) {
        const actionData = { playerId, action, amount };
        actions.push(actionData);
        if (phaseActions[currentPhase]) {
          phaseActions[currentPhase].push(actionData);
        }
      }
    });

    table.on('pot:updated', ({ total }) => {
      potUpdates.push(total);
    });

    // Create family pot players who limp and check down
    class FamilyPotPlayer extends Player {
      constructor(config) {
        super(config);
        this.position = null;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // Pre-flop: everyone limps (calls the big blind)
        if (gameState.phase === 'PRE_FLOP') {
          if (toCall > 0 && toCall <= 20) {
            return {
              playerId: this.id,
              action: Action.CALL,
              amount: toCall,
              timestamp: Date.now(),
            };
          }
        }

        // Post-flop: everyone checks every street
        if (['FLOP', 'TURN', 'RIVER'].includes(gameState.phase)) {
          return {
            playerId: this.id,
            action: Action.CHECK,
            timestamp: Date.now(),
          };
        }

        // Default check
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    // Create 5 players for family pot
    const players = [
      new FamilyPotPlayer({ name: 'Player 1' }),
      new FamilyPotPlayer({ name: 'Player 2' }),
      new FamilyPotPlayer({ name: 'Player 3' }),
      new FamilyPotPlayer({ name: 'Player 4' }),
      new FamilyPotPlayer({ name: 'Player 5' }),
    ];

    table.on('hand:ended', ({ winners }) => {
      if (!handEnded) {
        handEnded = true;
        captureActions = false;
        if (winners && winners.length > 0) {
          winnerAmount = winners[0].amount;
          // Check if we have hand information (indicates showdown)
          if (winners[0].hand) {
            showdownOccurred = true;
          }
        }
        setTimeout(() => table.close(), 10);
      }
    });

    // Add players and start game
    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for game to start
    await vi.waitFor(() => gameStarted, {
      timeout: 500,
      interval: 50,
    });

    // Wait for hand to complete
    await vi.waitFor(() => handEnded, { timeout: 1000 });

    // Wait for all actions to be captured and async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Verify a showdown occurred (hand went to river)
    expect(showdownOccurred).toBe(true);

    // Verify we had the right mix of calls and checks
    const calls = actions.filter((a) => a.action === Action.CALL);
    const checks = actions.filter((a) => a.action === Action.CHECK);

    // Should have 4 calls (UTG, MP, CO, SB) - BB already posted blind
    expect(calls.length).toBeGreaterThanOrEqual(4);

    // Should have many checks (all post-flop action)
    expect(checks.length).toBeGreaterThanOrEqual(15); // 5 players × 3 streets minimum

    // Verify we had a true 5-way pot
    // Each player puts in 20 chips (BB), so total pot = 5 × 20 = 100
    expect(winnerAmount).toBe(100);

    // Verify no raises or folds occurred (pure family pot)
    const raises = actions.filter((a) => a.action === Action.RAISE);
    const folds = actions.filter((a) => a.action === Action.FOLD);
    expect(raises).toHaveLength(0); // No raises in a family pot
    expect(folds).toHaveLength(0); // No folds in a family pot

    // The calls variable is already defined above, so we can use it
    expect(calls.length).toBeGreaterThanOrEqual(4); // At least 4 calls to complete the family pot

    table.close();
  });
});
