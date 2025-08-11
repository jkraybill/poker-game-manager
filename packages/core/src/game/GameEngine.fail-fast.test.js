import { describe, it, expect } from 'vitest';
import { GameEngine } from './GameEngine.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

/**
 * Test suite for fail-fast behavior on player contract violations
 * Ensures that any exception thrown by a player immediately crashes the game
 * with no retry attempts
 */
describe('GameEngine - Fail Fast on Contract Violations', () => {
  it('should immediately throw fatal error when player.getAction() throws', async () => {
    // Create a player that violates the contract by throwing an error
    class BrokenPlayer extends Player {
      constructor(config) {
        super(config);
        this.chips = 1000;
      }

      // eslint-disable-next-line require-await
      async getAction(_gameState) {
        throw new Error('Database connection failed');
      }
    }

    const player1 = new BrokenPlayer({ id: 'broken', name: 'Broken' });
    const player2 = new Player({ id: 'normal', name: 'Normal' });
    player2.chips = 1000;
    // eslint-disable-next-line require-await
    player2.getAction = async () => ({ action: Action.FOLD });

    const gameEngine = new GameEngine({
      players: [player1, player2],
      blinds: { small: 10, big: 20 },
      dealerButton: 0,
    });

    // Start the game and expect it to throw asynchronously
    const gamePromise = gameEngine.start();
    
    // The error will be thrown when the player action is requested
    await expect(gamePromise).rejects.toThrow('Fatal: Player broken threw error in getAction()');
  });

  it('should immediately throw fatal error when player.receivePrivateCards() throws', async () => {
    // Create a player that throws when receiving cards
    class CardRejectingPlayer extends Player {
      constructor(config) {
        super(config);
        this.chips = 1000;
      }

      receivePrivateCards(_cards) {
        throw new Error('Cannot process cards right now');
      }

      // eslint-disable-next-line require-await
      async getAction(_gameState) {
        return { action: Action.FOLD };
      }
    }

    const player1 = new CardRejectingPlayer({ id: 'card-rejecter', name: 'Rejecter' });
    const player2 = new Player({ id: 'normal', name: 'Normal' });
    player2.chips = 1000;
    // eslint-disable-next-line require-await
    player2.getAction = async () => ({ action: Action.FOLD });

    const gameEngine = new GameEngine({
      players: [player1, player2],
      blinds: { small: 10, big: 20 },
      dealerButton: 0,
    });

    // The game should crash immediately when dealing cards
    await expect(gameEngine.start()).rejects.toThrow('Fatal: Player card-rejecter threw error in receivePrivateCards()');
  });

  it('should NOT retry when player returns invalid action', async () => {
    // Create a player that returns null (invalid action)
    class NullReturningPlayer extends Player {
      constructor(config) {
        super(config);
        this.chips = 1000;
        this.callCount = 0;
      }

      // eslint-disable-next-line require-await
      async getAction(_gameState) {
        this.callCount++;
        if (this.callCount > 1) {
          throw new Error('Should not be called twice - no retry!');
        }
        return null; // Invalid action
      }
    }

    const player1 = new NullReturningPlayer({ id: 'null-player', name: 'Null' });
    const player2 = new Player({ id: 'normal', name: 'Normal' });
    player2.chips = 1000;
    // eslint-disable-next-line require-await
    player2.getAction = async () => ({ action: Action.FOLD });

    const gameEngine = new GameEngine({
      players: [player1, player2],
      blinds: { small: 10, big: 20 },
      dealerButton: 0,
    });

    // Start the game and expect it to fail
    const gamePromise = gameEngine.start();

    // Wait for the error
    await expect(gamePromise).rejects.toThrow('returned invalid action');

    // Verify it was only called once (no retry)
    expect(player1.callCount).toBe(1);
  });

  it('should provide detailed error context when crashing', async () => {
    // Create a player that throws with context
    class ContextualErrorPlayer extends Player {
      constructor(config) {
        super(config);
        this.chips = 1000;
      }

      // eslint-disable-next-line require-await
      async getAction(_gameState) {
        throw new TypeError('player.strategy is not a function');
      }
    }

    const player1 = new ContextualErrorPlayer({ id: 'context-player', name: 'Context' });
    const player2 = new Player({ id: 'normal', name: 'Normal' });
    player2.chips = 1000;
    // eslint-disable-next-line require-await
    player2.getAction = async () => ({ action: Action.FOLD });

    const gameEngine = new GameEngine({
      players: [player1, player2],
      blinds: { small: 10, big: 20 },
      dealerButton: 0,
    });

    // Start the game and capture the error
    let capturedError;
    try {
      await gameEngine.start();
    } catch (error) {
      capturedError = error;
    }

    // Verify the error message includes context
    expect(capturedError).toBeDefined();
    expect(capturedError.message).toContain('Fatal: Player context-player threw error');
    expect(capturedError.message).toContain('player.strategy is not a function');
    expect(capturedError.message).toContain('contract violation');
  });

  it('should crash on timeout without retry', async () => {
    // Create a player that never returns (times out)
    class HangingPlayer extends Player {
      constructor(config) {
        super(config);
        this.chips = 1000;
      }

      async getAction(_gameState) {
        // Never resolve - simulate hanging
        await new Promise(() => {});
      }
    }

    const player1 = new HangingPlayer({ id: 'hanging', name: 'Hanging' });
    const player2 = new Player({ id: 'normal', name: 'Normal' });
    player2.chips = 1000;
    // eslint-disable-next-line require-await
    player2.getAction = async () => ({ action: Action.FOLD });

    const gameEngine = new GameEngine({
      players: [player1, player2],
      blinds: { small: 10, big: 20 },
      dealerButton: 0,
      timeout: 100, // Short timeout for testing
    });

    // Start the game and expect it to timeout
    await expect(gameEngine.start()).rejects.toThrow('Fatal: Player hanging threw error in getAction(): Player hanging action timeout');
  });
});