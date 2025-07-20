/**
 * PotManager Split Pot Tests
 * 
 * Tests for pot distribution when multiple players tie.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PotManager } from './PotManager.js';

describe('PotManager Split Pot Distribution', () => {
  let players;

  beforeEach(() => {
    // Create mock players
    players = [
      { player: { id: 'p1' }, chips: 1000, state: 'ACTIVE' },
      { player: { id: 'p2' }, chips: 1000, state: 'ACTIVE' },
      { player: { id: 'p3' }, chips: 1000, state: 'ACTIVE' },
    ];
  });

  it('should split pot evenly between two winners', () => {
    const potManager = new PotManager(players, 10);
    
    // Each player contributes 100
    potManager.addToPot(players[0], 100);
    potManager.addToPot(players[1], 100);
    potManager.addToPot(players[2], 100);
    
    // Players 0 and 1 tie
    const winners = [
      { playerData: players[0] },
      { playerData: players[1] },
    ];
    
    const payouts = potManager.calculatePayouts(winners);
    
    expect(payouts.get(players[0])).toBe(150); // 300 / 2
    expect(payouts.get(players[1])).toBe(150);
    expect(payouts.get(players[2])).toBeUndefined(); // Not a winner
  });

  it('should split pot among three winners', () => {
    const potManager = new PotManager(players, 10);
    
    // Each player contributes 90 (creates pot of 270)
    potManager.addToPot(players[0], 90);
    potManager.addToPot(players[1], 90);
    potManager.addToPot(players[2], 90);
    
    // All three tie
    const winners = [
      { playerData: players[0] },
      { playerData: players[1] },
      { playerData: players[2] },
    ];
    
    const payouts = potManager.calculatePayouts(winners);
    
    // 270 / 3 = 90 each
    expect(payouts.get(players[0])).toBe(90);
    expect(payouts.get(players[1])).toBe(90);
    expect(payouts.get(players[2])).toBe(90);
  });

  it('should handle odd chip distribution correctly', () => {
    const potManager = new PotManager(players, 10);
    
    // Create pot of 101 (not evenly divisible by 2)
    potManager.addToPot(players[0], 50);
    potManager.addToPot(players[1], 51);
    
    // Two winners
    const winners = [
      { playerData: players[0] },
      { playerData: players[1] },
    ];
    
    const payouts = potManager.calculatePayouts(winners);
    
    // 101 / 2 = 50 remainder 1
    // First winner gets the extra chip
    expect(payouts.get(players[0])).toBe(51);
    expect(payouts.get(players[1])).toBe(50);
    expect(payouts.get(players[0]) + payouts.get(players[1])).toBe(101);
  });

  it('should split main pot but award side pot to single winner', () => {
    const potManager = new PotManager(players, 10);
    
    // Player 0 is short stacked
    players[0].chips = 100;
    players[1].chips = 500;
    players[2].chips = 500;
    
    // Simulate betting where player 0 goes all-in
    potManager.addToPot(players[0], 100);
    potManager.addToPot(players[1], 300);
    potManager.addToPot(players[2], 300);
    
    // Create side pots
    potManager.endBettingRound();
    
    // Players 0 and 1 tie for best hand, player 2 loses
    const winners = [
      { playerData: players[0] },
      { playerData: players[1] },
    ];
    
    const payouts = potManager.calculatePayouts(winners);
    
    // Main pot: 100 × 3 = 300, split between p0 and p1 = 150 each
    // Side pot: 200 × 2 = 400, only p1 eligible = 400
    expect(payouts.get(players[0])).toBe(150); // Only gets main pot share
    expect(payouts.get(players[1])).toBe(550); // Gets main pot share + side pot
  });

  it('should handle complex multi-way split with side pots', () => {
    const potManager = new PotManager(players, 10);
    
    // Different stack sizes
    players[0].chips = 50;
    players[1].chips = 150;
    players[2].chips = 300;
    
    // All go all-in
    potManager.addToPot(players[0], 50);
    potManager.addToPot(players[1], 150);
    potManager.addToPot(players[2], 300);
    
    potManager.endBettingRound();
    
    // All three players tie
    const winners = [
      { playerData: players[0] },
      { playerData: players[1] },
      { playerData: players[2] },
    ];
    
    const payouts = potManager.calculatePayouts(winners);
    
    // Pot 1: 50 × 3 = 150, split 3 ways = 50 each
    // Pot 2: 100 × 2 = 200, split between p1 and p2 = 100 each
    // Pot 3: 150 × 1 = 150, only p2 = 150
    expect(payouts.get(players[0])).toBe(50);   // Only in first pot
    expect(payouts.get(players[1])).toBe(150);  // First + second pot
    expect(payouts.get(players[2])).toBe(300);  // All three pots
    
    // Total distributed equals total pot
    const totalPot = 50 + 150 + 300;
    const totalPayout = payouts.get(players[0]) + payouts.get(players[1]) + payouts.get(players[2]);
    expect(totalPayout).toBe(totalPot);
  });
});