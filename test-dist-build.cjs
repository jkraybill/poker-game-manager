#!/usr/bin/env node

/**
 * Test the distributed build to see if the bug exists there
 * This simulates what npm users experience
 */

const { Table, Player, Action } = require('./dist/index.cjs');

class SimplePlayer extends Player {
  async getAction(gameState) {
    const { validActions } = gameState;
    if (validActions.includes(Action.FOLD)) return { action: Action.FOLD };
    return { action: Action.CHECK };
  }
  
  receivePrivateCards(cards) {
    this.cards = cards;
  }
  
  receivePublicCards(_cards) {}
  receiveGameUpdate(_update) {}
}

async function testDistBuild() {
  console.log('Testing DIST build (what npm users get)...\n');
  
  const table = new Table({
    id: 'test-table',
    maxPlayers: 4,
    minPlayers: 2,
    blinds: { small: 64000, big: 128000 }
  });
  
  const shortStack = new SimplePlayer({ id: 'p1', name: 'ShortStack' });
  shortStack.chips = 54228;
  table.addPlayer(shortStack);
  
  const bigStack = new SimplePlayer({ id: 'p2', name: 'BigStack' });
  bigStack.chips = 217772;
  table.addPlayer(bigStack);
  
  console.log('Before:', shortStack.chips, bigStack.chips);
  
  const result = await table.tryStartGame();
  console.log('Start result:', result.success);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\nAfter 2 seconds:');
  console.log('  Table state:', table.state);
  console.log('  ShortStack chips:', shortStack.chips);
  console.log('  ShortStack bet:', shortStack.bet);
  console.log('  BigStack chips:', bigStack.chips);
  console.log('  BigStack bet:', bigStack.bet);
  console.log('  Cards dealt?', shortStack.cards ? 'YES' : 'NO');
  
  // Try to access pot
  if (table.gameEngine && table.gameEngine.potManager) {
    const pot = table.gameEngine.potManager.getTotal();
    console.log('  Pot total:', pot);
    
    if (pot === 0 && !shortStack.cards) {
      console.log('\n🔴 BUG FOUND IN DIST BUILD!');
      console.log('This explains why npm users see the bug!');
    } else {
      console.log('\n✅ Dist build works correctly');
      console.log(`Pot: ${pot}, Cards dealt: ${shortStack.cards ? 'YES' : 'NO'}`);
    }
  } else {
    console.log('  Could not access pot manager');
  }
  
  process.exit(0);
}

testDistBuild().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});