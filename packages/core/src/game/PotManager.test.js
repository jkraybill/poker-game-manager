import { describe, it, expect, beforeEach } from 'vitest';
import { PotManager } from './PotManager.js';

describe('PotManager', () => {
  let players;
  let potManager;
  const smallBlind = 50;

  beforeEach(() => {
    // Create mock players
    players = [
      { id: 'player1', name: 'Player 1', state: 'ACTIVE', chips: 1000 },
      { id: 'player2', name: 'Player 2', state: 'ACTIVE', chips: 1500 },
      { id: 'player3', name: 'Player 3', state: 'ACTIVE', chips: 2000 },
    ];
    potManager = new PotManager(players, smallBlind);
  });

  describe('constructor and initialization', () => {
    it('should initialize with correct properties', () => {
      expect(potManager.players).toEqual(players);
      expect(potManager.smallBlind).toBe(smallBlind);
      expect(potManager.pots).toHaveLength(1);
      expect(potManager.currentPot).toBe(potManager.pots[0]);
    });

    it('should create main pot with all players eligible', () => {
      expect(potManager.currentPot.amount).toBe(0);
      expect(potManager.currentPot.eligiblePlayers).toEqual(players);
      expect(potManager.currentPot.contributions).toBeInstanceOf(Map);
      expect(potManager.currentPot.contributions.size).toBe(0);
    });
  });

  describe('addToPot', () => {
    it('should add chips to pot for a player', () => {
      potManager.addToPot(players[0], 100);
      
      expect(potManager.currentPot.amount).toBe(100);
      expect(potManager.currentPot.contributions.get(players[0])).toBe(100);
    });

    it('should accumulate multiple contributions from same player', () => {
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[0], 50);
      
      expect(potManager.currentPot.amount).toBe(150);
      expect(potManager.currentPot.contributions.get(players[0])).toBe(150);
    });

    it('should handle contributions from multiple players', () => {
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 200);
      potManager.addToPot(players[2], 150);
      
      expect(potManager.currentPot.amount).toBe(450);
      expect(potManager.currentPot.contributions.get(players[0])).toBe(100);
      expect(potManager.currentPot.contributions.get(players[1])).toBe(200);
      expect(potManager.currentPot.contributions.get(players[2])).toBe(150);
    });
  });

  describe('getTotalContribution', () => {
    it('should return 0 for player with no contributions', () => {
      expect(potManager.getTotalContribution(players[0])).toBe(0);
    });

    it('should return total contribution from single pot', () => {
      potManager.addToPot(players[0], 100);
      expect(potManager.getTotalContribution(players[0])).toBe(100);
    });

    it('should sum contributions across multiple pots', () => {
      // Add to main pot
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 200);
      
      // Manually create a side pot for testing
      const sidePot = {
        amount: 150,
        eligiblePlayers: [players[0], players[1]],
        contributions: new Map([[players[0], 50], [players[1], 100]]),
      };
      potManager.pots.push(sidePot);
      
      expect(potManager.getTotalContribution(players[0])).toBe(150);
      expect(potManager.getTotalContribution(players[1])).toBe(300);
    });
  });

  describe('getTotal', () => {
    it('should return 0 for empty pot', () => {
      expect(potManager.getTotal()).toBe(0);
    });

    it('should return total from single pot', () => {
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 200);
      expect(potManager.getTotal()).toBe(300);
    });

    it('should sum amounts across multiple pots', () => {
      // Main pot
      potManager.currentPot.amount = 300;
      
      // Add side pots
      potManager.pots.push({ amount: 200, eligiblePlayers: [], contributions: new Map() });
      potManager.pots.push({ amount: 150, eligiblePlayers: [], contributions: new Map() });
      
      expect(potManager.getTotal()).toBe(650);
    });
  });

  describe('createSidePots', () => {
    it('should not create side pots when no all-in players', () => {
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 100);
      potManager.addToPot(players[2], 100);
      
      potManager.createSidePots();
      
      expect(potManager.pots).toHaveLength(1);
      expect(potManager.currentPot.amount).toBe(300);
    });

    it('should create side pot for single all-in player', () => {
      // Player 1 goes all-in with 100
      players[0].state = 'ALL_IN';
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 200);
      potManager.addToPot(players[2], 200);
      
      potManager.createSidePots();
      
      // Should have main pot (300) and side pot (200)
      expect(potManager.pots).toHaveLength(2);
      expect(potManager.pots[0].amount).toBe(300); // Main pot: 100 from each
      expect(potManager.pots[0].eligiblePlayers).toContain(players[0]);
      expect(potManager.pots[1].amount).toBe(200); // Side pot: extra 100 from P2 and P3
    });

    it('should create multiple side pots for multiple all-in players', () => {
      // Player 1 all-in with 100
      players[0].state = 'ALL_IN';
      potManager.addToPot(players[0], 100);
      
      // Player 2 all-in with 200
      players[1].state = 'ALL_IN';
      potManager.addToPot(players[1], 200);
      
      // Player 3 continues with 300
      potManager.addToPot(players[2], 300);
      
      potManager.createSidePots();
      
      // Should have 3 pots
      expect(potManager.pots).toHaveLength(3);
      
      // Main pot: 100 from each (300 total)
      expect(potManager.pots[0].amount).toBe(300);
      expect(potManager.pots[0].eligiblePlayers).toHaveLength(3);
      
      // Side pot 1: extra 100 from P2 and P3 (200 total)
      expect(potManager.pots[1].amount).toBe(200);
      expect(potManager.pots[1].eligiblePlayers).toHaveLength(2);
      
      // Side pot 2: extra 100 from P3 only
      expect(potManager.pots[2].amount).toBe(100);
    });

    it('should handle all-in players with same contribution amount', () => {
      players[0].state = 'ALL_IN';
      players[1].state = 'ALL_IN';
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 100);
      potManager.addToPot(players[2], 200);
      
      potManager.createSidePots();
      
      // Should have main pot (300) and side pot (100)
      expect(potManager.pots).toHaveLength(2);
      expect(potManager.pots[0].amount).toBe(300);
      expect(potManager.pots[1].amount).toBe(100);
    });
  });

  describe('endBettingRound', () => {
    it('should call createSidePots', () => {
      // Add some contributions
      players[0].state = 'ALL_IN';
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 200);
      
      potManager.endBettingRound();
      
      // Verify side pots were created
      expect(potManager.pots.length).toBeGreaterThan(1);
    });
  });

  describe('calculatePayouts', () => {
    it('should return empty map for no winners', () => {
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 100);
      
      const payouts = potManager.calculatePayouts([]);
      
      expect(payouts.size).toBe(0);
    });

    it('should give entire pot to single winner', () => {
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 100);
      potManager.addToPot(players[2], 100);
      
      const winners = [{ playerData: players[0] }];
      const payouts = potManager.calculatePayouts(winners);
      
      expect(payouts.get(players[0])).toBe(300);
    });

    it('should split pot evenly among multiple winners', () => {
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 100);
      potManager.addToPot(players[2], 100);
      
      const winners = [
        { playerData: players[0] },
        { playerData: players[1] },
      ];
      const payouts = potManager.calculatePayouts(winners);
      
      expect(payouts.get(players[0])).toBe(150);
      expect(payouts.get(players[1])).toBe(150);
    });

    it('should handle odd pot amounts with remainder', () => {
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 100);
      potManager.addToPot(players[2], 101); // 301 total
      
      const winners = [
        { playerData: players[0] },
        { playerData: players[1] },
      ];
      const payouts = potManager.calculatePayouts(winners);
      
      // 301 / 2 = 150 remainder 1
      // First winner gets the extra chip
      expect(payouts.get(players[0])).toBe(151);
      expect(payouts.get(players[1])).toBe(150);
    });

    it('should correctly distribute side pots when all tie', () => {
      // Player 1 all-in with 100
      players[0].state = 'ALL_IN';
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 200);
      potManager.addToPot(players[2], 200);
      
      potManager.createSidePots();
      
      // If all players tie, they split pots they're eligible for
      const winners = [
        { playerData: players[0] }, // Eligible for main pot only
        { playerData: players[1] }, // Eligible for both pots
        { playerData: players[2] }, // Eligible for both pots
      ];
      
      const payouts = potManager.calculatePayouts(winners);
      
      // Main pot (300) split 3 ways = 100 each
      // Side pot (200) split 2 ways = 100 each for P2 and P3
      expect(payouts.get(players[0])).toBe(100);
      expect(payouts.get(players[1])).toBe(200); // 100 from main + 100 from side
      expect(payouts.get(players[2])).toBe(200); // 100 from main + 100 from side
    });

    it('should give entire main pot to all-in winner', () => {
      // Player 1 all-in with 100
      players[0].state = 'ALL_IN';
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 200);
      potManager.addToPot(players[2], 200);
      
      potManager.createSidePots();
      
      // Only Player 1 wins (has best hand)
      const winners = [
        { playerData: players[0] }
      ];
      
      const payouts = potManager.calculatePayouts(winners);
      
      // Player 1 gets entire main pot (300), not eligible for side pot
      expect(payouts.get(players[0])).toBe(300);
      expect(payouts.has(players[1])).toBe(false);
      expect(payouts.has(players[2])).toBe(false);
    });

    it('should handle winner not eligible for all pots', () => {
      // Create multiple pots with different eligible players
      players[0].state = 'ALL_IN';
      potManager.addToPot(players[0], 50);
      potManager.addToPot(players[1], 150);
      potManager.addToPot(players[2], 150);
      
      potManager.createSidePots();
      
      // Only Player 2 and 3 win (Player 1 not in winners)
      const winners = [
        { playerData: players[1] },
        { playerData: players[2] },
      ];
      
      const payouts = potManager.calculatePayouts(winners);
      
      // They split both main pot and side pot
      // Main pot: 150 (50 * 3) / 2 = 75 each
      // Side pot: 200 (100 * 2) / 2 = 100 each
      expect(payouts.get(players[1])).toBe(175);
      expect(payouts.get(players[2])).toBe(175);
    });
  });

  describe('updatePotForAction', () => {
    it('should handle bet action', () => {
      const action = { name: 'bet', amount: 100 };
      potManager.updatePotForAction(players[0], action);
      
      expect(potManager.currentPot.amount).toBe(100);
      expect(potManager.currentPot.contributions.get(players[0])).toBe(100);
    });

    it('should handle raise action', () => {
      const action = { name: 'raise', amount: 200 };
      potManager.updatePotForAction(players[0], action);
      
      expect(potManager.currentPot.amount).toBe(200);
      expect(potManager.currentPot.contributions.get(players[0])).toBe(200);
    });

    it('should handle call action', () => {
      const action = { name: 'call', amount: 100 };
      potManager.updatePotForAction(players[0], action);
      
      expect(potManager.currentPot.amount).toBe(100);
      expect(potManager.currentPot.contributions.get(players[0])).toBe(100);
    });

    it('should ignore fold action', () => {
      const action = { name: 'fold' };
      potManager.updatePotForAction(players[0], action);
      
      expect(potManager.currentPot.amount).toBe(0);
      expect(potManager.currentPot.contributions.has(players[0])).toBe(false);
    });

    it('should ignore check action', () => {
      const action = { name: 'check' };
      potManager.updatePotForAction(players[0], action);
      
      expect(potManager.currentPot.amount).toBe(0);
      expect(potManager.currentPot.contributions.has(players[0])).toBe(false);
    });
  });

  describe('edge cases and complex scenarios', () => {
    it('should handle empty player list', () => {
      const emptyPotManager = new PotManager([], smallBlind);
      
      expect(emptyPotManager.pots).toHaveLength(1);
      expect(emptyPotManager.currentPot.eligiblePlayers).toEqual([]);
      expect(emptyPotManager.getTotal()).toBe(0);
    });

    it('should handle zero contributions', () => {
      potManager.addToPot(players[0], 0);
      
      expect(potManager.currentPot.amount).toBe(0);
      expect(potManager.currentPot.contributions.get(players[0])).toBe(0);
    });

    it('should handle complex multi-way all-in scenario', () => {
      // Complex scenario: 4 players with different stack sizes
      const fourPlayers = [
        { id: 'p1', state: 'ALL_IN', chips: 50 },
        { id: 'p2', state: 'ALL_IN', chips: 150 },
        { id: 'p3', state: 'ALL_IN', chips: 300 },
        { id: 'p4', state: 'ACTIVE', chips: 1000 },
      ];
      
      const complexPotManager = new PotManager(fourPlayers, smallBlind);
      
      // Each goes all-in
      complexPotManager.addToPot(fourPlayers[0], 50);
      complexPotManager.addToPot(fourPlayers[1], 150);
      complexPotManager.addToPot(fourPlayers[2], 300);
      complexPotManager.addToPot(fourPlayers[3], 300); // Matches p3
      
      complexPotManager.createSidePots();
      
      // Should create 3 pots
      expect(complexPotManager.pots).toHaveLength(3);
      
      // Verify total is correct
      expect(complexPotManager.getTotal()).toBe(800);
      
      // If p1 wins everything they're eligible for
      const winners = [{ playerData: fourPlayers[0] }];
      const payouts = complexPotManager.calculatePayouts(winners);
      
      // p1 should only win the first pot (50 * 4 = 200)
      expect(payouts.get(fourPlayers[0])).toBe(200);
    });

    it('should maintain pot integrity through multiple betting rounds', () => {
      // Round 1
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 100);
      potManager.addToPot(players[2], 100);
      potManager.endBettingRound();
      
      // Round 2 - player 1 goes all-in
      players[0].state = 'ALL_IN';
      potManager.addToPot(players[0], 50);
      potManager.addToPot(players[1], 200);
      potManager.addToPot(players[2], 200);
      potManager.endBettingRound();
      
      // Verify total
      expect(potManager.getTotal()).toBe(750);
      
      // Verify pot structure
      expect(potManager.pots.length).toBeGreaterThanOrEqual(2);
    });
  });
});