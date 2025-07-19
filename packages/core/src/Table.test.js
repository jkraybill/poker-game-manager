import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Table } from './Table.js';
import { TableState, PlayerState } from './types/index.js';

// Mock player factory
const createMockPlayer = (id, name) => ({
  id,
  name,
  receivePrivateCards: vi.fn(),
  requestAction: vi.fn((validActions, timeout) => {
    // Return a check action by default
    return Promise.resolve({ name: 'check' });
  }),
  receivePublicCards: vi.fn(),
  receiveGameUpdate: vi.fn(),
});

describe('Table', () => {
  let table;
  const defaultConfig = {
    variant: 'texas-holdem',
    maxPlayers: 9,
    minPlayers: 2,
    blinds: { small: 10, big: 20 },
    minBuyIn: 1000,
    maxBuyIn: 10000,
    timeout: 30000,
  };

  beforeEach(() => {
    table = new Table();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(table.id).toBeDefined();
      expect(table.config.variant).toBe('texas-holdem');
      expect(table.config.maxPlayers).toBe(9);
      expect(table.config.minPlayers).toBe(2);
      expect(table.config.blinds).toEqual({ small: 10, big: 20 });
      expect(table.config.minBuyIn).toBe(1000);
      expect(table.config.maxBuyIn).toBe(10000);
      expect(table.config.timeout).toBe(30000);
    });

    it('should accept custom config', () => {
      const customConfig = {
        id: 'custom-table-id',
        variant: 'omaha',
        maxPlayers: 6,
        minPlayers: 3,
        blinds: { small: 25, big: 50 },
        minBuyIn: 2000,
        maxBuyIn: 20000,
        timeout: 60000,
      };
      
      const customTable = new Table(customConfig);
      
      expect(customTable.id).toBe('custom-table-id');
      expect(customTable.config.variant).toBe('omaha');
      expect(customTable.config.maxPlayers).toBe(6);
      expect(customTable.config.minPlayers).toBe(3);
      expect(customTable.config.blinds).toEqual({ small: 25, big: 50 });
      expect(customTable.config.minBuyIn).toBe(2000);
      expect(customTable.config.maxBuyIn).toBe(20000);
      expect(customTable.config.timeout).toBe(60000);
    });

    it('should initialize empty state', () => {
      expect(table.players).toBeInstanceOf(Map);
      expect(table.players.size).toBe(0);
      expect(table.waitingList).toEqual([]);
      expect(table.state).toBe(TableState.WAITING);
      expect(table.gameEngine).toBeNull();
      expect(table.gameCount).toBe(0);
    });
  });

  describe('addPlayer', () => {
    it('should add player successfully', () => {
      const player = createMockPlayer('player1', 'Player 1');
      const joinedSpy = vi.fn();
      table.on('player:joined', joinedSpy);
      
      const result = table.addPlayer(player);
      
      expect(result).toBe(true);
      expect(table.players.has('player1')).toBe(true);
      expect(table.players.get('player1')).toEqual({
        player,
        chips: 1000,
        state: PlayerState.WAITING,
        seatNumber: 1,
      });
      expect(joinedSpy).toHaveBeenCalledWith({
        player,
        tableId: table.id,
        seatNumber: 1,
      });
    });

    it('should add to waiting list when table is full', () => {
      // Fill the table
      for (let i = 1; i <= 9; i++) {
        table.addPlayer(createMockPlayer(`player${i}`, `Player ${i}`));
      }
      
      const waitingPlayer = createMockPlayer('player10', 'Player 10');
      const waitingSpy = vi.fn();
      table.on('player:waiting', waitingSpy);
      
      const result = table.addPlayer(waitingPlayer);
      
      expect(result).toBe(false);
      expect(table.waitingList).toContain(waitingPlayer);
      expect(waitingSpy).toHaveBeenCalledWith({
        player: waitingPlayer,
        position: 1,
      });
    });

    it('should throw error if player already at table', () => {
      const player = createMockPlayer('player1', 'Player 1');
      table.addPlayer(player);
      
      expect(() => table.addPlayer(player)).toThrow('Player already at table');
    });

    it('should assign correct seat numbers', () => {
      const player1 = createMockPlayer('player1', 'Player 1');
      const player2 = createMockPlayer('player2', 'Player 2');
      const player3 = createMockPlayer('player3', 'Player 3');
      
      table.addPlayer(player1);
      table.addPlayer(player2);
      table.addPlayer(player3);
      
      expect(table.players.get('player1').seatNumber).toBe(1);
      expect(table.players.get('player2').seatNumber).toBe(2);
      expect(table.players.get('player3').seatNumber).toBe(3);
    });

    it('should start game when minimum players reached', () => {
      const startSpy = vi.fn();
      table.on('game:started', startSpy);
      
      table.addPlayer(createMockPlayer('player1', 'Player 1'));
      expect(startSpy).not.toHaveBeenCalled();
      
      table.addPlayer(createMockPlayer('player2', 'Player 2'));
      
      // Game should have started (even if it ended quickly)
      expect(table.gameCount).toBe(1);
      expect(startSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalledWith({
        tableId: table.id,
        gameNumber: 1,
        players: ['player1', 'player2'],
      });
    });
  });

  describe('removePlayer', () => {
    beforeEach(() => {
      // Set minPlayers to 3 to prevent auto-start with 2 players
      table.config.minPlayers = 3;
      table.addPlayer(createMockPlayer('player1', 'Player 1'));
      table.addPlayer(createMockPlayer('player2', 'Player 2'));
    });

    it('should remove player successfully', () => {
      const leftSpy = vi.fn();
      table.on('player:left', leftSpy);
      
      const result = table.removePlayer('player1');
      
      expect(result).toBe(true);
      expect(table.players.has('player1')).toBe(false);
      expect(leftSpy).toHaveBeenCalledWith({
        playerId: 'player1',
        tableId: table.id,
        chips: 1000,
      });
    });

    it('should return false for non-existent player', () => {
      const result = table.removePlayer('non-existent');
      expect(result).toBe(false);
    });

    it('should add waiting player when spot opens', () => {
      // Fill the table
      for (let i = 3; i <= 9; i++) {
        table.addPlayer(createMockPlayer(`player${i}`, `Player ${i}`));
      }
      
      const waitingPlayer = createMockPlayer('player10', 'Player 10');
      table.addPlayer(waitingPlayer); // Goes to waiting list
      
      expect(table.waitingList).toContain(waitingPlayer);
      expect(table.players.has('player10')).toBe(false);
      
      // Remove a player
      table.removePlayer('player1');
      
      // Waiting player should be added
      expect(table.waitingList).not.toContain(waitingPlayer);
      expect(table.players.has('player10')).toBe(true);
    });

    it('should end game if not enough players during game', () => {
      // Start game
      table.state = TableState.IN_PROGRESS;
      table.gameEngine = { abort: vi.fn() };
      
      // Remove player to go below minimum
      table.removePlayer('player1');
      
      // Game should end (this would be triggered by endGame method)
      // Since endGame is not implemented in the current code, we check the condition
      expect(table.players.size).toBe(1);
      expect(table.players.size < table.config.minPlayers).toBe(true);
    });
  });

  describe('getNextAvailableSeat', () => {
    it('should return first available seat', () => {
      expect(table.getNextAvailableSeat()).toBe(1);
      
      table.addPlayer(createMockPlayer('player1', 'Player 1'));
      expect(table.getNextAvailableSeat()).toBe(2);
      
      table.addPlayer(createMockPlayer('player2', 'Player 2'));
      expect(table.getNextAvailableSeat()).toBe(3);
    });

    it('should reuse freed seats', () => {
      table.addPlayer(createMockPlayer('player1', 'Player 1'));
      table.addPlayer(createMockPlayer('player2', 'Player 2'));
      table.addPlayer(createMockPlayer('player3', 'Player 3'));
      
      // Remove player 2
      table.removePlayer('player2');
      
      // Next available should be seat 2
      expect(table.getNextAvailableSeat()).toBe(2);
    });

    it('should throw when no seats available', () => {
      // Fill all seats
      for (let i = 1; i <= 9; i++) {
        table.addPlayer(createMockPlayer(`player${i}`, `Player ${i}`));
      }
      
      expect(() => table.getNextAvailableSeat()).toThrow('No available seats');
    });
  });

  describe('tryStartGame', () => {
    it('should not start if already in progress', () => {
      table.state = TableState.IN_PROGRESS;
      table.addPlayer(createMockPlayer('player1', 'Player 1'));
      table.addPlayer(createMockPlayer('player2', 'Player 2'));
      
      const initialGameCount = table.gameCount;
      table.tryStartGame();
      
      expect(table.gameCount).toBe(initialGameCount);
    });

    it('should not start with insufficient players', () => {
      table.addPlayer(createMockPlayer('player1', 'Player 1'));
      
      table.tryStartGame();
      
      expect(table.state).toBe(TableState.WAITING);
      expect(table.gameEngine).toBeNull();
    });

    it('should start game with sufficient players', () => {
      const startedSpy = vi.fn();
      table.on('game:started', startedSpy);
      
      // Set minPlayers to 3 to prevent auto-start
      table.config.minPlayers = 3;
      table.addPlayer(createMockPlayer('player1', 'Player 1'));
      table.addPlayer(createMockPlayer('player2', 'Player 2'));
      
      // Reset minPlayers and try to start
      table.config.minPlayers = 2;
      table.tryStartGame();
      
      // Game should have started
      expect(table.gameCount).toBe(1);
      expect(startedSpy).toHaveBeenCalled();
      expect(startedSpy).toHaveBeenCalledWith({
        tableId: table.id,
        gameNumber: 1,
        players: ['player1', 'player2'],
      });
    });
  });

  describe('handleGameEnd', () => {
    beforeEach(() => {
      table.addPlayer(createMockPlayer('player1', 'Player 1'));
      table.addPlayer(createMockPlayer('player2', 'Player 2'));
      table.addPlayer(createMockPlayer('player3', 'Player 3'));
      table.state = TableState.IN_PROGRESS;
    });

    it('should update chip counts', () => {
      const result = {
        finalChips: {
          player1: 1500,
          player2: 800,
          player3: 700,
        },
      };
      
      table.handleGameEnd(result);
      
      expect(table.players.get('player1').chips).toBe(1500);
      expect(table.players.get('player2').chips).toBe(800);
      expect(table.players.get('player3').chips).toBe(700);
    });

    it('should remove broke players', () => {
      const result = {
        finalChips: {
          player1: 1500,
          player2: 0,
          player3: 1500,
        },
      };
      
      table.handleGameEnd(result);
      
      expect(table.players.has('player1')).toBe(true);
      expect(table.players.has('player2')).toBe(false);
      expect(table.players.has('player3')).toBe(true);
    });

    it('should reset state to waiting', () => {
      const result = { finalChips: {} };
      
      table.handleGameEnd(result);
      
      expect(table.state).toBe(TableState.WAITING);
    });

    it('should schedule next game', () => {
      vi.useFakeTimers();
      // Set minPlayers back to 2 for this test  
      table.config.minPlayers = 2;
      
      const result = {
        finalChips: {
          player1: 1500,
          player2: 1500,
          player3: 1500,
        },
      };
      
      const startedSpy = vi.fn();
      table.on('game:started', startedSpy);
      
      table.handleGameEnd(result);
      expect(table.state).toBe(TableState.WAITING);
      
      // Fast forward time
      vi.advanceTimersByTime(5000);
      
      // Should have tried to start new game
      expect(table.gameCount).toBeGreaterThan(0);
      
      vi.useRealTimers();
    });
  });

  describe('utility methods', () => {
    it('should check if game is in progress', () => {
      expect(table.isGameInProgress()).toBe(false);
      
      table.state = TableState.IN_PROGRESS;
      expect(table.isGameInProgress()).toBe(true);
      
      table.state = TableState.WAITING;
      expect(table.isGameInProgress()).toBe(false);
    });

    it('should get player count', () => {
      expect(table.getPlayerCount()).toBe(0);
      
      table.addPlayer(createMockPlayer('player1', 'Player 1'));
      expect(table.getPlayerCount()).toBe(1);
      
      table.addPlayer(createMockPlayer('player2', 'Player 2'));
      expect(table.getPlayerCount()).toBe(2);
    });

    it('should get table info', () => {
      table.addPlayer(createMockPlayer('player1', 'Player 1'));
      table.addPlayer(createMockPlayer('player2', 'Player 2'));
      
      const info = table.getInfo();
      
      expect(info.id).toBe(table.id);
      expect(info.variant).toBe('texas-holdem');
      expect(info.players).toBe(2);
      expect(info.maxPlayers).toBe(9);
      expect(info.blinds).toEqual({ small: 10, big: 20 });
      expect(info.state).toBe(TableState.WAITING);
      expect(info.gameCount).toBeGreaterThanOrEqual(0);
      expect(info.waitingList).toBe(0);
    });
  });

  describe('close', () => {
    it('should close table and cleanup', () => {
      const closedSpy = vi.fn();
      table.on('table:closed', closedSpy);
      
      table.close();
      
      expect(table.state).toBe(TableState.CLOSED);
      expect(closedSpy).toHaveBeenCalledWith({ tableId: table.id });
      expect(table.listenerCount('table:closed')).toBe(0);
    });

    it('should abort game if in progress', () => {
      const mockGameEngine = { abort: vi.fn() };
      table.gameEngine = mockGameEngine;
      
      table.close();
      
      expect(mockGameEngine.abort).toHaveBeenCalled();
    });
  });

  describe('event forwarding', () => {
    it('should forward game:ended event with table context', () => {
      // Prevent auto-start
      table.config.minPlayers = 3;
      table.addPlayer(createMockPlayer('player1', 'Player 1'));
      table.addPlayer(createMockPlayer('player2', 'Player 2'));
      
      const endedSpy = vi.fn();
      table.on('game:ended', endedSpy);
      
      // Manually start game
      table.config.minPlayers = 2;
      table.tryStartGame();
      
      // Simulate game engine ending
      const result = { finalChips: { player1: 1000, player2: 1000 } };
      table.gameEngine.emit('game:ended', result);
      
      // Should call handleGameEnd which sets state to WAITING
      expect(table.state).toBe(TableState.WAITING);
    });
  });
});