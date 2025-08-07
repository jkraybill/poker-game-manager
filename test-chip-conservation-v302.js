import { PokerGameManager, Player, Action } from './packages/core/src/index.js';

// Test exactly what the bug report claims
class AllInPlayer extends Player {
  getAction(gameState) {
    const myState = gameState.players[this.id];
    if (myState.chips > 0) {
      return {
        action: Action.ALL_IN,
        amount: myState.chips,
        playerId: this.id,
        timestamp: Date.now()
      };
    }
    return {
      action: Action.CHECK,
      playerId: this.id,
      timestamp: Date.now()
    };
  }
}

async function testChipConservation(numPlayers, numHands) {
  const manager = new PokerGameManager();
  const table = manager.createTable({
    id: 'test-table',
    blinds: { small: 100, big: 200 },
    minPlayers: numPlayers,
    maxPlayers: numPlayers,
    dealerButton: 0
  });

  // Create players with different stack sizes
  const players = [];
  const initialChips = [];
  for (let i = 0; i < numPlayers; i++) {
    const chips = 10000 + (i * 100); // Different stacks
    const player = new AllInPlayer({ 
      id: `player${i}`,
      name: `Player ${i}`
    });
    player.buyIn(chips);
    table.addPlayer(player);
    players.push(player);
    initialChips.push(chips);
  }

  const totalInitialChips = initialChips.reduce((sum, c) => sum + c, 0);
  console.log(`\n=== ${numPlayers}-PLAYER TEST ===`);
  console.log(`Initial chips: ${totalInitialChips}`);

  const chipHistory = [];
  let lastChipCount = totalInitialChips;

  // Track chip conservation
  table.on('hand:ended', ({ winners }) => {
    const currentChips = Array.from(table.players.values())
      .reduce((sum, pd) => sum + pd.player.chips, 0);
    
    const diff = currentChips - lastChipCount;
    chipHistory.push({
      hand: chipHistory.length + 1,
      chips: currentChips,
      diff: diff,
      winners: winners.map(w => ({ id: w.playerId, amount: w.amount }))
    });

    if (diff !== 0) {
      console.log(`🚨 Hand ${chipHistory.length}: ${currentChips}/${totalInitialChips} (${diff > 0 ? '+' : ''}${diff})`);
    }
    
    lastChipCount = currentChips;
  });

  // Play hands
  for (let hand = 0; hand < numHands; hand++) {
    // Check if we have enough players
    const activePlayers = Array.from(table.players.values())
      .filter(pd => pd.player.chips > 0);
    
    if (activePlayers.length < 2) {
      console.log(`Game over after ${hand} hands - not enough players`);
      break;
    }

    table.tryStartGame();
    
    // Wait for hand to complete
    await new Promise(resolve => {
      const handler = () => {
        table.off('hand:ended', handler);
        setTimeout(resolve, 100); // Give time for cleanup
      };
      table.on('hand:ended', handler);
    });
  }

  // Final report
  const finalChips = Array.from(table.players.values())
    .reduce((sum, pd) => sum + pd.player.chips, 0);
  
  const chipLoss = totalInitialChips - finalChips;
  const lossPercent = (chipLoss / totalInitialChips * 100).toFixed(1);
  
  console.log(`\nFINAL RESULTS:`);
  console.log(`Initial: ${totalInitialChips}`);
  console.log(`Final: ${finalChips}`);
  console.log(`Loss: ${chipLoss} (${lossPercent}%)`);
  
  if (chipLoss > 0) {
    console.log(`\n❌ CHIP CONSERVATION VIOLATED!`);
    console.log(`Missing ${chipLoss} chips (${lossPercent}% loss)`);
  } else {
    console.log(`\n✅ Perfect chip conservation!`);
  }

  return { 
    loss: chipLoss, 
    percent: parseFloat(lossPercent),
    history: chipHistory 
  };
}

// Run the tests they claim fail
async function runTests() {
  console.log('Testing v3.0.2 chip conservation...\n');

  // 4-player test (they claim 15% loss)
  const result4 = await testChipConservation(4, 10);

  // 9-player test (they claim 0.4% loss)  
  const result9 = await testChipConservation(9, 10);

  console.log('\n=== SUMMARY ===');
  console.log(`4-player: ${result4.percent}% loss`);
  console.log(`9-player: ${result9.percent}% loss`);

  if (result4.percent > 0 || result9.percent > 0) {
    console.log('\n🔥 THE BUG REPORT IS CORRECT - WE HAVE CHIP LEAKS!');
    process.exit(1);
  } else {
    console.log('\n✅ No chip conservation issues found');
    process.exit(0);
  }
}

runTests().catch(console.error);