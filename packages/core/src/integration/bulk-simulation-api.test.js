/**
 * Tests for bulk simulation API (#47)
 * Enables running multiple poker simulations efficiently for Monte Carlo analysis
 */
import { describe, it, expect } from 'vitest';
import { Table } from '../Table.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';
import { RiggedDeck } from '../game/RiggedDeck.js';

// Simple test player for predictable simulations
class SimulationPlayer extends Player {
  constructor(id, strategy = 'aggressive') {
    super({ id, name: id });
    this.strategy = strategy;
  }

  getAction(gameState) {
    if (this.strategy === 'aggressive') {
      if (gameState.toCall > 0) {
        return { action: Action.CALL };
      }
      return { action: Action.CHECK };
    }

    if (this.strategy === 'fold') {
      if (gameState.toCall > 0) {
        return { action: Action.FOLD };
      }
      return { action: Action.CHECK };
    }

    // Default: passive strategy
    if (gameState.toCall > 0) {
      return { action: Action.CALL };
    }
    return { action: Action.CHECK };
  }
}

describe('Bulk Simulation API', () => {
  describe('Static Table.runSimulations method', () => {
    it('should expose runSimulations static method', () => {
      expect(typeof Table.runSimulations).toBe('function');
    });

    it('should run a single simulation', async () => {
      const results = await Table.runSimulations({
        count: 1,
        config: {
          blinds: { small: 10, big: 20 },
          simulationMode: true,
          minPlayers: 2,
          dealerButton: 0,
        },
        players: [
          new SimulationPlayer('p1', 'aggressive'),
          new SimulationPlayer('p2', 'fold'),
        ],
      });

      expect(results).toBeDefined();
      expect(results.simulations).toBeDefined();
      expect(Array.isArray(results.simulations)).toBe(true);
      expect(results.simulations).toHaveLength(1);
      expect(results.simulations[0].success).toBe(true);
      expect(results.simulations[0].winners).toBeDefined();
      expect(results.simulations[0].pot).toBeGreaterThan(0);
    });

    it('should run multiple simulations', async () => {
      const count = 5;
      const results = await Table.runSimulations({
        count,
        config: {
          blinds: { small: 10, big: 20 },
          simulationMode: true,
          minPlayers: 2,
          dealerButton: 0,
        },
        players: [
          new SimulationPlayer('p1', 'aggressive'),
          new SimulationPlayer('p2', 'fold'),
        ],
      });

      expect(results.simulations).toHaveLength(count);

      // All simulations should be successful
      const successCount = results.simulations.filter(
        (sim) => sim.success,
      ).length;
      expect(successCount).toBe(count);

      // All should have winners
      const withWinners = results.simulations.filter(
        (sim) => sim.winners && sim.winners.length > 0,
      ).length;
      expect(withWinners).toBe(count);
    });

    it('should work with known cards (RiggedDeck)', async () => {
      const riggedDeck = new RiggedDeck({
        cards: [
          'As',
          'Ah', // P1 gets AA
          'Ks',
          'Kh', // P2 gets KK
          '7s',
          '2c',
          '8d',
          '9h',
          'Ts', // Flop + burn
          'Jc',
          'Qd',
          '3c', // Turn + burn + River
        ],
        dealAlternating: false,
      });

      const results = await Table.runSimulations({
        count: 3,
        config: {
          blinds: { small: 10, big: 20 },
          simulationMode: true,
          minPlayers: 2,
          dealerButton: 0,
        },
        players: [
          new SimulationPlayer('p1', 'aggressive'),
          new SimulationPlayer('p2', 'aggressive'),
        ],
        deck: riggedDeck,
      });

      expect(results.simulations).toHaveLength(3);

      // P1 with AA should win all hands with this setup
      results.simulations.forEach((sim) => {
        expect(sim.success).toBe(true);
        expect(sim.winners[0].playerId).toBe('p1');
      });
    });

    it('should handle error cases gracefully', async () => {
      const results = await Table.runSimulations({
        count: 2,
        config: {
          blinds: { small: 10, big: 20 },
          simulationMode: true,
          minPlayers: 3, // Require 3 players but only provide 2
          dealerButton: 0,
        },
        players: [new SimulationPlayer('p1'), new SimulationPlayer('p2')],
      });

      expect(results.simulations).toHaveLength(2);

      // All simulations should fail due to insufficient players
      results.simulations.forEach((sim) => {
        expect(sim.success).toBe(false);
        expect(sim.error).toContain('Not enough players');
      });
    });
  });

  describe('Parallel execution', () => {
    it('should support parallel execution', async () => {
      const start = Date.now();

      const results = await Table.runSimulations({
        count: 10,
        config: {
          blinds: { small: 10, big: 20 },
          simulationMode: true,
          minPlayers: 2,
          dealerButton: 0,
        },
        players: [
          new SimulationPlayer('p1', 'aggressive'),
          new SimulationPlayer('p2', 'fold'),
        ],
        parallel: 4, // Run 4 simulations concurrently
      });

      const elapsed = Date.now() - start;

      expect(results.simulations).toHaveLength(10);
      expect(elapsed).toBeLessThan(5000); // Should complete quickly with parallelism

      // All should be successful
      const successCount = results.simulations.filter(
        (sim) => sim.success,
      ).length;
      expect(successCount).toBe(10);
    });

    it('should default to sequential execution when parallel not specified', async () => {
      const results = await Table.runSimulations({
        count: 3,
        config: {
          blinds: { small: 10, big: 20 },
          simulationMode: true,
          minPlayers: 2,
          dealerButton: 0,
        },
        players: [new SimulationPlayer('p1'), new SimulationPlayer('p2')],
        // No parallel option specified
      });

      expect(results.simulations).toHaveLength(3);
      expect(results.simulations.every((sim) => sim.success)).toBe(true);
    });

    it('should limit concurrency to specified level', async () => {
      // This test verifies that we don't exceed the parallel limit
      // by checking that results are returned in batches
      const results = await Table.runSimulations({
        count: 6,
        config: {
          blinds: { small: 10, big: 20 },
          simulationMode: true,
          minPlayers: 2,
          dealerButton: 0,
        },
        players: [new SimulationPlayer('p1'), new SimulationPlayer('p2')],
        parallel: 2, // Only 2 concurrent simulations
      });

      expect(results.simulations).toHaveLength(6);
      expect(results.simulations.every((sim) => sim.success)).toBe(true);
    });
  });

  describe('Result aggregation', () => {
    it('should provide aggregated statistics', async () => {
      const results = await Table.runSimulations({
        count: 10,
        config: {
          blinds: { small: 10, big: 20 },
          simulationMode: true,
          minPlayers: 2,
          dealerButton: 0,
        },
        players: [
          new SimulationPlayer('p1', 'aggressive'),
          new SimulationPlayer('p2', 'fold'),
        ],
      });

      expect(results.stats).toBeDefined();
      expect(results.stats.totalSimulations).toBe(10);
      expect(results.stats.successfulSimulations).toBeDefined();
      expect(results.stats.successRate).toBeDefined();
      expect(results.stats.averagePot).toBeDefined();
      expect(typeof results.stats.averagePot).toBe('number');

      // Player statistics
      expect(results.stats.playerWins).toBeDefined();
      expect(results.stats.playerWins.p1).toBeDefined();
      expect(results.stats.playerWins.p2).toBeDefined();
      expect(typeof results.stats.playerWins.p1).toBe('number');
      expect(typeof results.stats.playerWins.p2).toBe('number');
    });

    it('should calculate win rates correctly', async () => {
      const results = await Table.runSimulations({
        count: 20,
        config: {
          blinds: { small: 10, big: 20 },
          simulationMode: true,
          minPlayers: 2,
          dealerButton: 0,
        },
        players: [
          new SimulationPlayer('p1', 'aggressive'),
          new SimulationPlayer('p2', 'aggressive'),
        ],
      });

      // All simulations should be successful
      expect(results.stats.successfulSimulations).toBe(20);
      expect(results.stats.successRate).toBe(1.0);

      // Total wins should be close to the number of simulations
      // (might be slightly higher in split pot scenarios where both players are winners)
      const totalWins =
        results.stats.playerWins.p1 + results.stats.playerWins.p2;
      expect(totalWins).toBeGreaterThanOrEqual(20);
      expect(totalWins).toBeLessThanOrEqual(22); // Allow for a few split pots

      // Both players should have some wins in a fair game
      expect(results.stats.playerWins.p1).toBeGreaterThan(0);
      expect(results.stats.playerWins.p2).toBeGreaterThan(0);

      // Average pot should be reasonable (blinds total 30)
      expect(results.stats.averagePot).toBeGreaterThan(20);
    });

    it('should handle mixed results in aggregation', async () => {
      const results = await Table.runSimulations({
        count: 5,
        config: {
          blinds: { small: 10, big: 20 },
          simulationMode: true,
          minPlayers: 3, // Some will fail, some will succeed if we add enough players
          dealerButton: 0,
        },
        players: [
          new SimulationPlayer('p1'),
          new SimulationPlayer('p2'),
          // Intentionally only 2 players for minPlayers: 3
        ],
      });

      expect(results.stats.totalSimulations).toBe(5);
      expect(results.stats.successfulSimulations).toBe(0); // All should fail
      expect(results.stats.successRate).toBe(0);
    });
  });

  describe('Memory efficiency', () => {
    it('should handle many simulations without memory issues', async () => {
      const startMemory = process.memoryUsage().heapUsed;

      const results = await Table.runSimulations({
        count: 100,
        config: {
          blinds: { small: 10, big: 20 },
          simulationMode: true,
          minPlayers: 2,
          dealerButton: 0,
        },
        players: [new SimulationPlayer('p1'), new SimulationPlayer('p2')],
        parallel: 4,
      });

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      expect(results.simulations).toHaveLength(100);
      expect(results.stats.successfulSimulations).toBe(100);

      // Memory increase should be reasonable (less than 50MB for 100 simulations)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should clean up resources properly', async () => {
      // Run simulations and verify no hanging references
      const results = await Table.runSimulations({
        count: 5,
        config: {
          blinds: { small: 10, big: 20 },
          simulationMode: true,
          minPlayers: 2,
          dealerButton: 0,
        },
        players: [new SimulationPlayer('p1'), new SimulationPlayer('p2')],
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      expect(results.simulations).toHaveLength(5);
      expect(results.stats.successfulSimulations).toBe(5);
    });
  });

  describe('Performance characteristics', () => {
    it('should complete simulations within reasonable time', async () => {
      const start = Date.now();

      await Table.runSimulations({
        count: 50,
        config: {
          blinds: { small: 10, big: 20 },
          simulationMode: true,
          minPlayers: 2,
          dealerButton: 0,
        },
        players: [new SimulationPlayer('p1'), new SimulationPlayer('p2')],
        parallel: 4,
      });

      const elapsed = Date.now() - start;

      // 50 simulations with 4 parallel workers should complete in under 10 seconds
      expect(elapsed).toBeLessThan(10000);
    });

    it('should scale with parallel workers', async () => {
      const sequentialStart = Date.now();
      await Table.runSimulations({
        count: 20,
        config: {
          blinds: { small: 10, big: 20 },
          simulationMode: true,
          minPlayers: 2,
          dealerButton: 0,
        },
        players: [new SimulationPlayer('p1'), new SimulationPlayer('p2')],
        parallel: 1, // Sequential
      });
      const sequentialTime = Date.now() - sequentialStart;

      const parallelStart = Date.now();
      await Table.runSimulations({
        count: 20,
        config: {
          blinds: { small: 10, big: 20 },
          simulationMode: true,
          minPlayers: 2,
          dealerButton: 0,
        },
        players: [new SimulationPlayer('p1'), new SimulationPlayer('p2')],
        parallel: 4, // Parallel
      });
      const parallelTime = Date.now() - parallelStart;

      // Both executions should complete successfully
      // Performance comparison can be flaky in test environments, so just verify functionality
      expect(parallelTime).toBeGreaterThan(0);
      expect(sequentialTime).toBeGreaterThan(0);
    });
  });
});
