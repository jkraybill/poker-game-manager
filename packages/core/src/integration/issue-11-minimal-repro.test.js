import { describe, it, expect } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

/**
 * MINIMAL reproduction of Issue #11: Pot Distribution Bug
 * 
 * The bug occurs when:
 * 1. A short-stacked player goes all-in
 * 2. Other players continue betting beyond the all-in amount
 * 3. The all-in player wins
 * 4. They receive 0 chips despite winning
 * 
 * Root cause: The all-in player is not marked as eligible for the pot they helped create
 */

class TestPlayer extends Player {
  constructor(config) {
    super(config);
    this.actions = config.actions || [];
    this.actionIndex = 0;
  }

  getAction(gameState) {
    if (this.actionIndex < this.actions.length) {
      const action = this.actions[this.actionIndex++];
      console.log(`${this.name}: ${action.action} ${action.amount || ''}`);
      return { ...action, timestamp: Date.now() };
    }
    return { action: Action.CHECK, timestamp: Date.now() };
  }
}

describe('Issue #11 - Minimal Pot Distribution Bug', () => {
  it('should reproduce the exact failing scenario', async () => {
    const manager = new PokerGameManager();
    
    const table = manager.createTable({
      tableId: 'exact-bug',
      minPlayers: 3,
      maxPlayers: 3,
      blinds: { small: 10, big: 20 },
      dealerButton: 0,
      minBuyIn: 1000,
    });

    // Same deck as complex scenario
    const customDeck = [
      { rank: 'A', suit: 's', toString() { return 'As'; } }, // P1
      { rank: 'K', suit: 'd', toString() { return 'Kd'; } }, // P2
      { rank: 'Q', suit: 'c', toString() { return 'Qc'; } }, // P3
      { rank: 'A', suit: 'h', toString() { return 'Ah'; } }, // P1
      { rank: 'K', suit: 'h', toString() { return 'Kh'; } }, // P2
      { rank: 'Q', suit: 'h', toString() { return 'Qh'; } }, // P3
      { rank: '2', suit: 'c', toString() { return '2c'; } },
      { rank: '3', suit: 'd', toString() { return '3d'; } },
      { rank: '5', suit: 's', toString() { return '5s'; } },
      { rank: '7', suit: 'h', toString() { return '7h'; } },
      { rank: '2', suit: 'd', toString() { return '2d'; } },
      { rank: '9', suit: 'h', toString() { return '9h'; } },
      { rank: '2', suit: 'h', toString() { return '2h'; } },
      { rank: 'J', suit: 'c', toString() { return 'Jc'; } },
    ];

    table.setCustomDeck(customDeck);

    // Players that exactly match the failing test
    const p1 = new TestPlayer({
      id: 'p1',
      name: 'Short Stack',
      actions: [{ action: Action.ALL_IN, amount: 100 }]
    });

    const p2 = new TestPlayer({
      id: 'p2',
      name: 'Medium Stack',
      actions: [{ action: Action.ALL_IN, amount: 300 }]
    });

    const p3 = new TestPlayer({
      id: 'p3',
      name: 'Big Stack',
      actions: [{ action: Action.CALL, amount: 280 }]
    });

    await table.addPlayer(p1);
    await table.addPlayer(p2);
    await table.addPlayer(p3);

    // Match exact chip counts from failing test
    p1.removeChips(900); // 100 chips
    p2.removeChips(700); // 300 chips
    // p3 keeps 1000 chips

    console.log('\n=== EXACT FAILING SCENARIO ===');
    console.log('P1:', p1.chips, 'chips');
    console.log('P2:', p2.chips, 'chips');
    console.log('P3:', p3.chips, 'chips');

    let handResult = null;
    table.on('hand:ended', (data) => {
      handResult = data;
    });

    table.tryStartGame();
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n=== RESULTS ===');
    console.log('Winners:', handResult.winners.map(w => ({
      id: w.playerId,
      amount: w.amount
    })));
    
    console.log('\nActual Pots:', handResult.sidePots.map(pot => ({
      amount: pot.amount,
      eligible: pot.eligiblePlayers
    })));
    
    // Expected pot structure:
    // Main pot: 300 (100 from each player) - P1, P2, P3 eligible
    // Side pot: 400 (200 from P2 and P3) - only P2, P3 eligible
    console.log('\nExpected Pots:');
    console.log('- Main pot: 300, eligible: [p1, p2, p3]');
    console.log('- Side pot: 400, eligible: [p2, p3]');

    const winner = handResult.winners[0];
    expect(winner.playerId).toBe('p1');
    
    // Calculate expected winnings:
    // P1 (100 chips) is all-in, so main pot = 100 * 3 = 300
    // P1 should win this main pot since they have AA
    const expectedWinnings = 300;
    
    if (winner.amount === 0) {
      console.log('\n🐛 BUG REPRODUCED: Winner got 0 chips instead of', expectedWinnings);
    } else if (winner.amount === expectedWinnings) {
      console.log('\n✅ Bug FIXED: Winner correctly got', winner.amount, 'chips');
    } else {
      console.log('\n⚠️  Partial bug: Winner got', winner.amount, 'chips instead of', expectedWinnings);
    }
    
    // The exact amount P1 should win
    expect(winner.amount).toBe(expectedWinnings);
    
    // Also check final chip counts
    console.log('\n=== FINAL CHIP COUNTS ===');
    console.log('P1:', p1.chips, '(started with 100)');
    console.log('P2:', p2.chips, '(started with 300)'); 
    console.log('P3:', p3.chips, '(started with 1000)');
    
    // Expected final chips:
    // Betting: P1 all-in 100, P2 all-in 300, P3 calls 300
    // Main pot: 100 * 3 = 300 (all players eligible)
    // Side pot: 200 * 2 = 400 (only P2 and P3 eligible)
    // Winners: P1 (AA) wins main pot, P2 (KK) beats P3 (QQ) for side pot
    expect(p1.chips).toBe(400);  // Started 100 + won 300
    expect(p2.chips).toBe(400);  // Started 300 - bet 300 + won 400
    expect(p3.chips).toBe(700);  // Started 1000 - bet 300
  });

  it.skip('FAILS: all-in winner gets 0 chips with side pots', async () => {
    const manager = new PokerGameManager();
    
    const table = manager.createTable({
      tableId: 'bug-repro',
      minPlayers: 3,
      maxPlayers: 3,
      blinds: { small: 10, big: 20 },
      dealerButton: 0,
      minBuyIn: 1000,
    });

    // Deterministic deck: P1 gets AA and wins
    const customDeck = [
      // Deal to each player
      { rank: 'A', suit: 's', toString() { return 'As'; } }, // P1
      { rank: '2', suit: 'd', toString() { return '2d'; } }, // P2
      { rank: '3', suit: 'c', toString() { return '3c'; } }, // P3
      { rank: 'A', suit: 'h', toString() { return 'Ah'; } }, // P1
      { rank: '2', suit: 'h', toString() { return '2h'; } }, // P2
      { rank: '3', suit: 'h', toString() { return '3h'; } }, // P3
      // Burn + Flop
      { rank: '4', suit: 'c', toString() { return '4c'; } },
      { rank: '5', suit: 'd', toString() { return '5d'; } },
      { rank: '6', suit: 's', toString() { return '6s'; } },
      { rank: '7', suit: 'h', toString() { return '7h'; } },
      // Burn + Turn + Burn + River
      { rank: '8', suit: 'c', toString() { return '8c'; } },
      { rank: '9', suit: 'd', toString() { return '9d'; } },
      { rank: 'T', suit: 's', toString() { return 'Ts'; } },
      { rank: 'J', suit: 'h', toString() { return 'Jh'; } },
    ];

    table.setCustomDeck(customDeck);

    // Create players
    const p1 = new TestPlayer({
      id: 'p1',
      name: 'ShortStack',
      actions: [{ action: Action.ALL_IN, amount: 100 }] // Will go all-in with 100
    });

    const p2 = new TestPlayer({
      id: 'p2', 
      name: 'MidStack',
      actions: [{ action: Action.CALL, amount: 90 }] // Call the all-in
    });

    const p3 = new TestPlayer({
      id: 'p3',
      name: 'BigStack',
      actions: [{ action: Action.CALL, amount: 80 }] // Call the all-in
    });

    await table.addPlayer(p1);
    await table.addPlayer(p2);
    await table.addPlayer(p3);

    // Adjust chips to create the scenario
    p1.removeChips(900); // 100 chips
    p2.removeChips(500); // 500 chips
    // p3 keeps 1000 chips

    console.log('\n=== SETUP ===');
    console.log('P1 (ShortStack):', p1.chips, 'chips');
    console.log('P2 (MidStack):', p2.chips, 'chips');
    console.log('P3 (BigStack):', p3.chips, 'chips');

    let handResult = null;
    table.on('hand:ended', (data) => {
      handResult = data;
    });

    // Start game
    table.tryStartGame();

    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n=== RESULT ===');
    console.log('Winners:', handResult.winners.map(w => ({
      id: w.playerId,
      amount: w.amount,
      hand: w.hand.description
    })));
    
    console.log('\nPots:', handResult.sidePots.map(pot => ({
      amount: pot.amount,
      eligible: pot.eligiblePlayers
    })));

    // THE BUG: Winner gets 0 chips
    const winner = handResult.winners[0];
    expect(winner.playerId).toBe('p1'); // P1 wins with AA
    expect(winner.amount).toBe(300); // Should win 300 (100 from each player)
    
    // But actually gets 0 due to the bug!
    console.log('\n🐛 BUG: Winner received', winner.amount, 'chips instead of 300!');
  });
});