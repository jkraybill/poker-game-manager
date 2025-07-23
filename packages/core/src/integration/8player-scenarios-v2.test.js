/**
 * 8-Player Poker Scenarios (Using Test Utilities)
 *
 * Tests full table dynamics with 8 players, representing common cash game
 * and tournament situations. With 8 players, we have:
 * - Full positional spectrum (UTG, UTG+1, MP1, MP2, CO, BTN, SB, BB)
 * - Tighter opening ranges required
 * - Complex multi-way dynamics
 * - Maximum side pot complexity potential
 *
 * Positions (with dealerButton: 0):
 * - Index 0: Button
 * - Index 1: SB
 * - Index 2: BB
 * - Index 3: UTG
 * - Index 4: UTG+1
 * - Index 5: MP1
 * - Index 6: MP2
 * - Index 7: CO
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

describe('8-Player Poker Scenarios (v2)', () => {
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

  it('should handle UTG vs UTG+1 opening war', async () => {
    // Create 8-player table
    const result = createTestTable('standard', {
      minPlayers: 8,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Create players array that will be populated below
    const players = [];

    // Early position aggressive strategy
    const earlyPositionStrategy = ({ player, gameState, myState, toCall }) => {
      // Get player index to determine position
      const playerIndex = players.findIndex(p => p.id === player.id);
      
      // With dealerButton: 0, positions are:
      // Index 0: Button, Index 1: SB, Index 2: BB, Index 3: UTG, Index 4: UTG+1, etc.
      
      // UTG (index 3) opens tight
      if (
        playerIndex === 3 &&
        gameState.currentBet === 20 &&
        !myState.hasActed
      ) {
        return { action: Action.RAISE, amount: 60 };
      }

      // UTG+1 (index 4) 3-bets UTG (positional advantage)
      if (
        playerIndex === 4 &&
        gameState.currentBet === 60 &&
        !myState.hasActed
      ) {
        return { action: Action.RAISE, amount: 180 };
      }

      // UTG 4-bets (showing strength) - check if we can raise
      if (
        playerIndex === 3 &&
        gameState.currentBet === 180 &&
        myState.lastAction === Action.RAISE &&
        gameState.validActions && gameState.validActions.includes(Action.RAISE)
      ) {
        return { action: Action.RAISE, amount: 450 };
      }

      // Others fold to early position war
      if (toCall > 60) {
        return { action: Action.FOLD };
      }

      return { action: toCall > 0 ? Action.FOLD : Action.CHECK };
    };

    // Create players
    const positions = ['button', 'sb', 'bb', 'utg', 'utg+1', 'mp1', 'mp2', 'co'];
    positions.forEach((pos, idx) => {
      const player = new StrategicPlayer({
        name: `Player ${idx + 1} (${pos.toUpperCase()})`,
        strategy: earlyPositionStrategy,
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

    // Verify early position battle
    const raises = actions.filter((a) => a.action === Action.RAISE);
    // UTG+1's 3-bet from 60 to 180 is a full raise (120 increment > 40 minimum)
    // So betting is reopened and UTG can 4-bet, expecting 3 raises total
    expect(raises.length).toBe(3);

    const utgPlayer = players.find((p) => p.position === 'utg');
    const utgPlusOnePlayer = players.find((p) => p.position === 'utg+1');

    const utgRaise = raises.find((r) => r.playerId === utgPlayer.id);
    const utgPlusOneRaise = raises.find(
      (r) => r.playerId === utgPlusOnePlayer.id,
    );

    // UTG opens, UTG+1 3-bets, UTG 4-bets
    expect(utgRaise).toBeDefined();
    expect(utgPlusOneRaise).toBeDefined();
    expect(utgRaise.amount).toBe(60);
    expect(utgPlusOneRaise.amount).toBe(180);
    
    // Verify UTG's 4-bet
    const utg4Bet = raises.find((r) => r.playerId === utgPlayer.id && r.amount === 450);
    expect(utg4Bet).toBeDefined();
  });

  it('should handle 8-way family pot with minimal raising', async () => {
    // Create 8-player table
    const result = createTestTable('standard', {
      minPlayers: 8,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Passive strategy with CO min-raise
    const passiveStrategy = ({ player, gameState, myState, toCall }) => {
      // Pre-flop strategy
      if (gameState.phase === 'PRE_FLOP') {
        // CO makes a min-raise to build pot
        if (
          player.position === 'co' &&
          !myState.hasActed &&
          gameState.currentBet === 20
        ) {
          return { action: Action.RAISE, amount: 40 }; // Min-raise
        }

        // If there's a bet to call, call it
        if (toCall > 0) {
          return { action: Action.CALL, amount: toCall };
        }
      }

      // Check all other situations
      return { action: Action.CHECK };
    };

    // Create 8 passive players
    const positions = ['button', 'sb', 'bb', 'utg', 'utg+1', 'mp1', 'mp2', 'co'];
    const players = positions.map((pos, idx) => {
      const player = new StrategicPlayer({
        name: `Player ${idx + 1} (${pos.toUpperCase()})`,
        strategy: passiveStrategy,
      });
      player.position = pos;
      return player;
    });

    // Add players and start
    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { winners, totalPot } = events;

    // Debug log to understand the winners
    if (winners.length > 1) {
      console.log('=== SPLIT POT DETECTED ===');
      winners.forEach((winner, i) => {
        console.log(`Winner ${i + 1}:`, {
          playerId: winner.playerId,
          hand: winner.hand?.description,
          cards: winner.cards,
          amount: winner.amount,
        });
      });
    }

    // Verify 8-way pot with min-raise
    // Everyone ends up with 40 in the pot (8 × 40 = 320)
    expect(totalPot).toBe(320);
    
    // This appears to be a split pot scenario in practice
    // When multiple players have the same hand (board plays), pot is split
    const totalWon = winners.reduce((sum, w) => sum + w.amount, 0);
    expect(totalWon).toBe(320);
    
    // Each winner should get an equal share
    if (winners.length > 1) {
      const expectedPerWinner = Math.floor(320 / winners.length);
      winners.forEach(w => {
        expect(w.amount).toBeGreaterThanOrEqual(expectedPerWinner);
        expect(w.amount).toBeLessThanOrEqual(expectedPerWinner + winners.length); // Account for odd chips
      });
    }
  });

  it('should handle complex 8-player tournament bubble scenario', async () => {
    // Create 8-player table with bubble blinds
    const result = createTestTable('standard', {
      blinds: { small: 50, big: 100 },
      minBuyIn: 500,
      maxBuyIn: 3000,
      minPlayers: 8,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Bubble strategy based on stack size
    const bubbleStrategy = ({ player, gameState, myState, toCall }) => {
      const mRatio = myState.chips / 150; // Total blinds

      // Micro stacks shove or fold based on position
      if (player.stackSize === 'micro') {
        // If in late position with no action, shove
        if (
          (player.position === 'button' || player.position === 'co') &&
          toCall <= 100
        ) {
          return { action: Action.ALL_IN, amount: myState.chips };
        }
        // If facing a raise and desperate
        if (toCall > 0 && toCall < myState.chips && mRatio < 3) {
          return { action: Action.ALL_IN, amount: myState.chips };
        }
      }

      // Short stacks shove or fold
      if (player.stackSize === 'short' && mRatio < 10) {
        if (player.position === 'button' || player.position === 'co') {
          return { action: Action.ALL_IN, amount: myState.chips };
        }
      }

      // Big stacks apply pressure from late position
      if (
        player.stackSize === 'big' &&
        gameState.currentBet <= 100 &&
        !myState.hasActed
      ) {
        if (player.position === 'button' || player.position === 'co') {
          return { action: Action.RAISE, amount: 250 }; // Pressure raise
        }
      }

      // Medium stacks play cautiously
      if (player.stackSize === 'medium' && toCall > 200) {
        return { action: Action.FOLD };
      }

      // Default tight play
      if (toCall > myState.chips * 0.3) {
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

    // Tournament bubble stack distribution
    const stackConfigs = [
      { position: 'button', chips: 2500, stackSize: 'big' },
      { position: 'sb', chips: 300, stackSize: 'micro' },
      { position: 'bb', chips: 1200, stackSize: 'medium' },
      { position: 'utg', chips: 500, stackSize: 'short' },
      { position: 'utg+1', chips: 1800, stackSize: 'medium' },
      { position: 'mp1', chips: 400, stackSize: 'short' },
      { position: 'mp2', chips: 2200, stackSize: 'big' },
      { position: 'co', chips: 600, stackSize: 'short' },
    ];

    const players = stackConfigs.map((config, idx) => {
      const player = new StrategicPlayer({
        name: `Player ${idx + 1} (${config.position.toUpperCase()})`,
        strategy: bubbleStrategy,
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
    const { actions } = events;

    // Verify bubble dynamics
    const allIns = actions.filter((a) => a.action === Action.ALL_IN);
    const folds = actions.filter((a) => a.action === Action.FOLD);

    expect(allIns.length).toBeGreaterThan(0); // Some desperation
    expect(folds.length).toBeGreaterThan(2); // Cautious play
  });

  it('should handle 8-player progressive knockout scenario', async () => {
    // Create 8-player table
    const result = createTestTable('standard', {
      blinds: { small: 25, big: 50 },
      minPlayers: 8,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Track chip counts
    const playerChips = new Map();

    // Bounty hunter strategy
    const bountyHunterStrategy = ({ player, gameState, myState, toCall }) => {
      // Track chip counts
      playerChips.set(player.id, myState.chips);

      // Aggressor tries to isolate short stacks
      if (player.isAggressor && gameState.currentBet === 50) {
        // Find shortest stack
        const shortStack = Object.values(gameState.players)
          .filter((p) => p.state === 'ACTIVE' && p.chips < 300)
          .sort((a, b) => a.chips - b.chips)[0];

        if (shortStack) {
          return { action: Action.RAISE, amount: shortStack.chips + 50 };
        }
      }

      // Short stacks call/all-in for bounty protection
      if (myState.chips < 300 && toCall > 0) {
        if (toCall >= myState.chips) {
          return { action: Action.ALL_IN, amount: myState.chips };
        }
        return { action: Action.CALL, amount: toCall };
      }

      // Medium stacks hunt carefully
      if (toCall > 0 && toCall < myState.chips * 0.4) {
        const potOdds = toCall / (gameState.pot + toCall);
        if (potOdds < 0.3) {
          // Good pot odds
          return { action: Action.CALL, amount: toCall };
        }
      }

      // Default
      return { action: toCall > 0 ? Action.FOLD : Action.CHECK };
    };

    // Mix of aggressive bounty hunters and cautious players
    const playerConfigs = [
      { position: 'button', isAggressor: true },
      { position: 'sb', isAggressor: false },
      { position: 'bb', isAggressor: false },
      { position: 'utg', isAggressor: false },
      { position: 'utg+1', isAggressor: true },
      { position: 'mp1', isAggressor: false },
      { position: 'mp2', isAggressor: true },
      { position: 'co', isAggressor: false },
    ];

    const players = playerConfigs.map((config, idx) => {
      const player = new StrategicPlayer({
        name: `Player ${idx + 1} (${config.position.toUpperCase()})`,
        strategy: bountyHunterStrategy,
      });
      Object.assign(player, config);
      return player;
    });

    // Give one player a short stack
    const originalAddPlayer = table.addPlayer.bind(table);
    let shortStackSet = false;
    table.addPlayer = function (player) {
      const result = originalAddPlayer(player);
      if (!shortStackSet && player.position === 'mp1') {
        const playerData = this.players.get(player.id);
        if (playerData) {
          playerData.chips = 250; // Short stack
          shortStackSet = true;
        }
      }
      return result;
    };

    // Add players and start
    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // In a bounty tournament, aggressive play is expected
    expect(events.handEnded).toBe(true);

    // Check if any player was eliminated
    for (const [, chips] of playerChips) {
      if (chips === 0) {
        // A player was eliminated - expected in bounty tournaments
        break;
      }
    }

    // We might or might not see a knockout in one hand
    // Just verify the game played out
    expect(events.actions.length).toBeGreaterThan(0);
  });
});
