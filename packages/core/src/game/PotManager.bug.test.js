import { describe, it, expect } from 'vitest';
import { PotManager } from './PotManager.js';

describe('PotManager - Issue #11 Bug Fixed', () => {
  it('should correctly create side pots when players go all-in', () => {
    // Create 3 mock players
    const p1 = { id: 'p1', name: 'Player 1', state: 'ACTIVE' };
    const p2 = { id: 'p2', name: 'Player 2', state: 'ACTIVE' };
    const p3 = { id: 'p3', name: 'Player 3', state: 'ACTIVE' };

    const potManager = new PotManager([p1, p2, p3]);

    // Simulate the exact scenario from our failing test
    // P1 goes all-in for 100 total (pre-flop)
    potManager.handleAllIn(p1, 100);
    potManager.addToPot(p1, 100);

    // P2 goes all-in for 300 total
    potManager.handleAllIn(p2, 300);
    potManager.addToPot(p2, 300);

    // P3 calls for 300 total
    potManager.addToPot(p3, 300);

    console.log('\nPots after all betting:');
    const potsInfo = potManager.getPotsInfo();
    potsInfo.forEach((pot) => {
      console.log(`${pot.potName}:`, {
        amount: pot.amount,
        eligible: pot.eligiblePlayers,
        isActive: pot.isActive,
        maxContribution: pot.maxContribution,
      });
    });

    // Expected results:
    // Main pot: 300 (100 from each), all players eligible
    // Side pot: 400 (200 from P2 and P3), only P2 and P3 eligible

    expect(potsInfo).toHaveLength(2);

    // Check main pot
    const mainPot = potsInfo[0];
    expect(mainPot.potName).toBe('Main Pot');
    expect(mainPot.amount).toBe(300);
    expect(mainPot.eligiblePlayers).toHaveLength(3);
    expect(mainPot.eligiblePlayers).toContain('p1');
    expect(mainPot.eligiblePlayers).toContain('p2');
    expect(mainPot.eligiblePlayers).toContain('p3');

    // Check side pot
    const sidePot = potsInfo[1];
    expect(sidePot.potName).toBe('Side Pot 1');
    expect(sidePot.amount).toBe(400);
    expect(sidePot.eligiblePlayers).toHaveLength(2);
    expect(sidePot.eligiblePlayers).toContain('p2');
    expect(sidePot.eligiblePlayers).toContain('p3');
    expect(sidePot.eligiblePlayers).not.toContain('p1');
  });
});
