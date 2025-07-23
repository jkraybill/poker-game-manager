import { describe, it, expect, beforeEach } from 'vitest';
import { PotManager } from './PotManager.js';

describe('PotManager', () => {
  let players;
  let potManager;

  beforeEach(() => {
    // Create mock players
    players = [
      { id: 'player1', name: 'Player 1', state: 'ACTIVE', chips: 1000 },
      { id: 'player2', name: 'Player 2', state: 'ACTIVE', chips: 1500 },
      { id: 'player3', name: 'Player 3', state: 'ACTIVE', chips: 2000 },
    ];
    potManager = new PotManager(players);
  });

  describe('constructor and initialization', () => {
    it('should initialize with correct properties', () => {
      expect(potManager.players).toEqual(players);
      expect(potManager.pots).toHaveLength(1);
      expect(potManager.pots[0].id).toBe(0);
      expect(potManager.pots[0].name).toBe('Main Pot');
    });

    it('should create main pot with all players eligible', () => {
      const mainPot = potManager.pots[0];
      expect(mainPot.amount).toBe(0);
      expect(mainPot.eligiblePlayers).toEqual(players);
      expect(mainPot.contributions).toBeInstanceOf(Map);
      expect(mainPot.contributions.size).toBe(0);
    });
  });

  describe('addToPot', () => {
    it('should add chips to pot for a player', () => {
      potManager.addToPot(players[0], 100);

      const mainPot = potManager.pots[0];
      expect(mainPot.amount).toBe(100);
      expect(mainPot.contributions.get(players[0])).toBe(100);
    });

    it('should accumulate multiple contributions from same player', () => {
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[0], 50);

      const mainPot = potManager.pots[0];
      expect(mainPot.amount).toBe(150);
      expect(mainPot.contributions.get(players[0])).toBe(150);
    });

    it('should handle contributions from multiple players', () => {
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 200);
      potManager.addToPot(players[2], 150);

      const mainPot = potManager.pots[0];
      expect(mainPot.amount).toBe(450);
      expect(mainPot.contributions.get(players[0])).toBe(100);
      expect(mainPot.contributions.get(players[1])).toBe(200);
      expect(mainPot.contributions.get(players[2])).toBe(150);
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
  });

  describe('handleAllIn', () => {
    it('should create side pot when player goes all-in', () => {
      // P1 goes all-in for 100 total
      potManager.handleAllIn(players[0], 100);
      
      // Should have created a side pot
      expect(potManager.pots).toHaveLength(2);
      expect(potManager.pots[0].maxContributionPerPlayer).toBe(100);
      expect(potManager.pots[0].isActive).toBe(false);
      expect(potManager.pots[1].eligiblePlayers).toEqual([players[1], players[2]]);
    });
  });

  describe('calculatePayouts', () => {
    it('should return correct payouts for single winner', () => {
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 100);
      potManager.addToPot(players[2], 100);

      // Mock hands - P1 wins with best hand
      const hands = [
        { 
          player: players[0], 
          hand: { rank: 3, description: 'Three of a Kind', kickers: [] },
          cards: [],
        },
        { 
          player: players[1], 
          hand: { rank: 2, description: 'Pair', kickers: [] },
          cards: [],
        },
        { 
          player: players[2], 
          hand: { rank: 1, description: 'High Card', kickers: [] },
          cards: [],
        },
      ];

      const payouts = potManager.calculatePayouts(hands);
      expect(payouts.get(players[0])).toBe(300);
      expect(payouts.get(players[1])).toBeUndefined();
      expect(payouts.get(players[2])).toBeUndefined();
    });

    it('should split pot between tied winners', () => {
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 100);
      potManager.addToPot(players[2], 100);

      // Mock hands - P1 and P2 tie
      const hands = [
        { 
          player: players[0], 
          hand: { rank: 2, description: 'Pair', kickers: [] },
          cards: [],
        },
        { 
          player: players[1], 
          hand: { rank: 2, description: 'Pair', kickers: [] },
          cards: [],
        },
        { 
          player: players[2], 
          hand: { rank: 1, description: 'High Card', kickers: [] },
          cards: [],
        },
      ];

      const payouts = potManager.calculatePayouts(hands);
      expect(payouts.get(players[0])).toBe(150);
      expect(payouts.get(players[1])).toBe(150);
      expect(payouts.get(players[2])).toBeUndefined();
    });

    it('should handle side pots correctly', () => {
      // Set up a scenario with side pots
      // P1 goes all-in for 100
      potManager.handleAllIn(players[0], 100);
      potManager.addToPot(players[0], 100);
      
      // P2 and P3 continue betting
      potManager.addToPot(players[1], 100);
      potManager.addToPot(players[2], 100);
      
      // Add more to side pot
      potManager.addToPot(players[1], 200);
      potManager.addToPot(players[2], 200);

      // Mock hands - P1 wins main pot, P2 wins side pot
      const hands = [
        { 
          player: players[0], 
          hand: { rank: 3, description: 'Three of a Kind', kickers: [] },
          cards: [],
        },
        { 
          player: players[1], 
          hand: { rank: 2, description: 'Pair', kickers: [] },
          cards: [],
        },
        { 
          player: players[2], 
          hand: { rank: 1, description: 'High Card', kickers: [] },
          cards: [],
        },
      ];

      const payouts = potManager.calculatePayouts(hands);
      expect(payouts.get(players[0])).toBe(300); // Wins main pot of 300
      expect(payouts.get(players[1])).toBe(400); // Wins side pot of 400
      expect(payouts.get(players[2])).toBeUndefined();
    });
  });

  describe('getPotsInfo', () => {
    it('should return pot information', () => {
      potManager.addToPot(players[0], 100);
      potManager.addToPot(players[1], 200);

      const potsInfo = potManager.getPotsInfo();
      expect(potsInfo).toHaveLength(1);
      expect(potsInfo[0]).toEqual({
        potId: 0,
        potName: 'Main Pot',
        amount: 300,
        eligiblePlayers: ['player1', 'player2', 'player3'],
        isMain: true,
        isActive: true,
        maxContribution: null,
      });
    });
  });

  describe('reset', () => {
    it('should reset pots to initial state', () => {
      potManager.addToPot(players[0], 100);
      potManager.handleAllIn(players[1], 200);
      
      expect(potManager.pots).toHaveLength(2);
      
      potManager.reset();
      
      expect(potManager.pots).toHaveLength(1);
      expect(potManager.pots[0].amount).toBe(0);
      expect(potManager.pots[0].id).toBe(0);
    });
  });

  describe('events', () => {
    it('should emit pot:updated event', () => {
      let eventData = null;
      potManager.on('pot:updated', (data) => {
        eventData = data;
      });

      potManager.addToPot(players[0], 100);

      expect(eventData).toEqual({
        potId: 0,
        potName: 'Main Pot',
        total: 100,
        playerBet: { playerId: 'player1', amount: 100 },
      });
    });

    it('should emit sidepot:created event', () => {
      let eventData = null;
      potManager.on('sidepot:created', (data) => {
        eventData = data;
      });

      potManager.handleAllIn(players[0], 100);

      expect(eventData).toEqual({
        potId: 1,
        potName: 'Side Pot 1',
        eligiblePlayers: ['player2', 'player3'],
        eligibleCount: 2,
      });
    });
  });
});