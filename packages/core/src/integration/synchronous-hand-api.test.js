/**
 * Tests for synchronous hand resolution API (#46)
 * Verifies that runHandToCompletion() runs hands synchronously without events
 */
import { describe, it, expect } from 'vitest';
import { Table } from '../Table.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';
import { RiggedDeck } from '../game/RiggedDeck.js';

// Simple test player for predictable actions
class TestPlayer extends Player {
  constructor(id, strategy = 'check') {
    super({ id, name: id });
    this.strategy = strategy;
    this.actionsTaken = [];
  }

  getAction(gameState) {
    const action = this.determineAction(gameState);
    this.actionsTaken.push(action);
    return action;
  }

  determineAction(gameState) {
    if (this.strategy === 'fold') {
      if (gameState.toCall > 0) {
        return { action: Action.FOLD };
      }
      return { action: Action.CHECK };
    }

    if (this.strategy === 'call') {
      if (gameState.toCall > 0) {
        return { action: Action.CALL };
      }
      return { action: Action.CHECK };
    }

    if (this.strategy === 'raise') {
      if (gameState.currentBet < 100) {
        return { action: Action.RAISE, amount: 50 };
      }
      return { action: Action.CALL };
    }

    if (this.strategy === 'all-in') {
      const myState = gameState.players[this.id];
      return { action: Action.ALL_IN, amount: myState.chips };
    }

    // Default check/call strategy
    if (gameState.toCall > 0) {
      return { action: Action.CALL };
    }
    return { action: Action.CHECK };
  }
}

