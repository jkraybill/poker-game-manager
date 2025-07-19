import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

// Test player implementations
class AlwaysFoldPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

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

class RaiseToAmountPlayer extends Player {
  constructor(config) {
    super(config);
    this.targetAmount = config.targetAmount || 100;
    this.hasRaised = false;
  }

  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    // Raise once to target amount
    if (!this.hasRaised && gameState.currentBet <= 20) {
      this.hasRaised = true;
      
      if (this.targetAmount > myState.chips) {
        return {
          playerId: this.id,
          action: Action.ALL_IN,
          amount: myState.chips,
          timestamp: Date.now(),
        };
      }
      
      return {
        playerId: this.id,
        action: Action.RAISE,
        amount: this.targetAmount,
        timestamp: Date.now(),
      };
    }

    // Otherwise call/check
    if (toCall > 0) {
      const callAmount = Math.min(toCall, myState.chips);
      return {
        playerId: this.id,
        action: callAmount === myState.chips ? Action.ALL_IN : Action.CALL,
        amount: callAmount,
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

class FoldToRaisePlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    // Fold to any raise above big blind
    if (gameState.currentBet > 20 && toCall > 0) {
      return {
        playerId: this.id,
        action: Action.FOLD,
        timestamp: Date.now(),
      };
    }

    // Otherwise call/check
    if (toCall > 0) {
      const callAmount = Math.min(toCall, myState.chips);
      return {
        playerId: this.id,
        action: callAmount === myState.chips ? Action.ALL_IN : Action.CALL,
        amount: callAmount,
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

class CallThenFoldPlayer extends Player {
  constructor(config) {
    super(config);
    this.hasCalled = false;
  }

  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    // First time: call any reasonable bet
    if (!this.hasCalled && toCall > 0 && toCall <= 100) {
      this.hasCalled = true;
      const callAmount = Math.min(toCall, myState.chips);
      return {
        playerId: this.id,
        action: callAmount === myState.chips ? Action.ALL_IN : Action.CALL,
        amount: callAmount,
        timestamp: Date.now(),
      };
    }

    // After calling once, fold to any bet
    if (this.hasCalled && toCall > 0) {
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

describe('Betting Scenarios', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    // Clean up any open tables
    manager.tables.forEach(table => table.close());
  });

  describe('2-player (heads-up)', () => {
    it('should handle SB/Button folding to BB', async () => {
      const table = manager.createTable({
        blinds: { small: 10, big: 20 },
        minBuyIn: 1000,
        maxBuyIn: 1000,
        minPlayers: 2,
      });

      const sbPlayer = new AlwaysFoldPlayer({ name: 'SB/Button' });
      const bbPlayer = new AlwaysFoldPlayer({ name: 'Big Blind' });

      // Track dealer button position
      let dealerButtonPos = -1;
      table.on('hand:started', ({ dealerButton }) => {
        dealerButtonPos = dealerButton;
      });

      // Create a promise that resolves when hand ends
      const handEndPromise = new Promise((resolve) => {
        table.on('hand:ended', ({ winners }) => {
          resolve({
            winnerId: winners[0]?.playerId,
            winnerAmount: winners[0]?.amount,
            dealerButton: dealerButtonPos,
          });
        });
      });

      // Track actions
      const actions = [];
      table.on('player:action', ({ playerId, action, amount }) => {
        actions.push({ playerId, action, amount });
      });

      // Add players
      table.addPlayer(sbPlayer);
      table.addPlayer(bbPlayer);

      // Wait for hand to complete
      const { winnerId, winnerAmount, dealerButton } = await handEndPromise;

      // In heads-up, if dealerButton is 0, then player at position 0 is SB/Button
      // and player at position 1 is BB
      const players = [sbPlayer, bbPlayer];
      const expectedWinner = dealerButton === 0 ? bbPlayer : sbPlayer;

      // Verify results
      expect(winnerId).toBe(expectedWinner.id);
      expect(winnerAmount).toBe(30); // SB $10 + BB $20
      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe(Action.FOLD);
      
      // In heads-up, the SB/Button should fold
      const actualSbPlayer = dealerButton === 0 ? sbPlayer : bbPlayer;
      expect(actions[0].playerId).toBe(actualSbPlayer.id);

      table.close();
    });
  });

  describe('3-player', () => {
    it('should handle Button raising and blinds folding', async () => {
      const table = manager.createTable({
        blinds: { small: 10, big: 20 },
        minBuyIn: 1000,
        maxBuyIn: 1000,
      });

      // Track results
      let gameStarted = false;
      let handEnded = false;
      let winnerId = null;
      let winnerAmount = 0;
      let dealerButton = -1;
      const actions = [];
      let captureActions = true;

      // Set up event listeners BEFORE adding players
      table.on('game:started', () => {
        gameStarted = true;
      });

      table.on('player:action', ({ playerId, action, amount }) => {
        if (captureActions) {
          actions.push({ playerId, action, amount });
        }
      });

      // Create players that will adapt based on position
      const players = [];
      
      class PositionAwarePlayer extends Player {
        constructor(config) {
          super(config);
          this.targetAmount = 100;
          this.hasRaised = false;
          this.position = null;  // Will be set when hand starts
        }

        async getAction(gameState) {
          const myState = gameState.players[this.id];
          const toCall = gameState.currentBet - myState.bet;

          // Only raise if we're the button/UTG and haven't raised yet
          if (this.position === 'button' && !this.hasRaised && gameState.currentBet <= 20) {
            this.hasRaised = true;
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: this.targetAmount,
              timestamp: Date.now(),
            };
          }

          // If we're not button and face a raise, fold
          if (this.position !== 'button' && toCall > 0 && gameState.currentBet > 20) {
            return {
              playerId: this.id,
              action: Action.FOLD,
              timestamp: Date.now(),
            };
          }

          // Otherwise call/check
          if (toCall > 0) {
            const callAmount = Math.min(toCall, myState.chips);
            return {
              playerId: this.id,
              action: callAmount === myState.chips ? Action.ALL_IN : Action.CALL,
              amount: callAmount,
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

      // Create 3 position-aware players
      const player1 = new PositionAwarePlayer({ name: 'Player 1' });
      const player2 = new PositionAwarePlayer({ name: 'Player 2' });
      const player3 = new PositionAwarePlayer({ name: 'Player 3' });
      
      players.push(player1, player2, player3);

      // Set up remaining event listeners
      table.on('hand:started', ({ dealerButton: db }) => {
        dealerButton = db;
        // In 3-player, button is also UTG
        players[db].position = 'button';
        players[(db + 1) % 3].position = 'sb';
        players[(db + 2) % 3].position = 'bb';
      });
      
      table.on('hand:ended', ({ winners }) => {
        if (!handEnded) {  // Only capture first hand
          handEnded = true;
          captureActions = false;  // Stop capturing actions
          if (winners && winners.length > 0) {
            winnerId = winners[0].playerId;
            winnerAmount = winners[0].amount;
          }
          // Close table to prevent auto-restart
          setTimeout(() => table.close(), 10);
        }
      });

      // Add players
      table.addPlayer(player1);
      table.addPlayer(player2);
      table.addPlayer(player3);

      // Wait a bit for auto-start
      await new Promise(resolve => setTimeout(resolve, 200));

      // Wait for game to start
      await vi.waitFor(() => gameStarted, { 
        timeout: 1000,
        interval: 50
      });

      // Wait for dealer button to be set
      await vi.waitFor(() => dealerButton >= 0, {
        timeout: 2000,
        interval: 50
      });

      // Wait for hand to complete
      await vi.waitFor(() => handEnded, { timeout: 5000 });
      
      // Ensure dealerButton was set
      expect(dealerButton).toBeGreaterThanOrEqual(0);
      expect(dealerButton).toBeLessThan(3);
      
      const buttonPlayer = players[dealerButton];

      // Check that we had exactly one raise and two folds
      const raiseAction = actions.find(a => a.action === Action.RAISE);
      expect(raiseAction).toBeDefined();
      expect(raiseAction.amount).toBe(100);

      const foldActions = actions.filter(a => a.action === Action.FOLD);
      expect(foldActions).toHaveLength(2);
      
      // The winner should be whoever raised (since others folded)
      expect(winnerId).toBe(raiseAction.playerId);
      expect(winnerAmount).toBe(130); // Raiser's $100 + SB $10 + BB $20

      table.close();
    });

    it.skip('should handle Button raising, SB folding, BB calling then folding to flop bet', async () => {
      const table = manager.createTable({
        blinds: { small: 10, big: 20 },
        minBuyIn: 1000,
        maxBuyIn: 1000,
      });

      // Track game state
      let currentPhase = null;
      let dealerButton = -1;

      table.on('round:started', ({ phase }) => {
        currentPhase = phase;
      });

      table.on('hand:started', ({ dealerButton: db }) => {
        dealerButton = db;
      });

      // Create players with phase-aware betting
      class PhaseAwareRaiser extends Player {
        constructor(config) {
          super(config);
          this.hasRaisedPreflop = false;
          this.hasBetFlop = false;
        }

        async getAction(gameState) {
          const myState = gameState.players[this.id];
          const toCall = gameState.currentBet - myState.bet;

          // Pre-flop: raise to 100
          if (!this.hasRaisedPreflop && gameState.phase === 'PRE_FLOP') {
            this.hasRaisedPreflop = true;
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 100,
              timestamp: Date.now(),
            };
          }

          // Flop: bet 200
          if (!this.hasBetFlop && gameState.phase === 'FLOP' && gameState.currentBet === 0) {
            this.hasBetFlop = true;
            return {
              playerId: this.id,
              action: Action.BET,
              amount: 200,
              timestamp: Date.now(),
            };
          }

          // Otherwise call/check
          if (toCall > 0) {
            const callAmount = Math.min(toCall, myState.chips);
            return {
              playerId: this.id,
              action: callAmount === myState.chips ? Action.ALL_IN : Action.CALL,
              amount: callAmount,
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

      // Create players based on position
      const players = [];
      for (let i = 0; i < 3; i++) {
        players.push(new Player({ name: `Player ${i + 1}` }));
      }

      // Track results
      let handEnded = false;
      let winnerId = null;
      let winnerAmount = 0;
      const actions = [];

      // Set up position-based strategies after we know dealer button
      table.on('game:started', () => {
        // Wait a bit to ensure dealer button is set
        setTimeout(() => {
          if (dealerButton >= 0) {
            const buttonPos = dealerButton;
            const sbPos = (dealerButton + 1) % 3;
            const bbPos = (dealerButton + 2) % 3;

            // Replace players with appropriate strategies
            players[buttonPos] = new PhaseAwareRaiser({ name: `Player ${buttonPos + 1} (Button)` });
            players[sbPos] = new FoldToRaisePlayer({ name: `Player ${sbPos + 1} (SB)` });
            players[bbPos] = new CallThenFoldPlayer({ name: `Player ${bbPos + 1} (BB)` });

            // Clear table and re-add with correct strategies
            table.players.clear();
            players.forEach(p => table.addPlayer(p));
          }
        }, 50);
      });

      table.on('player:action', ({ playerId, action, amount }) => {
        actions.push({ playerId, action, amount, phase: currentPhase });
      });

      table.on('hand:ended', ({ winners }) => {
        handEnded = true;
        if (winners && winners.length > 0) {
          winnerId = winners[0].playerId;
          winnerAmount = winners[0].amount;
        }
      });

      // Add initial players to trigger game start
      players.forEach(p => table.addPlayer(p));

      // Wait for hand to complete
      await vi.waitFor(() => handEnded, { timeout: 5000 });

      // Verify the button player won
      const buttonPlayer = players[dealerButton];
      expect(winnerId).toBe(buttonPlayer.id);

      // Verify action sequence
      const preflopActions = actions.filter(a => a.phase === 'PRE_FLOP');
      const flopActions = actions.filter(a => a.phase === 'FLOP');

      // Pre-flop: Button raises, SB folds, BB calls
      expect(preflopActions.find(a => a.action === Action.RAISE && a.amount === 100)).toBeDefined();
      expect(preflopActions.find(a => a.action === Action.FOLD)).toBeDefined();
      expect(preflopActions.find(a => a.action === Action.CALL)).toBeDefined();

      // Flop: BB checks, Button bets, BB folds
      expect(flopActions.find(a => a.action === Action.CHECK)).toBeDefined();
      expect(flopActions.find(a => a.action === Action.BET && a.amount === 200)).toBeDefined();
      expect(flopActions.find(a => a.action === Action.FOLD)).toBeDefined();

      // Pot should be Button's 100 + SB's 10 + BB's 100 = 210
      expect(winnerAmount).toBe(210);

      table.close();
    });
  });

  describe('All players fold scenarios', () => {
    it('should handle all 3 players folding to big blind', async () => {
      const table = manager.createTable({
        blinds: { small: 10, big: 20 },
        minBuyIn: 1000,
        maxBuyIn: 1000,
      });

      // Track results
      let gameStarted = false;
      let handEnded = false;
      let winnerId = null;
      let winnerAmount = 0;
      let dealerButton = -1;

      // Set up event listeners BEFORE adding players
      table.on('game:started', () => {
        gameStarted = true;
      });

      table.on('hand:started', ({ dealerButton: db }) => {
        dealerButton = db;
      });

      table.on('hand:ended', ({ winners }) => {
        handEnded = true;
        if (winners && winners.length > 0) {
          winnerId = winners[0].playerId;
          winnerAmount = winners[0].amount;
        }
      });

      const player1 = new AlwaysFoldPlayer({ name: 'Player 1' });
      const player2 = new AlwaysFoldPlayer({ name: 'Player 2' });
      const player3 = new AlwaysFoldPlayer({ name: 'Player 3' });

      // Add players
      table.addPlayer(player1);
      table.addPlayer(player2);
      table.addPlayer(player3);

      // Wait a bit for auto-start
      await new Promise(resolve => setTimeout(resolve, 200));

      // Wait for game to start
      await vi.waitFor(() => gameStarted, { 
        timeout: 1000,
        interval: 50
      });

      // Wait for dealer button to be set
      await vi.waitFor(() => dealerButton >= 0, {
        timeout: 2000,
        interval: 50
      });

      // Wait for hand to complete
      await vi.waitFor(() => handEnded, { timeout: 5000 });

      // Big blind should win
      const players = [player1, player2, player3];
      const bbPos = (dealerButton + 2) % 3;
      const bbPlayer = players[bbPos];

      expect(winnerId).toBe(bbPlayer.id);
      expect(winnerAmount).toBe(30); // SB $10 + BB $20

      table.close();
    });
  });
});