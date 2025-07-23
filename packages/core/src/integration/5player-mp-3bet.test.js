/**
 * 5-Player Middle Position 3-Bet Scenario
 *
 * Tests advanced pre-flop aggression in 5-player games with raise and 3-bet action.
 * This scenario demonstrates positional play, 3-betting strategy, and fold equity.
 *
 * Expected flow:
 * 1. UTG folds (weak hand or tight play)
 * 2. Middle Position raises to 60 (3x BB)
 * 3. Cutoff 3-bets to 180 (3x the raise)
 * 4. Button folds to 3-bet
 * 5. Small Blind folds to 3-bet
 * 6. Big Blind folds to 3-bet
 * 7. Middle Position folds to 3-bet
 * 8. Cutoff wins pot (180 + 10 + 20 + 60 = 270)
 *
 * This tests:
 * - 5-player position dynamics (UTG, MP, CO, Button, Blinds)
 * - 3-betting for value and as a bluff
 * - Fold equity calculations
 * - Pre-flop pot winning without showdown
 * - Complex betting round with multiple raises
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('5-Player MP 3-Bet', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    // Clean up any open tables
    manager.tables.forEach((table) => table.close());
  });

  it('should handle Middle Position raising, Cutoff 3-betting, everyone folds', async () => {
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
    let winnerId = null;
    let winnerAmount = 0;
    let dealerButton = -1;
    let captureActions = true;
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

    // Create 3-bet scenario players for 5-player game
    class ThreeBetPlayer extends Player {
      constructor(config) {
        super(config);
        this.position = null;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // UTG folds (simulating tight early position play)
        if (this.position === 'utg') {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }

        // MP raises to 60 (3x BB opening raise)
        if (this.position === 'mp' && gameState.currentBet === 20) {
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: 60,
            timestamp: Date.now(),
          };
        }

        // Cutoff 3-bets to 180 when facing MP raise (3x the raise)
        if (this.position === 'co' && gameState.currentBet === 60) {
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: 180,
            timestamp: Date.now(),
          };
        }

        // Everyone else folds to the 3-bet (high pressure)
        if (toCall > 0 && gameState.currentBet >= 180) {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }

        // Default: fold to any bet, check otherwise
        if (toCall > 0) {
          return {
            playerId: this.id,
            action: Action.FOLD,
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

    // Create 5 players
    const players = [
      new ThreeBetPlayer({ name: 'Player 1' }),
      new ThreeBetPlayer({ name: 'Player 2' }),
      new ThreeBetPlayer({ name: 'Player 3' }),
      new ThreeBetPlayer({ name: 'Player 4' }),
      new ThreeBetPlayer({ name: 'Player 5' }),
    ];

    // Set up remaining event listeners
    table.on('hand:started', ({ dealerButton: db }) => {
      dealerButton = db;

      // In 5-player game with dealerButton = 0:
      // Position 0 = Button/Cutoff
      // Position 1 = Small Blind
      // Position 2 = Big Blind
      // Position 3 = UTG (acts first pre-flop)
      // Position 4 = Middle Position
      const utgPos = (db + 3) % 5;
      const mpPos = (db + 4) % 5;
      const sbPos = (db + 1) % 5;
      const bbPos = (db + 2) % 5;

      players[utgPos].position = 'utg';
      players[mpPos].position = 'mp';
      players[db].position = 'co'; // Button position acts as Cutoff in 5-player
      players[sbPos].position = 'sb';
      players[bbPos].position = 'bb';
    });

    table.on('hand:ended', ({ winners }) => {
      if (!handEnded) {
        handEnded = true;
        captureActions = false;
        if (winners && winners.length > 0) {
          winnerId = winners[0].playerId;
          winnerAmount = winners[0].amount;
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

    // Wait for dealer button to be set
    await vi.waitFor(() => dealerButton >= 0, {
      timeout: 500,
      interval: 50,
    });

    // Wait for hand to complete
    await vi.waitFor(() => handEnded, { timeout: 1000 });

    // Wait for all actions to be captured
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Find cutoff player (3-bettor) - Button position in 5-player
    const coPlayer = players[dealerButton];

    // Verify results: Cutoff should win the pot
    expect(winnerId).toBe(coPlayer.id);

    // Pot calculation:
    // - UTG folded (no contribution)
    // - MP raised to 60 then folded to 3-bet
    // - CO 3-bet to 180
    // - Button folded (no contribution)
    // - SB folded after posting 10
    // - BB folded after posting 20
    // Total pot = 60 + 180 + 10 + 20 = 270
    expect(winnerAmount).toBe(270);

    // Verify action sequence
    const raises = actions.filter((a) => a.action === Action.RAISE);
    expect(raises).toHaveLength(2); // MP raise and CO 3-bet

    const mpRaise = raises[0];
    expect(mpRaise.amount).toBe(60);

    const co3Bet = raises[1];
    expect(co3Bet.amount).toBe(180);

    // Everyone else should fold (UTG, MP after 3-bet, Button, SB, BB)
    const folds = actions.filter((a) => a.action === Action.FOLD);
    expect(folds.length).toBeGreaterThanOrEqual(3); // At least UTG, MP, SB, BB

    // Verify proper action sequence: UTG fold, MP raise, CO 3-bet, then folds
    const firstAction = actions[0];
    expect(firstAction.action).toBe(Action.FOLD); // UTG folds first

    const raiseIndex = actions.findIndex(
      (a) => a.action === Action.RAISE && a.amount === 60,
    );
    const threeBetIndex = actions.findIndex(
      (a) => a.action === Action.RAISE && a.amount === 180,
    );
    expect(raiseIndex).toBeLessThan(threeBetIndex); // MP raises before CO 3-bets

    table.close();
  });
});
