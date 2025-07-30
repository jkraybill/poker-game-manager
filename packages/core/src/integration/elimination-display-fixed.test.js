import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';
// Remove deck builder import - will create deck manually

/**
 * Test for Issue #34 - Eliminated players shown in active standings
 */

class TestPlayer extends Player {
  constructor(config) {
    super(config);
    this.strategy = config.strategy || 'normal';
  }

  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    // Player A always raises
    if (this.strategy === 'raiser' && gameState.currentBet < 100) {
      return {
        playerId: this.id,
        action: Action.RAISE,
        amount: 100,
        timestamp: Date.now(),
      };
    }

    // Player B calls everything (will lose all chips)
    if (this.strategy === 'caller' && toCall > 0) {
      if (toCall >= myState.chips) {
        return {
          playerId: this.id,
          action: Action.ALL_IN,
          amount: myState.chips,
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

    // Default check/fold
    if (toCall > 0) {
      return {
        playerId: this.id,
        action: Action.FOLD,
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

describe('Elimination Display Fixed', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach((table) => table.close());
  });

  it('should properly remove eliminated players from active standings', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 100,
      maxBuyIn: 100,
      minPlayers: 2,
      dealerButton: 0,
    });

    // Create players
    const playerA = new TestPlayer({
      id: 'A',
      name: 'Player A (raiser)',
      strategy: 'raiser',
    });
    const playerB = new TestPlayer({
      id: 'B',
      name: 'Player B (caller)',
      strategy: 'caller',
    });
    const playerC = new TestPlayer({
      id: 'C',
      name: 'Player C (folder)',
      strategy: 'folder',
    });

    // Set up custom deck where A wins with AA
    const customDeck = [
      // Deal order for 3 players
      { rank: 'A', suit: 's' }, // A first card
      { rank: '2', suit: 'c' }, // B first card
      { rank: '7', suit: 'd' }, // C first card
      { rank: 'A', suit: 'h' }, // A second card (AA)
      { rank: '3', suit: 'c' }, // B second card
      { rank: '4', suit: 'c' }, // C second card
      // Community cards
      { rank: 'K', suit: 'c' }, // burn
      { rank: 'K', suit: 's' }, // flop 1
      { rank: 'K', suit: 'd' }, // flop 2
      { rank: 'K', suit: 'h' }, // flop 3
      { rank: '2', suit: 'd' }, // burn
      { rank: 'Q', suit: 'c' }, // turn
      { rank: '3', suit: 'd' }, // burn
      { rank: 'J', suit: 'c' }, // river
    ];

    table.setCustomDeck(customDeck);

    // Override addPlayer to give B very few chips
    const originalAddPlayer = table.addPlayer.bind(table);
    table.addPlayer = function (player) {
      const result = originalAddPlayer(player);
      if (player.id === 'B') {
        player.chips = 40; // Just enough for blinds + small bet
      }
      return result;
    };

    const eliminationEvents = [];
    let handsPlayed = 0;
    let activePlayers = [];

    table.on('player:eliminated', (data) => {
      eliminationEvents.push(data);
      console.log(`\n🔴 ELIMINATION EVENT: Player ${data.playerId} eliminated`);
    });

    table.on('hand:started', () => {
      handsPlayed++;
      console.log(`\n=== HAND ${handsPlayed} STARTED ===`);
    });

    table.on('hand:ended', () => {
      // Get current active players
      const currentActive = Array.from(table.players.values())
        .filter((pd) => pd.player.chips > 0)
        .map((pd) => ({
          id: pd.player.id,
          name: pd.player.name,
          chips: pd.player.chips,
        }));

      console.log('\nActive players after hand:', currentActive);
      console.log('Total players in table:', table.players.size);

      activePlayers = currentActive;

      // Check if eliminated player is still listed
      const allPlayers = Array.from(table.players.values()).map((pd) => ({
        id: pd.player.id,
        chips: pd.player.chips,
        inTable: true,
      }));
      console.log('All players in table:', allPlayers);

      if (handsPlayed < 3) {
        // Continue playing more hands
        setTimeout(() => table.tryStartGame(), 100);
      }
    });

    // Add players and start
    table.addPlayer(playerA);
    table.addPlayer(playerB);
    table.addPlayer(playerC);
    table.tryStartGame();

    // Wait for multiple hands
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Final verification
    console.log('\n=== FINAL TEST RESULTS ===');
    console.log('Hands played:', handsPlayed);
    console.log('Eliminations:', eliminationEvents.length);
    console.log('Final active players:', activePlayers);
    console.log('Table size:', table.players.size);

    // Key assertions
    if (eliminationEvents.length > 0) {
      // Check that eliminated players are not in active list
      const eliminatedIds = eliminationEvents.map((e) => e.playerId);
      const activeIds = activePlayers.map((p) => p.id);

      eliminatedIds.forEach((id) => {
        const inActiveList = activeIds.includes(id);
        console.log(`Player ${id} in active list: ${inActiveList}`);
        expect(inActiveList).toBe(false);
      });

      // Check table.players
      eliminatedIds.forEach((id) => {
        const stillInTable = table.players.has(id);
        console.log(`Player ${id} still in table.players: ${stillInTable}`);
        // This is the bug - eliminated players remain in table.players
      });
    }
  });
});
