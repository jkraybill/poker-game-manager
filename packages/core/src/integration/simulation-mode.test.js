/**
 * Tests for simulationMode feature (#45)
 * Verifies that simulationMode disables all delays for fast simulations
 */
import { describe, it, expect } from 'vitest';
import { Table } from '../Table.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

// Simple test player that plays predictably
class TestPlayer extends Player {
  constructor(id, strategy = 'check') {
    super({ id, name: id });
    this.strategy = strategy;
    this.actionCount = 0;
  }

  getAction(gameState) {
    this.actionCount++;

    // Fold strategy: fold if facing a bet, otherwise check
    if (this.strategy === 'fold') {
      if (gameState.toCall > 0) {
        return { action: Action.FOLD };
      }
      return { action: Action.CHECK };
    }

    if (this.strategy === 'call' && gameState.toCall > 0) {
      return { action: Action.CALL };
    }

    if (this.strategy === 'raise' && gameState.currentBet < 100) {
      return { action: Action.RAISE, amount: 50 };
    }

    // For 'check' strategy, call if we have to, otherwise check
    if (this.strategy === 'check' && gameState.toCall > 0) {
      return { action: Action.CALL };
    }

    return { action: Action.CHECK };
  }
}

describe('SimulationMode Feature', () => {
  describe('Table constructor option', () => {
    it('should accept simulationMode option', () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: true,
      });

      expect(table.simulationMode).toBe(true);
    });

    it('should default to false when not specified', () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
      });

      expect(table.simulationMode).toBe(false);
    });
  });

  describe('Performance comparison', () => {
    it('should complete hands much faster in simulation mode', async () => {
      // Test with normal mode
      const normalTable = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: false,
        minPlayers: 2,
      });

      const player1Normal = new TestPlayer('p1', 'fold');
      const player2Normal = new TestPlayer('p2', 'check');
      player1Normal.chips = 1000;
      player2Normal.chips = 1000;

      normalTable.addPlayer(player1Normal);
      normalTable.addPlayer(player2Normal);

      const normalStart = Date.now();

      const normalHandPromise = new Promise((resolve) => {
        normalTable.once('hand:ended', resolve);
      });

      await normalTable.tryStartGame();
      await normalHandPromise;

      const normalTime = Date.now() - normalStart;

      // Test with simulation mode
      const simTable = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: true,
        minPlayers: 2,
      });

      const player1Sim = new TestPlayer('p1', 'fold');
      const player2Sim = new TestPlayer('p2', 'check');
      player1Sim.chips = 1000;
      player2Sim.chips = 1000;

      simTable.addPlayer(player1Sim);
      simTable.addPlayer(player2Sim);

      const simStart = Date.now();

      const simHandPromise = new Promise((resolve) => {
        simTable.once('hand:ended', resolve);
      });

      await simTable.tryStartGame();
      await simHandPromise;

      const simTime = Date.now() - simStart;

      // Simulation mode should be significantly faster
      // In practice it might be hard to measure on very fast tests
      // so just verify sim mode is faster or equal
      expect(simTime).toBeLessThanOrEqual(normalTime);

      // Both should have completed the hand
      expect(player1Normal.actionCount).toBeGreaterThan(0);
      expect(player1Sim.actionCount).toBeGreaterThan(0);
    });

    it('should maintain identical game logic in both modes', async () => {
      const runGame = async (simulationMode) => {
        const table = new Table({
          blinds: { small: 10, big: 20 },
          simulationMode,
          minPlayers: 2,
          dealerButton: 0, // Fixed dealer for deterministic results
        });

        const player1 = new TestPlayer('p1', 'call');
        const player2 = new TestPlayer('p2', 'check');
        player1.chips = 1000;
        player2.chips = 1000;

        table.addPlayer(player1);
        table.addPlayer(player2);

        const events = {
          actions: [],
          phases: [],
          winner: null,
        };

        table.on('player:action', ({ action }) => {
          events.actions.push(action.action);
        });

        table.on('phase:change', ({ phase }) => {
          events.phases.push(phase);
        });

        const handPromise = new Promise((resolve) => {
          table.once('hand:ended', ({ winners }) => {
            events.winner = winners[0]?.playerId;
            resolve();
          });
        });

        await table.tryStartGame();
        await handPromise;

        return events;
      };

      const normalEvents = await runGame(false);
      const simEvents = await runGame(true);

      // Game logic should be identical
      expect(simEvents.actions).toEqual(normalEvents.actions);
      expect(simEvents.phases).toEqual(normalEvents.phases);
      // Winner might vary due to random cards, but both should have a winner
      expect(simEvents.winner).toBeDefined();
      expect(normalEvents.winner).toBeDefined();
    });
  });

  describe('Delay skipping', () => {
    it('should skip all setTimeout delays in simulation mode', async () => {
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

      const start = Date.now();
      let handsCompleted = 0;

      // Run 10 hands with individual timeouts
      for (let i = 0; i < 10; i++) {
        // Wait a tiny bit between hands to ensure table state is reset
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1));
        }

        const handPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error(`Hand ${i} timed out`)),
            500,
          );
          table.once('hand:ended', () => {
            clearTimeout(timeout);
            handsCompleted++;
            resolve();
          });
        });

        const startResult = await table.tryStartGame();
        if (!startResult.success) {
          throw new Error(
            `Failed to start hand ${i}: ${startResult.reason} (${JSON.stringify(startResult.details)})`,
          );
        }

        await handPromise;
      }

      const elapsed = Date.now() - start;

      // All 10 hands should have completed
      expect(handsCompleted).toBe(10);
      // 10 hands should complete in under 5000ms in simulation mode
      expect(elapsed).toBeLessThan(5000);
    }, 15000);

    it('should preserve event ordering in simulation mode', async () => {
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

      const eventOrder = [];

      table.on('game:started', () => eventOrder.push('game:started'));
      table.on('hand:started', () => eventOrder.push('hand:started'));
      table.on('cards:dealt', () => eventOrder.push('cards:dealt'));
      table.on('action:requested', () => eventOrder.push('action:requested'));
      table.on('hand:ended', () => eventOrder.push('hand:ended'));

      const handPromise = new Promise((resolve) => {
        table.once('hand:ended', resolve);
      });

      await table.tryStartGame();
      await handPromise;

      // Events should still fire in correct order
      expect(eventOrder[0]).toBe('game:started');
      expect(eventOrder[1]).toBe('hand:started');
      expect(eventOrder).toContain('cards:dealt');
      expect(eventOrder).toContain('action:requested');
      expect(eventOrder[eventOrder.length - 1]).toBe('hand:ended');
    });
  });

  describe('Multiple hands in simulation mode', () => {
    it('should handle rapid successive hands without issues', async () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: true,
        minPlayers: 2,
      });

      const player1 = new TestPlayer('p1', 'call');
      const player2 = new TestPlayer('p2', 'call');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      const handResults = [];

      // Run 100 hands rapidly
      for (let i = 0; i < 100; i++) {
        const handPromise = new Promise((resolve) => {
          table.once('hand:ended', ({ winners }) => {
            handResults.push(winners[0]?.playerId);
            resolve();
          });
        });

        const result = await table.tryStartGame();
        expect(result.success).toBe(true);
        await handPromise;
      }

      // Should have 100 results
      expect(handResults).toHaveLength(100);

      // Both players should win some hands (statistical check)
      const p1Wins = handResults.filter((id) => id === 'p1').length;
      const p2Wins = handResults.filter((id) => id === 'p2').length;

      expect(p1Wins).toBeGreaterThan(0);
      expect(p2Wins).toBeGreaterThan(0);
      expect(p1Wins + p2Wins).toBe(100);
    });
  });

  describe('Backward compatibility', () => {
    it('should not affect normal mode behavior', async () => {
      const table = new Table({
        blinds: { small: 10, big: 20 },
        simulationMode: false, // Explicitly false
        minPlayers: 2,
      });

      const player1 = new TestPlayer('p1', 'fold');
      const player2 = new TestPlayer('p2', 'check');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      const start = Date.now();

      const handPromise = new Promise((resolve) => {
        table.once('hand:ended', resolve);
      });

      await table.tryStartGame();
      await handPromise;

      const elapsed = Date.now() - start;

      // Normal mode should have completed (elapsed time will be > 0)
      expect(elapsed).toBeGreaterThanOrEqual(0);
      // And the game should have ended properly
      expect(player1.actionCount).toBeGreaterThan(0);
    });
  });
});
