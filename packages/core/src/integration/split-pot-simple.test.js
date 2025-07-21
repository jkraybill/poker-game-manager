/**
 * Simple Split Pot Test
 * 
 * A minimal test to verify split pot functionality works
 * without complex deck manipulation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';
import { HandEvaluator } from '../game/HandEvaluator.js';

describe('Simple Split Pot Test', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach(table => table.close());
  });

  it('should properly detect split pot winners in HandEvaluator', () => {
    // Test HandEvaluator directly first
    const playerHands = [
      {
        playerData: { player: { id: 'player1' } },
        hand: {
          rank: 5, // Straight
          kickers: [9, 8, 7, 6, 5],
          cards: [],
          description: 'Straight, Nine High',
        },
        cards: [],
      },
      {
        playerData: { player: { id: 'player2' } },
        hand: {
          rank: 5, // Straight
          kickers: [9, 8, 7, 6, 5], // Same kickers
          cards: [],
          description: 'Straight, Nine High',
        },
        cards: [],
      },
    ];

    const winners = HandEvaluator.findWinners(playerHands);
    expect(winners).toHaveLength(2); // Both should win
    expect(winners.map(w => w.playerData.player.id)).toContain('player1');
    expect(winners.map(w => w.playerData.player.id)).toContain('player2');
  });

  it('should handle 2-player all-in split pot scenario', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 100,
      maxBuyIn: 100,
      minPlayers: 2,
      dealerButton: 0,
    });

    // Simple all-in players
    class AllInPlayer extends Player {
      getAction(gameState) {
        const myState = gameState.players[this.id];
        
        // Both players go all-in preflop
        if (gameState.phase === 'PRE_FLOP') {
          return {
            playerId: this.id,
            action: Action.ALL_IN,
            amount: myState.chips,
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

    // Create promise to wait for hand end
    const handResult = new Promise((resolve) => {
      table.on('game:started', () => {
        console.log('Game started');
      });

      table.on('hand:ended', (event) => {
        console.log('hand:ended event received:', event);
        const handWinners = event.winners;
        
        console.log('Hand ended with winners:', handWinners?.length || 0);
        console.log('Winner details:', handWinners?.map(w => ({
          playerId: w.playerId,
          handRank: w.hand?.rank,
          handKickers: w.hand?.kickers,
          amount: w.amount,
        })) || []);
        
        resolve(handWinners || []);
      });
    });

    // Create 2 players with equal chips
    const players = [
      new AllInPlayer({ name: 'Player 1' }),
      new AllInPlayer({ name: 'Player 2' }),
    ];

    players.forEach(p => table.addPlayer(p));
    
    // Explicitly start the game (new API)
    table.tryStartGame();

    // Wait for hand to complete
    const winners = await handResult;

    console.log('Final winners array:', winners);
    console.log('Winners length:', winners.length);
    
    // With random cards, we can't guarantee a split pot
    // But we can verify the game completes and someone wins
    expect(winners.length).toBeGreaterThan(0);
    
    // Total winnings should equal the pot (200 chips)
    const totalWon = winners.reduce((sum, w) => sum + w.amount, 0);
    expect(totalWon).toBe(200);

    table.close();
  });
});