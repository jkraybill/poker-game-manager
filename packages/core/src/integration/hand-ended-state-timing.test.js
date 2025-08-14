import { describe, it, expect, beforeEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('hand:ended Event State Timing Issue', () => {
  let manager;
  let table1, table2;
  
  beforeEach(() => {
    manager = new PokerGameManager();
  });

  it('should demonstrate the timing issue where isGameInProgress() is true after hand:ended', async () => {
    // Setup two tables like in a tournament
    table1 = manager.createTable({
      id: 'table-1',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
    });
    
    table2 = manager.createTable({
      id: 'table-2', 
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
    });

    // Add players to both tables
    const player1 = new Player({ id: 'p1', name: 'Player 1' });
    player1.chips = 1000;
    player1.getAction = async () => ({ action: Action.FOLD });
    
    const player2 = new Player({ id: 'p2', name: 'Player 2' });
    player2.chips = 1000;
    player2.getAction = async () => ({ action: Action.CHECK });
    
    const player3 = new Player({ id: 'p3', name: 'Player 3' });
    player3.chips = 1000;
    player3.getAction = async () => ({ action: Action.FOLD });
    
    const player4 = new Player({ id: 'p4', name: 'Player 4' });
    player4.chips = 1000;
    player4.getAction = async () => ({ action: Action.CHECK });

    table1.addPlayer(player1);
    table1.addPlayer(player2);
    table2.addPlayer(player3);
    table2.addPlayer(player4);

    // Track state when hand:ended fires
    const stateAtHandEnded = {};

    // This simulates what the client's tournament manager does
    const playHandSequentially = async (tables) => {
      for (const table of tables) {
        // Skip if game is in progress (client's check)
        if (table.isGameInProgress()) {
          console.log(`Table ${table.id} still in progress, skipping`);
          continue;
        }

        // Set up listener BEFORE starting game (client's pattern)
        const handEndedPromise = new Promise((resolve) => {
          const handler = () => {
            // Client assumes that when hand:ended fires, the table is ready for next hand
            // But let's check if that's actually true
            const isInProgress = table.isGameInProgress();
            stateAtHandEnded[table.id] = isInProgress;
            console.log(`[${table.id}] hand:ended fired, isGameInProgress: ${isInProgress}`);
            table.off('hand:ended', handler);
            resolve();
          };
          table.on('hand:ended', handler);
        });

        // Start the game
        const result = await table.tryStartGame();
        console.log(`[${table.id}] tryStartGame result: ${result.success}`);
        if (result.success) {
          await handEndedPromise;
        }
      }
    };

    // Play first round of hands
    console.log('\n--- Playing first round of hands ---');
    await playHandSequentially([table1, table2]);

    // Check the problematic behavior
    console.log('State when hand:ended fired:');
    console.log(`  Table 1 isGameInProgress: ${stateAtHandEnded['table-1']}`);
    console.log(`  Table 2 isGameInProgress: ${stateAtHandEnded['table-2']}`);

    // FIXED: isGameInProgress() is now false when hand:ended fires!
    expect(stateAtHandEnded['table-1']).toBe(false);
    expect(stateAtHandEnded['table-2']).toBe(false);

    // Now try to play a second round - this is where the client gets stuck
    console.log('\n--- Trying to play second round ---');
    
    // Reset tracking
    stateAtHandEnded.table1 = null;
    stateAtHandEnded.table2 = null;

    // Client checks isGameInProgress() before playing
    // But it's still true from the previous hand!
    console.log('Before second round:');
    console.log(`  Table 1 isGameInProgress: ${table1.isGameInProgress()}`);
    console.log(`  Table 2 isGameInProgress: ${table2.isGameInProgress()}`);

    // After event loop tick, state should be updated
    await new Promise(resolve => setImmediate(resolve));
    
    console.log('After event loop tick:');
    console.log(`  Table 1 isGameInProgress: ${table1.isGameInProgress()}`);
    console.log(`  Table 2 isGameInProgress: ${table2.isGameInProgress()}`);

    // Now it should be false
    expect(table1.isGameInProgress()).toBe(false);
    expect(table2.isGameInProgress()).toBe(false);

    // This demonstrates the problem: 
    // 1. hand:ended fires while isGameInProgress() is still true
    // 2. Client code that assumes hand:ended means "ready for next hand" gets confused
    // 3. They have to wait for next tick or add workarounds
  });

  it('should show that the fix allows sequential tournament processing', async () => {
    // Setup similar to above
    table1 = manager.createTable({
      id: 'table-1',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
    });
    
    const player1 = new Player({ id: 'p1', name: 'Player 1' });
    player1.chips = 1000;
    player1.getAction = async ({ validActions, toCall }) => {
      // Only fold when there's a bet to call, otherwise check
      if (toCall > 0) return { action: Action.FOLD };
      if (validActions.includes(Action.CHECK)) return { action: Action.CHECK };
      return { action: Action.CALL };
    };
    
    const player2 = new Player({ id: 'p2', name: 'Player 2' });
    player2.chips = 1000;
    player2.getAction = async ({ validActions }) => {
      if (validActions.includes(Action.CHECK)) return { action: Action.CHECK };
      return { action: Action.CALL };
    };

    table1.addPlayer(player1);
    table1.addPlayer(player2);

    // Simulate client's tournament manager logic
    let handsPlayed = 0;
    let tablesSkipped = 0;

    const tournamentRound = async () => {
      // Check if table is ready (client's pattern from MultiTableTournament.js)
      if (table1.isGameInProgress()) {
        console.log('Table still in progress, skipping this round');
        tablesSkipped++;
        return;
      }

      // Play hand
      const handEndedPromise = new Promise((resolve) => {
        const handler = () => {
          table1.off('hand:ended', handler);
          resolve();
        };
        table1.on('hand:ended', handler);
      });

      const result = await table1.tryStartGame();
      if (result.success) {
        await handEndedPromise;
        handsPlayed++;
      }
    };

    // Play first hand
    await tournamentRound();
    expect(handsPlayed).toBe(1);
    expect(tablesSkipped).toBe(0);

    // Try to play second hand immediately (simulating sequential tournament processing)
    // This should now work correctly with the fix
    await tournamentRound();
    
    // FIXED: Tables are no longer skipped!
    expect(tablesSkipped).toBe(0);
    expect(handsPlayed).toBe(2); // Now correctly plays both hands

    // Try a third hand to fully validate
    await tournamentRound();
    expect(handsPlayed).toBe(3);
    expect(tablesSkipped).toBe(0);
  });
});