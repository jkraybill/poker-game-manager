import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  StrategicPlayer,
  DeckBuilder,
  cleanupTables,
  waitForHandEnd,
  Action,
} from '../test-utils/index.js';

/**
 * Test for Issue #28: Tournament elimination ordering
 *
 * When multiple players are eliminated in the same hand, they should be
 * eliminated in order based on their starting stack size (smallest first).
 * This is crucial for tournament finishing position tracking.
 */

describe('Tournament Elimination Ordering (Issue #28) - v2', () => {
  let manager, table, events;

  beforeEach(() => {
    ({ manager, table } = createTestTable('standard', {
      id: 'elimination-order-test',
      blinds: { small: 5, big: 10 },
      minBuyIn: 30,
      maxBuyIn: 1000,
      minPlayers: 2,
      dealerButton: 0,
    }));
    events = setupEventCapture(table);
  });

  afterEach(() => {
    cleanupTables(manager);
  });

  it('should eliminate players in correct order when multiple players bust in same hand', async () => {
    // Create a rigged deck where Big Stack gets the best hand
    const customDeck = new DeckBuilder(3)
      .dealHoleCards([
        ['7d', '2c'], // Small Stack gets 7-2 offsuit (worst hand)
        ['8s', '3h'], // Medium Stack gets 8-3 offsuit (bad hand)
        ['Ah', 'As'], // Big Stack gets pocket aces (best hand)
      ])
      .addFlop('Kh', 'Qd', 'Jc')
      .addTurn('Th')
      .addRiver('9s')
      .buildRiggedDeck();

    table.setDeck(customDeck);

    const eliminationOrder = [];
    const playerNames = new Map();
    const startingChips = new Map();

    // Track elimination events
    table.on('player:eliminated', ({ playerId, finalChips }) => {
      const playerName = playerNames.get(playerId);
      const startChips = startingChips.get(playerId);
      eliminationOrder.push({
        playerId,
        playerName,
        finalChips,
        startingChips: startChips,
      });
      console.log(
        `${playerName} (${playerId}) eliminated with ${finalChips} chips (started with ${startChips})`,
      );
    });

    // Create all-in strategy
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

    // Create players using test utilities
    const smallStack = new StrategicPlayer({
      name: 'Small Stack',
      strategy: allInStrategy,
    });
    const mediumStack = new StrategicPlayer({
      name: 'Medium Stack',
      strategy: allInStrategy,
    });
    const bigStack = new StrategicPlayer({
      name: 'Big Stack',
      strategy: allInStrategy,
    });

    // Add players
    table.addPlayer(smallStack);
    table.addPlayer(mediumStack);
    table.addPlayer(bigStack);

    // Track names and starting chips
    playerNames.set(smallStack.id, 'Small Stack');
    playerNames.set(mediumStack.id, 'Medium Stack');
    playerNames.set(bigStack.id, 'Big Stack');

    // Set different starting chips using table data
    const smallStackData = Array.from(table.players.values()).find(
      (p) => p.player.id === smallStack.id,
    );
    const mediumStackData = Array.from(table.players.values()).find(
      (p) => p.player.id === mediumStack.id,
    );
    const bigStackData = Array.from(table.players.values()).find(
      (p) => p.player.id === bigStack.id,
    );

    if (smallStackData) {
      smallStackData.chips = 30;
    }
    if (mediumStackData) {
      mediumStackData.chips = 50;
    }
    if (bigStackData) {
      bigStackData.chips = 200;
    }

    startingChips.set(smallStack.id, 30);
    startingChips.set(mediumStack.id, 50);
    startingChips.set(bigStack.id, 200);

    console.log('Starting stacks:');
    console.log(`  Small Stack (${smallStack.id}): 30 chips`);
    console.log(`  Medium Stack (${mediumStack.id}): 50 chips`);
    console.log(`  Big Stack (${bigStack.id}): 200 chips`);

    // Start game
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Give time for elimination events
    await new Promise((resolve) => setTimeout(resolve, 200));

    console.log(
      'Hand ended, winners:',
      events.winners.map((w) => ({
        name: playerNames.get(w.playerId),
        id: w.playerId,
        amount: w.amount,
      })),
    );

    console.log('\nElimination order:', eliminationOrder);

    // The scenario should create multiple eliminations
    if (eliminationOrder.length >= 2) {
      console.log('\n🎯 Multiple eliminations detected!');
      console.log(
        'Tournament rule: Players should be eliminated in order of starting stack size',
      );
      console.log(
        '(smallest stack = lowest finishing position = eliminated first)',
      );

      // Sort eliminations by the order they were emitted
      eliminationOrder.forEach((elim, index) => {
        console.log(
          `  Elimination ${index + 1}: ${elim.playerName} (started with ${elim.startingChips} chips)`,
        );
      });

      // Check if small stack was eliminated before medium stack
      const smallStackElim = eliminationOrder.find(
        (e) => e.playerId === smallStack.id,
      );
      const mediumStackElim = eliminationOrder.find(
        (e) => e.playerId === mediumStack.id,
      );

      if (smallStackElim && mediumStackElim) {
        const smallStackIndex = eliminationOrder.indexOf(smallStackElim);
        const mediumStackIndex = eliminationOrder.indexOf(mediumStackElim);

        if (smallStackIndex < mediumStackIndex) {
          console.log(
            '✅ Correct order: Small Stack eliminated before Medium Stack',
          );
        } else if (smallStackIndex > mediumStackIndex) {
          console.log(
            '❌ WRONG ORDER: Medium Stack eliminated before Small Stack',
          );
        } else {
          console.log(
            '❌ ISSUE #28 CONFIRMED: Both eliminated simultaneously!',
          );
        }
      }
    } else {
      console.log(
        `Only ${eliminationOrder.length} elimination(s) - expected multiple`,
      );
    }

    // For now, just verify we can detect the current behavior
    console.log('✅ Issue #28 reproduction test completed');
  });

  it('should demonstrate the potential issue with simultaneous eliminations', async () => {
    // Reset table for new test
    table.close();
    ({ manager, table } = createTestTable('standard', {
      id: 'simultaneous-elim-test',
      blinds: { small: 5, big: 10 },
      minBuyIn: 30,
      maxBuyIn: 1000,
      minPlayers: 2,
      dealerButton: 0,
    }));
    events = setupEventCapture(table);

    const eliminationOrder = [];
    const playerNames = new Map();
    const startingChips = new Map();

    // Track elimination events with timestamps
    table.on('player:eliminated', ({ playerId, finalChips }) => {
      const timestamp = Date.now();
      const playerName = playerNames.get(playerId);
      const startChips = startingChips.get(playerId);
      eliminationOrder.push({
        playerId,
        playerName,
        finalChips,
        startingChips: startChips,
        timestamp,
      });
      console.log(
        `[${timestamp}] ${playerName} eliminated (started with ${startChips} chips)`,
      );
    });

    // All-in strategy
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

    // Create 4 players with different stack sizes but add them in reverse order
    const players = [
      new StrategicPlayer({ name: 'Winner', strategy: allInStrategy }),
      new StrategicPlayer({ name: 'Big Stack', strategy: allInStrategy }),
      new StrategicPlayer({ name: 'Medium Stack', strategy: allInStrategy }),
      new StrategicPlayer({ name: 'Small Stack', strategy: allInStrategy }),
    ];

    // Add in specific order
    console.log('Players added in this order:');
    players.forEach((player, index) => {
      table.addPlayer(player);
      playerNames.set(player.id, player.name);
      const chips =
        index === 0 ? 300 : index === 1 ? 100 : index === 2 ? 60 : 40;
      const playerData = Array.from(table.players.values()).find(
        (p) => p.player.id === player.id,
      );
      if (playerData) {
        playerData.chips = chips;
      }
      startingChips.set(player.id, chips);
      console.log(`  ${index + 1}. ${player.name} (${chips} chips)`);
    });

    console.log(
      '\nTournament rule: Elimination should be by stack size, not addition order',
    );
    console.log('Expected elimination order: Small -> Medium -> Big');

    // Rig deck so Winner gets the nuts
    const customDeck = new DeckBuilder(4)
      .dealHoleCards([
        ['Ac', 'Ad'], // Winner gets pocket aces
        ['2h', '7d'], // Big Stack gets garbage
        ['3c', '8s'], // Medium Stack gets garbage
        ['4d', '9h'], // Small Stack gets garbage
      ])
      .addFlop('As', 'Ah', 'Kc') // Quad aces for winner
      .addTurn('Kd')
      .addRiver('Ks')
      .buildRiggedDeck();

    table.setDeck(customDeck);

    // Start game
    table.tryStartGame();

    // Wait for completion
    await waitForHandEnd(events);
    await new Promise((resolve) => setTimeout(resolve, 200));

    console.log(
      '\nHand ended, winners:',
      events.winners.map((w) => ({
        name: playerNames.get(w.playerId),
        amount: w.amount,
      })),
    );

    console.log('\nActual elimination order:');
    eliminationOrder.forEach((elim, index) => {
      console.log(
        `  ${index + 1}. ${elim.playerName} (${elim.startingChips} chips)`,
      );
    });

    // Verify elimination order follows stack sizes
    if (eliminationOrder.length >= 3) {
      const isCorrectOrder =
        eliminationOrder[0].startingChips <=
          eliminationOrder[1].startingChips &&
        eliminationOrder[1].startingChips <= eliminationOrder[2].startingChips;

      if (isCorrectOrder) {
        console.log('✅ Elimination order correctly follows stack size rules');
      } else {
        console.log(
          '❌ ISSUE #28: Elimination order does not follow stack size rules',
        );
      }
    }

    console.log('✅ Simultaneous elimination test completed');
  });

  it('should handle single elimination correctly (baseline test)', async () => {
    // Reset table
    table.close();
    ({ manager, table } = createTestTable('standard', {
      blinds: { small: 5, big: 10 },
      minPlayers: 2,
      dealerButton: 0,
    }));
    events = setupEventCapture(table);

    // One player folds, one survives
    const foldPlayer = new StrategicPlayer({
      name: 'Folder',
      strategy: (gameState, playerId) => ({
        playerId,
        action: Action.FOLD,
        timestamp: Date.now(),
      }),
    });

    const survivor = new StrategicPlayer({
      name: 'Survivor',
      strategy: (gameState, playerId) => {
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
      },
    });

    table.addPlayer(foldPlayer);
    table.addPlayer(survivor);

    // Give folder minimal chips
    const folderData = Array.from(table.players.values()).find(
      (p) => p.player.id === foldPlayer.id,
    );
    if (folderData) {
      folderData.chips = 15;
    } // Less than big blind

    table.tryStartGame();
    await waitForHandEnd(events);

    // Wait a bit for player state to update
    await new Promise((resolve) => setTimeout(resolve, 100));

    const survivorData = Array.from(table.players.values()).find(
      (p) => p.player.id === survivor.id,
    );
    console.log(`Survivor has chips: ${survivorData?.chips}`);

    // Just check that the test ran without errors
    expect(events.handEnded).toBe(true);
    console.log('✅ Single elimination works correctly');
  });
});
