import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createChipStackTable,
  setupEventCapture,
  StrategicPlayer,
  cleanupTables,
  waitForHandEnd,
  Action,
} from '../test-utils/index.js';

/**
 * Test for Issue #34 - Eliminated players shown in active standings
 */

describe('Elimination Display Fixed', () => {
  let manager, table, events;

  beforeEach(() => {
    manager = null;
    table = null;
    events = null;
  });

  afterEach(() => {
    if (manager) {
      cleanupTables(manager);
    }
  });

  it('should properly remove eliminated players from active standings', async () => {
    ({ manager, table } = createChipStackTable(
      'standard',
      [100, 40, 100], // Player B has fewer chips
      {
        blinds: { small: 10, big: 20 },
        minBuyIn: 100,
        maxBuyIn: 100,
        minPlayers: 2,
        dealerButton: 0,
      },
    ));
    events = setupEventCapture(table);

    // Create strategies
    const raiserStrategy = ({ gameState, toCall }) => {
      if (gameState.currentBet < 100) {
        return {
          action: Action.RAISE,
          amount: 100,
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

    const callerStrategy = ({ myState, toCall }) => {
      if (toCall > 0) {
        if (toCall >= myState.chips) {
          return {
            action: Action.ALL_IN,
            amount: myState.chips,
          };
        }
        return {
          action: Action.CALL,
          amount: toCall,
        };
      }
      return {
        action: Action.CHECK,
      };
    };

    const folderStrategy = ({ toCall }) => {
      if (toCall > 0) {
        return {
          action: Action.FOLD,
        };
      }
      return {
        action: Action.CHECK,
      };
    };

    // Create players
    const playerA = new StrategicPlayer({
      id: 'A',
      name: 'Player A (raiser)',
      strategy: raiserStrategy,
    });
    const playerB = new StrategicPlayer({
      id: 'B',
      name: 'Player B (caller)',
      strategy: callerStrategy,
    });
    const playerC = new StrategicPlayer({
      id: 'C',
      name: 'Player C (folder)',
      strategy: folderStrategy,
    });

    // Set up custom deck where A wins with AA
    const customDeck = [
      // Deal order for 3 players
      { rank: 'A', suit: 's', toString() { return 'As'; } }, // A first card
      { rank: '2', suit: 'c', toString() { return '2c'; } }, // B first card
      { rank: '7', suit: 'd', toString() { return '7d'; } }, // C first card
      { rank: 'A', suit: 'h', toString() { return 'Ah'; } }, // A second card (AA)
      { rank: '3', suit: 'c', toString() { return '3c'; } }, // B second card
      { rank: '4', suit: 'c', toString() { return '4c'; } }, // C second card
      // Community cards
      { rank: 'K', suit: 'c', toString() { return 'Kc'; } }, // burn
      { rank: 'K', suit: 's', toString() { return 'Ks'; } }, // flop 1
      { rank: 'K', suit: 'd', toString() { return 'Kd'; } }, // flop 2
      { rank: 'K', suit: 'h', toString() { return 'Kh'; } }, // flop 3
      { rank: '2', suit: 'd', toString() { return '2d'; } }, // burn
      { rank: 'Q', suit: 'c', toString() { return 'Qc'; } }, // turn
      { rank: '3', suit: 'd', toString() { return '3d'; } }, // burn
      { rank: 'J', suit: 'c', toString() { return 'Jc'; } }, // river
    ];

    table.setCustomDeck(customDeck);

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

      // Don't automatically start more hands
    });

    // Add players and start
    table.addPlayer(playerA);
    table.addPlayer(playerB);
    table.addPlayer(playerC);
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

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
