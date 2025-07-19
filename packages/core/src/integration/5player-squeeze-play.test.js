/**
 * 5-Player Squeeze Play Scenario
 * 
 * Tests an advanced poker concept called "squeeze play" where a player in the blinds
 * re-raises (squeezes) after there has been a raise and a call, exploiting the fact
 * that both opponents are likely to have weaker holdings and will fold to pressure.
 * 
 * Expected flow:
 * 1. UTG (1000 chips) raises to 60
 * 2. MP (900 chips) folds to the raise
 * 3. Button (800 chips) calls the raise 
 * 4. SB (600 chips) squeezes to 180 (seeing raise + call weakness)
 * 5. BB (700 chips) folds to the squeeze
 * 6. UTG folds to the squeeze
 * 7. Button folds to the squeeze
 * 8. SB wins pot (180 + 20 + 60 + 60 + 10 = 330)
 * 
 * This tests:
 * - Advanced pre-flop strategy (squeeze play)
 * - lastAction tracking functionality
 * - Complex decision making based on action history
 * - Multi-way pot dynamics
 * - Fold equity exploitation
 * 
 * Technical note: This test uses lastAction data to detect when there has been
 * both a raise and a call, which is the key condition for a squeeze play.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('5-Player Squeeze Play', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    // Clean up any open tables
    manager.tables.forEach(table => table.close());
  });

  it('should handle SB squeeze play after raise and call', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 500,
      maxBuyIn: 1000,
      minPlayers: 5,
      dealerButton: 0, // Deterministic for testing
    });

    // Track results
    let gameStarted = false;
    let handEnded = false;
    let winnerId = null;
    let winnerAmount = 0;
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

    // Create squeeze play scenario players
    class SqueezePlayPlayer extends Player {
      constructor(config) {
        super(config);
        this.chipAmount = config.chips;
        this.stackSize = config.stackSize;
        this.hasActed = false;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // UTG (1000 chips) raises to 60
        if (this.stackSize === 'utg' && gameState.currentBet === 20 && !this.hasActed) {
          this.hasActed = true;
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: 60,
            timestamp: Date.now(),
          };
        }

        // MP (900 chips) folds to UTG raise
        if (this.stackSize === 'mp' && toCall > 0 && gameState.currentBet > 20) {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }

        // Button (800 chips) calls the raise
        if (this.stackSize === 'button' && toCall > 0 && toCall <= 60 && gameState.currentBet === 60 && !this.hasActed) {
          this.hasActed = true;
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          };
        }

        // SB (600 chips) squeezes after detecting raise and call
        if (this.stackSize === 'sb' && gameState.currentBet === 60 && !this.hasActed) {
          // Use lastAction tracking to detect squeeze opportunity
          const playerStates = Object.values(gameState.players);
          const hasRaiser = playerStates.some(p => p.lastAction === Action.RAISE && p.bet === 60);
          const hasCaller = playerStates.some(p => p.lastAction === Action.CALL && p.bet === 60);
          
          if (hasRaiser && hasCaller) {
            this.hasActed = true;
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 180, // Squeeze size: 3x the original raise
              timestamp: Date.now(),
            };
          }
        }

        // Everyone folds to the squeeze
        if (toCall > 0 && gameState.currentBet >= 180) {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }

        // BB (700 chips) folds to any raise
        if (this.stackSize === 'bb' && toCall > 0 && gameState.currentBet > 20) {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }

        // Default: check if no bet to call
        if (toCall === 0) {
          return {
            playerId: this.id,
            action: Action.CHECK,
            timestamp: Date.now(),
          };
        }

        // Otherwise fold
        return {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now(),
        };
      }
    }

    // Create 5 players with specific stack sizes
    // With dealerButton=0, positions will be:
    // Player 0: Button (800 chips)
    // Player 1: SB (600 chips)  
    // Player 2: BB (700 chips)
    // Player 3: UTG (1000 chips)
    // Player 4: MP (900 chips)
    const playerConfigs = [
      { name: 'Button Player', chips: 800, stackSize: 'button' },
      { name: 'SB Player', chips: 600, stackSize: 'sb' },
      { name: 'BB Player', chips: 700, stackSize: 'bb' },
      { name: 'UTG Player', chips: 1000, stackSize: 'utg' },
      { name: 'MP Player', chips: 900, stackSize: 'mp' },
    ];

    const players = playerConfigs.map(config => 
      new SqueezePlayPlayer(config),
    );

    // Override addPlayer to set specific chip amounts
    const originalAddPlayer = table.addPlayer.bind(table);
    table.addPlayer = function(player) {
      const result = originalAddPlayer(player);
      const playerData = this.players.get(player.id);
      if (playerData && player.chipAmount) {
        playerData.chips = player.chipAmount;
      }
      return result;
    };

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

    // Add players
    players.forEach(p => table.addPlayer(p));

    // Wait for game to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { 
      timeout: 2000,
      interval: 50, 
    });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Verify the squeeze play sequence occurred
    const raiseAction = actions.find(a => a.action === Action.RAISE && a.amount === 60);
    const callAction = actions.find(a => a.action === Action.CALL);
    const squeezeAction = actions.find(a => a.action === Action.RAISE && a.amount === 180);
    
    expect(raiseAction).toBeDefined();
    expect(callAction).toBeDefined();
    expect(squeezeAction).toBeDefined();

    // Verify proper sequence: raise, then call, then squeeze
    const raiseIndex = actions.indexOf(raiseAction);
    const callIndex = actions.indexOf(callAction);
    const squeezeIndex = actions.indexOf(squeezeAction);
    
    expect(raiseIndex).toBeLessThan(callIndex);
    expect(callIndex).toBeLessThan(squeezeIndex);

    // After the squeeze, everyone should fold
    const actionsAfterSqueeze = actions.slice(squeezeIndex + 1);
    const foldsAfterSqueeze = actionsAfterSqueeze.filter(a => a.action === Action.FOLD);
    expect(foldsAfterSqueeze.length).toBeGreaterThanOrEqual(2); // At least BB and UTG fold

    // SB (600 chip player) should win the pot
    const sbPlayer = players.find(p => p.chipAmount === 600);
    expect(winnerId).toBe(sbPlayer.id);

    // Verify pot calculation:
    // SB squeeze 180 + BB blind 20 + UTG raise 60 + Button call 60 + SB blind 10 = 330
    expect(winnerAmount).toBe(330);

    // Verify we had the expected number of folds (MP, BB, UTG, Button all fold)
    const totalFolds = actions.filter(a => a.action === Action.FOLD);
    expect(totalFolds.length).toBeGreaterThanOrEqual(4);

    table.close();
  });
});