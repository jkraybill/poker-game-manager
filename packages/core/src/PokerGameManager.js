import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import { Table } from './Table.js';

/**
 * Main entry point for the poker game management library.
 * Manages multiple tables and provides a clean API for game operations.
 */
export class PokerGameManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.tables = new Map();
    this.config = {
      maxTables: config.maxTables || 1000,
      defaultTimeout: config.defaultTimeout || 30000,
      ...config,
    };
  }

  /**
   * Create a new poker table
   * @param {Object} config - Table configuration
   * @returns {Table} The created table instance
   */
  createTable(config = {}) {
    if (this.tables.size >= this.config.maxTables) {
      throw new Error(`Maximum number of tables (${this.config.maxTables}) reached`);
    }

    const tableId = config.id || nanoid();
    const table = new Table({
      id: tableId,
      timeout: this.config.defaultTimeout,
      ...config,
    });

    // Forward table events
    table.on('*', (eventName, data) => {
      this.emit('table:event', {
        tableId,
        eventName,
        data,
      });
    });

    table.on('table:closed', () => {
      this.tables.delete(tableId);
      this.emit('table:removed', { tableId });
    });

    this.tables.set(tableId, table);
    this.emit('table:created', { tableId, table });

    return table;
  }

  /**
   * Get a specific table by ID
   * @param {string} tableId - The table ID
   * @returns {Table|undefined} The table instance or undefined
   */
  getTable(tableId) {
    return this.tables.get(tableId);
  }

  /**
   * Get all active tables
   * @returns {Table[]} Array of active tables
   */
  getTables() {
    return Array.from(this.tables.values());
  }

  /**
   * Close a specific table
   * @param {string} tableId - The table ID to close
   * @returns {boolean} True if table was closed, false if not found
   */
  closeTable(tableId) {
    const table = this.tables.get(tableId);
    if (!table) {
      return false;
    }

    table.close();
    return true;
  }

  /**
   * Close all tables
   */
  closeAllTables() {
    for (const table of this.tables.values()) {
      table.close();
    }
  }

  /**
   * Get statistics about active tables
   * @returns {Object} Statistics object
   */
  getStats() {
    const tables = this.getTables();
    return {
      totalTables: tables.length,
      activeTables: tables.filter(t => t.isGameInProgress()).length,
      totalPlayers: tables.reduce((sum, t) => sum + t.getPlayerCount(), 0),
      memoryUsage: process.memoryUsage().heapUsed,
    };
  }
}