import { describe, it, expect } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('Debug Timeout Issue', () => {
  it('should complete a simple hand without timeout', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'debug-table',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
    });

    let handEnded = false;
    table.on('hand:ended', () => {
      console.log('Hand ended!');
      handEnded = true;
    });

    const player1 = new Player({ id: 'p1', name: 'P1' });
    player1.chips = 1000;
    let p1Calls = 0;
    // eslint-disable-next-line require-await
    player1.getAction = async function(gameState) {
      p1Calls++;
      console.log(`P1 called ${p1Calls} times - phase: ${gameState.phase}, toCall: ${gameState.currentBet - gameState.players[this.id].bet}`);
      const toCall = gameState.currentBet - gameState.players[this.id].bet;
      if (toCall > 0) {
        return { action: Action.CALL };
      }
      return { action: Action.CHECK };
    };

    const player2 = new Player({ id: 'p2', name: 'P2' });
    player2.chips = 1000;
    let p2Calls = 0;
    // eslint-disable-next-line require-await
    player2.getAction = async function(gameState) {
      p2Calls++;
      console.log(`P2 called ${p2Calls} times - phase: ${gameState.phase}, toCall: ${gameState.currentBet - gameState.players[this.id].bet}`);
      const toCall = gameState.currentBet - gameState.players[this.id].bet;
      if (toCall > 0) {
        return { action: Action.CALL };
      }
      return { action: Action.CHECK };
    };

    table.addPlayer(player1);
    table.addPlayer(player2);

    console.log('Starting game...');
    const started = await table.tryStartGame();
    expect(started).toBe(true);

    // Wait for hand to complete
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('Test timed out!');
        console.log(`P1 was called ${p1Calls} times`);
        console.log(`P2 was called ${p2Calls} times`);
        reject(new Error('Hand did not end within 2 seconds'));
      }, 2000);

      const checkInterval = setInterval(() => {
        if (handEnded) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });

    expect(handEnded).toBe(true);
    console.log('Test completed successfully');
  });
});