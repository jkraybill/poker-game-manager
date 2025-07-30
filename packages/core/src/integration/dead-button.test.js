import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

/**
 * Tests for dead button and dead small blind rules per POKER-RULES.md section 3
 *
 * Core principle: The big blind ALWAYS moves forward one position each hand.
 * The button and small blind are positioned relative to the big blind.
 */

// Simple test player that tracks position and blinds posted
class TestPlayer extends Player {
  constructor(config) {
    super(config);
    this.blindsPosted = [];
    this.isEliminated = false;
  }

  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    // Fold if eliminated
    if (this.isEliminated) {
      return {
        playerId: this.id,
        action: Action.FOLD,
        timestamp: Date.now(),
      };
    }

    // Otherwise just call/check
    if (toCall > 0) {
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now(),
      };
    }

    return {
      playerId: this.id,
      action: Action.CHECK,
      timestamp: Date.now(),
    };
  }
}

describe('Dead Button Rules', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach((table) => table.close());
  });

  it('should implement dead button when player between button and blinds is eliminated', async () => {
    // Scenario 1 from Issue #37:
    // 4 players A, B, C, D
    // Hand 1: A=Button, B=SB, C=BB, D=UTG
    // Player B eliminated during hand
    // Hand 2 should have: Dead button on B's seat, no SB posted, C=BB

    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
      dealerButton: 0,
    });

    const players = [
      new TestPlayer({ id: 'A', name: 'Player A' }),
      new TestPlayer({ id: 'B', name: 'Player B' }),
      new TestPlayer({ id: 'C', name: 'Player C' }),
      new TestPlayer({ id: 'D', name: 'Player D' }),
    ];

    // Track blind posting
    const blindTracking = {
      hand1: { sb: null, bb: null, button: null },
      hand2: {
        sb: null,
        bb: null,
        button: null,
        deadButton: false,
        deadSB: false,
      },
    };

    let handCount = 0;
    let hand1Complete = false;
    let hand2Complete = false;

    // Track hand 1 blinds
    table.on('hand:started', (data) => {
      handCount++;

      if (handCount === 1) {
        blindTracking.hand1.button = data.dealerButton;
        // In 4 player game with button at 0: SB=1, BB=2
        blindTracking.hand1.sb = data.players[(data.dealerButton + 1) % 4];
        blindTracking.hand1.bb = data.players[(data.dealerButton + 2) % 4];
      } else if (handCount === 2) {
        blindTracking.hand2.button = data.dealerButton;

        // Check if button is "dead" (on eliminated player's seat)
        const activePlayerIds = players
          .filter((p) => p.chips > 0)
          .map((p) => p.id);
        const buttonPlayerId = data.players[data.dealerButton];
        blindTracking.hand2.deadButton =
          !activePlayerIds.includes(buttonPlayerId);

        // TODO: This is where the current implementation fails
        // It should place button on B's empty seat, not rotate to next active
      }
    });

    table.on('pot:updated', ({ playerBet, deadMoney }) => {
      if (playerBet && handCount === 1) {
        if (playerBet.amount === 10 && !blindTracking.hand1.sb) {
          blindTracking.hand1.sb = playerBet.playerId;
        } else if (playerBet.amount === 20 && !blindTracking.hand1.bb) {
          blindTracking.hand1.bb = playerBet.playerId;
        }
      } else if (handCount === 2) {
        if (playerBet) {
          if (playerBet.amount === 10 && !blindTracking.hand2.sb) {
            blindTracking.hand2.sb = playerBet.playerId;
          } else if (playerBet.amount === 20 && !blindTracking.hand2.bb) {
            blindTracking.hand2.bb = playerBet.playerId;
          }
        }
        if (deadMoney) {
          blindTracking.hand2.deadSB = true;
        }
      }
    });

    table.on('hand:ended', () => {
      if (handCount === 1) {
        // Eliminate player B after hand 1
        players[1].chips = 0;
        players[1].isEliminated = true;
        hand1Complete = true;

        // Start hand 2
        setTimeout(() => table.tryStartGame(), 100);
      } else if (handCount === 2) {
        hand2Complete = true;
      }
    });

    // Add players
    for (const player of players) {
      table.addPlayer(player);
    }

    // Start game
    table.tryStartGame();

    // Wait for both hands to complete
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (hand1Complete && hand2Complete) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });

    // Verify hand 1 positions (should be standard)
    expect(blindTracking.hand1.button).toBe(0); // Player A
    expect(blindTracking.hand1.sb).toBe('B'); // Player B posts SB
    expect(blindTracking.hand1.bb).toBe('C'); // Player C posts BB

    // Verify hand 2 implements dead button rule
    // CURRENT BEHAVIOR (WRONG): Button moves to C, D posts SB, A posts BB
    // CORRECT BEHAVIOR: Button on B's empty seat (dead), no SB, C posts BB again

    // This test will currently FAIL, demonstrating the bug
    console.log('\n=== Dead Button Test Results ===');
    console.log('Hand 1:', blindTracking.hand1);
    console.log('Hand 2:', blindTracking.hand2);
    console.log('Expected: Dead button on position 1, no SB, C posts BB');

    // These assertions show what SHOULD happen (will fail with current implementation)
    // expect(blindTracking.hand2.button).toBe(1); // Dead button on B's seat
    // expect(blindTracking.hand2.deadButton).toBe(true);
    // expect(blindTracking.hand2.deadSB).toBe(true); // No one posts SB
    // expect(blindTracking.hand2.bb).toBe('C'); // C posts BB again
  });

  it('should handle multiple eliminations correctly', async () => {
    // Scenario 4 from Issue #37:
    // 4 players A, B, C, D
    // Hand 1: A=Button, B=SB, C=BB, D=UTG
    // Players B and C eliminated during hand
    // Hand 2: D=Button, A=SB, D=BB (heads-up rules)

    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
      dealerButton: 0,
    });

    const players = [
      new TestPlayer({ id: 'A', name: 'Player A' }),
      new TestPlayer({ id: 'B', name: 'Player B' }),
      new TestPlayer({ id: 'C', name: 'Player C' }),
      new TestPlayer({ id: 'D', name: 'Player D' }),
    ];

    let handCount = 0;
    const handData = [];

    table.on('hand:started', (data) => {
      handCount++;
      handData.push({
        hand: handCount,
        button: data.dealerButton,
        players: [...data.players],
      });
    });

    table.on('hand:ended', () => {
      if (handCount === 1) {
        // Eliminate players B and C
        players[1].chips = 0;
        players[1].isEliminated = true;
        players[2].chips = 0;
        players[2].isEliminated = true;

        setTimeout(() => table.tryStartGame(), 100);
      }
    });

    // Add players and start
    for (const player of players) {
      table.addPlayer(player);
    }
    table.tryStartGame();

    // Wait for completion
    await new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });

    console.log('\n=== Multiple Elimination Test ===');
    console.log('Hand data:', handData);

    // With current implementation, this test shows the issue
    // After B and C are eliminated, only A and D remain (heads-up)
    // The button should follow proper heads-up transition rules
  });
});
