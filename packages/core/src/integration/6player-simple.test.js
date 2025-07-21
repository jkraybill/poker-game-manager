import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action, PlayerState } from '../types/index.js';

describe('6-Player Simple Test', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach(table => table.close());
  });

  it('should complete a simple 6-player game', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 6,
    });

    let gameStarted = false;
    let handEnded = false;
    let actionCount = 0;

    // Simple fold-only players (except big blind who checks)
    class FoldPlayer extends Player {
      constructor(config) {
        super(config);
        this.isBigBlind = config.isBigBlind || false;
      }
      
      async getAction(gameState) {
        // Small delay to ensure no race conditions
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const activePlayers = Object.values(gameState.players).filter(p => 
          p.state === PlayerState.ACTIVE || p.state === PlayerState.ALL_IN,
        );
        console.log(`Player ${this.id} acting. Active players: ${activePlayers.length}`);
        
        // Big blind checks if no one raised
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;
        
        if (this.isBigBlind && toCall === 0) {
          console.log(`${this.id} is BB and checking`);
          return {
            playerId: this.id,
            action: Action.CHECK,
            timestamp: Date.now(),
          };
        }
        
        const action = {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now(),
        };
        console.log(`${this.id} folding`);
        return action;
      }
    }

    table.on('game:started', () => {
      gameStarted = true;
      console.log('Game started!');
    });

    table.on('player:action', ({ action, playerId }) => {
      actionCount++;
      console.log(`Action ${actionCount}: ${action} by ${playerId}`);
    });

    table.on('action:requested', ({ playerId }) => {
      console.log(`Waiting for action from ${playerId}`);
    });

    table.on('hand:ended', ({ winners }) => {
      handEnded = true;
      console.log('Hand ended! Winners:', winners?.length);
      table.close();
    });

    table.on('hand:complete', ({ winners }) => {
      console.log('Hand complete event! Winners:', winners);
    });

    table.on('game:ended', (data) => {
      console.log('Game ended event:', data);
    });

    table.on('error', (error) => {
      console.error('Table Error:', error);
    });

    table.on('game:error', (error) => {
      console.error('Game Error:', error);
    });

    table.on('action:invalid', (data) => {
      console.error('Invalid action:', data);
    });

    // Add 6 players (mark player at index 2 as BB with dealerButton: 0)
    for (let i = 0; i < 6; i++) {
      table.addPlayer(new FoldPlayer({ 
        name: `Player ${i + 1}`,
        isBigBlind: i === 2, // With 6 players and dealerButton: 0, index 2 is BB
      }));
    }
    table.tryStartGame();

    // Wait for game to start
    await vi.waitFor(() => gameStarted, { timeout: 500 });
    
    // Wait for hand to end
    await vi.waitFor(() => handEnded, { timeout: 1000 });

    expect(gameStarted).toBe(true);
    expect(handEnded).toBe(true);
    expect(actionCount).toBeGreaterThan(0);
  });
});