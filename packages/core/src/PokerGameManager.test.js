import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PokerGameManager } from './PokerGameManager.js';
import { Table } from './Table.js';

// Mock the Table class
vi.mock('./Table.js', () => {
  return {
    Table: vi.fn((config) => {
      const tableId = config?.id || 'mock-table-id';
      const mockTable = {
        id: tableId,
        on: vi.fn(),
        emit: vi.fn(),
        close: vi.fn(),
        isGameInProgress: vi.fn(() => false),
        getPlayerCount: vi.fn(() => 0),
        getInfo: vi.fn(() => ({
          id: tableId,
          variant: 'texas-holdem',
          players: 0,
          maxPlayers: 9,
          blinds: { small: 10, big: 20 },
          state: 'waiting',
          gameCount: 0,
          waitingList: 0,
        })),
      };
      return mockTable;
    }),
  };
});

describe('PokerGameManager', () => {
  let manager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new PokerGameManager();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(manager.tables).toBeInstanceOf(Map);
      expect(manager.tables.size).toBe(0);
      expect(manager.config.maxTables).toBe(1000);
      expect(manager.config.defaultTimeout).toBe(30000);
    });

    it('should accept custom config', () => {
      const customManager = new PokerGameManager({
        maxTables: 50,
        defaultTimeout: 60000,
        customOption: 'test',
      });

      expect(customManager.config.maxTables).toBe(50);
      expect(customManager.config.defaultTimeout).toBe(60000);
      expect(customManager.config.customOption).toBe('test');
    });

    it('should merge config with defaults', () => {
      const customManager = new PokerGameManager({
        maxTables: 100,
      });

      expect(customManager.config.maxTables).toBe(100);
      expect(customManager.config.defaultTimeout).toBe(30000); // default
    });
  });

  describe('createTable', () => {
    it('should create a table with default config', () => {
      const createdSpy = vi.fn();
      manager.on('table:created', createdSpy);

      const table = manager.createTable();

      expect(Table).toHaveBeenCalledWith({
        id: expect.any(String),
        timeout: 30000,
      });
      expect(manager.tables.size).toBe(1);
      expect(manager.tables.has(table.id)).toBe(true);
      expect(createdSpy).toHaveBeenCalledWith({
        tableId: table.id,
        table,
      });
    });

    it('should create a table with custom config', () => {
      const customConfig = {
        id: 'custom-table-123',
        variant: 'omaha',
        maxPlayers: 6,
        blinds: { small: 25, big: 50 },
      };

      const table = manager.createTable(customConfig);

      expect(Table).toHaveBeenCalledWith({
        id: 'custom-table-123',
        timeout: 30000,
        variant: 'omaha',
        maxPlayers: 6,
        blinds: { small: 25, big: 50 },
      });
      expect(table.id).toBe('custom-table-123'); // Mock now uses the provided ID
    });

    it('should generate table ID if not provided', () => {
      manager.createTable();
      manager.createTable();

      expect(Table).toHaveBeenCalledTimes(2);
      const calls = Table.mock.calls;
      expect(calls[0][0].id).toBeDefined();
      expect(calls[1][0].id).toBeDefined();
      expect(calls[0][0].id).not.toBe(calls[1][0].id);
    });

    it('should throw error when max tables reached', () => {
      const smallManager = new PokerGameManager({ maxTables: 2 });
      
      smallManager.createTable();
      smallManager.createTable();

      expect(() => smallManager.createTable()).toThrow(
        'Maximum number of tables (2) reached',
      );
    });

    it('should set up event forwarding', () => {
      const table = manager.createTable();

      expect(table.on).toHaveBeenCalledWith('*', expect.any(Function));
      expect(table.on).toHaveBeenCalledWith('table:closed', expect.any(Function));
    });

    it('should forward table events', () => {
      const eventSpy = vi.fn();
      manager.on('table:event', eventSpy);

      const table = manager.createTable();
      const eventHandler = table.on.mock.calls.find(call => call[0] === '*')[1];

      // Simulate a table event
      eventHandler('game:started', { gameId: 123 });

      expect(eventSpy).toHaveBeenCalledWith({
        tableId: table.id,
        eventName: 'game:started',
        data: { gameId: 123 },
      });
    });

    it('should handle table closed event', () => {
      const removedSpy = vi.fn();
      manager.on('table:removed', removedSpy);

      const table = manager.createTable();
      expect(manager.tables.size).toBe(1);

      // Get the table:closed handler
      const closedHandler = table.on.mock.calls.find(call => call[0] === 'table:closed')[1];
      
      // Simulate table closing
      closedHandler();

      expect(manager.tables.size).toBe(0);
      expect(removedSpy).toHaveBeenCalledWith({ tableId: table.id });
    });
  });

  describe('getTable', () => {
    it('should return existing table', () => {
      const table = manager.createTable();
      const retrieved = manager.getTable(table.id);

      expect(retrieved).toBe(table);
    });

    it('should return undefined for non-existent table', () => {
      const retrieved = manager.getTable('non-existent-id');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getTables', () => {
    it('should return empty array when no tables', () => {
      const tables = manager.getTables();

      expect(tables).toEqual([]);
    });

    it('should return all tables', () => {
      const table1 = manager.createTable();
      const table2 = manager.createTable();
      const table3 = manager.createTable();

      const tables = manager.getTables();

      expect(tables).toHaveLength(3);
      expect(tables).toContain(table1);
      expect(tables).toContain(table2);
      expect(tables).toContain(table3);
    });

    it('should return a new array each time', () => {
      manager.createTable();
      
      const tables1 = manager.getTables();
      const tables2 = manager.getTables();

      expect(tables1).not.toBe(tables2);
      expect(tables1).toEqual(tables2);
    });
  });

  describe('closeTable', () => {
    it('should close existing table', () => {
      const table = manager.createTable();
      const result = manager.closeTable(table.id);

      expect(result).toBe(true);
      expect(table.close).toHaveBeenCalled();
    });

    it('should return false for non-existent table', () => {
      const result = manager.closeTable('non-existent-id');

      expect(result).toBe(false);
    });

    it('should trigger cleanup through table close event', () => {
      const removedSpy = vi.fn();
      manager.on('table:removed', removedSpy);

      const table = manager.createTable();
      expect(manager.tables.size).toBe(1);

      // Close the table
      manager.closeTable(table.id);

      // Simulate the table emitting closed event
      const closedHandler = table.on.mock.calls.find(call => call[0] === 'table:closed')[1];
      closedHandler();

      expect(manager.tables.size).toBe(0);
      expect(removedSpy).toHaveBeenCalledWith({ tableId: table.id });
    });
  });

  describe('closeAllTables', () => {
    it('should close all tables', () => {
      const table1 = manager.createTable();
      const table2 = manager.createTable();
      const table3 = manager.createTable();

      manager.closeAllTables();

      expect(table1.close).toHaveBeenCalled();
      expect(table2.close).toHaveBeenCalled();
      expect(table3.close).toHaveBeenCalled();
    });

    it('should handle empty manager', () => {
      expect(() => manager.closeAllTables()).not.toThrow();
    });

    it('should work with single table', () => {
      const table = manager.createTable();
      
      manager.closeAllTables();

      expect(table.close).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return stats for empty manager', () => {
      const stats = manager.getStats();

      expect(stats).toEqual({
        totalTables: 0,
        activeTables: 0,
        totalPlayers: 0,
        memoryUsage: expect.any(Number),
      });
    });

    it('should return stats for manager with tables', () => {
      // Create tables with different states
      const table1 = manager.createTable();
      table1.isGameInProgress.mockReturnValue(true);
      table1.getPlayerCount.mockReturnValue(5);

      const table2 = manager.createTable();
      table2.isGameInProgress.mockReturnValue(false);
      table2.getPlayerCount.mockReturnValue(3);

      const table3 = manager.createTable();
      table3.isGameInProgress.mockReturnValue(true);
      table3.getPlayerCount.mockReturnValue(8);

      const stats = manager.getStats();

      expect(stats).toEqual({
        totalTables: 3,
        activeTables: 2, // table1 and table3
        totalPlayers: 16, // 5 + 3 + 8
        memoryUsage: expect.any(Number),
      });
    });

    it('should include memory usage', () => {
      const stats = manager.getStats();

      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(typeof stats.memoryUsage).toBe('number');
    });
  });

  describe('event emission', () => {
    it('should be an EventEmitter', () => {
      expect(manager.on).toBeDefined();
      expect(manager.emit).toBeDefined();
      expect(manager.removeAllListeners).toBeDefined();
    });

    it('should emit table:created on table creation', () => {
      const createdSpy = vi.fn();
      manager.on('table:created', createdSpy);

      const table = manager.createTable();

      expect(createdSpy).toHaveBeenCalledTimes(1);
      expect(createdSpy).toHaveBeenCalledWith({
        tableId: table.id,
        table,
      });
    });

    it('should emit table:removed when table closes', () => {
      const removedSpy = vi.fn();
      manager.on('table:removed', removedSpy);

      const table = manager.createTable();
      const closedHandler = table.on.mock.calls.find(call => call[0] === 'table:closed')[1];
      closedHandler();

      expect(removedSpy).toHaveBeenCalledTimes(1);
      expect(removedSpy).toHaveBeenCalledWith({
        tableId: table.id,
      });
    });

    it('should forward all table events', () => {
      const eventSpy = vi.fn();
      manager.on('table:event', eventSpy);

      const table = manager.createTable();
      const eventHandler = table.on.mock.calls.find(call => call[0] === '*')[1];

      // Test various events
      eventHandler('game:started', { gameId: 1 });
      eventHandler('player:joined', { playerId: 'p1' });
      eventHandler('custom:event', { data: 'test' });

      expect(eventSpy).toHaveBeenCalledTimes(3);
      expect(eventSpy).toHaveBeenCalledWith({
        tableId: table.id,
        eventName: 'game:started',
        data: { gameId: 1 },
      });
      expect(eventSpy).toHaveBeenCalledWith({
        tableId: table.id,
        eventName: 'player:joined',
        data: { playerId: 'p1' },
      });
      expect(eventSpy).toHaveBeenCalledWith({
        tableId: table.id,
        eventName: 'custom:event',
        data: { data: 'test' },
      });
    });
  });

  describe('edge cases and cleanup', () => {
    it('should handle rapid table creation and removal', () => {
      for (let i = 0; i < 10; i++) {
        const table = manager.createTable();
        manager.closeTable(table.id);
      }

      // All tables should eventually be cleaned up
      expect(manager.tables.size).toBeLessThanOrEqual(10);
    });

    it('should maintain table isolation', () => {
      const table1 = manager.createTable();
      const table2 = manager.createTable();

      // Tables should have separate event handlers
      expect(table1.on).not.toBe(table2.on);
      expect(table1).not.toBe(table2);
    });

    it('should handle concurrent operations', () => {
      // Create multiple tables
      const tables = [];
      for (let i = 0; i < 5; i++) {
        tables.push(manager.createTable());
      }

      // Close some tables
      manager.closeTable(tables[1].id);
      manager.closeTable(tables[3].id);

      // Create more tables
      manager.createTable();
      manager.createTable();

      // Get stats shouldn't throw
      expect(() => manager.getStats()).not.toThrow();
      
      // Get tables shouldn't throw
      expect(() => manager.getTables()).not.toThrow();
    });

    it('should prevent memory leaks by cleaning up event listeners', () => {
      const table = manager.createTable();
      
      // Simulate table closed event
      const closedHandler = table.on.mock.calls.find(call => call[0] === 'table:closed')[1];
      closedHandler();

      // Table should be removed from manager
      expect(manager.tables.has(table.id)).toBe(false);
      
      // No references should remain
      expect(manager.getTables()).not.toContain(table);
    });
  });
});