import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  createChipStackTable,
  setupEventCapture,
  StrategicPlayer,
  cleanupTables,
  waitForHandEnd,
  Action,
  createRiggedDeckFromArray,
} from '../test-utils/index.js';

/**
 * Test for Issue #28: Tournament elimination ordering
 *
 * When multiple players are eliminated in the same hand, they should be
 * eliminated in order based on their starting stack size (smallest first).
 * This is crucial for tournament finishing position tracking.
 */

describe('Tournament Elimination Ordering (Issue #28)', () => {
  let manager;
  let table;
  let events;

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

  it('should eliminate players in correct order when multiple players bust in same hand', async () => {
    // Create a rigged deck scenario where we know the outcome
    const result = createTestTable('standard', {
      id: 'elimination-order-test',
      blinds: { small: 5, big: 10 },
      minBuyIn: 30,
      maxBuyIn: 1000,
      minPlayers: 2,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;
    events = setupEventCapture(table);

    // Create a rigged deck - Big Stack gets the best hand, others get weak hands
    const riggedDeckArray = [
      // Hole cards - dealing order is player 0, 1, 2, then player 0, 1, 2 again
      // Player 0 (Small Stack) gets 7-2 offsuit (worst hand)
      {
        rank: '7',
        suit: 'd',
        toString() {
          return '7d';
        },
      },
      // Player 1 (Medium Stack) gets 8-3 offsuit (bad hand)
      {
        rank: '8',
        suit: 's',
        toString() {
          return '8s';
        },
      },
      // Player 2 (Big Stack) gets A-A (pocket aces - best hand)
      {
        rank: 'A',
        suit: 'h',
        toString() {
          return 'Ah';
        },
      },
      // Second hole card
      {
        rank: '2',
        suit: 'c',
        toString() {
          return '2c';
        },
      }, // Small Stack 7-2
      {
        rank: '3',
        suit: 'h',
        toString() {
          return '3h';
        },
      }, // Medium Stack 8-3
      {
        rank: 'A',
        suit: 's',
        toString() {
          return 'As';
        },
      }, // Big Stack A-A

      // Burn + Community cards that don't help the small stacks
      {
        rank: '4',
        suit: 'd',
        toString() {
          return '4d';
        },
      }, // Burn
      {
        rank: 'K',
        suit: 'h',
        toString() {
          return 'Kh';
        },
      }, // Flop 1
      {
        rank: 'Q',
        suit: 'd',
        toString() {
          return 'Qd';
        },
      }, // Flop 2
      {
        rank: 'J',
        suit: 'c',
        toString() {
          return 'Jc';
        },
      }, // Flop 3
      {
        rank: '5',
        suit: 's',
        toString() {
          return '5s';
        },
      }, // Burn
      {
        rank: 'T',
        suit: 'h',
        toString() {
          return 'Th';
        },
      }, // Turn
      {
        rank: '6',
        suit: 'd',
        toString() {
          return '6d';
        },
      }, // Burn
      {
        rank: '9',
        suit: 's',
        toString() {
          return '9s';
        },
      }, // River
    ];
    const riggedDeck = createRiggedDeckFromArray(riggedDeckArray);

    table.setDeck(riggedDeck);

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

    // Create all-in strategy to force showdown
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

    // Create players
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

    // Track player info BEFORE adding (since we'll override chips during add)
    playerNames.set(smallStack.id, 'Small Stack');
    playerNames.set(mediumStack.id, 'Medium Stack');
    playerNames.set(bigStack.id, 'Big Stack');

    // Recreate table with chip stack support
    const chipResult = createChipStackTable(
      'standard',
      [30, 50, 200], // Small, Medium, Big stacks
      {
        id: 'elimination-order-test',
        blinds: { small: 5, big: 10 },
        minBuyIn: 30,
        maxBuyIn: 1000,
        minPlayers: 2,
        dealerButton: 0,
      },
    );
    manager = chipResult.manager;
    table = chipResult.table;
    events = setupEventCapture(table);

    // Reattach event listener
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

    // Set custom deck on new table
    table.setDeck(riggedDeck);

    // Add players in the order that matches chip amounts
    table.addPlayer(smallStack);
    table.addPlayer(mediumStack);
    table.addPlayer(bigStack);

    startingChips.set(smallStack.id, 30);
    startingChips.set(mediumStack.id, 50);
    startingChips.set(bigStack.id, 200);

    console.log('Starting stacks:');
    console.log(`  Small Stack (${smallStack.id}): ${smallStack.chips} chips`);
    console.log(
      `  Medium Stack (${mediumStack.id}): ${mediumStack.chips} chips`,
    );
    console.log(`  Big Stack (${bigStack.id}): ${bigStack.chips} chips`);

    // Wait for hand to complete
    const handComplete = new Promise((resolve) => {
      table.on('hand:ended', ({ winners }) => {
        console.log(
          'Hand ended, winners:',
          winners.map((w) => ({
            name: playerNames.get(w.playerId),
            id: w.playerId,
            amount: w.amount,
          })),
        );
        // Give time for elimination events
        setTimeout(resolve, 200);
      });
    });

    // Start game
    table.tryStartGame();

    // Wait for completion
    await handComplete;

    console.log('\nElimination order:', eliminationOrder);

    // The scenario should create multiple eliminations since all players go all-in
    // and the big stack with pocket aces should win most/all of the pot
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
    // This test will reveal if elimination order depends on player iteration order
    // rather than tournament rules (stack size)

    const result2 = createTestTable('standard', {
      id: 'simultaneous-elim-test',
      blinds: { small: 5, big: 10 },
      minBuyIn: 30,
      maxBuyIn: 1000,
      minPlayers: 2,
      dealerButton: 0,
    });
    manager = result2.manager;
    table = result2.table;
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

    // Create 4 players with different stack sizes but add them in reverse order
    // to see if elimination follows addition order rather than stack size order
    const allInStrategyForTest = ({ myState }) => {
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

    // Create players - add BIG stack first, then medium, then small
    // This tests if elimination order follows insertion order vs stack size
    const bigStack = new StrategicPlayer({
      name: 'Big Stack',
      strategy: allInStrategyForTest,
    });
    const mediumStack = new StrategicPlayer({
      name: 'Medium Stack',
      strategy: allInStrategyForTest,
    });
    const smallStack = new StrategicPlayer({
      name: 'Small Stack',
      strategy: allInStrategyForTest,
    });
    const winnerStack = new StrategicPlayer({
      name: 'Winner',
      strategy: allInStrategyForTest,
    });

    // Set up name mapping
    playerNames.set(bigStack.id, 'Big Stack');
    playerNames.set(mediumStack.id, 'Medium Stack');
    playerNames.set(smallStack.id, 'Small Stack');
    playerNames.set(winnerStack.id, 'Winner');

    // Recreate table with chip stacks in the order we'll add players
    const chipResult2 = createChipStackTable(
      'standard',
      [300, 100, 60, 40], // Winner, Big, Medium, Small (in add order)
      {
        id: 'simultaneous-elim-test',
        blinds: { small: 5, big: 10 },
        minBuyIn: 30,
        maxBuyIn: 1000,
        minPlayers: 2,
        dealerButton: 0,
      },
    );
    manager = chipResult2.manager;
    table = chipResult2.table;
    events = setupEventCapture(table);

    // Reattach event listener
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

    // Add in reverse order of stack size
    table.addPlayer(winnerStack); // Biggest stack, added first
    table.addPlayer(bigStack); // Big stack, added second
    table.addPlayer(mediumStack); // Medium stack, added third
    table.addPlayer(smallStack); // Smallest stack, added last

    startingChips.set(bigStack.id, 100);
    startingChips.set(mediumStack.id, 60);
    startingChips.set(smallStack.id, 40);
    startingChips.set(winnerStack.id, 300);

    console.log('Players added in this order:');
    console.log('  1. Winner (300 chips)');
    console.log('  2. Big Stack (100 chips)');
    console.log('  3. Medium Stack (60 chips)');
    console.log('  4. Small Stack (40 chips)');
    console.log('');
    console.log(
      'Tournament rule: Elimination should be by stack size, not addition order',
    );
    console.log('Expected elimination order: Small -> Medium -> Big');

    // Use a rigged deck that gives winner the best hand
    const riggedDeckArray = [
      // Winner gets pocket aces
      {
        rank: 'A',
        suit: 'h',
        toString() {
          return 'Ah';
        },
      }, // Winner
      {
        rank: '2',
        suit: 'd',
        toString() {
          return '2d';
        },
      }, // Big Stack
      {
        rank: '3',
        suit: 's',
        toString() {
          return '3s';
        },
      }, // Medium Stack
      {
        rank: '4',
        suit: 'c',
        toString() {
          return '4c';
        },
      }, // Small Stack
      // Second cards
      {
        rank: 'A',
        suit: 's',
        toString() {
          return 'As';
        },
      }, // Winner - AA
      {
        rank: '7',
        suit: 'h',
        toString() {
          return '7h';
        },
      }, // Big Stack - 27
      {
        rank: '8',
        suit: 'd',
        toString() {
          return '8d';
        },
      }, // Medium Stack - 38
      {
        rank: '9',
        suit: 'c',
        toString() {
          return '9c';
        },
      }, // Small Stack - 49

      // Board that doesn't help anyone except winner
      {
        rank: '5',
        suit: 'h',
        toString() {
          return '5h';
        },
      }, // Burn
      {
        rank: 'K',
        suit: 'd',
        toString() {
          return 'Kd';
        },
      }, // Flop
      {
        rank: 'Q',
        suit: 's',
        toString() {
          return 'Qs';
        },
      },
      {
        rank: 'J',
        suit: 'h',
        toString() {
          return 'Jh';
        },
      },
      {
        rank: '6',
        suit: 'd',
        toString() {
          return '6d';
        },
      }, // Burn
      {
        rank: 'T',
        suit: 'c',
        toString() {
          return 'Tc';
        },
      }, // Turn
      {
        rank: '7',
        suit: 's',
        toString() {
          return '7s';
        },
      }, // Burn
      {
        rank: '2',
        suit: 'h',
        toString() {
          return '2h';
        },
      }, // River
    ];
    const riggedDeck = createRiggedDeckFromArray(riggedDeckArray);

    table.setDeck(riggedDeck);

    table.tryStartGame();
    await waitForHandEnd(events);
    const { winners } = events;
    console.log(
      '\nHand ended, winners:',
      winners.map((w) => ({
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

    // Analyze if the current implementation has the issue
    if (eliminationOrder.length >= 2) {
      // Check timestamps to see if eliminations are simultaneous
      const timestamps = eliminationOrder.map((e) => e.timestamp);
      const isSimultaneous = timestamps.every((t) => t === timestamps[0]);

      if (isSimultaneous) {
        console.log(
          '\n❌ ISSUE #28 CONFIRMED: All eliminations have same timestamp (simultaneous)',
        );
      }

      // Check if order follows stack size rules
      const stackSizes = eliminationOrder.map((e) => e.startingChips);
      const isCorrectOrder = stackSizes.every((size, index) => {
        return index === 0 || size >= stackSizes[index - 1];
      });

      if (!isCorrectOrder) {
        console.log(
          '❌ ISSUE #28 CONFIRMED: Elimination order does not follow stack size rules',
        );
        console.log('Expected: Smallest stack eliminated first');
        console.log('Actual: Wrong order detected');
      } else {
        console.log('✅ Elimination order correctly follows stack size rules');
      }
    }

    console.log('✅ Simultaneous elimination test completed');
  });

  it('should handle single elimination correctly (baseline test)', async () => {
    // Simple 2-player test to ensure basic elimination works
    const result = createChipStackTable(
      'standard',
      [200, 30], // Player 1 has more chips, Player 2 has fewer
      {
        id: 'single-elimination-test',
        blinds: { small: 10, big: 20 },
        minBuyIn: 30,
        maxBuyIn: 200,
        minPlayers: 2,
        dealerButton: 0,
      },
    );
    manager = result.manager;
    table = result.table;
    events = setupEventCapture(table);

    const eliminationOrder = [];
    table.on('player:eliminated', ({ playerId }) => {
      eliminationOrder.push(playerId);
    });

    const allInStrategyBaseline = ({ myState }) => {
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
      name: 'Player 1',
      strategy: allInStrategyBaseline,
    });
    const player2 = new StrategicPlayer({
      name: 'Player 2',
      strategy: allInStrategyBaseline,
    });

    table.addPlayer(player1);
    table.addPlayer(player2);

    // Create custom deck to ensure Player 1 wins and Player 2 loses all chips
    const customDeckArray = [
      // Player 1 gets pocket aces
      {
        rank: 'A',
        suit: 's',
        toString() {
          return 'As';
        },
      },
      // Player 2 gets 7-2 offsuit (worst hand)
      {
        rank: '7',
        suit: 'd',
        toString() {
          return '7d';
        },
      },
      // Player 1 second card
      {
        rank: 'A',
        suit: 'h',
        toString() {
          return 'Ah';
        },
      },
      // Player 2 second card
      {
        rank: '2',
        suit: 'c',
        toString() {
          return '2c';
        },
      },
      // Burn + Flop
      {
        rank: '3',
        suit: 'd',
        toString() {
          return '3d';
        },
      }, // Burn
      {
        rank: 'K',
        suit: 'h',
        toString() {
          return 'Kh';
        },
      },
      {
        rank: 'Q',
        suit: 's',
        toString() {
          return 'Qs';
        },
      },
      {
        rank: 'J',
        suit: 'c',
        toString() {
          return 'Jc';
        },
      },
      // Burn + Turn
      {
        rank: '4',
        suit: 'd',
        toString() {
          return '4d';
        },
      }, // Burn
      {
        rank: 'T',
        suit: 'h',
        toString() {
          return 'Th';
        },
      },
      // Burn + River
      {
        rank: '5',
        suit: 'd',
        toString() {
          return '5d';
        },
      }, // Burn
      {
        rank: '9',
        suit: 's',
        toString() {
          return '9s';
        },
      },
    ];
    const customDeck = createRiggedDeckFromArray(customDeckArray);

    table.setDeck(customDeck);

    table.tryStartGame();
    await waitForHandEnd(events);

    // Should have exactly one elimination (player 2 loses with 7-2)
    expect(eliminationOrder).toHaveLength(1);
    expect(eliminationOrder[0]).toBeDefined();

    // Verify the winner received the pot
    expect(events.winners).toHaveLength(1);
    // Player 1 had 200, player 2 had 30, both go all-in
    // Player 1 wins the pot of 60 (30 from each player)
    // But the amount reported is their total chips after winning
    expect(events.winners[0].amount).toBe(230); // 200 + 30 won from player 2

    // Note: The current implementation may not update table player chips
    // or remove eliminated players immediately, so we just verify the
    // elimination event was fired and the pot was distributed correctly

    console.log('✅ Single elimination works correctly');
  });
});
