/**
 * Custom Deck Tests (Using Test Utilities)
 *
 * Tests that the custom deck functionality works correctly, ensuring
 * cards are dealt in the expected order to players and community cards.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  createHeadsUpTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  Action,
  cleanupTables,
} from '../test-utils/index.js';
import { RiggedDeck } from '../game/RiggedDeck.js';

describe('Custom Deck Tests (v2)', () => {
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

  it('should deal cards in correct order from custom deck', async () => {
    // Create 4-player table
    const result = createTestTable('standard', {
      minPlayers: 4,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    const playerHands = new Map();
    let communityCards = [];

    // Create a rigged deck with the specific cards we want
    const riggedDeck = RiggedDeck.createAlternatingDeck({
      holeCards: [
        ['As', 'Ah'], // Player 1: pocket aces
        ['Ks', 'Kh'], // Player 2: pocket kings
        ['Qs', 'Qh'], // Player 3: pocket queens
        ['2c', '3c'], // Player 4: 2-3 suited
      ],
      burn: ['8d', '8h', '8s'], // Burn cards
      flop: ['4c', '5c', '6c'], // Straight on the flop
      turn: '7c', // Completes straight flush
      river: '9c', // Another club
    });

    table.setDeck(riggedDeck);

    // Track community cards
    table.on('cards:community', ({ cards }) => {
      communityCards = cards;
    });

    // Set up event capture
    events = setupEventCapture(table);

    // Simple check/call strategy
    const simpleStrategy = ({ toCall, myState }) => {
      // Simple strategy: check if possible, call if needed
      if (toCall === 0) {
        return { action: Action.CHECK };
      }

      if (toCall > 0 && toCall <= myState.chips) {
        return { action: Action.CALL, amount: toCall };
      }

      return { action: Action.FOLD };
    };

    // Create 4 players with tracking for their cards
    const players = [];
    for (let i = 1; i <= 4; i++) {
      const player = new StrategicPlayer({
        id: `Player ${i}`,
        name: `Player ${i}`,
        strategy: simpleStrategy,
      });
      player.seatNumber = i;

      // Override receivePrivateCards to track hands
      const originalReceivePrivateCards =
        player.receivePrivateCards.bind(player);
      player.receivePrivateCards = function (cards) {
        playerHands.set(this.seatNumber, cards);
        return originalReceivePrivateCards(cards);
      };

      players.push(player);
    }

    players.forEach((p) => table.addPlayer(p));
    table.tryStartGame();

    // Wait for game to complete
    await waitForHandEnd(events);

    // Verify hole cards were dealt correctly
    const p1Cards = playerHands.get(1);
    expect(p1Cards).toBeDefined();
    expect(p1Cards[0].toString()).toBe('As');
    expect(p1Cards[1].toString()).toBe('Ah');

    const p2Cards = playerHands.get(2);
    expect(p2Cards).toBeDefined();
    expect(p2Cards[0].toString()).toBe('Ks');
    expect(p2Cards[1].toString()).toBe('Kh');

    const p3Cards = playerHands.get(3);
    expect(p3Cards).toBeDefined();
    expect(p3Cards[0].toString()).toBe('Qs');
    expect(p3Cards[1].toString()).toBe('Qh');

    const p4Cards = playerHands.get(4);
    expect(p4Cards).toBeDefined();
    expect(p4Cards[0].toString()).toBe('2c');
    expect(p4Cards[1].toString()).toBe('3c');

    // Verify community cards
    expect(communityCards).toHaveLength(5);
    expect(communityCards[0].toString()).toBe('4c');
    expect(communityCards[1].toString()).toBe('5c');
    expect(communityCards[2].toString()).toBe('6c');
    expect(communityCards[3].toString()).toBe('7c');
    expect(communityCards[4].toString()).toBe('9c');

    // Verify winner
    const { winners } = events;
    expect(winners.length).toBeGreaterThan(0);
    const winner = winners[0];

    // Player 4 should win with a straight flush (2-3-4-5-6 all clubs)
    expect(winner.playerId).toBe('Player 4');
    expect(winner.hand.rank).toBe(9); // Straight flush rank
    expect(winner.hand.description).toContain('Straight Flush');
  });

  it('should handle custom deck with exact card count', async () => {
    // Create heads-up table
    const result = createHeadsUpTable({
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Create a rigged deck with minimal cards for 2 players
    const riggedDeck = RiggedDeck.createAlternatingDeck({
      holeCards: [
        ['As', 'Ah'], // Player 1: pocket aces
        ['Ks', 'Kh'], // Player 2: pocket kings
      ],
      burn: ['2d', '3d', '8c'], // Burn cards
      flop: ['Qc', 'Jc', 'Tc'], // Broadway cards
      turn: '5h',
      river: '8c',
    });

    table.setDeck(riggedDeck);

    // Set up event capture
    events = setupEventCapture(table);

    // Track errors
    let gameError = null;
    table.on('game:error', (error) => {
      gameError = error;
      console.error('Game error:', error);
    });

    // Simple check/call strategy
    const simpleStrategy = ({ player, gameState, myState, toCall }) => {
      console.log(
        `SimplePlayer ${player.name} getAction called, phase: ${gameState.phase}, currentBet: ${gameState.currentBet}`,
      );
      console.log(`My state - bet: ${myState.bet}, chips: ${myState.chips}`);

      if (toCall === 0) {
        console.log(`${player.name} checking`);
        return { action: Action.CHECK };
      }

      if (toCall > 0 && toCall <= myState.chips) {
        console.log(`${player.name} calling ${toCall}`);
        return { action: Action.CALL, amount: toCall };
      }

      console.log(`${player.name} folding`);
      return { action: Action.FOLD };
    };

    // Create 2 players
    const player1 = new StrategicPlayer({
      name: 'Player 1',
      strategy: simpleStrategy,
    });
    const player2 = new StrategicPlayer({
      name: 'Player 2',
      strategy: simpleStrategy,
    });

    table.addPlayer(player1);
    table.addPlayer(player2);

    console.log('Starting game with custom deck...');
    table.tryStartGame();

    // Wait for game to complete
    await waitForHandEnd(events);

    // Verify game completed without errors
    expect(gameError).toBeNull();

    // Verify there was a winner
    const { winners } = events;
    expect(winners.length).toBeGreaterThan(0);

    console.log('Game completed successfully with custom deck!');
  });
});
