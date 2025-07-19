import { PokerGameManager, Player, Action } from '../packages/core/src/index.js';

// Player that always folds when facing a bet
class AlwaysFoldPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    // Always fold when facing any bet
    if (toCall > 0) {
      return {
        playerId: this.id,
        action: Action.FOLD,
        timestamp: Date.now(),
      };
    }

    // Check if no bet to face
    return {
      playerId: this.id,
      action: Action.CHECK,
      timestamp: Date.now(),
    };
  }
}

// Player that never folds
class NeverFoldPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    if (toCall === 0) {
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now(),
      };
    }

    // Call any bet
    const callAmount = Math.min(toCall, myState.chips);
    return {
      playerId: this.id,
      action: callAmount === myState.chips ? Action.ALL_IN : Action.CALL,
      amount: callAmount,
      timestamp: Date.now(),
    };
  }
}

// Run the test
async function runTest() {
  console.log('=== 2-PLAYER TEST: SB FOLDS TO BB ===\n');
  console.log('Testing scenario: Heads-up, SB/Button folds to BB\n');
  
  const manager = new PokerGameManager();

  const table = manager.createTable({
    blinds: { small: 10, big: 20 },
    minBuyIn: 1000,
    maxBuyIn: 1000,
    minPlayers: 2,  // Heads-up game
  });

  // Create two players
  const sbPlayer = new AlwaysFoldPlayer({ name: 'SB/Button' });
  const bbPlayer = new NeverFoldPlayer({ name: 'Big Blind' });
  
  // Track test results
  let testPassed = false;
  let bigBlindWon = false;
  let potAmount = 0;
  let winnerId = null;
  let winnerAmount = 0;
  let currentGameNumber = 0;
  
  // Track actions
  const actions = [];
  
  // Listen to events
  table.on('game:started', ({ gameNumber }) => {
    currentGameNumber = gameNumber;
    if (gameNumber === 1) {
      console.log(`Game ${gameNumber} started\n`);
    }
  });
  
  table.on('action:requested', ({ playerId, gameState }) => {
    if (currentGameNumber === 1) {
      const player = [sbPlayer, bbPlayer].find(p => p.id === playerId);
      const playerState = gameState.players[playerId];
      const toCall = gameState.currentBet - playerState.bet;
      console.log(`[ACTION REQUEST] ${player?.name} to act. Current bet: $${gameState.currentBet}, player bet: $${playerState.bet}, to call: $${toCall}`);
    }
  });
  
  table.on('hand:started', ({ dealerButton }) => {
    if (currentGameNumber === 1) {
      console.log(`New hand started. Dealer button at position ${dealerButton}`);
      console.log('In heads-up play:');
      console.log(`- Position ${dealerButton} is Button/Small Blind: ${sbPlayer.name}`);
      console.log(`- Position ${dealerButton === 0 ? 1 : 0} is Big Blind: ${bbPlayer.name}\n`);
    }
  });
  
  table.on('pot:updated', ({ total, playerBet }) => {
    potAmount = total;
    if (currentGameNumber === 1 && playerBet) {
      const player = [sbPlayer, bbPlayer].find(p => p.id === playerBet.playerId);
      console.log(`[POT UPDATE] ${player?.name} contributes $${playerBet.amount}, pot now $${total}`);
    }
  });
  
  table.on('player:action', ({ playerId, action, amount }) => {
    if (currentGameNumber === 1) {
      const player = [sbPlayer, bbPlayer].find(p => p.id === playerId);
      actions.push({ player: player?.name, action, amount });
      console.log(`${player?.name} ${action}${amount ? ` $${amount}` : ''}`);
    }
  });
  
  table.on('hand:ended', ({ winners, payouts }) => {
    if (currentGameNumber !== 1) return;
    
    console.log('\nHand ended');
    console.log(`Final pot: $${potAmount}`);
    
    // Check if big blind won
    if (winners && winners.length > 0) {
      winnerId = winners[0].playerId;
      winnerAmount = winners[0].amount;
      
      const winner = [sbPlayer, bbPlayer].find(p => p.id === winnerId);
      console.log(`Winner: ${winner?.name} wins $${winnerAmount}`);
      
      // Verify test conditions
      if (winner === bbPlayer && winnerAmount === 30) {
        bigBlindWon = true;
        testPassed = true;
        console.log('\n✅ TEST PASSED: Big Blind won $30 after SB/Button folded');
      } else {
        console.log(`\n❌ TEST FAILED: Expected Big Blind to win $30, but ${winner?.name} won $${winnerAmount}`);
      }
    }
    
    // Show action sequence
    console.log('\nAction sequence:');
    actions.forEach(({ player, action }) => {
      console.log(`- ${player}: ${action}`);
    });
  });
  
  table.on('game:ended', () => {
    console.log('\nGame ended');
    table.close();
  });

  // Add players to table
  // In heads-up, first player added gets position 0 (will be button/SB)
  // Second player gets position 1 (will be BB)
  table.addPlayer(sbPlayer);
  table.addPlayer(bbPlayer);

  // Wait for test to complete
  await new Promise(resolve => {
    let handEnded = false;
    
    table.on('hand:ended', () => {
      if (!handEnded && currentGameNumber === 1) {
        handEnded = true;
        setTimeout(() => {
          table.close();
          resolve();
        }, 100);
      }
    });
    
    // Safety timeout
    setTimeout(() => {
      if (!handEnded) {
        console.log('\n❌ TEST TIMEOUT: Test did not complete in time');
        table.close();
        resolve();
      }
    }, 10000);
  });

  // Final test result
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Test result: ${testPassed ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Big Blind won: ${bigBlindWon ? 'Yes' : 'No'}`);
  console.log(`Pot amount: $${potAmount}`);
  console.log(`Winner amount: $${winnerAmount}`);
  
  // Exit with appropriate code
  process.exit(testPassed ? 0 : 1);
}

// Run the test
runTest().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});