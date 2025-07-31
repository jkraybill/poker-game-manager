import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  StrategicPlayer,
  cleanupTables,
  waitForHandEnd,
  Action,
  STRATEGIES,
} from '../test-utils/index.js';

/**
 * Test for Issue #34 - Eliminated players shown in active standings
 */

describe('Eliminated Player Display', () => {
  let manager, table, events;

  beforeEach(() => {
    ({ manager, table } = createTestTable('standard', {
      blinds: { small: 10, big: 20 },
      minBuyIn: 100,
      maxBuyIn: 100,
      minPlayers: 2,
      dealerButton: 0,
    }));
    events = setupEventCapture(table);
  });

  afterEach(() => {
    cleanupTables(manager);
  });

  it('should not show eliminated players in active player list', async () => {
    // Strategy: Player B goes all-in on first action
    const allInOnceStrategy = (() => {
      let hasGoneAllIn = false;
      return ({ myState, toCall }) => {
        // Go all-in on first action when facing a bet
        if (!hasGoneAllIn && toCall > 0) {
          hasGoneAllIn = true;
          return {
            action: Action.ALL_IN,
            amount: myState.chips,
          };
        }

        if (toCall > 0) {
          return {
            action: Action.CALL,
            amount: toCall,
          };
        }

        return {
          action: Action.CHECK,
        };
      };
    })();

    const players = [
      new StrategicPlayer({ 
        id: 'A', 
        name: 'Player A', 
        strategy: STRATEGIES.alwaysCall, 
      }),
      new StrategicPlayer({ 
        id: 'B', 
        name: 'Player B (will lose)', 
        strategy: allInOnceStrategy, 
      }),
      new StrategicPlayer({ 
        id: 'C', 
        name: 'Player C', 
        strategy: STRATEGIES.alwaysCall, 
      }),
    ];

    // Add players
    for (const player of players) {
      table.addPlayer(player);
    }

    // Give player B very few chips so they'll lose
    players[1].chips = 30; // Will go all-in and likely lose

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

    // Start game
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

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
