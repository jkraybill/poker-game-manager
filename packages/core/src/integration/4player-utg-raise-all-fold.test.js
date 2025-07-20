/**
 * 4-Player UTG Raise All Fold Scenario
 * 
 * Tests the specific case where UTG (Under The Gun) raises and all other players fold.
 * This tests early position aggression and fold equity in 4-player games.
 * 
 * Expected flow:
 * 1. UTG raises to 60 (3x BB)
 * 2. Button folds to raise  
 * 3. SB folds to raise
 * 4. BB folds to raise
 * 5. UTG wins pot (60 + 10 + 20 = 90)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('4-Player UTG Raise All Fold', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    // Clean up any open tables
    manager.tables.forEach(table => table.close());
  });

  it('should handle UTG raising and everyone folding', async () => {
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

    // Create position-aware players for 4-player game
    class FourPlayerPositionAware extends Player {
      constructor(config) {
        super(config);
        this.position = null;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // UTG raises to 60 (3x BB)
        if (this.position === 'utg' && gameState.currentBet === 20) {
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: 60,
            timestamp: Date.now(),
          };
        }

        // Everyone else folds to raises
        if (toCall > 0 && gameState.currentBet > 20) {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }

        // Call blinds if needed
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
      new FourPlayerPositionAware({ name: 'Player 1' }),
      new FourPlayerPositionAware({ name: 'Player 2' }),
      new FourPlayerPositionAware({ name: 'Player 3' }),
      new FourPlayerPositionAware({ name: 'Player 4' }),
    ];

    // Set up remaining event listeners
    table.on('hand:started', ({ dealerButton: db }) => {
      dealerButton = db;
      
      // In 4-player game with dealerButton = 0:
      // Position 0 = Button
      // Position 1 = SB  
      // Position 2 = BB
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
    players.forEach(p => table.addPlayer(p));
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
    
    // Wait for hand to complete
    await vi.waitFor(() => handEnded, { timeout: 5000 });
    
    // Wait a bit for all actions to be captured
    await new Promise(resolve => setTimeout(resolve, 200));

    // Find UTG player
    const utgPos = (dealerButton + 3) % 4;
    const utgPlayer = players[utgPos];

    // Verify results: UTG should win the pot
    expect(winnerId).toBe(utgPlayer.id);
    expect(winnerAmount).toBe(90); // UTG's $60 + SB $10 + BB $20

    // Verify action sequence
    const raiseAction = actions.find(a => a.action === Action.RAISE);
    expect(raiseAction).toBeDefined();
    expect(raiseAction.amount).toBe(60);
    expect(raiseAction.playerId).toBe(utgPlayer.id);

    // Should have exactly 3 folds (Button, SB, BB)
    const foldActions = actions.filter(a => a.action === Action.FOLD);
    expect(foldActions).toHaveLength(3);

    table.close();
  });
});