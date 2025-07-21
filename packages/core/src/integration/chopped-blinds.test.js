/**
 * Chopped Blinds Test
 * 
 * Tests the scenario where all players fold to the big blind,
 * resulting in the BB winning the pot without showing cards.
 * This is one of the most common scenarios in poker.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('Chopped Blinds Scenarios', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach(table => table.close());
  });

  it('should handle everyone folding to BB in 6-handed game', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 6,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    let winner = null;
    let winnerShowedCards = false;
    const actions = [];

    class TightPlayer extends Player {
      constructor(config) {
        super(config);
        this.position = config.position;
      }

      getAction(gameState) {
        // Everyone folds to BB
        if (gameState.phase === 'PRE_FLOP' && this.position !== 'BB') {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }

        // BB should win without acting
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('player:action', ({ playerId, action }) => {
      const player = players.find(p => p.id === playerId);
      actions.push({
        position: player?.position,
        action,
      });
    });

    table.on('hand:ended', ({ winners }) => {
      if (!handEnded) {
        handEnded = true;
        winner = winners[0];
        // If hand is "Won by fold", cards weren't shown
        winnerShowedCards = winner?.hand !== 'Won by fold';
        setTimeout(() => table.close(), 10);
      }
    });

    // Create 6 players
    const positions = ['BUTTON', 'SB', 'BB', 'UTG', 'MP', 'CO'];
    const players = positions.map(pos => 
      new TightPlayer({ 
        name: `Player (${pos})`,
        position: pos,
      }),
    );

    players.forEach(p => table.addPlayer(p));
    table.tryStartGame();

    await vi.waitFor(() => gameStarted, { timeout: 500 });
    await vi.waitFor(() => handEnded, { timeout: 1000 });
    
    // Wait for actions to be captured
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify BB won
    expect(winner).toBeDefined();
    const bbPlayer = players.find(p => p.position === 'BB');
    expect(winner.playerId).toBe(bbPlayer.id);
    
    // BB should win SB + BB = 30 chips
    expect(winner.amount).toBe(30);
    
    // Cards should not be shown
    expect(winnerShowedCards).toBe(false);
    
    // Count folds - should be 5 (everyone except BB)
    const folds = actions.filter(a => a.action === Action.FOLD);
    expect(folds).toHaveLength(5);

    table.close();
  });

  it('should handle heads-up where SB/Button folds to BB', async () => {
    const table = manager.createTable({
      blinds: { small: 25, big: 50 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    let winner = null;
    const actions = [];

    class HeadsUpPlayer extends Player {
      constructor(config) {
        super(config);
        this.isButton = config.isButton;
      }

      getAction(gameState) {
        // In heads-up, button is SB and acts first
        if (this.isButton) {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }

        // BB shouldn't need to act
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('player:action', ({ playerId, action }) => {
      actions.push({ playerId, action });
    });

    table.on('hand:ended', ({ winners }) => {
      if (!handEnded) {
        handEnded = true;
        winner = winners[0];
        setTimeout(() => table.close(), 10);
      }
    });

    const players = [
      new HeadsUpPlayer({ name: 'Button/SB', isButton: true }),
      new HeadsUpPlayer({ name: 'BB', isButton: false }),
    ];

    players.forEach(p => table.addPlayer(p));
    table.tryStartGame();

    await vi.waitFor(() => gameStarted, { timeout: 500 });
    await vi.waitFor(() => handEnded, { timeout: 1000 });
    
    // Wait for actions to be captured
    await new Promise(resolve => setTimeout(resolve, 200));

    // BB should win
    expect(winner).toBeDefined();
    expect(winner.amount).toBe(75); // SB (25) + BB (50)
    
    // Only one action - SB folding
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe(Action.FOLD);

    table.close();
  });

  it('should handle walk scenario where SB completes and BB checks', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    let showdownOccurred = false;
    const actions = [];

    class WalkPlayer extends Player {
      constructor(config) {
        super(config);
        this.isButton = config.isButton;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        if (gameState.phase === 'PRE_FLOP') {
          // SB completes (calls the BB)
          if (this.isButton && toCall > 0) {
            return {
              playerId: this.id,
              action: Action.CALL,
              amount: toCall,
              timestamp: Date.now(),
            };
          }
        }

        // Both check all streets
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('player:action', ({ action }) => {
      actions.push(action);
    });

    table.on('hand:ended', ({ winners }) => {
      if (!handEnded) {
        handEnded = true;
        // Check if hand went to showdown
        showdownOccurred = winners[0]?.hand && winners[0].hand !== 'Won by fold';
        setTimeout(() => table.close(), 10);
      }
    });

    const players = [
      new WalkPlayer({ name: 'Button/SB', isButton: true }),
      new WalkPlayer({ name: 'BB', isButton: false }),
    ];

    players.forEach(p => table.addPlayer(p));
    table.tryStartGame();

    await vi.waitFor(() => gameStarted, { timeout: 500 });
    await vi.waitFor(() => handEnded, { timeout: 1000 });
    
    // Wait for actions to be captured
    await new Promise(resolve => setTimeout(resolve, 200));

    // Should go to showdown
    expect(showdownOccurred).toBe(true);
    
    // Should have 1 call and many checks
    const calls = actions.filter(a => a === Action.CALL);
    const checks = actions.filter(a => a === Action.CHECK);
    
    expect(calls).toHaveLength(1); // SB completes
    expect(checks.length).toBeGreaterThan(6); // Both check pre-flop, flop, turn, river

    table.close();
  });

  it('should properly return blinds when everyone folds pre-flop', async () => {
    const table = manager.createTable({
      blinds: { small: 100, big: 200 },
      minBuyIn: 5000,
      maxBuyIn: 5000,
      minPlayers: 4,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    let winner = null;

    class SimpleFoldPlayer extends Player {
      getAction(gameState) {
        const myState = gameState.players[this.id];
        
        // If I'm not BB and haven't acted, fold
        if (gameState.phase === 'PRE_FLOP' && !myState.hasActed && gameState.currentBet > myState.bet) {
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

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('hand:ended', ({ winners }) => {
      if (!handEnded) {
        handEnded = true;
        winner = winners[0];
        setTimeout(() => table.close(), 10);
      }
    });

    // Create 4 players
    const players = Array.from({ length: 4 }, (_, i) => 
      new SimpleFoldPlayer({ name: `Player ${i + 1}` }),
    );

    players.forEach(p => table.addPlayer(p));
    table.tryStartGame();

    await vi.waitFor(() => gameStarted, { timeout: 500 });
    await vi.waitFor(() => handEnded, { timeout: 1000 });
    
    // Wait for actions to be captured
    await new Promise(resolve => setTimeout(resolve, 200));

    // Winner should get SB + BB = 300
    expect(winner).toBeDefined();
    expect(winner.amount).toBe(300);
    
    // Should be won by fold
    expect(winner.hand).toBe('Won by fold');

    table.close();
  });
});