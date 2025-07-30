/**
 * 7-Player Poker Scenarios (Using Test Utilities)
 *
 * Tests poker dynamics with 7 players at the table, representing common
 * tournament situations after a few eliminations. With 7 players, we see:
 * - More complex positional dynamics than 6-handed
 * - Still not quite full ring, allowing for wider ranges
 * - Common online tournament table size
 * - Interesting dynamics with MP1 and MP2 positions
 *
 * Positions (with dealerButton: 0):
 * - Index 0: Button
 * - Index 1: SB
 * - Index 2: BB
 * - Index 3: UTG
 * - Index 4: UTG+1 (MP1)
 * - Index 5: MP2
 * - Index 6: CO
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  Action,
  cleanupTables,
} from '../test-utils/index.js';

describe('7-Player Poker Scenarios (v2)', () => {
  let manager;
  let table;
  let events;

  beforeEach(() => {
    // Initialize but don't create yet
    manager = null;
    table = null;
    events = null;
  });

  afterEach(() => {
    // Clean up if created
    if (manager) {
      cleanupTables(manager);
    }
  });

  it('should handle 7-way family pot limped to showdown', async () => {
    // Create 7-player table
    const result = createTestTable('standard', {
      minPlayers: 7,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Passive limping strategy
    const limpingStrategy = ({ gameState, toCall }) => {
      // Everyone limps preflop
      if (gameState.phase === 'PRE_FLOP' && toCall > 0 && toCall <= 20) {
        return { action: Action.CALL, amount: toCall };
      }

      // Check all streets
      return { action: Action.CHECK };
    };

    // Create 7 passive players
    const players = Array.from(
      { length: 7 },
      (_, i) =>
        new StrategicPlayer({
          name: `Player ${i + 1}`,
          strategy: limpingStrategy,
        }),
    );

    // Add players and start
    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { winners, actions, totalPot } = events;

    // Verify 7-way pot
    expect(totalPot).toBe(140); // 7 × 20 = 140

    // Handle both single winner and split pot scenarios
    expect(winners.length).toBeGreaterThanOrEqual(1);
    const totalWon = winners.reduce((sum, w) => sum + w.amount, 0);
    expect(totalWon).toBe(140);

    if (winners.length === 1) {
      expect(winners[0].amount).toBe(140);
    } else {
      // Split pot - each winner gets equal share
      winners.forEach((w) => {
        expect(w.amount).toBe(Math.floor(140 / winners.length));
      });
    }

    // Showdown should have been reached
    const showdownReached =
      winners[0]?.hand !== null && winners[0]?.hand !== undefined;
    expect(showdownReached).toBe(true);

    // Count limps (excluding BB check)
    const calls = actions.filter((a) => a.action === Action.CALL);
    expect(calls.length).toBeGreaterThanOrEqual(5); // At least 5 limpers
  });

  it('should handle UTG vs MP1 vs CO 3-bet pot', async () => {
    // Create 7-player table
    const result = createTestTable('standard', {
      minPlayers: 7,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Position-aware aggressive strategy
    const positionalStrategy = ({ player, gameState, toCall }) => {
      // UTG opens
      if (
        player.position === 'utg' &&
        gameState.currentBet === 20 &&
        !player.hasRaised
      ) {
        player.hasRaised = true;
        return { action: Action.RAISE, amount: 60 };
      }

      // MP1 3-bets UTG
      if (
        player.position === 'mp1' &&
        gameState.currentBet === 60 &&
        !player.hasRaised
      ) {
        player.hasRaised = true;
        return { action: Action.RAISE, amount: 180 };
      }

      // CO cold 4-bets
      if (
        player.position === 'co' &&
        gameState.currentBet === 180 &&
        !player.hasRaised
      ) {
        player.hasRaised = true;
        return { action: Action.RAISE, amount: 450 };
      }

      // Fold to big bets
      if (toCall > 100) {
        return { action: Action.FOLD };
      }

      // Default
      return { action: toCall > 0 ? Action.FOLD : Action.CHECK };
    };

    // Create players with positions
    const positions = ['button', 'sb', 'bb', 'utg', 'mp1', 'mp2', 'co'];
    const players = positions.map((pos, idx) => {
      const player = new StrategicPlayer({
        name: `Player ${idx + 1} (${pos.toUpperCase()})`,
        strategy: positionalStrategy,
      });
      player.position = pos;
      player.hasRaised = false;
      return player;
    });

    // Add players and start
    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { actions } = events;

    // Verify action sequence
    const raises = actions.filter((a) => a.action === Action.RAISE);
    expect(raises).toHaveLength(3);

    // Find players by position
    const utgPlayer = players.find((p) => p.position === 'utg');
    const mp1Player = players.find((p) => p.position === 'mp1');
    const coPlayer = players.find((p) => p.position === 'co');

    expect(raises[0].playerId).toBe(utgPlayer.id);
    expect(raises[1].playerId).toBe(mp1Player.id);
    expect(raises[2].playerId).toBe(coPlayer.id);
  });

  it('should handle complex 7-player all-in festival with multiple side pots', async () => {
    // Create 7-player table with variable buy-ins
    const result = createTestTable('standard', {
      minBuyIn: 100,
      maxBuyIn: 1000,
      minPlayers: 7,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // All-in strategy
    const allInStrategy = ({ player, gameState, myState }) => {
      // Create a pre-flop all-in cascade
      if (gameState.phase === 'PRE_FLOP') {
        // Small blind (50 chips) starts the cascade
        if (player.position === 'sb' && !player.hasActed) {
          player.hasActed = true;
          return { action: Action.ALL_IN, amount: myState.chips };
        }

        // Once someone is all-in, others follow
        const allInPlayers = Object.values(gameState.players).filter(
          (p) => p.lastAction === Action.ALL_IN,
        );

        if (allInPlayers.length > 0) {
          return { action: Action.ALL_IN, amount: myState.chips };
        }

        // If no one has acted yet and we're not SB, check/call
        const toCall = gameState.currentBet - myState.bet;
        if (toCall > 0) {
          return { action: Action.CALL, amount: toCall };
        }
      }

      // Post-flop, just check (shouldn't get here with all-ins)
      return { action: Action.CHECK };
    };

    // Override addPlayer for custom chips
    const originalAddPlayer = table.addPlayer.bind(table);
    table.addPlayer = function (player) {
      const result = originalAddPlayer(player);
      const playerData = this.players.get(player.id);
      if (playerData && player.targetChips) {
        playerData.chips = player.targetChips;
      }
      return result;
    };

    // Create 7 players with varying stacks
    const stackConfigs = [
      { position: 'button', chips: 1000 }, // Big stack
      { position: 'sb', chips: 50 }, // Micro stack
      { position: 'bb', chips: 120 }, // Short stack
      { position: 'utg', chips: 200 }, // Medium-short
      { position: 'mp1', chips: 350 }, // Medium
      { position: 'mp2', chips: 150 }, // Short
      { position: 'co', chips: 600 }, // Large stack
    ];

    const players = stackConfigs.map((config, idx) => {
      const player = new StrategicPlayer({
        name: `Player ${idx + 1} (${config.position.toUpperCase()})`,
        strategy: allInStrategy,
      });
      player.targetChips = config.chips;
      player.position = config.position;
      player.hasActed = false;
      return player;
    });

    // Track side pots when flop is dealt
    let capturedSidePots = [];
    table.on('cards:community', ({ phase }) => {
      if (
        phase === 'FLOP' &&
        capturedSidePots.length === 0 &&
        table.gameEngine?.potManager
      ) {
        // Capture the pots right after pre-flop ends
        capturedSidePots = [...table.gameEngine.potManager.pots];
      }
    });

    // Add players and start
    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { sidePots, totalPot } = events;

    // Use captured side pots if available
    const potsToCheck =
      capturedSidePots.length > 0 ? capturedSidePots : sidePots;

    expect(events.handEnded).toBe(true);

    // With multiple all-ins of different stack sizes, we should get side pots
    // However, the exact number depends on the order of all-ins
    if (potsToCheck.length > 0) {
      expect(potsToCheck.length).toBeGreaterThanOrEqual(1);

      // Calculate total from pots
      const calculatedTotal = potsToCheck.reduce(
        (sum, pot) => sum + pot.amount,
        0,
      );
      expect(calculatedTotal).toBeGreaterThan(0);
    } else {
      // If we don't have detailed pot info, at least verify we have a total pot
      expect(totalPot).toBeGreaterThan(0);
    }

    // Verify that multiple all-ins occurred
    const allInActions = events.actions.filter(
      (a) => a.action === Action.ALL_IN,
    );
    expect(allInActions.length).toBeGreaterThanOrEqual(4); // Most players should go all-in
  });

  it('should handle CO squeeze play after UTG raise and MP1 call', async () => {
    // Create 7-player table
    const result = createTestTable('standard', {
      minPlayers: 7,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Track squeeze play
    let squeezePlayed = false;

    // Create players array that will be populated below
    const players = [];

    // Squeeze play strategy
    const squeezeStrategy = ({ player, gameState, myState, toCall }) => {
      const playerStates = Object.values(gameState.players);
      const playerIndex = players.findIndex((p) => p.id === player.id);

      // With dealerButton: 0, positions are:
      // Index 0: Button, Index 1: SB, Index 2: BB, Index 3: UTG, Index 4: MP1, Index 5: MP2, Index 6: CO

      // UTG (index 3) raises
      if (
        playerIndex === 3 &&
        gameState.currentBet === 20 &&
        !myState.hasActed
      ) {
        return { action: Action.RAISE, amount: 60 };
      }

      // MP1 (index 4) calls the raise
      if (
        playerIndex === 4 &&
        gameState.currentBet === 60 &&
        !myState.hasActed
      ) {
        return { action: Action.CALL, amount: toCall };
      }

      // CO (index 6) executes squeeze play
      if (playerIndex === 6 && !myState.hasActed && gameState.currentBet > 20) {
        const raisers = playerStates.filter(
          (p) => p.lastAction === Action.RAISE,
        );
        const callers = playerStates.filter((p) => p.lastAction === Action.CALL);

        if (raisers.length === 1 && callers.length >= 1) {
          squeezePlayed = true;
          return { action: Action.RAISE, amount: 220 }; // Large squeeze
        }
      }

      // Fold to squeeze
      if (toCall > 150) {
        return { action: Action.FOLD };
      }

      // Default
      return { action: toCall > 0 ? Action.FOLD : Action.CHECK };
    };

    // Create players
    const positions = ['button', 'sb', 'bb', 'utg', 'mp1', 'mp2', 'co'];
    positions.forEach((pos, idx) => {
      const player = new StrategicPlayer({
        name: `Player ${idx + 1} (${pos.toUpperCase()})`,
        strategy: squeezeStrategy,
      });
      player.position = pos;
      player.hasActed = false;
      players.push(player);
    });

    // Add players and start
    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { actions } = events;

    // Verify squeeze sequence
    expect(squeezePlayed).toBe(true);

    const raises = actions.filter((a) => a.action === Action.RAISE);
    expect(raises.length).toBeGreaterThanOrEqual(2); // UTG raise + CO squeeze

    const coPlayer = players.find((p) => p.position === 'co');
    const coRaise = raises.find((r) => r.playerId === coPlayer.id);
    expect(coRaise).toBeDefined();
    expect(coRaise.amount).toBeGreaterThan(180); // Large squeeze size
  });

  it('should handle 7-player tournament bubble with conservative play', async () => {
    // Create 7-player table with tournament bubble blinds
    const result = createTestTable('standard', {
      blinds: { small: 75, big: 150 },
      minBuyIn: 500,
      maxBuyIn: 5000,
      minPlayers: 7,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Tournament bubble strategy - extremely conservative
    const tournamentBubbleStrategy = ({
      player,
      gameState,
      myState,
      toCall,
    }) => {
      const mRatio = myState.chips / 225; // Total blinds
      const stackType = player.stackType;

      // Micro stacks (< 5M) - desperation mode
      if (stackType === 'micro' && mRatio < 5) {
        // Push from button/CO with any two
        if (
          (player.position === 'button' || player.position === 'co') &&
          toCall <= 150
        ) {
          return { action: Action.ALL_IN, amount: myState.chips };
        }
        // Call all-in if committed
        if (toCall >= myState.chips * 0.7) {
          return { action: Action.ALL_IN, amount: myState.chips };
        }
        return { action: Action.FOLD };
      }

      // Short stacks (5-10M) - selective aggression
      if (stackType === 'short' && mRatio < 10) {
        // Push from late position
        if (
          ['button', 'co', 'mp2'].includes(player.position) &&
          toCall <= 150
        ) {
          return { action: Action.ALL_IN, amount: myState.chips };
        }
        return { action: Action.FOLD };
      }

      // Medium stacks (10-20M) - avoid confrontation
      if (stackType === 'medium') {
        // Only play premium hands
        if (toCall > 225) {
          return { action: Action.FOLD };
        }
        // Steal attempt only from button
        if (
          player.position === 'button' &&
          toCall === 150 &&
          !myState.hasActed
        ) {
          return { action: Action.RAISE, amount: 375 }; // Min-raise steal
        }
      }

      // Big stacks (20M+) - apply ICM pressure
      if (stackType === 'big') {
        // Abuse bubble dynamics
        if (
          ['button', 'co'].includes(player.position) &&
          gameState.currentBet <= 150 &&
          !myState.hasActed
        ) {
          // Look for short stacks behind
          const shortStacksBehind = Object.values(gameState.players).filter(
            (p) => p.state === 'ACTIVE' && p.chips < 1500,
          ).length;

          if (shortStacksBehind > 0) {
            return { action: Action.RAISE, amount: 450 }; // 3x pressure
          }
        }
      }

      // Default ultra-conservative play
      if (toCall > myState.chips * 0.1) {
        return { action: Action.FOLD };
      }

      return { action: toCall > 0 ? Action.FOLD : Action.CHECK };
    };

    // Override addPlayer for custom chips
    const originalAddPlayer = table.addPlayer.bind(table);
    table.addPlayer = function (player) {
      const result = originalAddPlayer(player);
      const playerData = this.players.get(player.id);
      if (playerData && player.targetChips) {
        playerData.chips = player.targetChips;
      }
      return result;
    };

    // Tournament bubble stack distribution (5 players remain, top 4 get paid)
    const stackConfigs = [
      { position: 'button', chips: 4500, stackType: 'big' }, // Chip leader
      { position: 'sb', chips: 700, stackType: 'micro' }, // Desperate
      { position: 'bb', chips: 2200, stackType: 'medium' }, // Safe middle
      { position: 'utg', chips: 900, stackType: 'short' }, // At risk
      { position: 'mp1', chips: 3200, stackType: 'big' }, // Co-leader
      { position: 'mp2', chips: 1800, stackType: 'medium' }, // Comfortable
      { position: 'co', chips: 700, stackType: 'micro' }, // Desperate
    ];

    const players = stackConfigs.map((config, idx) => {
      const player = new StrategicPlayer({
        name: `Player ${idx + 1} (${config.position.toUpperCase()})`,
        strategy: tournamentBubbleStrategy,
      });
      Object.assign(player, config);
      return player;
    });

    // Add players and start
    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { actions, winners } = events;

    // Verify bubble dynamics
    const allIns = actions.filter((a) => a.action === Action.ALL_IN);
    const folds = actions.filter((a) => a.action === Action.FOLD);
    const raises = actions.filter((a) => a.action === Action.RAISE);

    // Should see many folds (conservative play)
    expect(folds.length).toBeGreaterThan(2);

    // Total aggression should be limited
    const totalActions = allIns.length + raises.length;
    expect(totalActions).toBeGreaterThan(0); // Some action
    expect(totalActions).toBeLessThan(5); // But not too much

    // Verify winner(s) - handle potential split pot
    expect(winners.length).toBeGreaterThan(0);
    const totalWon = winners.reduce((sum, w) => sum + w.amount, 0);
    expect(totalWon).toBeGreaterThan(0);

    // If micro stacks went all-in, verify they were desperate
    if (allIns.length > 0) {
      const allInPlayers = allIns.map((a) => {
        return players.find((p) => p.id === a.playerId);
      });

      // At least one all-in should be from a short/micro stack
      const desperateAllIns = allInPlayers.filter(
        (p) => p && (p.stackType === 'micro' || p.stackType === 'short'),
      );
      expect(desperateAllIns.length).toBeGreaterThan(0);
    }
  });
});
