import { describe, it, expect } from 'vitest';
import { Table } from '../../Table.js';
import { Player } from '../../Player.js';
import { Action } from '../../types/index.js';

/**
 * Test using Table directly (not through PokerGameManager)
 * to match exactly how the client is using it
 */

class SimplePlayer extends Player {
  getAction(gameState) {
    const { validActions } = gameState;
    if (validActions.includes(Action.FOLD)) {
      return { action: Action.FOLD };
    }
    return { action: Action.CHECK };
  }

  receivePrivateCards(cards) {
    this.cards = cards;
  }

  receivePublicCards(_cards) {}
  receiveGameUpdate(_update) {}
}

describe('Direct Table Usage - Blind Posting Bug', () => {
  it('should reproduce the exact bug scenario from client', async () => {
    // EXACT reproduction from client's test-blind-posting-bug.js
    const table = new Table({
      id: 'test-table',
      maxPlayers: 4,
      minPlayers: 2,
      blinds: { small: 64000, big: 128000 },
    });

    // Player with insufficient chips for big blind
    const shortStack = new SimplePlayer({ id: 'p1', name: 'ShortStack' });
    shortStack.chips = 54228; // Less than BB of 128000
    table.addPlayer(shortStack);

    // Player with sufficient chips
    const bigStack = new SimplePlayer({ id: 'p2', name: 'BigStack' });
    bigStack.chips = 217772;
    table.addPlayer(bigStack);

    console.log('Before:', shortStack.chips, bigStack.chips);

    await table.tryStartGame();

    // Wait exactly 2 seconds like the client does
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('After 2 seconds:');
    console.log('  Table state:', table.state);
    console.log('  Pot (table.pot):', table.pot); // How client accesses it
    console.log('  ShortStack chips:', shortStack.chips);
    console.log('  ShortStack bet:', shortStack.bet);
    console.log('  BigStack chips:', bigStack.chips);
    console.log('  BigStack bet:', bigStack.bet);
    console.log('  Cards dealt?', shortStack.cards);
    console.log('  Game stuck?', table.isGameInProgress());

    // Try to get pot through gameEngine
    if (table.gameEngine) {
      const actualPot = table.gameEngine.potManager.getTotal();
      console.log('  Pot (via gameEngine):', actualPot);
    }

    // According to bug report, these should fail:
    // - Pot should be 0 (BUG)
    // - Cards should not be dealt (BUG)
    // - Game should be stuck (BUG)

    // But let's see what actually happens...
    expect(shortStack.chips).toBe(0); // This works
    expect(shortStack.bet).toBe(54228); // This works
    expect(bigStack.chips).toBe(89772); // This works
    expect(bigStack.bet).toBe(128000); // This works

    // Check if cards were dealt
    const cardsDealt =
      shortStack.cards !== undefined && shortStack.cards !== null;
    console.log('  Cards actually dealt?', cardsDealt);

    // Check actual pot
    const actualPot = table.gameEngine
      ? table.gameEngine.potManager.getTotal()
      : 0;
    console.log('  Actual pot total:', actualPot);

    // If pot is 0 and cards not dealt, bug is reproduced
    if (actualPot === 0 && !cardsDealt) {
      console.log('\n🔴 BUG REPRODUCED!');
      console.log('Pot is 0 and no cards dealt - exactly as reported!');
    } else if (actualPot > 0 && cardsDealt) {
      console.log('\n✅ Bug NOT reproduced - everything works correctly');
      console.log(`Pot is ${actualPot} and cards were dealt`);
    } else {
      console.log('\n⚠️ Partial bug - inconsistent state');
      console.log(`Pot: ${actualPot}, Cards dealt: ${cardsDealt}`);
    }
  });
});
