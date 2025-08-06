/**
 * Test where the all-in player wins to see if they get too much
 */

import { Table, Player } from './packages/core/src/index.js';
import { Action } from './packages/core/src/types/index.js';

// Deterministic player that will have predetermined cards
class DeterministicPlayer extends Player {
  constructor(config) {
    super(config);
    this.strategy = config.strategy || 'normal';
    this.forcedCards = config.forcedCards;
  }
  
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - (myState?.bet || 0);
    
    // First action: raise if we're the small stack
    if (this.strategy === 'allin' && !myState.hasActed && gameState.phase === 'PRE_FLOP') {
      return { action: Action.RAISE, amount: 40000, timestamp: Date.now() };
    }
    
    // Go all-in after flop
    if (this.strategy === 'allin' && gameState.phase === 'FLOP') {
      return { action: Action.ALL_IN, timestamp: Date.now() };
    }
    
    // Call any bet
    if (toCall > 0) {
      return { action: Action.CALL, amount: toCall, timestamp: Date.now() };
    }
    
    // Check
    if (gameState.validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK, timestamp: Date.now() };
    }
    
    return { action: Action.FOLD, timestamp: Date.now() };
  }
  
  receivePrivateCards(cards) {
    // Override to use forced cards if available
    if (this.forcedCards) {
      super.receivePrivateCards(this.forcedCards);
    } else {
      super.receivePrivateCards(cards);
    }
  }
}

async function testAllInWinner() {
  console.log('=== Testing All-In Player Winning ===\n');
  
  // Multiple test runs to catch the bug
  for (let run = 0; run < 5; run++) {
    console.log(`\n--- Run ${run + 1} ---`);
    
    const table = new Table({
      id: `test-${run}`,
      maxPlayers: 3,
      minPlayers: 3,
      blinds: { small: 10000, big: 20000 }
    });
    
    // Small stack that goes all-in
    const smallStack = new DeterministicPlayer({
      id: 'small',
      name: 'Small Stack',
      strategy: 'allin'
    });
    smallStack.buyIn(50000);
    
    // Medium stack
    const mediumStack = new DeterministicPlayer({
      id: 'medium',
      name: 'Medium Stack',
      strategy: 'call'
    });
    mediumStack.buyIn(100000);
    
    // Large stack
    const largeStack = new DeterministicPlayer({
      id: 'large',
      name: 'Large Stack',
      strategy: 'call'  
    });
    largeStack.buyIn(150000);
    
    await table.addPlayer(smallStack);
    await table.addPlayer(mediumStack);
    await table.addPlayer(largeStack);
    
    let bugFound = false;
    
    table.on('hand:ended', (data) => {
      const smallWinner = data.winners.find(w => w.playerId === 'small');
      
      if (smallWinner) {
        // Small stack went all-in for 50k, with 3 players should win max 150k
        const maxEligible = 50000 * 3;
        
        if (smallWinner.amount > maxEligible) {
          console.log(`❌ BUG: Small stack won ${smallWinner.amount} but max eligible is ${maxEligible}`);
          console.log(`   Excess: ${smallWinner.amount - maxEligible}`);
          bugFound = true;
        } else {
          console.log(`✅ Correct: Small stack won ${smallWinner.amount} (max ${maxEligible})`);
        }
      } else {
        console.log('Small stack did not win this hand');
      }
      
      // Check total pot
      const totalPot = data.sidePots.reduce((sum, pot) => sum + pot.amount, 0);
      const totalWinnings = data.winners.reduce((sum, w) => sum + w.amount, 0);
      
      if (totalPot !== totalWinnings) {
        console.log(`⚠️  Pot mismatch: Pot=${totalPot}, Winnings=${totalWinnings}`);
      }
    });
    
    // Start game
    table.tryStartGame();
    
    // Wait for hand
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (bugFound) {
      console.log('\n🚨 BUG REPRODUCED! Exiting...');
      break;
    }
  }
}

testAllInWinner().catch(console.error);