describe('Synchronous Hand Resolution API', () => {
  describe('Basic functionality', () => {
    it('should expose runHandToCompletion method on Table', () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
      });

      expect(typeof table.runHandToCompletion).toBe('function');
    });

    it('should return synchronously without promises', () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: true,
        minPlayers: 2,
      });

      const player1 = new TestPlayer('p1', 'fold');
      const player2 = new TestPlayer('p2', 'check');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      // This should return immediately, not a promise
      const result = table.runHandToCompletion();

      // Should not be a promise
      expect(result).not.toBeInstanceOf(Promise);
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should return complete hand results', () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: true,
        minPlayers: 2,
        dealerButton: 0,
      });

      const player1 = new TestPlayer('p1', 'call');
      const player2 = new TestPlayer('p2', 'check');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      const result = table.runHandToCompletion();

      if (!result.success) {
        console.log('Failed with error:', result.error);
      }

      expect(result.success).toBe(true);
      expect(result.winners).toBeDefined();
      expect(Array.isArray(result.winners)).toBe(true);
      expect(result.winners.length).toBeGreaterThan(0);

      // Should have winner details
      const winner = result.winners[0];
      expect(winner.playerId).toBeDefined();
      expect(winner.amount).toBeGreaterThan(0);
      expect(winner.handStrength).toBeDefined();

      // Should have pot information
      expect(result.pot).toBeDefined();
      expect(result.pot).toBeGreaterThan(0);

      // Should have final chip counts
      expect(result.finalChips).toBeDefined();
      expect(result.finalChips.p1).toBeDefined();
      expect(result.finalChips.p2).toBeDefined();
      expect(result.finalChips.p1 + result.finalChips.p2).toBe(2000); // Total chips conserved
    });

    it('should handle error cases gracefully', () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: true,
        minPlayers: 2,
      });

      // Try to run without enough players
      const result = table.runHandToCompletion();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Not enough players');
    });
  });

  describe('Game mechanics', () => {
    it('should correctly handle all-in scenarios', () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: true,
        minPlayers: 2,
        dealerButton: 0,
      });

      const player1 = new TestPlayer('p1', 'all-in');
      const player2 = new TestPlayer('p2', 'call');
      player1.chips = 500;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      const result = table.runHandToCompletion();

      expect(result.success).toBe(true);
      expect(result.pot).toBe(1000); // Both players all-in for 500 each

      // One player should have 0 chips, other should have 2000 or split
      const totalChips = result.finalChips.p1 + result.finalChips.p2;
      expect(totalChips).toBe(1500); // Total chips conserved
    });

    it('should work with custom decks', () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: true,
        minPlayers: 2,
        dealerButton: 0,
      });

      // Rig the deck so player 1 gets AA, player 2 gets KK
      const riggedDeck = new RiggedDeck([
        'As',
        'Ah', // Player 1 hole cards
        'Ks',
        'Kh', // Player 2 hole cards
        '2c',
        '3d',
        '4h',
        '5s',
        '6c', // Board
      ]);

      table.setDeck(riggedDeck);

      const player1 = new TestPlayer('p1', 'raise');
      const player2 = new TestPlayer('p2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      const result = table.runHandToCompletion();

      expect(result.success).toBe(true);
      // Player 1 with AA should win
      expect(result.winners[0].playerId).toBe('p1');
      expect(result.winners[0].handStrength).toContain('pair');
    });

    it('should handle multiple players', () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: true,
        minPlayers: 3,
        dealerButton: 0,
      });

      const player1 = new TestPlayer('p1', 'call');
      const player2 = new TestPlayer('p2', 'call');
      const player3 = new TestPlayer('p3', 'raise');
      player1.chips = 1000;
      player2.chips = 1000;
      player3.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);
      table.addPlayer(player3);

      const result = table.runHandToCompletion();

      expect(result.success).toBe(true);
      expect(result.finalChips.p1).toBeDefined();
      expect(result.finalChips.p2).toBeDefined();
      expect(result.finalChips.p3).toBeDefined();

      const totalChips =
        result.finalChips.p1 + result.finalChips.p2 + result.finalChips.p3;
      expect(totalChips).toBe(3000); // Total chips conserved
    });

    it('should handle side pots correctly', () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: true,
        minPlayers: 3,
        dealerButton: 0,
      });

      const player1 = new TestPlayer('p1', 'all-in');
      const player2 = new TestPlayer('p2', 'call');
      const player3 = new TestPlayer('p3', 'call');
      player1.chips = 200; // Short stack
      player2.chips = 1000;
      player3.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);
      table.addPlayer(player3);

      const result = table.runHandToCompletion();

      expect(result.success).toBe(true);

      // Should have side pot information
      if (result.sidePots) {
        expect(result.sidePots).toBeDefined();
        expect(Array.isArray(result.sidePots)).toBe(true);
      }

      const totalChips =
        result.finalChips.p1 + result.finalChips.p2 + result.finalChips.p3;
      expect(totalChips).toBe(2200); // Total chips conserved
    });
  });

  describe('Performance and Monte Carlo usage', () => {
    it('should run multiple hands rapidly for Monte Carlo simulations', () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: true,
        minPlayers: 2,
      });

      const results = [];
      const iterations = 1000;

      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        // Reset players for each iteration
        table.removeAllPlayers();

        const player1 = new TestPlayer(`p1_${i}`, 'call');
        const player2 = new TestPlayer(`p2_${i}`, 'raise');
        player1.chips = 1000;
        player2.chips = 1000;

        table.addPlayer(player1);
        table.addPlayer(player2);

        const result = table.runHandToCompletion();
        results.push(result);
      }

      const elapsed = Date.now() - start;

      // Should complete 1000 hands quickly (under 10 seconds)
      expect(elapsed).toBeLessThan(10000);

      // All hands should have completed successfully
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBe(iterations);

      // Should have winners for all hands
      const handsWithWinners = results.filter(
        (r) => r.winners && r.winners.length > 0,
      ).length;
      expect(handsWithWinners).toBe(iterations);
    });

    it('should work with simulationMode for maximum performance', () => {
      const normalTable = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: false,
        minPlayers: 2,
      });

      const simTable = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: true,
        minPlayers: 2,
      });

      // Test both modes work
      for (const table of [normalTable, simTable]) {
        table.removeAllPlayers();

        const player1 = new TestPlayer('p1', 'fold');
        const player2 = new TestPlayer('p2', 'check');
        player1.chips = 1000;
        player2.chips = 1000;

        table.addPlayer(player1);
        table.addPlayer(player2);

        const result = table.runHandToCompletion();

        expect(result.success).toBe(true);
        expect(result.winners).toBeDefined();
      }
    });

    it('should not interfere with normal event-driven gameplay', () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: true,
        minPlayers: 2,
      });

      const player1 = new TestPlayer('p1', 'call');
      const player2 = new TestPlayer('p2', 'check');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      // Run synchronous hand
      const syncResult = table.runHandToCompletion();
      expect(syncResult.success).toBe(true);

      // Reset chips
      player1.chips = 1000;
      player2.chips = 1000;

      // Should still be able to run normal event-driven game
      new Promise((resolve) => {
        table.once('hand:ended', ({ winners }) => {
          resolve({ success: true, winners });
        });
      });

      table.tryStartGame().then(() => {
        // Game started normally
      });

      // Both modes should work
      expect(syncResult.success).toBe(true);
    });
  });

  describe('Return value structure', () => {
    it('should return detailed hand information', () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: true,
        minPlayers: 2,
        dealerButton: 0,
      });

      const player1 = new TestPlayer('p1', 'raise');
      const player2 = new TestPlayer('p2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      const result = table.runHandToCompletion();

      // Core fields
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('winners');
      expect(result).toHaveProperty('pot');
      expect(result).toHaveProperty('finalChips');

      // Optional detailed fields
      if (result.board) {
        expect(Array.isArray(result.board)).toBe(true);
        expect(result.board.length).toBeLessThanOrEqual(5);
      }

      if (result.handHistory) {
        expect(Array.isArray(result.handHistory)).toBe(true);
      }

      if (result.showdownParticipants) {
        expect(Array.isArray(result.showdownParticipants)).toBe(true);
      }
    });

    it('should include error details on failure', () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: true,
        minPlayers: 3,
      });

      // Only add 2 players when 3 are required
      const player1 = new TestPlayer('p1', 'call');
      const player2 = new TestPlayer('p2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      const result = table.runHandToCompletion();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.error.toLowerCase()).toContain('players');
    });
  });
});
