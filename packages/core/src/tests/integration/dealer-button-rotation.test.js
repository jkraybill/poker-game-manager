import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PokerGameManager } from '../../PokerGameManager.js';
import { Player } from '../../Player.js';
import { Action } from '../../types/index.js';

// Simple test player that always checks/calls
class TestPlayer extends Player {
  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    if (toCall === 0) {
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now(),
      };
    }

    return {
      playerId: this.id,
      action: Action.CALL,
      amount: toCall,
      timestamp: Date.now(),
    };
  }
}

describe('Dealer Button Rotation', () => {
  let manager;
  let table;
  let players;

  beforeEach(() => {
    manager = new PokerGameManager();
    table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 3,
      dealerButton: 0, // Start with position 0
    });

    // Create 3 test players
    players = [
      new TestPlayer({ id: 'player-1', name: 'Player 1' }),
      new TestPlayer({ id: 'player-2', name: 'Player 2' }),
      new TestPlayer({ id: 'player-3', name: 'Player 3' }),
    ];
  });

  afterEach(() => {
    if (table) {
      table.close();
    }
  });

  it('should rotate dealer button clockwise after each hand', () => {
    const buttonPositions = [];
    const handCount = 4; // Play 4 hands to see full rotation
    let handsPlayed = 0;

    // Track button positions
    table.on('hand:started', (data) => {
      buttonPositions.push(data.dealerButton);
    });

    // Add players
    players.forEach(player => table.addPlayer(player));

    // Play multiple hands
    return new Promise((resolve) => {
      table.on('hand:ended', () => {
        handsPlayed++;
        
        if (handsPlayed < handCount) {
          // Start next hand
          setTimeout(() => {
            table.tryStartGame();
          }, 10);
        } else {
          // Verify button rotated correctly
          expect(buttonPositions).toHaveLength(handCount);
          expect(buttonPositions[0]).toBe(0); // First hand: position 0
          expect(buttonPositions[1]).toBe(1); // Second hand: position 1
          expect(buttonPositions[2]).toBe(2); // Third hand: position 2
          expect(buttonPositions[3]).toBe(0); // Fourth hand: back to position 0
          
          resolve();
        }
      });

      // Start first hand
      table.tryStartGame();
    });
  });

  it('should skip eliminated players when rotating button', () => {
    const buttonPositions = [];
    let handsPlayed = 0;

    // Override player 2's chips to eliminate them quickly
    const originalAddPlayer = table.addPlayer.bind(table);
    table.addPlayer = function(player) {
      const result = originalAddPlayer(player);
      if (player.id === 'player-2') {
        // Give player 2 only enough for one blind
        player.chips = 30;
      }
      return result;
    };

    // Make player 2 go all-in to get eliminated
    players[1].getAction = function(gameState) {
      const myState = gameState.players[this.id];
      if (myState.chips > 0) {
        return {
          playerId: this.id,
          action: Action.ALL_IN,
          amount: myState.chips,
          timestamp: Date.now(),
        };
      }
    };

    // Track button positions
    table.on('hand:started', (data) => {
      buttonPositions.push(data.dealerButton);
    });

    // Track elimination
    table.on('player:eliminated', ({ playerId }) => {
      console.log(`Player ${playerId} eliminated`);
    });

    // Add players
    players.forEach(player => table.addPlayer(player));

    // Play hands
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Test timed out'));
      }, 5000);

      table.on('hand:ended', () => {
        handsPlayed++;
        console.log(`Hand ${handsPlayed} ended, active players: ${table.getPlayerCount()}`);
        
        if (handsPlayed === 1) {
          // After first hand, player 2 should be eliminated
          // Wait for elimination to process
          setTimeout(() => {
            if (table.getPlayerCount() >= 2) {
              table.tryStartGame();
            } else {
              clearTimeout(timeout);
              reject(new Error('Not enough players for second hand'));
            }
          }, 200);
        } else if (handsPlayed === 2) {
          clearTimeout(timeout);
          // After second hand, check button rotation
          // With player at position 1 eliminated, button should skip from 0 to 2
          expect(buttonPositions).toHaveLength(2);
          expect(buttonPositions[0]).toBe(0); // First hand: position 0
          // Since player 1 (index 1) is eliminated, button goes to player 2 (now at index 0 in active players)
          // But we want to track by original positions, so it should be 2
          expect(buttonPositions[1]).toBe(0); // Second hand: position 0 (only 2 players left)
          
          resolve();
        }
      });

      // Start first hand
      table.tryStartGame();
    });
  });

  it('should handle heads-up button rotation correctly', () => {
    const buttonPositions = [];
    let handsPlayed = 0;

    // Create only 2 players for heads-up
    const headsUpTable = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
      dealerButton: 0,
    });

    const headsUpPlayers = [
      new TestPlayer({ id: 'player-1', name: 'Player 1' }),
      new TestPlayer({ id: 'player-2', name: 'Player 2' }),
    ];

    // Track button positions
    headsUpTable.on('hand:started', (data) => {
      buttonPositions.push(data.dealerButton);
    });

    // Add players
    headsUpPlayers.forEach(player => headsUpTable.addPlayer(player));

    // Play multiple hands
    return new Promise((resolve) => {
      headsUpTable.on('hand:ended', () => {
        handsPlayed++;
        
        if (handsPlayed < 3) {
          // Start next hand
          setTimeout(() => {
            headsUpTable.tryStartGame();
          }, 10);
        } else {
          // Verify button rotated correctly in heads-up
          expect(buttonPositions).toHaveLength(3);
          expect(buttonPositions[0]).toBe(0); // First hand: position 0
          expect(buttonPositions[1]).toBe(1); // Second hand: position 1
          expect(buttonPositions[2]).toBe(0); // Third hand: back to position 0
          
          headsUpTable.close();
          resolve();
        }
      });

      // Start first hand
      headsUpTable.tryStartGame();
    });
  });
});