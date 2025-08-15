import { describe, it, expect } from 'vitest';
import { Table } from '../../Table.js';
import { Player } from '../../Player.js';
import { Action } from '../../types/index.js';

/**
 * Test for preflop stuck bug reported by client
 * Bug: When a player posts an all-in blind (insufficient chips),
 * the hand gets stuck in PRE_FLOP phase and cards aren't actually dealt to players
 */

class SimplePlayer extends Player {
  constructor(config) {
    super(config);
    this.cardsReceived = false;
    this.privateCardsReceived = null;
  }

  getAction(gameState) {
    const { validActions } = gameState;
    console.log(
      `  ${this.name} action requested, valid actions:`,
      validActions,
    );

    if (validActions.includes(Action.FOLD)) {
      return { action: Action.FOLD };
    }
    if (validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK };
    }
    return { action: Action.CALL };
  }

  receivePrivateCards(cards) {
    console.log(`  ${this.name} receivePrivateCards called with:`, cards);
    this.cardsReceived = true;
    this.privateCardsReceived = cards;
    this.cards = cards; // Store cards
  }

  receivePublicCards(_cards) {}
  receiveGameUpdate(_update) {}
}

describe('Preflop Stuck Bug - All-in Blind Post', () => {
  it('should handle player with insufficient chips posting all-in blind', async () => {
    // Exact scenario from client bug report
    const table = new Table({
      id: 'bug-repro',
      maxPlayers: 4,
      minPlayers: 2,
      blinds: { small: 4000, big: 8000 },
    });

    // Player with insufficient chips for BB (will post all-in)
    const shortStack = new SimplePlayer({ id: 'p1', name: 'ShortStack' });
    shortStack.chips = 2276; // Less than BB of 8000
    table.addPlayer(shortStack);

    // Player with normal stack
    const normalStack = new SimplePlayer({ id: 'p2', name: 'NormalStack' });
    normalStack.chips = 50000;
    table.addPlayer(normalStack);

    console.log('\nInitial state:');
    console.log('  ShortStack:', shortStack.chips, 'chips');
    console.log('  NormalStack:', normalStack.chips, 'chips');

    // Track events
    // let handStarted = false;
    let cardsDealtEventFired = false;
    let handEnded = false;
    const potUpdates = [];
    const cardsDealtEvents = [];

    table.on('hand:started', () => {
      console.log('  EVENT: hand:started');
      // handStarted = true;
    });

    table.on('cards:dealt', (data) => {
      console.log('  EVENT: cards:dealt', data);
      cardsDealtEventFired = true;
      cardsDealtEvents.push(data);
    });

    table.on('pot:updated', (data) => {
      console.log('  EVENT: pot:updated to', data.total);
      potUpdates.push(data.total);
    });

    table.on('hand:ended', () => {
      console.log('  EVENT: hand:ended');
      handEnded = true;
    });

    // Start the game
    const result = await table.tryStartGame();
    expect(result.success).toBe(true);

    // Capture pot value during the game
    let actualPotDuringGame = 0;
    let gamePhaseDuringGame = null;

    // Wait a bit for game to start processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Capture values while game is running
    if (table.gameEngine) {
      actualPotDuringGame = table.gameEngine.potManager?.getTotal() || 0;
      gamePhaseDuringGame = table.gameEngine.phase;
    }

    // Wait for game to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get final state
    // const gameEngine = table.gameEngine;
    const actualPot = actualPotDuringGame; // Use captured value
    const gamePhase = gamePhaseDuringGame;

    console.log('\nAfter starting:');
    console.log('  Table state:', table.state);
    console.log('  Game phase:', gamePhase);
    console.log('  Pot total:', actualPot);
    console.log('  ShortStack chips:', shortStack.chips);
    console.log('  NormalStack chips:', normalStack.chips);
    console.log('  ShortStack bet:', shortStack.bet);
    console.log('  NormalStack bet:', normalStack.bet);
    console.log('  Cards dealt event fired:', cardsDealtEventFired);
    console.log('  ShortStack.cardsReceived:', shortStack.cardsReceived);
    console.log('  NormalStack.cardsReceived:', normalStack.cardsReceived);
    console.log('  ShortStack.cards:', shortStack.cards);
    console.log('  NormalStack.cards:', normalStack.cards);

    // CRITICAL ASSERTIONS

    // 1. Cards should be dealt to players
    expect(cardsDealtEventFired).toBe(true);
    expect(shortStack.cardsReceived).toBe(true);
    expect(normalStack.cardsReceived).toBe(true);
    expect(shortStack.cards).toBeDefined();
    expect(shortStack.cards?.length).toBe(2);
    expect(normalStack.cards).toBeDefined();
    expect(normalStack.cards?.length).toBe(2);

    // 2. Most important: Game should NOT be stuck
    // Wait for hand to complete (or timeout if stuck)
    const startTime = Date.now();
    while (!handEnded && Date.now() - startTime < 3000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 3. Hand should have ended (not stuck)
    expect(handEnded).toBe(true);
    expect(table.isGameInProgress()).toBe(false);
    expect(table.state).not.toBe('IN_PROGRESS');

    // 4. Pot was correct during the game (from events)
    expect(potUpdates).toContain(10276); // Should have had correct pot

    // 5. Winner should have received the chips
    const totalChips = shortStack.chips + normalStack.chips;
    expect(totalChips).toBe(52276); // Original total

    console.log('\n✅ BUG FIXED! Game completed successfully');
    console.log('  Hand ended:', handEnded);
    console.log(
      '  Final chips - ShortStack:',
      shortStack.chips,
      'NormalStack:',
      normalStack.chips,
    );
    console.log('  Pot updates during game:', potUpdates);
  });

  it('should handle multiple short stacks with all-in blinds', async () => {
    const table = new Table({
      id: 'multi-short',
      maxPlayers: 3,
      minPlayers: 3,
      blinds: { small: 5000, big: 10000 },
    });

    // Button with normal stack
    const button = new SimplePlayer({ id: 'btn', name: 'Button' });
    button.chips = 50000;
    table.addPlayer(button);

    // SB with insufficient chips
    const sbShort = new SimplePlayer({ id: 'sb', name: 'SB-Short' });
    sbShort.chips = 2000; // Less than SB of 5000
    table.addPlayer(sbShort);

    // BB with insufficient chips
    const bbShort = new SimplePlayer({ id: 'bb', name: 'BB-Short' });
    bbShort.chips = 3000; // Less than BB of 10000
    table.addPlayer(bbShort);

    let cardsDealtEventFired = false;
    let handEnded = false;
    const potUpdates = [];

    table.on('cards:dealt', () => {
      cardsDealtEventFired = true;
    });

    table.on('pot:updated', (data) => {
      potUpdates.push(data.total);
    });

    table.on('hand:ended', () => {
      handEnded = true;
    });

    const result = await table.tryStartGame();
    expect(result.success).toBe(true);

    // Wait for hand to complete
    const startTime = Date.now();
    while (!handEnded && Date.now() - startTime < 3000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Check if players received cards
    expect(cardsDealtEventFired).toBe(true);
    expect(button.cardsReceived).toBe(true);
    expect(sbShort.cardsReceived).toBe(true);
    expect(bbShort.cardsReceived).toBe(true);

    // Check pot updates (captured during game)
    const expectedPot = 2000 + 3000; // Both all-in
    expect(potUpdates).toContain(expectedPot);

    // Verify hand completed
    expect(handEnded).toBe(true);
  });
});
