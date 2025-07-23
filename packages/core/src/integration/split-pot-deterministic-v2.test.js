/**
 * Split Pot Deterministic Tests (Using Test Utilities)
 * 
 * Tests split pot scenarios using custom decks for deterministic testing.
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

describe('Split Pot Deterministic Tests (v2)', () => {
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

  it('should split pot between two players with identical hands', async () => {
    // Create heads-up table
    const result = createHeadsUpTable({
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set custom deck BEFORE adding players
    // Both players get AA, board has low cards
    const customDeck = [
      // First card to each player
      { rank: 'A', suit: 's', toString() { return 'As'; } }, // P1 first card
      { rank: 'A', suit: 'c', toString() { return 'Ac'; } }, // P2 first card
      // Second card to each player
      { rank: 'A', suit: 'h', toString() { return 'Ah'; } }, // P1 second card
      { rank: 'A', suit: 'd', toString() { return 'Ad'; } }, // P2 second card
      // Burn + Flop
      { rank: '8', suit: 'c', toString() { return '8c'; } }, // Burn
      { rank: '2', suit: 'c', toString() { return '2c'; } }, // Flop 1
      { rank: '3', suit: 's', toString() { return '3s'; } }, // Flop 2
      { rank: '4', suit: 'h', toString() { return '4h'; } }, // Flop 3
      // Burn + Turn
      { rank: '8', suit: 'd', toString() { return '8d'; } }, // Burn
      { rank: '5', suit: 'd', toString() { return '5d'; } }, // Turn
      // Burn + River
      { rank: '8', suit: 'h', toString() { return '8h'; } }, // Burn
      { rank: '7', suit: 'c', toString() { return '7c'; } }, // River
    ];

    table.setCustomDeck(customDeck);

    // Set up event capture
    events = setupEventCapture(table);

    // Betting strategy
    const bettingStrategy = ({ player, gameState, toCall }) => {
      if (gameState.phase === 'PRE_FLOP') {
        // Button raises TO 60 total (already has 10 in as SB)
        if (player.isButton && gameState.currentBet === 20) {
          return { action: Action.RAISE, amount: 50 }; // Raise BY 50 to make total 60
        }
        // BB calls
        if (toCall > 0) {
          return { action: Action.CALL, amount: toCall };
        }
      }

      // Check post-flop
      return { action: Action.CHECK };
    };

    // Create 2 players
    const player1 = new StrategicPlayer({ 
      name: 'Player 1',
      strategy: bettingStrategy,
    });
    player1.isButton = true;

    const player2 = new StrategicPlayer({ 
      name: 'Player 2',
      strategy: bettingStrategy,
    });
    player2.isButton = false;

    table.addPlayer(player1);
    table.addPlayer(player2);
    
    // Explicitly start the game
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    const { winners } = events;

    // Both players should win with AA
    expect(winners).toHaveLength(2);
    
    // Each should get half the pot (120 / 2 = 60)
    expect(winners[0].amount).toBe(60);
    expect(winners[1].amount).toBe(60);
    
    // Both should have the same hand rank (two pair - AA with board)
    expect(winners[0].hand.rank).toBe(winners[1].hand.rank);
  });

  it('should split pot three ways with identical hands', async () => {
    // Create 3-player table
    const result = createTestTable('standard', {
      minPlayers: 3,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set custom deck BEFORE adding players
    // All players get pocket pairs, board makes everyone play the board
    const customDeck = [
      // First card to each player
      { rank: '2', suit: 's', toString() { return '2s'; } }, // P1 first card
      { rank: '3', suit: 'c', toString() { return '3c'; } }, // P2 first card
      { rank: '4', suit: 's', toString() { return '4s'; } }, // P3 first card
      // Second card to each player
      { rank: '2', suit: 'h', toString() { return '2h'; } }, // P1 second card
      { rank: '3', suit: 'd', toString() { return '3d'; } }, // P2 second card
      { rank: '4', suit: 'h', toString() { return '4h'; } }, // P3 second card
      // Burn + Flop
      { rank: '9', suit: 'c', toString() { return '9c'; } }, // Burn
      { rank: 'A', suit: 'c', toString() { return 'Ac'; } }, // Flop 1
      { rank: 'A', suit: 'd', toString() { return 'Ad'; } }, // Flop 2
      { rank: 'K', suit: 'c', toString() { return 'Kc'; } }, // Flop 3
      // Burn + Turn
      { rank: '9', suit: 'd', toString() { return '9d'; } }, // Burn
      { rank: 'K', suit: 'd', toString() { return 'Kd'; } }, // Turn
      // Burn + River
      { rank: '9', suit: 'h', toString() { return '9h'; } }, // Burn
      { rank: 'Q', suit: 's', toString() { return 'Qs'; } }, // River
    ];

    table.setCustomDeck(customDeck);

    // Set up event capture
    events = setupEventCapture(table);

    // Limping strategy
    const limpingStrategy = ({ gameState, myState, toCall }) => {
      // Everyone limps/calls preflop
      if (gameState.phase === 'PRE_FLOP' && toCall > 0 && toCall <= 20) {
        return { action: Action.CALL, amount: toCall };
      }

      // Check otherwise
      return { action: Action.CHECK };
    };

    // Create 3 players
    const players = Array.from({ length: 3 }, (_, i) => 
      new StrategicPlayer({ 
        name: `Player ${i + 1}`,
        strategy: limpingStrategy,
      })
    );

    players.forEach(p => table.addPlayer(p));
    
    // Explicitly start the game
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    const { winners } = events;

    // All three should win (playing the board - AAKKQ)
    expect(winners).toHaveLength(3);
    
    // Each gets 1/3 of pot (60 / 3 = 20)
    winners.forEach(winner => {
      expect(winner.amount).toBe(20);
    });
  });
});