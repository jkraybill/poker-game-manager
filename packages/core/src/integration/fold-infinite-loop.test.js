import { describe, it, expect } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

/**
 * Specific test for the fold infinite loop bug
 * Ensures that when a player folds, they are marked as having acted
 * and the game doesn't ask them again
 */
describe('Fold Action Infinite Loop Fix', () => {
  it('should not re-ask player after they fold', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'fold-test',
      blinds: { small: 100, big: 200 },
      minPlayers: 3,
    });

    let foldPlayerDecisions = 0;

    // Player who will raise
    const raiser = new Player({ id: 'raiser', name: 'Raiser' });
    raiser.chips = 5000;
    // eslint-disable-next-line require-await
    raiser.getAction = async function(gameState) {
      // Raise on first action
      if (gameState.phase === 'PRE_FLOP' && gameState.currentBet === 200) {
        console.log('Raiser: Raising to 500');
        return { action: Action.RAISE, amount: 500 };
      }
      return { action: Action.CHECK };
    };

    // Player who will fold
    const folder = new Player({ id: 'folder', name: 'Folder' });
    folder.chips = 1000;
    // eslint-disable-next-line require-await
    folder.getAction = async function(gameState) {
      foldPlayerDecisions++;
      console.log(`Folder decision #${foldPlayerDecisions}:`, {
        phase: gameState.phase,
        currentBet: gameState.currentBet,
        toCall: gameState.currentBet - gameState.players[this.id].bet,
      });
      
      if (foldPlayerDecisions > 2) {
        throw new Error(`INFINITE LOOP: Folder asked ${foldPlayerDecisions} times after folding!`);
      }
      
      // Fold when facing the raise
      const toCall = gameState.currentBet - gameState.players[this.id].bet;
      if (toCall > 200) {
        console.log('Folder: Folding to the raise');
        return { action: Action.FOLD };
      }
      
      if (toCall > 0) {
        return { action: Action.CALL };
      }
      return { action: Action.CHECK };
    };

    // Player who will call
    const caller = new Player({ id: 'caller', name: 'Caller' });
    caller.chips = 5000;
    // eslint-disable-next-line require-await
    caller.getAction = async function(gameState) {
      const toCall = gameState.currentBet - gameState.players[this.id].bet;
      if (toCall > 0) {
        console.log('Caller: Calling');
        return { action: Action.CALL };
      }
      return { action: Action.CHECK };
    };

    // Track events
    let foldEventFired = false;
    table.on('player:action', ({ playerId, action }) => {
      if (playerId === 'folder' && action === Action.FOLD) {
        foldEventFired = true;
        console.log('Fold event fired');
      }
    });

    // Add players in specific order
    table.addPlayer(raiser);
    table.addPlayer(folder);
    table.addPlayer(caller);

    // Start game
    const started = await table.tryStartGame();
    expect(started.success).toBe(true);

    // Wait for actions to process
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify folder was only asked once (before folding)
    expect(foldPlayerDecisions).toBe(1);
    expect(foldEventFired).toBe(true);
    
    console.log('Test passed: Folder only asked once before folding');
  });

  it('should handle multiple players folding in sequence', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'multi-fold',
      blinds: { small: 10, big: 20 },
      minPlayers: 4,
    });

    const decisionCounts = new Map();

    // Create 4 players - one raises, three fold
    for (let i = 0; i < 4; i++) {
      const player = new Player({ id: `p${i}`, name: `Player${i}` });
      player.chips = 1000;
      
      // eslint-disable-next-line require-await
      player.getAction = async function(gameState) {
        const key = this.id;
        const count = (decisionCounts.get(key) || 0) + 1;
        decisionCounts.set(key, count);
        
        console.log(`${this.name} decision #${count}`);
        
        if (count > 3) {
          throw new Error(`INFINITE LOOP: ${this.name} asked ${count} times!`);
        }
        
        // First player raises, others fold
        if (i === 0 && gameState.currentBet === 20) {
          return { action: Action.RAISE, amount: 100 };
        }
        
        const toCall = gameState.currentBet - gameState.players[this.id].bet;
        if (toCall > 20) {
          console.log(`${this.name}: Folding to raise`);
          return { action: Action.FOLD };
        }
        
        if (toCall > 0) {
          return { action: Action.CALL };
        }
        return { action: Action.CHECK };
      };
      
      table.addPlayer(player);
    }

    const started = await table.tryStartGame();
    expect(started.success).toBe(true);

    // Wait for hand to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Each folding player should only be asked once
    expect(decisionCounts.get('p1')).toBeLessThanOrEqual(2); // May act pre-raise and post-raise
    expect(decisionCounts.get('p2')).toBeLessThanOrEqual(2);
    expect(decisionCounts.get('p3')).toBeLessThanOrEqual(2);
    
    console.log('Test passed: Multiple folds handled correctly');
  });
});