import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('Position Information in hand:started Event', () => {
  let manager;
  
  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    // Managers don't have close method, clean up individual tables
    manager = null;
  });

  it('should provide position information for 2-player heads-up game', async () => {
    const table = manager.createTable({
      id: 'heads-up-positions',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
      dealerButton: 0,
    });

    let positionData = null;

    const player1 = new Player({ id: 'p1', name: 'Button/SB' });
    player1.chips = 1000;
    // eslint-disable-next-line require-await
    player1.getAction = async () => ({ action: Action.FOLD });

    const player2 = new Player({ id: 'p2', name: 'Big Blind' });
    player2.chips = 1000;
    // eslint-disable-next-line require-await
    player2.getAction = async () => ({ action: Action.CHECK });

    table.addPlayer(player1);
    table.addPlayer(player2);

    // Capture position information
    table.on('hand:started', ({ positions }) => {
      positionData = positions;
    });

    const result = await table.tryStartGame();
    expect(result.success).toBe(true);

    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify position information
    expect(positionData).toBeDefined();
    expect(positionData.button).toBe('p1');
    expect(positionData.smallBlind).toBe('p1');
    expect(positionData.bigBlind).toBe('p2');
    expect(positionData.utg).toBeNull(); // No UTG in heads-up

    // Verify position mapping
    expect(positionData.positions['p1']).toBe('small-blind'); // In heads-up, button is also SB
    expect(positionData.positions['p2']).toBe('big-blind');

    // Verify player order
    expect(positionData.playerOrder).toEqual(['p1', 'p2']);

    table.close();
  });

  it('should provide position information for 4-player game', async () => {
    const table = manager.createTable({
      id: 'four-player-positions',
      blinds: { small: 10, big: 20 },
      minPlayers: 4,
      dealerButton: 0,
    });

    let positionData = null;

    const players = ['Button', 'Small Blind', 'Big Blind', 'UTG'].map((name, i) => {
      const player = new Player({ id: `p${i + 1}`, name });
      player.chips = 1000;
      // eslint-disable-next-line require-await
      player.getAction = async () => ({ action: Action.FOLD });
      return player;
    });

    players.forEach(p => table.addPlayer(p));

    // Capture position information
    table.on('hand:started', ({ positions }) => {
      positionData = positions;
    });

    const result = await table.tryStartGame();
    expect(result.success).toBe(true);

    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify position information
    expect(positionData).toBeDefined();
    expect(positionData.button).toBe('p1');
    expect(positionData.smallBlind).toBe('p2');
    expect(positionData.bigBlind).toBe('p3');
    expect(positionData.utg).toBe('p4');

    // Verify position mapping
    expect(positionData.positions['p1']).toBe('button');
    expect(positionData.positions['p2']).toBe('small-blind');
    expect(positionData.positions['p3']).toBe('big-blind');
    expect(positionData.positions['p4']).toBe('under-the-gun');

    // Verify player order
    expect(positionData.playerOrder).toEqual(['p1', 'p2', 'p3', 'p4']);

    table.close();
  });

  it('should provide position information for 6-player game with all positions', async () => {
    const table = manager.createTable({
      id: 'six-player-positions',
      blinds: { small: 10, big: 20 },
      minPlayers: 6,
      dealerButton: 0,
    });

    let positionData = null;

    const players = Array.from({ length: 6 }, (_, i) => {
      const player = new Player({ id: `p${i + 1}`, name: `Player ${i + 1}` });
      player.chips = 1000;
      // eslint-disable-next-line require-await
      player.getAction = async () => ({ action: Action.FOLD });
      return player;
    });

    players.forEach(p => table.addPlayer(p));

    // Capture position information
    table.on('hand:started', ({ positions }) => {
      positionData = positions;
    });

    const result = await table.tryStartGame();
    expect(result.success).toBe(true);

    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify key position information
    expect(positionData).toBeDefined();
    expect(positionData.button).toBe('p1');
    expect(positionData.smallBlind).toBe('p2');
    expect(positionData.bigBlind).toBe('p3');
    expect(positionData.utg).toBe('p4');

    // Verify basic position mapping exists
    expect(positionData.positions['p1']).toBe('button');
    expect(positionData.positions['p2']).toBe('small-blind');
    expect(positionData.positions['p3']).toBe('big-blind');
    expect(positionData.positions['p4']).toBe('under-the-gun');

    // Verify all players have position assignments
    expect(Object.keys(positionData.positions)).toHaveLength(6);

    // Verify player order contains all players
    expect(positionData.playerOrder).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);

    table.close();
  });

  it('should handle dead button scenarios', async () => {
    const table = manager.createTable({
      id: 'dead-button-positions',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
      dealerButton: 0,
    });

    let positionData = null;

    const player1 = new Player({ id: 'p1', name: 'Active Player 1' });
    player1.chips = 1000;
    // eslint-disable-next-line require-await
    player1.getAction = async () => ({ action: Action.FOLD });

    const player2 = new Player({ id: 'p2', name: 'Active Player 2' });
    player2.chips = 1000;
    // eslint-disable-next-line require-await
    player2.getAction = async () => ({ action: Action.CHECK });

    table.addPlayer(player1);
    table.addPlayer(player2);

    // Capture position information
    table.on('hand:started', ({ positions }) => {
      positionData = positions;
    });

    const result = await table.tryStartGame();
    expect(result.success).toBe(true);

    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify position information exists
    expect(positionData).toBeDefined();
    expect(positionData.positions).toBeDefined();
    expect(typeof positionData.isDeadButton).toBe('boolean');
    expect(typeof positionData.isDeadSmallBlind).toBe('boolean');

    table.close();
  });

  it('should maintain backward compatibility with existing dealerButton field', async () => {
    const table = manager.createTable({
      id: 'backward-compatibility',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
      dealerButton: 0,
    });

    let handStartedData = null;

    const player1 = new Player({ id: 'p1', name: 'Player 1' });
    player1.chips = 1000;
    // eslint-disable-next-line require-await
    player1.getAction = async () => ({ action: Action.FOLD });

    const player2 = new Player({ id: 'p2', name: 'Player 2' });
    player2.chips = 1000;
    // eslint-disable-next-line require-await
    player2.getAction = async () => ({ action: Action.CHECK });

    table.addPlayer(player1);
    table.addPlayer(player2);

    // Capture full event data
    table.on('hand:started', (data) => {
      handStartedData = data;
    });

    const result = await table.tryStartGame();
    expect(result.success).toBe(true);

    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify backward compatibility fields still exist
    expect(handStartedData).toBeDefined();
    expect(handStartedData.players).toBeDefined();
    expect(handStartedData.dealerButton).toBeDefined();
    expect(typeof handStartedData.dealerButton).toBe('number');

    // Verify new position information is also present
    expect(handStartedData.positions).toBeDefined();
    expect(handStartedData.positions.button).toBeDefined();
    expect(handStartedData.positions.positions).toBeDefined();

    table.close();
  });
});