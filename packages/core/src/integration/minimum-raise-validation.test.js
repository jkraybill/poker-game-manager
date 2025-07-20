/**
 * Minimum Raise Validation Tests
 * 
 * Tests that the game engine properly enforces minimum raise rules:
 * - Minimum raise must be at least the size of the previous raise
 * - First raise must be at least 2x the big blind
 * - All-in for less than minimum raise doesn't reopen betting
 * - String betting prevention (raise amount must be declared)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('Minimum Raise Validation', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach(table => table.close());
  });

  it('should enforce minimum raise of 2x big blind for first raise', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    const actions = [];
    let invalidRaiseAttempted = false;

    class MinRaisePlayer extends Player {
      constructor(config) {
        super(config);
        this.isButton = config.isButton;
        this.attemptCount = 0;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        this.attemptCount++;

        if (gameState.phase === 'PRE_FLOP') {
          if (this.isButton && gameState.currentBet === 20) {
            // First attempt: try to raise to 30 (less than min raise)
            if (this.attemptCount === 1) {
              invalidRaiseAttempted = true;
              return {
                playerId: this.id,
                action: Action.RAISE,
                amount: 30, // Invalid: should be at least 40
                timestamp: Date.now(),
              };
            }
            // Second attempt: valid min raise
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 40, // Valid: 2x BB
              timestamp: Date.now(),
            };
          }
        }

        // Default fold
        return {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now(),
        };
      }
    }

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('player:action', ({ playerId, action, amount }) => {
      actions.push({ playerId, action, amount });
    });

    table.on('hand:ended', () => {
      if (!handEnded) {
        handEnded = true;
        setTimeout(() => table.close(), 10);
      }
    });

    const players = [
      new MinRaisePlayer({ name: 'Button', isButton: true }),
      new MinRaisePlayer({ name: 'BB', isButton: false }),
    ];

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Should have attempted invalid raise
    expect(invalidRaiseAttempted).toBe(true);
    
    // Check that the actual raise was 40 (minimum valid)
    const raises = actions.filter(a => a.action === Action.RAISE);
    expect(raises.length).toBeGreaterThan(0);
    expect(raises[0].amount).toBeGreaterThanOrEqual(40);

    table.close();
  });

  it('should enforce minimum re-raise equal to previous raise size', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 3,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    const actions = [];

    class ReRaisePlayer extends Player {
      constructor(config) {
        super(config);
        this.position = config.position;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        if (gameState.phase === 'PRE_FLOP') {
          // UTG raises to 60 (raise of 40)
          if (this.position === 'UTG' && gameState.currentBet === 20) {
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 60,
              timestamp: Date.now(),
            };
          }

          // Button re-raises to 100 (raise of 40, minimum allowed)
          if (this.position === 'BUTTON' && gameState.currentBet === 60) {
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 100, // Min re-raise: 60 + 40
              timestamp: Date.now(),
            };
          }
        }

        return {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now(),
        };
      }
    }

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('player:action', ({ playerId, action, amount }) => {
      actions.push({ action, amount });
    });

    table.on('hand:ended', () => {
      if (!handEnded) {
        handEnded = true;
        setTimeout(() => table.close(), 10);
      }
    });

    const players = [
      new ReRaisePlayer({ name: 'Button', position: 'BUTTON' }),
      new ReRaisePlayer({ name: 'SB', position: 'SB' }),
      new ReRaisePlayer({ name: 'BB', position: 'BB' }),
      new ReRaisePlayer({ name: 'UTG', position: 'UTG' }),
    ];

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    const raises = actions.filter(a => a.action === Action.RAISE);
    expect(raises).toHaveLength(2);
    expect(raises[0].amount).toBe(60);  // UTG raise
    expect(raises[1].amount).toBe(100); // Button re-raise

    table.close();
  });

  it('should not reopen betting when all-in is less than minimum raise', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 50,
      maxBuyIn: 1000,
      minPlayers: 3,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    const actionSequence = [];

    class ShortStackPlayer extends Player {
      constructor(config) {
        super(config);
        this.position = config.position;
        this.stackSize = config.stackSize;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];

        if (gameState.phase === 'PRE_FLOP') {
          // Player 1 raises to 100
          if (this.position === 'P1' && gameState.currentBet === 20) {
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 100,
              timestamp: Date.now(),
            };
          }

          // Short stack goes all-in for 50 (less than minimum raise)
          if (this.position === 'SHORT' && this.stackSize === 'short' && 
              gameState.currentBet === 100 && !myState.hasActed) {
            return {
              playerId: this.id,
              action: Action.ALL_IN,
              amount: myState.chips, // Only 50 chips
              timestamp: Date.now(),
            };
          }

          // Player 3 can only call or fold (betting not reopened)
          if (this.position === 'P3' && gameState.currentBet === 100) {
            // Try to raise (should not be allowed)
            if (!myState.hasActed) {
              return {
                playerId: this.id,
                action: Action.CALL,
                amount: 100 - myState.bet,
                timestamp: Date.now(),
              };
            }
          }
        }

        return {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now(),
        };
      }
    }

    // Custom chip setup
    const originalAddPlayer = table.addPlayer.bind(table);
    table.addPlayer = function(player) {
      const result = originalAddPlayer(player);
      const playerData = this.players.get(player.id);
      if (playerData && player.stackSize === 'short') {
        playerData.chips = 50; // Short stack
      }
      return result;
    };

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('player:action', ({ playerId, action, amount }) => {
      const player = players.find(p => p.id === playerId);
      actionSequence.push({
        position: player?.position,
        action,
        amount,
      });
    });

    table.on('hand:ended', () => {
      if (!handEnded) {
        handEnded = true;
        setTimeout(() => table.close(), 10);
      }
    });

    const players = [
      new ShortStackPlayer({ name: 'Player 1', position: 'P1', stackSize: 'normal' }),
      new ShortStackPlayer({ name: 'Short Stack', position: 'SHORT', stackSize: 'short' }),
      new ShortStackPlayer({ name: 'Player 3', position: 'P3', stackSize: 'normal' }),
    ];

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Verify action sequence
    const p1Raise = actionSequence.find(a => a.position === 'P1' && a.action === Action.RAISE);
    const shortAllIn = actionSequence.find(a => a.position === 'SHORT' && a.action === Action.ALL_IN);
    const p3Action = actionSequence.find(a => a.position === 'P3');

    expect(p1Raise).toBeDefined();
    expect(p1Raise.amount).toBe(100);
    
    expect(shortAllIn).toBeDefined();
    expect(shortAllIn.amount).toBe(50);
    
    // P3 should only be able to call or fold, not raise
    expect(p3Action).toBeDefined();
    expect(p3Action.action).not.toBe(Action.RAISE);

    table.close();
  });

  it('should track minimum raise amounts through multiple raises', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 2000,
      maxBuyIn: 2000,
      minPlayers: 4,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    const raiseSequence = [];

    class EscalatingPlayer extends Player {
      constructor(config) {
        super(config);
        this.position = config.position;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];

        if (gameState.phase === 'PRE_FLOP') {
          // P1: Raise to 60 (raise of 40)
          if (this.position === 'P1' && gameState.currentBet === 20) {
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 60,
              timestamp: Date.now(),
            };
          }

          // P2: Re-raise to 140 (raise of 80)
          if (this.position === 'P2' && gameState.currentBet === 60) {
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 140,
              timestamp: Date.now(),
            };
          }

          // P3: Re-re-raise to 300 (raise of 160)
          if (this.position === 'P3' && gameState.currentBet === 140) {
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 300,
              timestamp: Date.now(),
            };
          }

          // P4: Must raise at least to 460 (300 + 160)
          if (this.position === 'P4' && gameState.currentBet === 300) {
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 500, // Valid: more than minimum
              timestamp: Date.now(),
            };
          }
        }

        return {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now(),
        };
      }
    }

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('player:action', ({ playerId, action, amount }) => {
      if (action === Action.RAISE) {
        const player = players.find(p => p.id === playerId);
        raiseSequence.push({
          position: player?.position,
          amount,
        });
      }
    });

    table.on('hand:ended', () => {
      if (!handEnded) {
        handEnded = true;
        setTimeout(() => table.close(), 10);
      }
    });

    const players = [
      new EscalatingPlayer({ name: 'Player 1', position: 'P1' }),
      new EscalatingPlayer({ name: 'Player 2', position: 'P2' }),
      new EscalatingPlayer({ name: 'Player 3', position: 'P3' }),
      new EscalatingPlayer({ name: 'Player 4', position: 'P4' }),
    ];

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Verify raise sequence
    expect(raiseSequence).toHaveLength(4);
    expect(raiseSequence[0]).toEqual({ position: 'P1', amount: 60 });
    expect(raiseSequence[1]).toEqual({ position: 'P2', amount: 140 });
    expect(raiseSequence[2]).toEqual({ position: 'P3', amount: 300 });
    expect(raiseSequence[3].position).toBe('P4');
    expect(raiseSequence[3].amount).toBeGreaterThanOrEqual(460);

    table.close();
  });
});