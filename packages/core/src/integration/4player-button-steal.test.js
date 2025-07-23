/**
 * 4-Player Button Steal Scenario
 *
 * Tests the classic "button steal" move where the Button position attempts to steal
 * the blinds by raising after all players before them have folded. This is a
 * fundamental positional play concept in poker.
 *
 * Expected flow:
 * 1. UTG folds (weak hand)
 * 2. Button raises to 50 (2.5x BB) to steal blinds
 * 3. Small Blind folds to the raise
 * 4. Big Blind folds to the raise
 * 5. Button wins pot (50 + 10 + 20 = 80 chips)
 *
 * This tests:
 * - Position-based decision making
 * - Fold equity in late position
 * - Basic blind stealing mechanics
 * - Pre-flop pot winning without showdown
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('4-Player Button Steal', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    // Clean up any open tables
    manager.tables.forEach((table) => table.close());
  });

  it('should handle Button stealing blinds after UTG folds', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 4,
      dealerButton: 0, // Deterministic for testing
    });

    // Track results
    let gameStarted = false;
    let handEnded = false;
    let winnerId = null;
    let winnerAmount = 0;
    let dealerButton = -1;
    const captureActions = true;
    const actions = [];

    // Set up event listeners
    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('player:action', ({ playerId, action, amount }) => {
      if (captureActions) {
        actions.push({ playerId, action, amount });
      }
    });

    // Create button-steal scenario players
    class ButtonStealPlayer extends Player {
      constructor(config) {
        super(config);
        this.position = null;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // UTG folds immediately (simulating weak hand or tight play)
        if (this.position === 'utg') {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }

        // Button raises to steal blinds after UTG folds
        if (this.position === 'button' && gameState.currentBet === 20) {
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: 50, // 2.5x BB steal sizing
            timestamp: Date.now(),
          };
        }

        // Blinds fold to button steal attempt
        if (
          ['sb', 'bb'].includes(this.position) &&
          toCall > 0 &&
          gameState.currentBet > 20
        ) {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }

        // Call blinds if needed (shouldn't happen in this scenario)
        if (toCall > 0) {
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          };
        }

        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    // Create 4 players
    const players = [
      new ButtonStealPlayer({ name: 'Player 1' }),
      new ButtonStealPlayer({ name: 'Player 2' }),
      new ButtonStealPlayer({ name: 'Player 3' }),
      new ButtonStealPlayer({ name: 'Player 4' }),
    ];

    // Set up remaining event listeners
    table.on('hand:started', ({ dealerButton: db }) => {
      dealerButton = db;

      // In 4-player game with dealerButton = 0:
      // Position 0 = Button
      // Position 1 = Small Blind
      // Position 2 = Big Blind
      // Position 3 = UTG (acts first pre-flop)
      const utgPos = (db + 3) % 4;
      const sbPos = (db + 1) % 4;
      const bbPos = (db + 2) % 4;

      players[utgPos].position = 'utg';
      players[db].position = 'button';
      players[sbPos].position = 'sb';
      players[bbPos].position = 'bb';
    });

    table.on('hand:ended', ({ winners }) => {
      if (!handEnded) {
        handEnded = true;
        if (winners && winners.length > 0) {
          winnerId = winners[0].playerId;
          winnerAmount = winners[0].amount;
        }
        setTimeout(() => table.close(), 10);
      }
    });

    // Add players and start game manually
    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for game to start
    await vi.waitFor(() => gameStarted, {
      timeout: 1000,
      interval: 50,
    });

    // Wait for dealer button to be set
    await vi.waitFor(() => dealerButton >= 0, {
      timeout: 500,
      interval: 50,
    });

    // Wait for hand to complete
    await vi.waitFor(() => handEnded, { timeout: 1000 });

    // Wait a bit for all actions to be captured
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Find button player
    const buttonPlayer = players[dealerButton];

    // Verify results: Button should win the pot
    expect(winnerId).toBe(buttonPlayer.id);

    // Pot calculation for button steal:
    // - UTG folded (no contribution)
    // - Button raised to 50
    // - SB folded after posting 10
    // - BB folded after posting 20
    // Total pot = 50 + 10 + 20 = 80
    expect(winnerAmount).toBe(80);

    // Verify action sequence
    const raiseAction = actions.find((a) => a.action === Action.RAISE);
    expect(raiseAction).toBeDefined();
    expect(raiseAction.amount).toBe(50);
    expect(raiseAction.playerId).toBe(buttonPlayer.id);

    // Should have exactly 3 folds (UTG, SB, BB)
    const foldActions = actions.filter((a) => a.action === Action.FOLD);
    expect(foldActions).toHaveLength(3);

    // Verify proper action sequence: UTG fold, then Button raise, then SB/BB folds
    const firstAction = actions[0];
    expect(firstAction.action).toBe(Action.FOLD); // UTG folds first

    const raiseIndex = actions.findIndex((a) => a.action === Action.RAISE);
    const foldsAfterRaise = actions
      .slice(raiseIndex + 1)
      .filter((a) => a.action === Action.FOLD);
    expect(foldsAfterRaise).toHaveLength(2); // SB and BB fold after Button raise

    table.close();
  });
});
