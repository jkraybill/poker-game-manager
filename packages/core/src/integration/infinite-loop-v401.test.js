import { describe, it, expect } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

/**
 * Test to reproduce the infinite loop issue reported in v4.0.1
 * Players are asked for the same decision repeatedly even with valid responses
 */
describe('Infinite Loop v4.0.1 Reproduction', () => {
  it('should not ask players multiple times for the same decision', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'test-table',
      blinds: { small: 100, big: 200 },
      minPlayers: 3,
    });

    // Track decision requests per player
    const decisionCounts = new Map();

    // Create players
    const player1 = new Player({ id: 'player-1', name: 'Player 1' });
    player1.chips = 10000;
    // eslint-disable-next-line require-await
    player1.getAction = async function (gameState) {
      const stateKey = `${gameState.phase}-${gameState.pot}-${gameState.currentBet}-${gameState.players[this.id].bet}`;
      const key = `${this.id}-${stateKey}`;
      const count = (decisionCounts.get(key) || 0) + 1;
      decisionCounts.set(key, count);

      console.log(`${this.name} decision #${count}:`, {
        phase: gameState.phase,
        pot: gameState.pot,
        currentBet: gameState.currentBet,
        myBet: gameState.players[this.id].bet,
        toCall: gameState.currentBet - gameState.players[this.id].bet,
        myChips: gameState.players[this.id].chips,
        validActions: gameState.validActions,
      });

      if (count > 10) {
        throw new Error(
          `INFINITE LOOP DETECTED: ${this.name} asked for same decision ${count} times\n` +
            `State: phase=${gameState.phase}, pot=${gameState.pot}, currentBet=${gameState.currentBet}, ` +
            `toCall=${gameState.currentBet - gameState.players[this.id].bet}, myChips=${gameState.players[this.id].chips}\n` +
            `validActions=${JSON.stringify(gameState.validActions)}`,
        );
      }

      const toCall = gameState.currentBet - gameState.players[this.id].bet;

      // Simple strategy: call/check
      if (toCall > 0) {
        return { action: Action.CALL };
      }
      return { action: Action.CHECK };
    };

    const player2 = new Player({ id: 'player-2', name: 'Player 2' });
    player2.chips = 10000;
    // eslint-disable-next-line require-await
    player2.getAction = async function (gameState) {
      const stateKey = `${gameState.phase}-${gameState.pot}-${gameState.currentBet}-${gameState.players[this.id].bet}`;
      const key = `${this.id}-${stateKey}`;
      const count = (decisionCounts.get(key) || 0) + 1;
      decisionCounts.set(key, count);

      console.log(`${this.name} decision #${count}:`, {
        phase: gameState.phase,
        currentBet: gameState.currentBet,
        toCall: gameState.currentBet - gameState.players[this.id].bet,
      });

      if (count > 10) {
        throw new Error(
          `INFINITE LOOP DETECTED: ${this.name} asked for same decision ${count} times\n` +
            `State: phase=${gameState.phase}, pot=${gameState.pot}, currentBet=${gameState.currentBet}, ` +
            `toCall=${gameState.currentBet - gameState.players[this.id].bet}, myChips=${gameState.players[this.id].chips}\n` +
            `validActions=${JSON.stringify(gameState.validActions)}`,
        );
      }

      // This player will fold to trigger the issue
      const toCall = gameState.currentBet - gameState.players[this.id].bet;
      if (toCall > 200) {
        console.log(`${this.name} folding`);
        return { action: Action.FOLD };
      }
      if (toCall > 0) {
        return { action: Action.CALL };
      }
      return { action: Action.CHECK };
    };

    const player3 = new Player({ id: 'player-3', name: 'Player 3' });
    player3.chips = 10000;
    // eslint-disable-next-line require-await
    player3.getAction = async function (gameState) {
      const stateKey = `${gameState.phase}-${gameState.pot}-${gameState.currentBet}-${gameState.players[this.id].bet}`;
      const key = `${this.id}-${stateKey}`;
      const count = (decisionCounts.get(key) || 0) + 1;
      decisionCounts.set(key, count);

      console.log(`${this.name} decision #${count}:`, {
        phase: gameState.phase,
        currentBet: gameState.currentBet,
        toCall: gameState.currentBet - gameState.players[this.id].bet,
      });

      if (count > 10) {
        throw new Error(
          `INFINITE LOOP DETECTED: ${this.name} asked for same decision ${count} times`,
        );
      }

      // This player will raise to test reopening betting
      const toCall = gameState.currentBet - gameState.players[this.id].bet;
      if (gameState.phase === 'PRE_FLOP' && gameState.currentBet === 200) {
        console.log(`${this.name} raising to 500`);
        return { action: Action.RAISE, amount: 500 };
      }
      if (toCall > 0) {
        return { action: Action.CALL };
      }
      return { action: Action.CHECK };
    };

    // Add players
    table.addPlayer(player1);
    table.addPlayer(player2);
    table.addPlayer(player3);

    // Start game
    console.log('Starting game...');
    const started = await table.tryStartGame();
    expect(started.success).toBe(true);

    // Wait for hand to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check that no player was asked for the same decision too many times
    console.log('\nDecision counts:');
    for (const [key, count] of decisionCounts.entries()) {
      console.log(`  ${key}: ${count} times`);
      // Each unique game state should only be asked once (or twice for reopened betting)
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('should handle circular references when all players have acted', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'circular-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
    });

    const actionLog = [];

    const player1 = new Player({ id: 'p1', name: 'P1' });
    player1.chips = 1000;
    // eslint-disable-next-line require-await
    player1.getAction = async function (gameState) {
      const logEntry = {
        player: this.id,
        phase: gameState.phase,
        currentBet: gameState.currentBet,
        timestamp: Date.now(),
      };
      actionLog.push(logEntry);

      // Check for rapid repeated requests (sign of infinite loop)
      const recentRequests = actionLog.filter(
        (entry) =>
          entry.player === this.id &&
          entry.phase === gameState.phase &&
          entry.currentBet === gameState.currentBet &&
          Date.now() - entry.timestamp < 100, // Within 100ms
      );

      if (recentRequests.length > 3) {
        throw new Error(
          `Rapid repeated requests detected for ${this.id}: ${recentRequests.length} requests in 100ms`,
        );
      }

      const toCall = gameState.currentBet - gameState.players[this.id].bet;
      if (toCall > 0) {
        return { action: Action.CALL };
      }
      return { action: Action.CHECK };
    };

    const player2 = new Player({ id: 'p2', name: 'P2' });
    player2.chips = 1000;
    // eslint-disable-next-line require-await
    player2.getAction = async function (gameState) {
      const logEntry = {
        player: this.id,
        phase: gameState.phase,
        currentBet: gameState.currentBet,
        timestamp: Date.now(),
      };
      actionLog.push(logEntry);

      // Check for rapid repeated requests
      const recentRequests = actionLog.filter(
        (entry) =>
          entry.player === this.id &&
          entry.phase === gameState.phase &&
          entry.currentBet === gameState.currentBet &&
          Date.now() - entry.timestamp < 100,
      );

      if (recentRequests.length > 3) {
        throw new Error(
          `Rapid repeated requests detected for ${this.id}: ${recentRequests.length} requests in 100ms`,
        );
      }

      const toCall = gameState.currentBet - gameState.players[this.id].bet;
      if (toCall > 0) {
        return { action: Action.CALL };
      }
      return { action: Action.CHECK };
    };

    table.addPlayer(player1);
    table.addPlayer(player2);

    const started = await table.tryStartGame();
    expect(started.success).toBe(true);

    // Wait for hand
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify no rapid repeated requests occurred
    const p1Requests = actionLog.filter((e) => e.player === 'p1').length;
    const p2Requests = actionLog.filter((e) => e.player === 'p2').length;

    console.log(`Total requests - P1: ${p1Requests}, P2: ${p2Requests}`);

    // Each player should be asked a reasonable number of times (not hundreds)
    expect(p1Requests).toBeLessThan(20);
    expect(p2Requests).toBeLessThan(20);
  });
});
