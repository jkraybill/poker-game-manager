/**
 * Test with playerId included in action (like pokersim does)
 */

import { Table, Player } from './packages/core/src/index.js';
import { Action } from './packages/core/src/types/index.js';

class TestPlayer extends Player {
  constructor(config) {
    super(config);
    this.shouldAllIn = config.shouldAllIn || false;
  }
  
  async getAction(gameState) {
    // First player always goes all-in
    if (this.shouldAllIn) {
      return {
        playerId: this.id, // Including playerId like pokersim does
        action: Action.ALL_IN,
        timestamp: Date.now()
      };
    }
    
    // Second player always calls
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - (myState?.bet || 0);
    
    if (toCall > 0) {
      return {
        playerId: this.id, // Including playerId
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now()
      };
    }
    
    return {
      playerId: this.id,
      action: Action.CHECK,
      timestamp: Date.now()
    };
  }
}

async function testWithPlayerId() {
  console.log('=== Test with playerId in action ===\n');
  
  const table = new Table({
    id: 'test',
    maxPlayers: 2,
    minPlayers: 2,
    blinds: { small: 50, big: 100 }
  });
  
  const smallStack = new TestPlayer({
    id: 'small',
    name: 'Small Stack',
    shouldAllIn: true
  });
  smallStack.buyIn(1000);
  
  const bigStack = new TestPlayer({
    id: 'big',
    name: 'Big Stack',
    shouldAllIn: false
  });
  bigStack.buyIn(5000);
  
  await table.addPlayer(smallStack);
  await table.addPlayer(bigStack);
  
  console.log('Setup:');
  console.log('- Small Stack: 1,000 chips (will go all-in)');
  console.log('- Big Stack: 5,000 chips (will call)');
  console.log('- Expected: Small Stack can win maximum 2,000\n');
  
  table.on('hand:ended', (data) => {
    console.log('\nResults:');
    
    const winner = data.winners.find(w => w.playerId === 'small');
    if (winner) {
      console.log(`Small Stack won: ${winner.amount} chips`);
      
      if (winner.amount > 2000) {
        console.log(`❌ BUG: Won ${winner.amount - 2000} more than eligible!`);
      } else {
        console.log('✅ Correct: Won within eligible amount');
      }
    } else {
      console.log('Small Stack did not win');
    }
    
    console.log('\nSide pots:', data.sidePots.map(p => ({
      name: p.potName,
      amount: p.amount,
      cap: p.maxContribution,
      eligible: p.eligiblePlayers
    })));
  });
  
  // Start game
  table.tryStartGame();
  
  await new Promise(resolve => setTimeout(resolve, 1000));
}

testWithPlayerId().catch(console.error);