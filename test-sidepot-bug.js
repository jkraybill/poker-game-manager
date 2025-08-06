/**
 * Test to verify side pot calculation bug reported by pokersim team
 */

import { Table, Player } from './packages/core/src/index.js';
import { Action } from './packages/core/src/types/index.js';

// Create a test player that will go all-in or call
class TestPlayer extends Player {
  constructor(config) {
    super(config);
    this.strategy = config.strategy || 'normal';
  }
  
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - (myState?.bet || 0);
    
    // Strategy: 'allin' always goes all-in, 'call' always calls
    if (this.strategy === 'allin' && toCall > 0) {
      return {
        action: Action.ALL_IN,
        timestamp: Date.now()
      };
    }
    
    // Default: call any bet
    if (toCall > 0 && toCall <= this.chips) {
      return {
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now()
      };
    }
    
    // Check if no bet to call
    if (toCall === 0 && gameState.validActions.includes(Action.CHECK)) {
      return {
        action: Action.CHECK,
        timestamp: Date.now()
      };
    }
    
    // Fold if can't afford to call
    return {
      action: Action.FOLD,
      timestamp: Date.now()
    };
  }
}

async function demonstrateBug() {
  console.log('=== Demonstrating Side Pot Bug ===\n');
  
  // Create table with higher blinds to force action
  const table = new Table({
    id: 'bug-demo',
    maxPlayers: 3,
    minPlayers: 2,
    blinds: { small: 5000, big: 10000 }
  });
  
  // Player A: Small stack that will go all-in
  const playerA = new TestPlayer({
    id: 'player-a',
    name: 'Small Stack (All-in)',
    strategy: 'allin'
  });
  playerA.buyIn(30000); // 3 BBs
  
  // Player B: Medium stack
  const playerB = new TestPlayer({
    id: 'player-b',
    name: 'Medium Stack',
    strategy: 'call'
  });
  playerB.buyIn(100000); // 10 BBs
  
  // Player C: Large stack
  const playerC = new TestPlayer({
    id: 'player-c',
    name: 'Large Stack',
    strategy: 'call'
  });
  playerC.buyIn(200000); // 20 BBs
  
  // Add players
  await table.addPlayer(playerA);
  await table.addPlayer(playerB);
  await table.addPlayer(playerC);
  
  console.log('Initial chip counts:');
  console.log(`- ${playerA.name}: ${playerA.chips}`);
  console.log(`- ${playerB.name}: ${playerB.chips}`);
  console.log(`- ${playerC.name}: ${playerC.chips}`);
  console.log(`Total chips: ${playerA.chips + playerB.chips + playerC.chips}\n`);
  
  // Track actions
  table.on('player:action', (data) => {
    const player = [playerA, playerB, playerC].find(p => p.id === data.playerId);
    console.log(`Action: ${player?.name || data.playerId} ${data.action} ${data.amount || ''}`);
  });
  
  // Analyze results
  table.on('hand:ended', (data) => {
    console.log('\n=== HAND RESULTS ===');
    console.log('Winners:', JSON.stringify(data.winners, null, 2));
    console.log('\nSide Pots:', JSON.stringify(data.sidePots, null, 2));
    
    // Check for the bug
    const smallStackWinner = data.winners.find(w => w.playerId === 'player-a');
    if (smallStackWinner) {
      const maxEligible = 30000 * 3; // Small stack's all-in × 3 players
      console.log('\n=== BUG CHECK ===');
      console.log(`Small Stack went all-in for: 30,000`);
      console.log(`Maximum eligible to win: ${maxEligible} (30,000 × 3 players)`);
      console.log(`Actually won: ${smallStackWinner.amount}`);
      
      if (smallStackWinner.amount > maxEligible) {
        console.log(`\n❌ BUG CONFIRMED: Won ${smallStackWinner.amount - maxEligible} more than eligible!`);
        console.log('This violates poker side pot rules.');
      } else {
        console.log('\n✅ Correct: Winnings within eligible amount');
      }
    }
    
    // Verify chip conservation
    const totalBefore = 30000 + 100000 + 200000;
    const totalAfter = playerA.chips + playerB.chips + playerC.chips;
    console.log(`\nChip conservation check:`);
    console.log(`- Total before: ${totalBefore}`);
    console.log(`- Total after: ${totalAfter}`);
    console.log(`- Difference: ${totalAfter - totalBefore} (should be 0)`);
    
    // Final chip counts
    console.log('\nFinal chip counts:');
    console.log(`- ${playerA.name}: ${playerA.chips}`);
    console.log(`- ${playerB.name}: ${playerB.chips}`);
    console.log(`- ${playerC.name}: ${playerC.chips}`);
  });
  
  // Start the game
  console.log('\nStarting game...\n');
  table.tryStartGame();
  
  // Wait for hand to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
}

// Run the demonstration
demonstrateBug().catch(console.error);