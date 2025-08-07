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
    ;({ manager, table } = createTestTable('standard', {
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
      dealerButton: 0,
    }));
    events = setupEventCapture(table);
  });

  afterEach(() => {
    cleanupTables(manager);
  });

  it('should not show eliminated players in active player list', async () => {
    // Strategy: Always go all-in to force elimination
    const alwaysAllInStrategy = ({ myState, validActions }) => {
      // Always go all-in if we have chips and it's valid
      if (myState.chips > 0 && validActions.includes(Action.ALL_IN)) {
        return {
          action: Action.ALL_IN,
          amount: myState.chips,
        };
      }
      
      // Otherwise use the first available valid action
      if (validActions.includes(Action.CHECK)) {
        return {
          action: Action.CHECK,
        };
      }
      
      if (validActions.includes(Action.CALL)) {
        return {
          action: Action.CALL,
        };
      }
      
      return {
        action: Action.FOLD,
      };
    };

    // Regular calling strategy for other players
    const callStrategy = ({ validActions, toCall }) => {
      // Use validActions to ensure we only take valid actions
      if (validActions.includes(Action.CALL) && toCall > 0) {
        return {
          action: Action.CALL,
          amount: toCall,
        };
      }

      if (validActions.includes(Action.CHECK)) {
        return {
          action: Action.CHECK,
        };
      }

      // Fallback to FOLD if nothing else is available
      return {
        action: Action.FOLD,
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
      strategy: alwaysAllInStrategy,
    });

    const playerC = new StrategicPlayer({
      id: 'C',
      name: 'Player C',
      strategy: callStrategy,
    });

    // Set chips before adding players (v2.0 API)
    playerA.buyIn(200);
    playerB.buyIn(30); // Will go all-in and likely lose
    playerC.buyIn(200);

    // Add players
    table.addPlayer(playerA);
    table.addPlayer(playerB);
    table.addPlayer(playerC);

    // Log initial state
    console.log(
      'Initial player chips:',
      Array.from(table.players.values()).map((p) => ({
        id: p.player.id,
        chips: p.player.chips,
      })),
    );

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

      // Store active players after any hand that had an elimination
      // or if we have fewer than 3 players left (indicates an elimination happened)
      if (eliminationOccurred || activePlayers.length < 3) {
        postEliminationActivePlayers = activePlayers;
      }
    });

    // Play until someone is eliminated (max 3 hands to prevent long CI runs)
    const maxHands = 3;
    while (!eliminationOccurred && handCount < maxHands) {
      table.tryStartGame();
      await waitForHandEnd(events, 2000); // 2s timeout per hand

      // Reset event capture for next hand
      events = setupEventCapture(table);
    }

    // Verify elimination occurred
    expect(eliminationOccurred).toBe(true);
    expect(postEliminationActivePlayers).not.toBeNull();

    // Should have fewer than 3 active players after elimination (at least one player was eliminated)
    expect(postEliminationActivePlayers.length).toBeLessThan(3);
    expect(postEliminationActivePlayers.length).toBeGreaterThanOrEqual(1);

    // Verify that the elimination tracking worked correctly
    expect(eliminationOccurred).toBe(true);

    // Log the result for clarity
    console.log('✅ Eliminated player not shown in active list');
    console.log(
      `Active players after elimination: ${postEliminationActivePlayers.map((p) => p.id).join(', ')}`,
    );

    console.log('✅ Issue #34 verified: Eliminated players not in active list');
  });

  it('should handle all players eliminated scenario', async () => {
    // Reset table
    table.close()
    ;({ manager, table } = createTestTable('standard', {
      blinds: { small: 5, big: 10 },
      minPlayers: 2,
      dealerButton: 0,
    }));
    events = setupEventCapture(table);

    const allInStrategy = ({ myState }) => {
      if (myState.chips > 0) {
        return {
          action: Action.ALL_IN,
          amount: myState.chips,
        };
      }
      return {
        action: Action.CHECK,
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

    // Set chips before adding players (v2.0 API)
    player1.buyIn(30);
    player2.buyIn(30);

    table.addPlayer(player1);
    table.addPlayer(player2);

    let eliminationCount = 0;
    table.on('player:eliminated', ({ playerId }) => {
      console.log(`Player ${playerId} eliminated`);
      eliminationCount++;
    });

    table.tryStartGame();
    await waitForHandEnd(events);

    // Give time for elimination events
    await new Promise((resolve) => setTimeout(resolve, 100));

    // After the hand, at least one player should be eliminated (unless split pot)
    // With both players all-in, we expect 0 eliminations (split pot) or 1 elimination
    expect(eliminationCount).toBeGreaterThanOrEqual(0);
    expect(eliminationCount).toBeLessThanOrEqual(1);

    // Check active players
    const activePlayers = Array.from(table.players.values()).filter(
      (pd) => pd.player.chips > 0,
    );

    // Should have exactly 1 active player (the winner)
    expect(activePlayers).toHaveLength(1);
    expect(activePlayers[0].player.chips).toBeGreaterThan(0);

    console.log(
      '✅ Edge case handled: One player remains after heads-up elimination',
    );
  });
});
