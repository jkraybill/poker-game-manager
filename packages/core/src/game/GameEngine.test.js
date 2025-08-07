import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from './GameEngine.js';
import { Action, PlayerState } from '../types/index.js';
import { Player } from '../Player.js';

// Mock player class for testing
class MockPlayer extends Player {
  constructor(config) {
    super(config);
    // Default to returning a valid action based on validActions array
    this.getAction = vi.fn().mockImplementation((gameState) => {
      // Use validActions if provided by GameEngine
      const validActions = gameState.validActions || [];
      
      // Simple strategy: prefer CHECK over CALL over FOLD
      let action;
      if (validActions.includes(Action.CHECK)) {
        action = Action.CHECK;
      } else if (validActions.includes(Action.CALL)) {
        action = Action.CALL;
      } else if (validActions.includes(Action.FOLD)) {
        action = Action.FOLD;
      } else if (validActions.includes(Action.ALL_IN)) {
        action = Action.ALL_IN;
      } else {
        // This should never happen if GameEngine is working correctly
        console.error('No valid actions available for player', config.id, 'validActions:', validActions);
        action = Action.CHECK; // Fallback
      }
      
      return Promise.resolve({
        action,
        playerId: config.id,
        timestamp: Date.now(),
      });
    });
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
    afterEach(() => {
      // Abort the game to prevent background promises from continuing
      if (gameEngine.phase !== 'ENDED') {
        gameEngine.abort();
      }
    });

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
    afterEach(() => {
      // Abort the game to prevent background promises from continuing
      if (gameEngine.phase !== 'ENDED') {
        gameEngine.abort();
      }
    });

    it('should start a new hand', async () => {
      // Mock promptNextPlayer to prevent async game loop
      const promptSpy = vi.spyOn(gameEngine, 'promptNextPlayer').mockResolvedValue();
      
      const handStartedSpy = vi.fn();
      gameEngine.on('hand:started', handStartedSpy);

      await gameEngine.start();

      expect(handStartedSpy).toHaveBeenCalledWith({
        players: ['player1', 'player2', 'player3'],
        dealerButton: gameEngine.dealerButtonIndex,
      });
      
      // Restore original implementation
      promptSpy.mockRestore();
    });

    it('should deal hole cards to all players', async () => {
      // Mock promptNextPlayer to prevent async game loop
      const promptSpy = vi.spyOn(gameEngine, 'promptNextPlayer').mockResolvedValue();
      
      await gameEngine.start();

      expect(mockPlayers[0].player.receivePrivateCards).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ rank: expect.any(String) }),
          expect.objectContaining({ rank: expect.any(String) }),
        ]),
      );
      
      // Restore original implementation
      promptSpy.mockRestore();
    });

    it('should post blinds', async () => {
      // Mock promptNextPlayer to prevent async game loop
      const promptSpy = vi.spyOn(gameEngine, 'promptNextPlayer').mockResolvedValue();
      
      const potUpdatedSpy = vi.fn();
      gameEngine.on('pot:updated', potUpdatedSpy);

      await gameEngine.start();

      // Should have two pot updates for small and big blind
      expect(potUpdatedSpy).toHaveBeenCalledTimes(2);
      
      // Restore original implementation
      promptSpy.mockRestore();
    });

    it('should throw error if game already in progress', async () => {
      // Mock promptNextPlayer to prevent async game loop
      const promptSpy = vi.spyOn(gameEngine, 'promptNextPlayer').mockResolvedValue();
      
      await gameEngine.start();
      await expect(gameEngine.start()).rejects.toThrow('Game already in progress');
      
      // Restore original implementation
      promptSpy.mockRestore();
    });
  });

  describe('player actions', () => {
    beforeEach(async () => {
      // Clear mock call history but keep default implementation
      mockPlayers.forEach((mp) => {
        mp.player.getAction.mockClear();
        mp.player.receivePrivateCards.mockClear();
        mp.player.receiveMessage.mockClear();
        // Re-apply default implementation after clearing
        mp.player.getAction.mockImplementation((gameState) => {
          // Use validActions if provided by GameEngine
          const validActions = gameState.validActions || [];
          
          // Simple strategy: prefer CHECK over CALL over FOLD
          let action;
          if (validActions.includes(Action.CHECK)) {
            action = Action.CHECK;
          } else if (validActions.includes(Action.CALL)) {
            action = Action.CALL;
          } else if (validActions.includes(Action.FOLD)) {
            action = Action.FOLD;
          } else if (validActions.includes(Action.ALL_IN)) {
            action = Action.ALL_IN;
          } else {
            // This should never happen if GameEngine is working correctly
            console.error('No valid actions available for player', mp.player.id, 'validActions:', validActions);
            action = Action.CHECK; // Fallback
          }
          
          return Promise.resolve({
            action,
            playerId: mp.player.id,
            timestamp: Date.now(),
          });
        });
      });
      // Mock promptNextPlayer to prevent the game loop from running automatically
      vi.spyOn(gameEngine, 'promptNextPlayer').mockResolvedValue();
      await gameEngine.start();
    });

    afterEach(() => {
      // Abort the game to prevent background promises from continuing
      if (gameEngine.phase !== 'ENDED') {
        gameEngine.abort();
      }
      // Restore all mocks
      vi.restoreAllMocks();
    });

    it('should reject fold action when check is available', async () => {
      // Restore real promptNextPlayer for this test
      gameEngine.promptNextPlayer.mockRestore();
      
      // Set up BB with option to check (everyone called)
      const sbIndex = gameEngine.getNextActivePlayerIndex(gameEngine.dealerButtonIndex);
      const bbIndex = gameEngine.getNextActivePlayerIndex(sbIndex);
      
      // Make everyone call to BB
      mockPlayers.forEach((mp, idx) => {
        if (idx !== bbIndex) {
          mp.bet = 20;
          mp.chips = 980;
          mp.hasActed = true;
        }
      });
      
      gameEngine.currentPlayerIndex = bbIndex;
      const bbPlayer = mockPlayers[bbIndex];
      bbPlayer.hasActed = false;
      
      // Try to fold when check is available
      bbPlayer.player.getAction.mockResolvedValue({
        action: Action.FOLD,
        playerId: bbPlayer.player.id,
      });

      // Should throw error
      await expect(gameEngine.promptNextPlayer()).rejects.toThrow(
        'Cannot fold when you can check for free',
      );
    });

    it('should handle check action when valid', async () => {
      // Restore real promptNextPlayer for this test
      gameEngine.promptNextPlayer.mockRestore();
      
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

  });

  describe('betting rounds', () => {
    afterEach(() => {
      // Abort the game to prevent background promises from continuing
      if (gameEngine.phase !== 'ENDED') {
        gameEngine.abort();
      }
    });

    it('should progress through all betting rounds', async () => {
      // Mock promptNextPlayer to prevent async game loop
      const promptSpy = vi.spyOn(gameEngine, 'promptNextPlayer').mockResolvedValue();
      
      const communityCardsSpy = vi.fn();
      gameEngine.on('cards:community', communityCardsSpy);

      // Start the game
      await gameEngine.start();
      
      // Manually set up pre-flop betting completion state
      for (let i = 0; i < 3; i++) {
        gameEngine.players[i].hasActed = true;
        gameEngine.players[i].bet = gameEngine.getCurrentBet();
      }
      
      // Manually trigger betting round end to see flop
      await gameEngine.endBettingRound();

      // Should deal flop (3 cards)
      expect(communityCardsSpy).toHaveBeenCalledWith({
        cards: expect.arrayContaining([
          expect.objectContaining({ rank: expect.any(String) }),
          expect.objectContaining({ rank: expect.any(String) }),
          expect.objectContaining({ rank: expect.any(String) }),
        ]),
        phase: 'FLOP',
      });
      
      // Restore original implementation
      promptSpy.mockRestore();
    });
  });

  describe('hand completion', () => {
    afterEach(() => {
      // Abort the game to prevent background promises from continuing
      if (gameEngine.phase !== 'ENDED') {
        gameEngine.abort();
      }
    });

    it('should end hand when only one player remains', async () => {
      // Mock promptNextPlayer to prevent async game loop
      const promptSpy = vi.spyOn(gameEngine, 'promptNextPlayer').mockResolvedValue();
      
      const handCompleteSpy = vi.fn();
      gameEngine.on('hand:complete', handCompleteSpy);

      await gameEngine.start();

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
      
      // Restore original implementation
      promptSpy.mockRestore();
    });
  });

  describe('abort()', () => {
    afterEach(() => {
      // Abort the game to prevent background promises from continuing
      if (gameEngine.phase !== 'ENDED') {
        gameEngine.abort();
      }
    });

    it('should abort the game', async () => {
      // Mock promptNextPlayer to prevent async game loop
      const promptSpy = vi.spyOn(gameEngine, 'promptNextPlayer').mockResolvedValue();
      
      const abortSpy = vi.fn();
      gameEngine.on('game:aborted', abortSpy);

      await gameEngine.start();
      gameEngine.abort();

      expect(gameEngine.phase).toBe('ENDED');
      expect(abortSpy).toHaveBeenCalled();
      
      // Restore original implementation
      promptSpy.mockRestore();
    });
  });
});
