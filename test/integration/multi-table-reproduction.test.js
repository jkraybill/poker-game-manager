import { describe, it, expect } from 'vitest';
import { PokerGameManager } from '../../packages/core/src/PokerGameManager.js';
import { Player } from '../../packages/core/src/Player.js';
import { Action } from '../../packages/core/src/types/index.js';

describe('Multi-Table Chip Conservation Bug', () => {
  class TestPlayer extends Player {
    constructor(config) {
      super(config);
      this.chips = config.chips || 1000; // Set chips after construction
      this.actionCount = 0;
    }

    async getAction(gameState) {
      this.actionCount++;
      const myState = gameState.players[this.id];
      
      // Simple strategy: Call small amounts, fold to large bets
      // This ensures hands actually complete
      if (gameState.toCall > 0) {
        if (gameState.toCall <= 20) {
          // Call blinds and small bets
          return { action: Action.CALL, timestamp: Date.now() };
        }
        return { action: Action.FOLD, timestamp: Date.now() };
      }
      return { action: Action.CHECK, timestamp: Date.now() };
    }
  }

  function countTotalChips(tables) {
    let total = 0;
    for (const table of tables) {
      // Access players from the table's players Map
      for (const [playerId, playerInfo] of table.players) {
        total += playerInfo.player.chips;
      }
    }
    return total;
  }

  it('should maintain chip conservation with single table', { timeout: 20000 }, async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'table-1',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
      maxPlayers: 6,
      dealerButton: 0
    });

    // Add 6 players with 1000 chips each
    const players = [];
    for (let i = 0; i < 6; i++) {
      const player = new TestPlayer({ id: `player-${i}`, chips: 1000 });
      players.push(player);
      await table.addPlayer(player);
    }

    const initialChips = countTotalChips([table]);
    expect(initialChips).toBe(6000); // 6 players * 1000 chips

    // Set up event listener BEFORE starting the game
    const handCompletePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Hand did not complete within timeout'));
      }, 5000);
      
      table.once('hand:ended', () => {
        console.log('Hand ended event received!');
        clearTimeout(timeout);
        setTimeout(resolve, 100);
      });
    });
    
    // Start the game
    console.log('Starting game...');
    const started = await table.tryStartGame();
    console.log('Game started:', started);
    
    // Wait for hand to complete
    await handCompletePromise;

    const finalChips = countTotalChips([table]);
    expect(finalChips).toBe(6000); // Chips should be conserved
  });

  it('should maintain chip conservation with sequential multi-table', { timeout: 20000 }, async () => {
    const manager = new PokerGameManager();
    const tables = [];
    const allPlayers = [];

    // Create 8 tables
    for (let t = 0; t < 8; t++) {
      const table = manager.createTable({
        id: `table-${t}`,
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
        maxPlayers: 6,
        dealerButton: 0
      });
      tables.push(table);

      // Add 6 players per table
      for (let p = 0; p < 6; p++) {
        const player = new TestPlayer({ 
          id: `t${t}-p${p}`, 
          chips: 1000 
        });
        allPlayers.push(player);
        await table.addPlayer(player);
      }
    }

    const initialChips = countTotalChips(tables);
    expect(initialChips).toBe(48000); // 48 players * 1000 chips

    // Play hands SEQUENTIALLY
    for (const table of tables) {
      // Set up event listener before starting
      const handCompletePromise = new Promise(resolve => {
        table.once('hand:ended', () => {
          setTimeout(resolve, 100);
        });
      });
      
      await table.tryStartGame();
      await handCompletePromise;
    }

    const finalChips = countTotalChips(tables);
    expect(finalChips).toBe(48000); // Chips should be conserved
  });

  it('should maintain chip conservation with simultaneous multi-table', { timeout: 20000 }, async () => {
    const manager = new PokerGameManager();
    const tables = [];
    const allPlayers = [];

    // Create 8 tables
    for (let t = 0; t < 8; t++) {
      const table = manager.createTable({
        id: `table-${t}`,
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
        maxPlayers: 6,
        dealerButton: 0
      });
      tables.push(table);

      // Add 6 players per table
      for (let p = 0; p < 6; p++) {
        const player = new TestPlayer({ 
          id: `t${t}-p${p}`, 
          chips: 1000 
        });
        allPlayers.push(player);
        await table.addPlayer(player);
      }
    }

    const initialChips = countTotalChips(tables);
    expect(initialChips).toBe(48000); // 48 players * 1000 chips

    // Start all tables SIMULTANEOUSLY
    const handPromises = tables.map(async table => {
      await table.tryStartGame();
      return new Promise((resolve) => {
        table.once('hand:ended', () => {
          setTimeout(resolve, 100);
        });
      });
    });

    // Check chips DURING simultaneous execution
    await new Promise(resolve => setTimeout(resolve, 500));
    const duringChips = countTotalChips(tables);
    console.log(`Chips during simultaneous execution: ${duringChips}`);
    
    // This is where the bug manifests - chips disappear temporarily
    expect(duringChips).toBe(48000); // This likely fails with -4800 chips

    // Wait for all hands to complete
    await Promise.all(handPromises);

    const finalChips = countTotalChips(tables);
    console.log(`Chips after all hands complete: ${finalChips}`);
    
    // Chips mysteriously restore after completion
    expect(finalChips).toBe(48000); // This might pass even though chips were lost during execution
  });

  it('should handle rapid simultaneous table creation and gameplay', { timeout: 20000 }, async () => {
    const manager = new PokerGameManager();
    const tableCount = 10;
    const playersPerTable = 4;
    const initialChipsPerPlayer = 1500;
    
    // Create all tables and players at once
    const tablePromises = Array.from({ length: tableCount }, async (_, t) => {
      const table = manager.createTable({
        id: `rapid-table-${t}`,
        blinds: { small: 25, big: 50 },
        minPlayers: 2,
        maxPlayers: playersPerTable,
        dealerButton: 0
      });

      // Add players
      for (let p = 0; p < playersPerTable; p++) {
        const player = new TestPlayer({ 
          id: `rapid-t${t}-p${p}`, 
          chips: initialChipsPerPlayer 
        });
        await table.addPlayer(player);
      }

      return table;
    });

    const tables = await Promise.all(tablePromises);
    
    const expectedTotal = tableCount * playersPerTable * initialChipsPerPlayer;
    const initialChips = countTotalChips(tables);
    expect(initialChips).toBe(expectedTotal);

    // Start all games simultaneously and play multiple hands
    const multiHandPromises = tables.map(async (table) => {
      for (let hand = 0; hand < 3; hand++) {
        await new Promise(async (resolve) => {
          table.once('hand:ended', () => {
            setTimeout(resolve, 50);
          });
          await table.tryStartGame();
        });
      }
    });

    // Monitor chips during execution
    const checkInterval = setInterval(() => {
      const currentChips = countTotalChips(tables);
      if (currentChips !== expectedTotal) {
        console.log(`⚠️ Chip violation detected: ${currentChips} (expected ${expectedTotal})`);
      }
    }, 100);

    await Promise.all(multiHandPromises);
    clearInterval(checkInterval);

    const finalChips = countTotalChips(tables);
    expect(finalChips).toBe(expectedTotal);
  });
});