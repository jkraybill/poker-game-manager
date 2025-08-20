/**
 * Minimal reproduction of showdown betting round completion bug
 * This test should complete quickly but currently times out
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';
import { setupEventCapture, waitForHandEnd } from '../test-utils/index.js';
import { RiggedDeck } from '../game/RiggedDeck.js';

// Simple player that always calls/checks
class CallPlayer extends Player {
  constructor(id) {
    super({ id, name: id });
  }

  getAction(gameState) {
    if (gameState.toCall > 0) {
      return { action: Action.CALL };
    }
    return { action: Action.CHECK };
  }
}

describe('Showdown Bug Minimal Reproduction', () => {
  let manager;
  let table;
  let eventCapture;

  beforeEach(() => {
    manager = new PokerGameManager();
    table = manager.createTable({
      id: 'showdown-bug-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
      simulationMode: true,
      dealerButton: 0,
    });
    eventCapture = setupEventCapture(table);
  });

  it('should complete a simple 2-player showdown quickly using synchronous API', () => {
    // First test the synchronous API to see if the issue is in event flow
    const riggedDeck = new RiggedDeck({
      cards: [
        'As',
        'Ad', // P1 gets AA (will win)
        'Kh',
        'Qc', // P2 gets KQ (will lose)
        'Jh', // Burn before flop
        '2s',
        '3d',
        '8h', // Flop
        'Jc', // Burn before turn
        '9c', // Turn
        'Jd', // Burn before river
        'Ts', // River
      ],
      dealAlternating: false,
    });
    table.setDeck(riggedDeck);

    const player1 = new CallPlayer('player1');
    const player2 = new CallPlayer('player2');
    player1.chips = 1000;
    player2.chips = 1000;

    table.addPlayer(player1);
    table.addPlayer(player2);

    const startTime = Date.now();
    const result = table.runHandToCompletion();
    const duration = Date.now() - startTime;

    console.log(`Synchronous hand completed in ${duration}ms`);
    console.log('Result:', {
      success: result.success,
      winners: result.winners?.length,
      error: result.error,
    });

    if (result.success) {
      expect(result.success).toBe(true);
      expect(result.winners).toHaveLength(1);
      expect(result.winners[0].playerId).toBe('player1');
      expect(duration).toBeLessThan(1000);
    } else {
      console.log('Synchronous API failed with error:', result.error);
      throw new Error(`Synchronous API failed: ${result.error}`);
    }
  });

  it('should complete a simple 2-player showdown quickly (currently times out)', async () => {
    // Set up a deterministic showdown scenario
    const riggedDeck = new RiggedDeck({
      cards: [
        'As',
        'Ad', // P1 gets AA (will win)
        'Kh',
        'Qc', // P2 gets KQ (will lose)
        'Jh', // Burn before flop
        '2s',
        '3d',
        '8h', // Flop
        'Jc', // Burn before turn
        '9c', // Turn
        'Jd', // Burn before river
        'Ts', // River
      ],
      dealAlternating: false,
    });
    table.setDeck(riggedDeck);

    const player1 = new CallPlayer('player1');
    const player2 = new CallPlayer('player2');
    player1.chips = 1000;
    player2.chips = 1000;

    table.addPlayer(player1);
    table.addPlayer(player2);

    // Add event debugging to understand what's happening
    const events = [];

    // Listen to all relevant events
    table.on('hand:started', () => events.push('hand:started'));
    table.on('hand:complete', (data) =>
      events.push(`hand:complete(${data.winners?.length} winners)`),
    );
    table.on('game:ended', () => events.push('game:ended'));
    table.on('hand:ended', (data) =>
      events.push(`hand:ended(${data.winners?.length} winners)`),
    );

    // Listen to phase changes to understand game progression
    table.on('phase:change', (data) => events.push(`phase:${data.phase}`));

    // This should complete in under 100ms but currently times out after 5 seconds
    const startTime = Date.now();

    table.tryStartGame();

    try {
      await waitForHandEnd(eventCapture);
      const duration = Date.now() - startTime;
      console.log(`Hand completed in ${duration}ms`);
      console.log('Events received:', events);

      // Verify the hand completed successfully
      expect(eventCapture.winners).toHaveLength(1);
      expect(eventCapture.winners[0].playerId).toBe('player1'); // AA should win
      expect(duration).toBeLessThan(1000); // Should complete quickly
    } catch (error) {
      console.log('Test failed. Events received so far:', events);
      console.log('EventCapture state:', {
        handEnded: eventCapture.handEnded,
        winners: eventCapture.winners,
        actions: eventCapture.actions?.length,
      });

      // Check the game engine state to see where we're stuck
      if (table.gameEngine) {
        console.log('GameEngine state:', {
          phase: table.gameEngine.phase,
          currentPlayerIndex: table.gameEngine.currentPlayerIndex,
          currentBet: table.gameEngine.getCurrentBet
            ? table.gameEngine.getCurrentBet()
            : 'unknown',
          endingBettingRound: table.gameEngine.endingBettingRound,
          players: table.gameEngine.players?.map((p) => ({
            id: p.id,
            state: p.state,
            bet: p.bet,
            chips: p.chips,
            hasActed: p.hasActed,
            hasOption: p.hasOption,
          })),
        });
      }
      throw error;
    }
  });
});
