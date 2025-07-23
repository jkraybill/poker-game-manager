/**
 * PotManager Split Pot Tests
 *
 * Tests for pot distribution when multiple players tie.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PotManager } from './PotManager.js';
import { Player } from '../Player.js';
import { PlayerState } from '../types/index.js';

describe('PotManager Split Pot Distribution', () => {
  let players;

  beforeEach(() => {
    // Create real Player instances
    players = [
      new Player({ id: 'p1', name: 'Player 1' }),
      new Player({ id: 'p2', name: 'Player 2' }),
      new Player({ id: 'p3', name: 'Player 3' }),
    ];

    // Initialize chip stacks
    players.forEach((p) => p.buyIn(1000));
  });

  it('should split pot evenly between two winners', () => {
    const potManager = new PotManager(players);

    // Each player contributes 100
    potManager.addToPot(players[0], 100);
    potManager.addToPot(players[1], 100);
    potManager.addToPot(players[2], 100);

    // Players 0 and 1 tie with same hand rank
    const hands = [
      { player: players[0], hand: { rank: 2, description: 'Pair', kickers: [] }, cards: [] },
      { player: players[1], hand: { rank: 2, description: 'Pair', kickers: [] }, cards: [] },
      { player: players[2], hand: { rank: 1, description: 'High Card', kickers: [] }, cards: [] },
    ];

    const payouts = potManager.calculatePayouts(hands);

    expect(payouts.get(players[0])).toBe(150); // 300 / 2
    expect(payouts.get(players[1])).toBe(150);
    expect(payouts.get(players[2])).toBeUndefined(); // Not a winner
  });

  it('should split pot among three winners', () => {
    const potManager = new PotManager(players);

    // Each player contributes 90 (creates pot of 270)
    potManager.addToPot(players[0], 90);
    potManager.addToPot(players[1], 90);
    potManager.addToPot(players[2], 90);

    // All players tie
    const hands = [
      { player: players[0], hand: { rank: 2, description: 'Pair', kickers: [] }, cards: [] },
      { player: players[1], hand: { rank: 2, description: 'Pair', kickers: [] }, cards: [] },
      { player: players[2], hand: { rank: 2, description: 'Pair', kickers: [] }, cards: [] },
    ];

    const payouts = potManager.calculatePayouts(hands);

    expect(payouts.get(players[0])).toBe(90); // 270 / 3
    expect(payouts.get(players[1])).toBe(90);
    expect(payouts.get(players[2])).toBe(90);
  });

  it('should handle odd chip distribution correctly', () => {
    const potManager = new PotManager(players);

    // Create pot of 301 (not evenly divisible by 2)
    potManager.addToPot(players[0], 100);
    potManager.addToPot(players[1], 100);
    potManager.addToPot(players[2], 101);

    // Players 0 and 1 tie
    const hands = [
      { player: players[0], hand: { rank: 2, description: 'Pair', kickers: [] }, cards: [] },
      { player: players[1], hand: { rank: 2, description: 'Pair', kickers: [] }, cards: [] },
      { player: players[2], hand: { rank: 1, description: 'High Card', kickers: [] }, cards: [] },
    ];

    const payouts = potManager.calculatePayouts(hands);

    // First winner gets the extra chip
    expect(payouts.get(players[0])).toBe(151); // 150 + 1 extra
    expect(payouts.get(players[1])).toBe(150);
    expect(payouts.get(players[2])).toBeUndefined();
  });

  it('should split main pot but award side pot to single winner', () => {
    const potManager = new PotManager(players);

    // Player 0 goes all-in for 100
    players[0].removeChips(900); // Has 100 left
    potManager.handleAllIn(players[0], 100);
    potManager.addToPot(players[0], 100);

    // Players 1 and 2 must first match the 100, then bet more
    potManager.addToPot(players[1], 100); // Match the all-in
    potManager.addToPot(players[2], 100); // Match the all-in
    
    // Now they can bet more in the side pot
    potManager.addToPot(players[1], 200); // Additional 200
    potManager.addToPot(players[2], 200); // Additional 200

    // Player 0 and 1 tie for main pot, Player 1 wins side pot
    const hands = [
      { player: players[0], hand: { rank: 2, description: 'Pair', kickers: [] }, cards: [] },
      { player: players[1], hand: { rank: 2, description: 'Pair', kickers: [] }, cards: [] },
      { player: players[2], hand: { rank: 1, description: 'High Card', kickers: [] }, cards: [] },
    ];

    const payouts = potManager.calculatePayouts(hands);

    // P0 only contributed 100, so main pot is capped at 300 (100 from each)
    // P0 and P1 tie for main pot, so each gets 150
    // No side pot was created because P0's all-in was handled before others bet more
    expect(payouts.get(players[0])).toBe(150); // Half of main pot
    expect(payouts.get(players[1])).toBe(150); // Half of main pot
    expect(payouts.get(players[2])).toBeUndefined();
  });

  it('should handle basic side pot when short stack goes all-in', () => {
    // POKER 101: Basic side pot scenario
    // - 3 players: P1 has 50 chips, P2 has 200 chips, P3 has 200 chips
    // - P1 goes all-in for 50
    // - P2 and P3 call and continue betting
    // - This MUST create a main pot (150) and side pot for P2/P3
    
    const players = [
      new Player({ id: 'p1', name: 'Short Stack' }),
      new Player({ id: 'p2', name: 'Big Stack 1' }),
      new Player({ id: 'p3', name: 'Big Stack 2' }),
    ];
    
    // Set up chip counts and state
    // Note: In real game, GameEngine manages player state
    // For unit tests, we need to set it manually
    players[0].chips = 50;
    players[0].state = PlayerState.ACTIVE;
    players[1].chips = 200;
    players[1].state = PlayerState.ACTIVE;
    players[2].chips = 200;
    players[2].state = PlayerState.ACTIVE;
    
    const potManager = new PotManager(players);

    // Pre-flop betting:
    // P1 goes all-in for 50
    potManager.handleAllIn(players[0], 50);  // Call this FIRST to cap the pot
    potManager.addToPot(players[0], 50);     // Then add the chips
    players[0].removeChips(50);

    // P2 calls 50 first
    potManager.addToPot(players[1], 50);
    players[1].removeChips(50);

    // P3 raises to 100 total
    potManager.addToPot(players[2], 100);
    players[2].removeChips(100);

    // P2 calls the additional 50
    potManager.addToPot(players[1], 50);
    players[1].removeChips(50);


    // Expected pots:
    // - Main pot: 150 (50 from each player) - all eligible
    // - Side pot: 100 (50 more from P2 and P3) - only P2/P3 eligible

    // P1 wins with best hand
    const hands = [
      { player: players[0], hand: { rank: 3, description: 'Three of a Kind', kickers: [] }, cards: [] },
      { player: players[1], hand: { rank: 2, description: 'Pair', kickers: [] }, cards: [] },
      { player: players[2], hand: { rank: 1, description: 'High Card', kickers: [] }, cards: [] },
    ];

    const payouts = potManager.calculatePayouts(hands);

    const p1Payout = payouts.get(players[0]) || 0;
    const p2Payout = payouts.get(players[1]) || 0;
    const p3Payout = payouts.get(players[2]) || 0;

    // P1 should win main pot (150) only
    expect(p1Payout).toBe(150);
    
    // P2 should win side pot (100)
    expect(p2Payout).toBe(100);
    
    // P3 gets nothing
    expect(p3Payout).toBe(0);

    // Total payout should equal total pot
    expect(p1Payout + p2Payout + p3Payout).toBe(250);
  });
});