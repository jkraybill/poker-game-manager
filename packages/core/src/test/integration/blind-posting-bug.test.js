import { describe, it, expect } from 'vitest';
import { Table } from '../../Table.js';
import { Player } from '../../Player.js';
import { Action, TableState } from '../../types/index.js';

/**
 * Test for critical blind posting bug when player has insufficient chips
 * Bug report from client: When a player has fewer chips than the blind,
 * the pot stays at 0 even though chips are deducted from the player.
 * The hand never starts and no cards are dealt.
 */

class SimplePlayer extends Player {
  getAction(gameState) {
    const { validActions } = gameState;
    if (validActions.includes(Action.FOLD)) {
      return { action: Action.FOLD };
    }
    if (validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK };
    }
    return { action: Action.FOLD };
  }

  receivePrivateCards(cards) {
    this.cards = cards;
  }

  receivePublicCards(_cards) {}
  receiveGameUpdate(_update) {}
}

describe('Blind Posting Bug - Insufficient Chips', () => {
  it('should handle player with insufficient chips for big blind', async () => {
    // Reproduce exact scenario from bug report
    const table = new Table({
      id: 'test-table',
      maxPlayers: 4,
      minPlayers: 2,
      blinds: { small: 64000, big: 128000 },
    });

    // Player with insufficient chips for big blind
    const shortStack = new SimplePlayer({ id: 'p1', name: 'ShortStack' });
    shortStack.chips = 54228; // Less than BB of 128000
    table.addPlayer(shortStack);

    // Player with sufficient chips
    const bigStack = new SimplePlayer({ id: 'p2', name: 'BigStack' });
    bigStack.chips = 217772;
    table.addPlayer(bigStack);

    console.log('Initial state:');
    console.log('  ShortStack chips:', shortStack.chips);
    console.log('  BigStack chips:', bigStack.chips);

    // Track events
    let cardsDealt = false;
    let handStarted = false;

    table.on('cards:dealt', () => {
      cardsDealt = true;
    });

    table.on('hand:started', () => {
      handStarted = true;
    });

    // Start the game
    const result = await table.tryStartGame();
    expect(result.success).toBe(true);

    // Wait for blind posting to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get pot from game engine
    const actualPot = table.gameEngine
      ? table.gameEngine.potManager.getTotal()
      : 0;

    console.log('\nAfter starting:');
    console.log('  Table state:', table.state);
    console.log('  Actual pot:', actualPot);
    console.log('  ShortStack chips:', shortStack.chips);
    console.log('  ShortStack bet:', shortStack.bet);
    console.log('  BigStack chips:', bigStack.chips);
    console.log('  BigStack bet:', bigStack.bet);
    console.log('  Cards dealt?', cardsDealt);
    console.log('  ShortStack cards:', shortStack.cards);

    // THE BUG: These assertions should pass but currently fail

    // 1. Pot should contain the posted blinds (not 0!)
    const expectedPot = 54228 + 128000; // 182228
    expect(actualPot).toBe(expectedPot);
    expect(actualPot).toBeGreaterThan(0); // Should NOT be 0

    // 2. Cards should be dealt
    expect(cardsDealt).toBe(true);
    expect(shortStack.cards).toBeDefined();
    expect(shortStack.cards?.length).toBe(2);

    // 3. Hand should have started
    expect(handStarted).toBe(true);

    // 4. Game should be in progress (not stuck)
    expect(table.isGameInProgress()).toBe(true);
    expect(table.state).toBe(TableState.IN_PROGRESS);

    // 5. Chips should be deducted correctly
    expect(shortStack.chips).toBe(0); // All-in
    expect(bigStack.chips).toBe(217772 - 128000); // Posted BB
  });

  it('should handle player with less than small blind', async () => {
    const table = new Table({
      id: 'test-table-2',
      maxPlayers: 2,
      minPlayers: 2,
      blinds: { small: 1000, big: 2000 },
    });

    // Player with less than small blind
    const tinyStack = new SimplePlayer({ id: 'p1', name: 'TinyStack' });
    tinyStack.chips = 500; // Less than SB of 1000
    table.addPlayer(tinyStack);

    const normalStack = new SimplePlayer({ id: 'p2', name: 'NormalStack' });
    normalStack.chips = 10000;
    table.addPlayer(normalStack);

    let cardsDealt = false;
    table.on('cards:dealt', () => {
      cardsDealt = true;
    });

    const result = await table.tryStartGame();
    expect(result.success).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get pot from game engine
    const actualPot = table.gameEngine
      ? table.gameEngine.potManager.getTotal()
      : 0;

    // Pot should contain both blinds
    const expectedPot = 500 + 2000; // 2500
    expect(actualPot).toBe(expectedPot);
    expect(actualPot).toBeGreaterThan(0);

    // Cards should be dealt
    expect(cardsDealt).toBe(true);
    expect(tinyStack.cards).toBeDefined();
    expect(tinyStack.cards?.length).toBe(2);

    // Chips should be deducted
    expect(tinyStack.chips).toBe(0); // All-in
    expect(normalStack.chips).toBe(8000); // Posted BB
  });
});
