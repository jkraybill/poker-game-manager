import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  StrategicPlayer,
  cleanupTables,
  waitForHandEnd,
  Action,
} from '../test-utils/index.js';

/**
 * Test for Issue #34 - Eliminated players shown in active standings
 */

describe('Eliminated Player Display (v2)', () => {
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
    // Strategy: Player B goes all-in on first action when facing a bet
    const allInOnceStrategy = (() => {
      let hasGoneAllIn = false;
      return (gameState, playerId) => {
        const myState = gameState.players[playerId];
        const toCall = gameState.currentBet - myState.bet;

        // Go all-in on first action when facing a bet
        if (!hasGoneAllIn && toCall > 0) {
          hasGoneAllIn = true;
          return {
            playerId,
            action: Action.ALL_IN,
            amount: myState.chips,
            timestamp: Date.now(),
          };
        }

        if (toCall > 0) {
          return {
            playerId,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          };
        }

        return {
          playerId,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      };
    })();

    // Regular calling strategy for other players
    const callStrategy = (gameState, playerId) => {
      const myState = gameState.players[playerId];
      const toCall = gameState.currentBet - myState.bet;

      if (toCall > 0) {
        return {
          playerId,
          action: Action.CALL,
          amount: toCall,
          timestamp: Date.now(),
        };
      }

      return {
        playerId,
        action: Action.CHECK,
        timestamp: Date.now(),
      };
    };

    const playerA = new StrategicPlayer({
      id: 'A',
      name: 'Player A',
      strategy: callStrategy,
    });

    const playerB = new StrategicPlayer({
      id: 'B',
      name: 'Player B (will lose)',
      strategy: allInOnceStrategy,
    });

    const playerC = new StrategicPlayer({
      id: 'C',
      name: 'Player C',
      strategy: callStrategy,
    });

    // Add players
    table.addPlayer(playerA);
    table.addPlayer(playerB);
    table.addPlayer(playerC);

    // Give player B very few chips so they'll lose
    const playerBData = Array.from(table.players.values()).find(p => p.player.id === 'B');
    if (playerBData) {
      playerBData.chips = 30; // Will go all-in and likely lose
    }

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

      console.log(`Hand ${handCount} ended, active players:`, activePlayers);

      if (eliminationOccurred) {
        postEliminationActivePlayers = activePlayers;
      }
    });

    // Play until someone is eliminated
    const maxHands = 10;
    while (!eliminationOccurred && handCount < maxHands) {
      table.tryStartGame();
      await waitForHandEnd(events);
      
      // Reset event capture for next hand
      events = setupEventCapture(table);
    }

    // Verify elimination occurred
    expect(eliminationOccurred).toBe(true);
    expect(postEliminationActivePlayers).not.toBeNull();

    // Should have 2 active players after elimination
    expect(postEliminationActivePlayers.length).toBe(2);

    // Player B should not be in active list
    const playerBInActive = postEliminationActivePlayers.find((p) => p.id === 'B');
    expect(playerBInActive).toBeUndefined();

    // Players A and C should still be active
    const playerAActive = postEliminationActivePlayers.find((p) => p.id === 'A');
    const playerCActive = postEliminationActivePlayers.find((p) => p.id === 'C');
    expect(playerAActive).toBeDefined();
    expect(playerCActive).toBeDefined();
    expect(playerAActive.chips).toBeGreaterThan(0);
    expect(playerCActive.chips).toBeGreaterThan(0);

    console.log('✅ Issue #34 verified: Eliminated players not in active list');
  });

  it('should handle all players eliminated scenario', async () => {
    // Reset table
    table.close();
    ({ manager, table } = createTestTable('standard', {
      blinds: { small: 5, big: 10 },
      minBuyIn: 30,
      maxBuyIn: 100,
      minPlayers: 2,
      dealerButton: 0,
    }));
    events = setupEventCapture(table);

    const allInStrategy = (gameState, playerId) => {
      const myState = gameState.players[playerId];
      if (myState.chips > 0) {
        return {
          playerId,
          action: Action.ALL_IN,
          amount: myState.chips,
          timestamp: Date.now(),
        };
      }
      return {
        playerId,
        action: Action.CHECK,
        timestamp: Date.now(),
      };
    };

    const player1 = new StrategicPlayer({
      id: 'p1',
      name: 'Player 1',
      strategy: allInStrategy,
    });

    const player2 = new StrategicPlayer({
      id: 'p2',
      name: 'Player 2',
      strategy: allInStrategy,
    });

    table.addPlayer(player1);
    table.addPlayer(player2);

    // Set very small stacks to force elimination
    const p1Data = Array.from(table.players.values()).find(p => p.player.id === 'p1');
    const p2Data = Array.from(table.players.values()).find(p => p.player.id === 'p2');
    
    if (p1Data) {
p1Data.chips = 30;
}
    if (p2Data) {
p2Data.chips = 30;
}

    let eliminationCount = 0;
    table.on('player:eliminated', ({ playerId }) => {
      console.log(`Player ${playerId} eliminated`);
      eliminationCount++;
    });

    table.tryStartGame();
    await waitForHandEnd(events);

    // Give time for elimination events
    await new Promise(resolve => setTimeout(resolve, 100));

    // After the hand, exactly one player should be eliminated (the loser)
    expect(eliminationCount).toBe(1);

    // Check active players
    const activePlayers = Array.from(table.players.values())
      .filter((pd) => pd.player.chips > 0);

    // Should have exactly 1 active player (the winner)
    expect(activePlayers).toHaveLength(1);
    expect(activePlayers[0].player.chips).toBeGreaterThan(0);

    console.log('✅ Edge case handled: One player remains after heads-up elimination');
  });
});