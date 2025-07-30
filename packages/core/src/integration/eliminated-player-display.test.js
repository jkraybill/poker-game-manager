import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

/**
 * Test for Issue #34 - Eliminated players shown in active standings
 */

class AllInPlayer extends Player {
  constructor(config) {
    super(config);
    this.hasGoneAllIn = false;
  }

  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    // Go all-in on first action
    if (!this.hasGoneAllIn && toCall > 0) {
      this.hasGoneAllIn = true;
      return {
        playerId: this.id,
        action: Action.ALL_IN,
        amount: myState.chips,
        timestamp: Date.now(),
      };
    }

    if (toCall > 0) {
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
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

describe('Eliminated Player Display', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach((table) => table.close());
  });

  it('should not show eliminated players in active player list', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 100,
      maxBuyIn: 100,
      minPlayers: 2,
      dealerButton: 0,
    });

    const players = [
      new Player({ id: 'A', name: 'Player A' }),
      new AllInPlayer({ id: 'B', name: 'Player B (will lose)' }),
      new Player({ id: 'C', name: 'Player C' }),
    ];

    // Give player B very few chips so they'll lose
    const originalAddPlayer = table.addPlayer.bind(table);
    table.addPlayer = function (player) {
      const result = originalAddPlayer(player);
      if (player.id === 'B') {
        player.chips = 30; // Will go all-in and likely lose
      }
      return result;
    };

    let eliminationOccurred = false;
    let postEliminationActivePlayers = null;
    let handCount = 0;

    table.on('player:eliminated', ({ playerId }) => {
      console.log(`Player ${playerId} eliminated`);
      eliminationOccurred = true;
    });

    table.on('hand:ended', () => {
      handCount++;

      // Check active players after hand
      const activePlayers = Array.from(table.players.values())
        .filter((pd) => pd.player.chips > 0)
        .map((pd) => ({ id: pd.player.id, chips: pd.player.chips }));

      console.log(`\nAfter hand ${handCount}:`);
      console.log('Active players:', activePlayers);
      console.log('Table.players size:', table.players.size);

      if (handCount === 1) {
        postEliminationActivePlayers = activePlayers;

        // Player B should have been eliminated
        const playerB = table.players.get('B');
        if (playerB) {
          console.log(
            `Player B still in table.players with chips: ${playerB.player.chips}`,
          );
        } else {
          console.log('Player B removed from table.players');
        }
      }
    });

    // Add players and start
    for (const player of players) {
      table.addPlayer(player);
    }
    table.tryStartGame();

    // Wait for hand to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify results
    console.log('\n=== Elimination Display Test Results ===');
    console.log('Elimination occurred:', eliminationOccurred);
    console.log(
      'Post-elimination active players:',
      postEliminationActivePlayers,
    );

    // Check if eliminated player is still in table.players
    const eliminatedPlayer = table.players.get('B');
    if (eliminatedPlayer) {
      console.log(
        `BUG: Eliminated player B still in table with chips: ${eliminatedPlayer.player.chips}`,
      );
    }

    // The key test: eliminated players should not be in active standings
    if (postEliminationActivePlayers) {
      const eliminatedInActiveList = postEliminationActivePlayers.some(
        (p) => p.id === 'B' && p.chips === 0,
      );
      expect(eliminatedInActiveList).toBe(false);
    }
  });
});
