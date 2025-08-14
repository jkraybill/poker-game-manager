import { describe, it, expect, beforeEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

/**
 * Test for the infinite loop bug reported in v4.0.0
 * When a player has low chips (around the big blind amount),
 * the game repeatedly asks for the same action even after receiving valid responses
 */
describe('Low Chips Infinite Loop Bug (v4.0.0)', () => {
  let manager;
  let table;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  it('should not enter infinite loop when player has chips just over big blind', async () => {
    table = manager.createTable({
      id: 'test-table',
      blinds: { small: 100, big: 200 },
      minPlayers: 4,
      maxPlayers: 4,
    });

    // Track how many times each player is asked for actions
    const actionRequests = new Map();

    // Create players with varying chip counts
    const player1 = new Player({ id: 'p1', name: 'Player1' });
    player1.chips = 10000;
    // eslint-disable-next-line require-await
    player1.getAction = async function (gameState) {
      const key = `${this.id}-${gameState.phase}-${gameState.currentBet}-${gameState.pot}`;
      const count = (actionRequests.get(key) || 0) + 1;
      actionRequests.set(key, count);

      if (count > 10) {
        throw new Error(
          `INFINITE LOOP: Player ${this.id} asked for same decision ${count} times`,
        );
      }

      const toCall = gameState.currentBet - gameState.players[this.id].bet;
      if (toCall > 0) {
        return { action: Action.CALL };
      }
      return { action: Action.CHECK };
    };

    const player2 = new Player({ id: 'p2', name: 'Player2' });
    player2.chips = 209; // Just over 1 BB - this triggers the bug
    // eslint-disable-next-line require-await
    player2.getAction = async function (gameState) {
      const key = `${this.id}-${gameState.phase}-${gameState.currentBet}-${gameState.pot}`;
      const count = (actionRequests.get(key) || 0) + 1;
      actionRequests.set(key, count);

      console.log(`Player ${this.id} decision #${count}:`, {
        phase: gameState.phase,
        currentBet: gameState.currentBet,
        myChips: gameState.players[this.id].chips,
        myBet: gameState.players[this.id].bet,
        toCall: gameState.currentBet - gameState.players[this.id].bet,
        validActions: gameState.validActions,
      });

      if (count > 10) {
        throw new Error(
          `INFINITE LOOP: Player ${this.id} asked for same decision ${count} times`,
        );
      }

      // Try to fold when facing a bet we can't fully afford
      const toCall = gameState.currentBet - gameState.players[this.id].bet;
      if (toCall >= gameState.players[this.id].chips) {
        console.log(
          `Player ${this.id} choosing to FOLD (can't afford full call)`,
        );
        return { action: Action.FOLD };
      }

      if (toCall > 0) {
        return { action: Action.CALL };
      }
      return { action: Action.CHECK };
    };

    const player3 = new Player({ id: 'p3', name: 'Player3' });
    player3.chips = 8000;
    // eslint-disable-next-line require-await
    player3.getAction = async function (gameState) {
      const key = `${this.id}-${gameState.phase}-${gameState.currentBet}-${gameState.pot}`;
      const count = (actionRequests.get(key) || 0) + 1;
      actionRequests.set(key, count);

      if (count > 10) {
        throw new Error(
          `INFINITE LOOP: Player ${this.id} asked for same decision ${count} times`,
        );
      }

      const toCall = gameState.currentBet - gameState.players[this.id].bet;
      if (toCall > 0) {
        return { action: Action.CALL };
      }
      return { action: Action.CHECK };
    };

    const player4 = new Player({ id: 'p4', name: 'Player4' });
    player4.chips = 12000;
    // eslint-disable-next-line require-await
    player4.getAction = async function (gameState) {
      const key = `${this.id}-${gameState.phase}-${gameState.currentBet}-${gameState.pot}`;
      const count = (actionRequests.get(key) || 0) + 1;
      actionRequests.set(key, count);

      if (count > 10) {
        throw new Error(
          `INFINITE LOOP: Player ${this.id} asked for same decision ${count} times`,
        );
      }

      const toCall = gameState.currentBet - gameState.players[this.id].bet;
      if (toCall > 0) {
        return { action: Action.FOLD }; // Fold to end betting quickly
      }
      return { action: Action.CHECK };
    };

    // Add players
    table.addPlayer(player1);
    table.addPlayer(player2);
    table.addPlayer(player3);
    table.addPlayer(player4);

    // Track game events
    let handStarted = false;

    table.on('hand:started', () => {
      handStarted = true;
      console.log('Hand started');
    });

    table.on('hand:ended', () => {
      console.log('Hand ended');
    });

    table.on('player:action', ({ player, action }) => {
      console.log(`Action processed: ${player} - ${action.action}`);
    });

    // Start the game - this should NOT cause infinite loop
    console.log('Starting game...');
    const started = await table.tryStartGame();
    expect(started.success).toBe(true);

    // Wait for hand to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check that no player was asked for the same decision too many times
    for (const [key, count] of actionRequests.entries()) {
      console.log(`Decision ${key}: requested ${count} times`);
      expect(count).toBeLessThanOrEqual(2); // Should never ask more than twice
    }

    expect(handStarted).toBe(true);
  });

  it('should handle ALL_IN correctly when player cannot afford full call', async () => {
    table = manager.createTable({
      id: 'test-all-in',
      blinds: { small: 100, big: 200 },
      minPlayers: 2,
    });

    let decisionCount = 0;

    const richPlayer = new Player({ id: 'rich', name: 'Rich' });
    richPlayer.chips = 5000;
    // eslint-disable-next-line require-await
    richPlayer.getAction = async function (gameState) {
      // Raise big to force poor player to go all-in
      if (gameState.phase === 'PRE_FLOP' && gameState.currentBet === 200) {
        return { action: Action.RAISE, amount: 1000 };
      }
      return { action: Action.CHECK };
    };

    const poorPlayer = new Player({ id: 'poor', name: 'Poor' });
    poorPlayer.chips = 250; // Can't afford the 1000 raise
    // eslint-disable-next-line require-await
    poorPlayer.getAction = async function (gameState) {
      decisionCount++;

      console.log(`Poor player decision #${decisionCount}:`, {
        phase: gameState.phase,
        currentBet: gameState.currentBet,
        myChips: gameState.players[this.id].chips,
        toCall: gameState.currentBet - gameState.players[this.id].bet,
      });

      if (decisionCount > 5) {
        throw new Error(`INFINITE LOOP: Asked ${decisionCount} times`);
      }

      // When we can't afford full call, go all-in
      const toCall = gameState.currentBet - gameState.players[this.id].bet;
      if (toCall >= gameState.players[this.id].chips) {
        console.log('Going ALL_IN with remaining chips');
        return {
          action: Action.ALL_IN,
          amount: gameState.players[this.id].chips,
        };
      }

      return { action: Action.CALL };
    };

    table.addPlayer(richPlayer);
    table.addPlayer(poorPlayer);

    const started = await table.tryStartGame();
    expect(started.success).toBe(true);

    // Wait for hand to process
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should not have asked poor player too many times
    expect(decisionCount).toBeLessThanOrEqual(2);
  });
});
