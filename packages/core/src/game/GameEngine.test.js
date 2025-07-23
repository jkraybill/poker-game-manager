import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from './GameEngine.js';
import { Action, PlayerState } from '../types/index.js';
import { Player } from '../Player.js';

// Mock player class for testing
class MockPlayer extends Player {
  constructor(config) {
    super(config);
    this.getAction = vi.fn();
    this.receivePrivateCards = vi.fn();
    this.receiveMessage = vi.fn();
  }
}

describe('GameEngine', () => {
  let gameEngine;
  let mockPlayers;

  beforeEach(() => {
    // Create mock players with chips
    const player1 = new MockPlayer({ id: 'player1', name: 'Alice' });
    player1.buyIn(1000);

    const player2 = new MockPlayer({ id: 'player2', name: 'Bob' });
    player2.buyIn(1000);

    const player3 = new MockPlayer({ id: 'player3', name: 'Charlie' });
    player3.buyIn(1000);

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
      {
        player: player3,
        chips: player3.chips,
        state: PlayerState.ACTIVE,
      },
    ];

    gameEngine = new GameEngine({
      players: mockPlayers,
      blinds: { small: 10, big: 20 },
      timeout: 1000,
    });
  });

  describe('initialization', () => {
    it('should initialize with correct defaults', () => {
      expect(gameEngine.config.smallBlind).toBe(10);
      expect(gameEngine.config.bigBlind).toBe(20);
      expect(gameEngine.players).toHaveLength(3);
      expect(gameEngine.phase).toBe('WAITING');
    });

    it('should set random dealer button', () => {
      expect(gameEngine.dealerButtonIndex).toBeGreaterThanOrEqual(0);
      expect(gameEngine.dealerButtonIndex).toBeLessThan(3);
    });
  });

  describe('start()', () => {
    it('should start a new hand', () => {
      const handStartedSpy = vi.fn();
      gameEngine.on('hand:started', handStartedSpy);

      gameEngine.start();

      expect(handStartedSpy).toHaveBeenCalledWith({
        players: ['player1', 'player2', 'player3'],
        dealerButton: gameEngine.dealerButtonIndex,
      });
    });

    it('should deal hole cards to all players', () => {
      gameEngine.start();

      expect(mockPlayers[0].player.receivePrivateCards).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ rank: expect.any(String) }),
          expect.objectContaining({ rank: expect.any(String) }),
        ]),
      );
    });

    it('should post blinds', () => {
      const potUpdatedSpy = vi.fn();
      gameEngine.on('pot:updated', potUpdatedSpy);

      gameEngine.start();

      // Should have two pot updates for small and big blind
      expect(potUpdatedSpy).toHaveBeenCalledTimes(2);
    });

    it('should throw error if game already in progress', () => {
      gameEngine.start();
      expect(() => gameEngine.start()).toThrow('Game already in progress');
    });
  });

  describe('player actions', () => {
    beforeEach(() => {
      // Reset all mocks before each test
      mockPlayers.forEach((mp) => {
        mp.player.getAction.mockReset();
        mp.player.receivePrivateCards.mockReset();
        mp.player.receiveMessage.mockReset();
      });
      gameEngine.start();
    });

    it('should handle fold action', async () => {
      const currentPlayer = mockPlayers[gameEngine.currentPlayerIndex];
      currentPlayer.player.getAction.mockResolvedValue({
        action: Action.FOLD,
        playerId: currentPlayer.player.id,
      });

      const actionSpy = vi.fn();
      gameEngine.on('player:action', actionSpy);

      // Trigger next player prompt
      await gameEngine.promptNextPlayer();

      expect(actionSpy).toHaveBeenCalledWith({
        playerId: currentPlayer.player.id,
        action: Action.FOLD,
        amount: undefined,
      });
    });

    it('should handle check action when valid', async () => {
      // In a simpler test, just verify that check works when current bet matches player bet
      // Skip to a state where everyone has acted and it's time for someone to check

      // Find the big blind player
      const sbIndex = gameEngine.getNextActivePlayerIndex(
        gameEngine.dealerButtonIndex,
      );
      const bbIndex = gameEngine.getNextActivePlayerIndex(sbIndex);
      const bbPlayer = gameEngine.players[bbIndex];

      // Manually set up the state where everyone has matched the big blind
      gameEngine.players.forEach((player, index) => {
        if (index !== bbIndex) {
          player.bet = 20; // Everyone has called to big blind
          player.hasActed = true;
          player.chips = 980;
        }
      });

      // Set current player to big blind who can check
      gameEngine.currentPlayerIndex = bbIndex;
      bbPlayer.hasActed = false;

      const actionSpy = vi.fn();
      gameEngine.on('player:action', actionSpy);

      bbPlayer.getAction.mockResolvedValue({
        action: Action.CHECK,
        playerId: bbPlayer.id,
      });

      await gameEngine.promptNextPlayer();

      expect(bbPlayer.state).toBe(PlayerState.ACTIVE);
      expect(actionSpy).toHaveBeenCalledWith({
        playerId: bbPlayer.id,
        action: Action.CHECK,
        amount: undefined,
      });
    });

    it('should handle timeout by folding', async () => {
      const currentPlayer = mockPlayers[gameEngine.currentPlayerIndex];
      // Make getAction take longer than timeout
      currentPlayer.player.getAction.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 2000)),
      );

      const actionSpy = vi.fn();
      gameEngine.on('player:action', actionSpy);

      await gameEngine.promptNextPlayer();

      expect(actionSpy).toHaveBeenCalledWith({
        playerId: currentPlayer.player.id,
        action: Action.FOLD,
        amount: undefined,
      });
    });
  });

  describe('betting rounds', () => {
    it('should progress through all betting rounds', () => {
      const communityCardsSpy = vi.fn();
      gameEngine.on('cards:community', communityCardsSpy);

      // Mock all players to check/call
      mockPlayers.forEach((player) => {
        player.player.getAction.mockResolvedValue({
          action: Action.CHECK,
          playerId: player.player.id,
        });
      });

      gameEngine.start();

      // Simulate betting round completion
      for (let i = 0; i < 3; i++) {
        gameEngine.players[i].hasActed = true;
        gameEngine.players[i].bet = gameEngine.getCurrentBet();
      }
      gameEngine.endBettingRound();

      // Should deal flop (3 cards)
      expect(communityCardsSpy).toHaveBeenCalledWith({
        cards: expect.arrayContaining([
          expect.objectContaining({ rank: expect.any(String) }),
          expect.objectContaining({ rank: expect.any(String) }),
          expect.objectContaining({ rank: expect.any(String) }),
        ]),
        phase: 'FLOP',
      });
    });
  });

  describe('hand completion', () => {
    it('should end hand when only one player remains', () => {
      const handCompleteSpy = vi.fn();
      gameEngine.on('hand:complete', handCompleteSpy);

      gameEngine.start();

      // Fold all but one player
      gameEngine.handleFold(gameEngine.players[0]);
      gameEngine.handleFold(gameEngine.players[1]);

      expect(handCompleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          winners: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player3',
              hand: 'Won by fold',
            }),
          ]),
          board: expect.any(Array),
        }),
      );
    });
  });

  describe('abort()', () => {
    it('should abort the game', () => {
      const abortSpy = vi.fn();
      gameEngine.on('game:aborted', abortSpy);

      gameEngine.start();
      gameEngine.abort();

      expect(gameEngine.phase).toBe('ENDED');
      expect(abortSpy).toHaveBeenCalled();
    });
  });
});
