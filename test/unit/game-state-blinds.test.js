import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../packages/core/src/game/GameEngine.js';
import { Player } from '../../packages/core/src/Player.js';
import { Action, PlayerState, GamePhase } from '../../packages/core/src/types/index.js';

describe('GameState blind values', () => {
  it('should include bigBlind and smallBlind in game state', () => {
    // Create mock players
    const player1 = new Player({ id: 'p1', name: 'Player 1', chips: 1000 });
    const player2 = new Player({ id: 'p2', name: 'Player 2', chips: 1000 });
    
    // Create game engine with players
    const config = {
      blinds: {
        small: 50,
        big: 100,
      },
      minPlayers: 2,
      players: [player1, player2],
      dealerButton: 0,
    };
    
    const engine = new GameEngine(config);
    
    // Initialize the hand to set up pot manager
    engine.phase = GamePhase.WAITING;
    engine.initializeHand();
    
    // Build game state
    const gameState = engine.buildGameState();
    
    // Verify bigBlind and smallBlind are included
    expect(gameState.bigBlind).toBe(100);
    expect(gameState.smallBlind).toBe(50);
    
    // Clean up
    engine.releaseGameState(gameState);
  });

  it('should allow BB calculations in player decisions', () => {
    // Create mock players
    const player1 = new Player({ id: 'p1', name: 'Player 1', chips: 5000 });
    const player2 = new Player({ id: 'p2', name: 'Player 2', chips: 5000 });
    
    // Create game engine with 200 big blind
    const config = {
      blinds: {
        small: 100,
        big: 200,
      },
      minPlayers: 2,
      players: [player1, player2],
      dealerButton: 0,
    };
    
    const engine = new GameEngine(config);
    
    // Initialize the hand to set up pot manager
    engine.phase = GamePhase.WAITING;
    engine.initializeHand();
    
    // Build game state
    const gameState = engine.buildGameState();
    
    // Verify bigBlind is available for calculations
    expect(gameState.bigBlind).toBe(200);
    expect(gameState.smallBlind).toBe(100);
    
    // Simulate a player calculation with a hypothetical bet of 400 (2 BBs)
    const hypotheticalBet = 400;
    const betSizeBBs = hypotheticalBet / gameState.bigBlind;
    expect(betSizeBBs).toBe(2); // 400 / 200 = 2 BBs
    
    // This demonstrates that players can now do BB calculations like:
    // const betSizeBBs = toCall / (gameState.bigBlind || 200);
    // Without the fallback value!
    
    // Clean up
    engine.releaseGameState(gameState);
  });
});