import { describe, it, expect } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { TableState } from '../types/index.js';

/**
 * Debug test to verify tryStartGame returns detailed error information
 */
describe('Debug tryStartGame Failure Details', () => {
  it('should return comprehensive debugging info when table not ready', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'debug-table',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
    });

    // Manually set state to IN_PROGRESS to simulate issue
    table.state = TableState.IN_PROGRESS;

    const result = await table.tryStartGame();

    // Log the full result for debugging
    console.log('tryStartGame failed with:', JSON.stringify(result, null, 2));

    // Verify we get the expected structure
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.reason).toBe('TABLE_NOT_READY');
    expect(result.details).toBeDefined();
    expect(result.details.currentState).toBe('IN_PROGRESS');
    expect(result.details.message).toContain('not in WAITING state');
    expect(result.details.tableId).toBe('debug-table');
    expect(result.details.timestamp).toBeDefined();
    expect(result.details.isGameInProgress).toBe(true);
    expect(result.details.gameEngine).toBe('null');
  });

  it('should return comprehensive debugging info for insufficient players', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'debug-table-2',
      blinds: { small: 25, big: 50 },
      minPlayers: 3,
    });

    const player1 = new Player({ id: 'alice', name: 'Alice' });
    player1.chips = 1000;
    table.addPlayer(player1);

    const result = await table.tryStartGame();

    // Log the full result for debugging
    console.log(
      'Insufficient players result:',
      JSON.stringify(result, null, 2),
    );

    expect(result.success).toBe(false);
    expect(result.reason).toBe('INSUFFICIENT_PLAYERS');
    expect(result.details.currentPlayers).toBe(1);
    expect(result.details.minPlayers).toBe(3);
    expect(result.details.playerIds).toEqual(['alice']);
    expect(result.details.playerDetails).toHaveLength(1);
    expect(result.details.playerDetails[0]).toMatchObject({
      id: 'alice',
      name: 'Alice',
      chips: 1000,
      seatNumber: 1,
    });
    expect(result.details.timestamp).toBeDefined();
    expect(result.details.waitingListSize).toBe(0);
  });

  it('should emit game:start-failed event with full details', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'event-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
    });

    let eventData = null;
    table.on('game:start-failed', (data) => {
      eventData = data;
    });

    // Try to start with no players
    const result = await table.tryStartGame();

    // Verify event was emitted
    expect(eventData).toBeDefined();
    expect(eventData).toEqual(result);
    expect(eventData.reason).toBe('INSUFFICIENT_PLAYERS');

    console.log(
      'game:start-failed event emitted with:',
      JSON.stringify(eventData, null, 2),
    );
  });

  it('should return comprehensive debugging for chip issues', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'chip-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
    });

    const player1 = new Player({ id: 'rich', name: 'Rich' });
    const player2 = new Player({ id: 'broke', name: 'Broke' });
    const player3 = new Player({ id: 'poor', name: 'Poor' });

    player1.chips = 1000;
    player2.chips = 0;
    player3.chips = 0;

    table.addPlayer(player1);
    table.addPlayer(player2);
    table.addPlayer(player3);

    const result = await table.tryStartGame();

    console.log(
      'Insufficient active players result:',
      JSON.stringify(result, null, 2),
    );

    expect(result.success).toBe(false);
    expect(result.reason).toBe('INSUFFICIENT_ACTIVE_PLAYERS');
    expect(result.details.totalPlayers).toBe(3);
    expect(result.details.activePlayers).toBe(1);
    expect(result.details.minPlayers).toBe(2);
    expect(result.details.playersWithNoChips).toHaveLength(2);
    expect(result.details.allPlayerChips).toHaveLength(3);
    expect(result.details.allPlayerChips[0].chips).toBe(1000);
    expect(result.details.allPlayerChips[1].chips).toBe(0);
    expect(result.details.allPlayerChips[2].chips).toBe(0);
    expect(result.details.timestamp).toBeDefined();
  });
});
