/**
 * 3-Player Poker Scenarios
 * 
 * Tests for 3-player games covering position dynamics, button raises, and blind defense.
 * In 3-player, the button is also UTG (under the gun).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('3-Player Scenarios', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    // Clean up any open tables
    manager.tables.forEach(table => table.close());
  });

  describe('Button raise dynamics', () => {
    it('should handle Button raising and blinds folding', async () => {
      const table = manager.createTable({
        blinds: { small: 10, big: 20 },
        minBuyIn: 1000,
        maxBuyIn: 1000,
        minPlayers: 3, // Require 3 players for this test
        dealerButton: 0, // Deterministic for testing
      });

      // Track results
      let gameStarted = false;
      let handEnded = false;
      let winnerId = null;
      let winnerAmount = 0;
      let dealerButton = -1;
      const actions = [];
      let captureActions = true;

      // Create players array early so we can reference it in event handlers
      const players = [];

      // Set up event listeners BEFORE creating players
      table.on('game:started', () => {
        gameStarted = true;
      });

      table.on('player:action', ({ playerId, action, amount }) => {
        if (captureActions) {
          actions.push({ playerId, action, amount });
        }
      });
      
      class PositionAwarePlayer extends Player {
        constructor(config) {
          super(config);
          this.targetAmount = 100;
          this.hasRaised = false;
          this.position = null;  // Will be set when hand starts
        }

        getAction(gameState) {
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

      // Set up hand:started listener
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
          if (winners && winners.length > 0) {
            winnerId = winners[0].playerId;
            winnerAmount = winners[0].amount;
          }
          // Close table to prevent auto-restart after a delay
          setTimeout(() => {
            table.close();
          }, 500);
        }
      });

      // Add all players and start game
      table.addPlayer(player1);
      table.addPlayer(player2);
      table.addPlayer(player3);
      table.tryStartGame();

      // Wait for game to start
      await vi.waitFor(() => gameStarted, { 
        timeout: 1000,
        interval: 50,
      });

      // Wait for dealer button to be set
      await vi.waitFor(() => dealerButton >= 0, {
        timeout: 2000,
        interval: 50,
      });

      // Wait for hand to complete first
      await vi.waitFor(() => handEnded, { 
        timeout: 5000,
        interval: 50,
      });
      
      // Then wait a bit for any remaining actions to be processed
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Ensure dealerButton was set
      expect(dealerButton).toBeGreaterThanOrEqual(0);
      expect(dealerButton).toBeLessThan(3);

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

    // Test removed - dynamically replacing players mid-hand is not supported
  });
});