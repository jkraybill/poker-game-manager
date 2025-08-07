import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from './GameEngine.js';
import { Action, PlayerState } from '../types/index.js';
import { Player } from '../Player.js';

describe('GameEngine - Unhandled Promise Rejection Bug', () => {
  let gameEngine;
  let mockPlayers;
  let actionCallCount;
  let rejectionOccurred;

  beforeEach(() => {
    actionCallCount = 0;
    rejectionOccurred = false;
    
    // Track unhandled rejections
    const originalHandler = process.listeners('unhandledRejection')[0];
    process.removeAllListeners('unhandledRejection');
    process.on('unhandledRejection', (reason) => {
      console.log('Unhandled rejection detected:', reason.message);
      rejectionOccurred = true;
      // Re-emit for test framework
      if (originalHandler) {
        originalHandler(reason);
      }
    });

    // Create a player that tries to fold when they can check
    // This player will be the BB and try to fold when toCall = 0
    class BadFoldPlayer extends Player {
      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = Math.max(0, gameState.currentBet - myState.bet);
        
        console.log(`BadFoldPlayer ${this.id}: phase=${gameState.phase}, toCall=${toCall}, validActions=${gameState.validActions}`);
        
        // In pre-flop, after SB calls, BB has option to check (toCall = 0)
        // Try to fold when check is available - this should crash
        if (gameState.phase === 'PRE_FLOP' && toCall === 0) {
          actionCallCount++;
          console.log('BB attempting invalid FOLD when can check for free!');
          return {
            action: Action.FOLD,
            playerId: this.id,
            timestamp: Date.now(),
          };
        }
        
        // Otherwise play normally
        if (toCall > 0) {
          return {
            action: Action.CALL,
            playerId: this.id,
            timestamp: Date.now(),
          };
        } else {
          return {
            action: Action.CHECK,
            playerId: this.id,
            timestamp: Date.now(),
          };
        }
      }
    }
    
    // Create a normal player for SB position
    class NormalPlayer extends Player {
      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = Math.max(0, gameState.currentBet - myState.bet);
        
        console.log(`NormalPlayer ${this.id}: phase=${gameState.phase}, toCall=${toCall}`);
        
        // Just call/check as appropriate
        if (toCall > 0) {
          return {
            action: Action.CALL,
            playerId: this.id,
            timestamp: Date.now(),
          };
        } else {
          return {
            action: Action.CHECK,
            playerId: this.id,
            timestamp: Date.now(),
          };
        }
      }
    }

    // Set up players - we'll make player2 the BB who tries to fold
    const player1 = new NormalPlayer({ id: 'player1', name: 'Alice' });
    player1.buyIn(1000);

    const player2 = new BadFoldPlayer({ id: 'player2', name: 'Bob' });
    player2.buyIn(1000);

    mockPlayers = [
      {
        player: player1,
        chips: player1.chips,
        state: PlayerState.ACTIVE,
      },
      {
        player: player2,
        chips: player2.chips,
        state: PlayerState.ACTIVE,
      },
    ];

    gameEngine = new GameEngine({
      players: mockPlayers,
      blinds: { small: 10, big: 20 },
      dealerButton: 0, // Deterministic: player1 is SB, player2 is BB
      timeout: 500, // Short timeout to make test fail faster
    });
  });

  it('should crash immediately when player tries to fold with toCall = 0', async () => {
    // Start the game - this should now properly throw
    try {
      await gameEngine.start();
      // If we get here, the validation didn't work
      console.log('ERROR: start() completed without throwing');
    } catch (error) {
      console.log('Good! Error was properly thrown:', error.message);
      // This is expected - validation should crash immediately
      expect(error.message).toContain('Cannot fold when you can check');
      return; // Test passes
    }
    
    // EXPECTED: The game should have crashed with "Cannot fold when you can check for free"
    // ACTUAL BUG: The validation error becomes an unhandled rejection
    //             and getAction is called multiple times
    
    // This test demonstrates the bug:
    // 1. If actionCallCount > 1, the validation error was swallowed
    // 2. If rejectionOccurred is true, we had an unhandled rejection
    
    console.log('\n=== Test Results ===');
    console.log(`getAction was called ${actionCallCount} times`);
    console.log(`Unhandled rejection occurred: ${rejectionOccurred}`);
    
    // If we get here, the bug is present - the game continued despite invalid action
    // These assertions will FAIL with the current bug
    // and PASS when the bug is fixed
    expect(actionCallCount).toBe(1); // Should only try fold once before crashing
    expect(rejectionOccurred).toBe(false); // Should not have unhandled rejections
  });

  it('should properly await async validation errors in betting rounds', async () => {
    let errorThrown = false;
    let errorMessage = '';
    
    // Override the game start to catch errors properly
    try {
      // This should throw because startBettingRound is now async and awaited
      await gameEngine.start();
      
      // If we reach here without error, the validation didn't work
      console.log('WARNING: No error was thrown despite invalid action');
    } catch (error) {
      errorThrown = true;
      errorMessage = error.message;
      console.log('Caught error properly:', errorMessage);
    }
    
    // With the bug: errorThrown will be false because error is swallowed
    // After fix: errorThrown should be true with proper error message
    expect(errorThrown).toBe(true);
    expect(errorMessage).toContain('Cannot fold when you can check');
  });
});