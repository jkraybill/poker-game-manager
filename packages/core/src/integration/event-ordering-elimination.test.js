import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';
import { Deck } from '../game/Deck.js';

/**
 * Test for Issue #33: Event ordering with guaranteed elimination
 * 
 * This test ensures that player:eliminated events fire AFTER hand:ended events
 * when a player loses all their chips.
 */

describe('Event Ordering - Elimination (Issue #33)', () => {
  let manager;
  let table;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    if (table) {
      table.close();
    }
  });

  it('should fire player:eliminated after hand:ended when player loses all chips', async () => {
    // Create a custom deck where player 1 gets better cards than player 2
    class RiggedDeck extends Deck {
      constructor() {
        super();
        // Set up cards - in 2-player game with dealerButton:0
        // Player at position 0 gets cards first, player at position 1 gets cards second
        this.cards = [];
        
        // Player 1 gets AA (will win)
        this.cards.push({ rank: 'A', suit: 's' });
        this.cards.push({ rank: 'A', suit: 'h' });
        
        // Player 2 gets 72 (will lose)
        this.cards.push({ rank: '7', suit: 'd' });
        this.cards.push({ rank: '2', suit: 'c' });
        
        // Community cards that don't help player 2
        this.cards.push({ rank: 'K', suit: 's' });
        this.cards.push({ rank: 'Q', suit: 'h' });
        this.cards.push({ rank: 'J', suit: 'd' });
        this.cards.push({ rank: 'T', suit: 'c' });
        this.cards.push({ rank: '9', suit: 's' });
        
        // Add more cards to avoid running out
        for (let i = 0; i < 40; i++) {
          this.cards.push({ rank: '3', suit: 'h' });
        }
      }
      
      shuffle() {
        // Don't shuffle - keep our rigged order
      }
    }

    // Create table
    table = manager.createTable({
      id: 'elimination-test',
      blinds: { small: 10, big: 20 },
      minBuyIn: 40,
      maxBuyIn: 200,
      minPlayers: 2,
      maxPlayers: 9,
      dealerButton: 0,
    });

    // Use rigged deck
    const riggedDeck = new RiggedDeck();
    table.setCustomDeck(riggedDeck.cards);

    const eventLog = [];

    // Track events
    table.on('hand:ended', ({ winners }) => {
      eventLog.push({
        event: 'hand:ended',
        timestamp: Date.now(),
        winners: winners.map(w => ({ id: w.playerId, amount: w.amount })),
      });
    });

    table.on('player:eliminated', ({ playerId }) => {
      eventLog.push({
        event: 'player:eliminated',
        timestamp: Date.now(),
        playerId,
      });
    });

    // Simple all-in player
    class AllInPlayer extends Player {
      getAction(gameState) {
        const myState = gameState.players[this.id];
        
        if (myState.chips > 0) {
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

    const player1 = new AllInPlayer({ name: 'Player 1' });
    const player2 = new AllInPlayer({ name: 'Player 2' });

    // Add players in order
    table.addPlayer(player1);
    table.addPlayer(player2);

    // Set chips - player 2 will lose all chips
    player1.chips = 100;
    player2.chips = 50;

    // Wait for hand to complete
    const handComplete = new Promise((resolve) => {
      table.on('hand:ended', () => {
        // Wait a bit for any async events
        setTimeout(resolve, 100);
      });
    });

    // Start game
    table.tryStartGame();
    
    // Wait for completion
    await handComplete;

    // Verify we got both events
    const handEndedEvents = eventLog.filter(e => e.event === 'hand:ended');
    const eliminationEvents = eventLog.filter(e => e.event === 'player:eliminated');
    
    expect(handEndedEvents).toHaveLength(1);
    expect(eliminationEvents).toHaveLength(1);

    // Verify ordering - elimination must come after hand:ended
    const handTime = handEndedEvents[0].timestamp;
    const elimTime = eliminationEvents[0].timestamp;
    
    expect(elimTime).toBeGreaterThanOrEqual(handTime);
    
    // Verify the correct player was eliminated (player2 who had 50 chips)
    expect(eliminationEvents[0].playerId).toBe(player2.id);
    
    // Verify player1 won the pot
    expect(handEndedEvents[0].winners[0].id).toBe(player1.id);
    // Player 1 (SB) posts 10, Player 2 (BB) posts 20, then both go all-in
    // Total pot = 100 + 50 = 150
    expect(handEndedEvents[0].winners[0].amount).toBe(150);
  });
});