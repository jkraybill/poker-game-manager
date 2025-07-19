/**
 * 4-Player Big Blind Defense Scenario
 * 
 * Tests the Big Blind defending against a Button steal attempt by calling the raise
 * and playing post-flop. This demonstrates blind defense strategy and multi-street play.
 * 
 * Expected flow:
 * Pre-flop:
 * 1. UTG folds (weak hand)
 * 2. Button raises to 60 (3x BB) attempting to steal
 * 3. Small Blind folds to the raise
 * 4. Big Blind calls (defends with pot odds)
 * 
 * Flop:
 * 5. Big Blind checks
 * 6. Button continuation bets 80
 * 7. Big Blind calls the c-bet
 * 
 * Turn & River:
 * 8. Both players check to showdown
 * 9. Best hand wins at showdown
 * 
 * This tests:
 * - Blind defense decision making
 * - Multi-street post-flop play
 * - Continuation betting patterns
 * - Showdown mechanics with multiple betting rounds
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('4-Player Big Blind Defense', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    // Clean up any open tables
    manager.tables.forEach(table => table.close());
  });

  it('should handle Big Blind defending against Button raise and playing to showdown', async () => {
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
    let winnerAmount = 0;
    let dealerButton = -1;
    let captureActions = true;
    let showdownOccurred = false;
    const actions = [];
    const phaseActions = {
      PRE_FLOP: [],
      FLOP: [],
      TURN: [],
      RIVER: [],
    };

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

    // Create Big Blind defense scenario players
    class BBDefensePlayer extends Player {
      constructor(config) {
        super(config);
        this.position = null;
        this.hasRaisedPreflop = false;
        this.hasBetFlop = false;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // Pre-flop behavior
        if (gameState.phase === 'PRE_FLOP') {
          // UTG folds immediately (simulating weak hand)
          if (this.position === 'utg') {
            return {
              playerId: this.id,
              action: Action.FOLD,
              timestamp: Date.now(),
            };
          }

          // Button raises after UTG folds (steal attempt)
          if (this.position === 'button' && !this.hasRaisedPreflop && gameState.currentBet === 20) {
            this.hasRaisedPreflop = true;
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 60, // 3x BB steal sizing
              timestamp: Date.now(),
            };
          }

          // SB folds to button raise (common vs steal)
          if (this.position === 'sb' && toCall > 0 && gameState.currentBet > 20) {
            return {
              playerId: this.id,
              action: Action.FOLD,
              timestamp: Date.now(),
            };
          }

          // BB calls button raise (defends with pot odds)
          if (this.position === 'bb' && toCall > 0 && gameState.currentBet > 20) {
            return {
              playerId: this.id,
              action: Action.CALL,
              amount: toCall,
              timestamp: Date.now(),
            };
          }
        }

        // Flop: BB checks, Button c-bets, BB calls
        if (gameState.phase === 'FLOP') {
          // Button continuation bets when checked to
          if (this.position === 'button' && !this.hasBetFlop && gameState.currentBet === 0) {
            this.hasBetFlop = true;
            return {
              playerId: this.id,
              action: Action.BET,
              amount: 80, // ~2/3 pot c-bet
              timestamp: Date.now(),
            };
          }

          // BB calls the continuation bet
          if (this.position === 'bb' && toCall > 0) {
            return {
              playerId: this.id,
              action: Action.CALL,
              amount: toCall,
              timestamp: Date.now(),
            };
          }
        }

        // Turn and River: both players check to showdown
        if (['TURN', 'RIVER'].includes(gameState.phase)) {
          return {
            playerId: this.id,
            action: Action.CHECK,
            timestamp: Date.now(),
          };
        }

        // Default: check
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    // Create 4 players
    const players = [
      new BBDefensePlayer({ name: 'Player 1' }),
      new BBDefensePlayer({ name: 'Player 2' }),
      new BBDefensePlayer({ name: 'Player 3' }),
      new BBDefensePlayer({ name: 'Player 4' }),
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

    // Add players
    players.forEach(p => table.addPlayer(p));

    // Wait for game to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { 
      timeout: 2000,
      interval: 50, 
    });
    await vi.waitFor(() => dealerButton >= 0, { 
      timeout: 3000,
      interval: 50, 
    });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Verify a showdown occurred (hand went to river)
    expect(showdownOccurred).toBe(true);

    // Verify action sequence
    // Should have: UTG fold, Button raise, SB fold, BB call
    const folds = actions.filter(a => a.action === Action.FOLD);
    expect(folds).toHaveLength(2); // UTG and SB fold

    const raiseAction = actions.find(a => a.action === Action.RAISE);
    expect(raiseAction).toBeDefined();
    expect(raiseAction.amount).toBe(60);

    const calls = actions.filter(a => a.action === Action.CALL);
    expect(calls.length).toBeGreaterThanOrEqual(2); // BB calls pre-flop and flop

    // Verify we had a continuation bet on flop
    const betAction = actions.find(a => a.action === Action.BET);
    expect(betAction).toBeDefined();
    expect(betAction.amount).toBe(80);

    // Verify we had multiple checks (turn and river)
    const checks = actions.filter(a => a.action === Action.CHECK);
    expect(checks.length).toBeGreaterThanOrEqual(4); // At least 2 on turn and 2 on river

    // Verify reasonable pot size
    // Pre-flop: Button 60 + BB 60 (40 + 20 blind) = 120 (SB folds after posting 10)
    // Actually: Button 60 + BB call 40 + SB fold 10 + BB blind 20 = 130
    // Flop: 80 * 2 = 160
    // Total pot should be around 290, winner gets it all
    expect(winnerAmount).toBeGreaterThan(200);
    expect(winnerAmount).toBeLessThan(400); // Sanity check

    table.close();
  });
});