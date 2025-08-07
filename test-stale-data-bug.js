import { PokerGameManager, Player, Action } from './packages/core/src/index.js';

// Test if the delayed hand:ended event has stale chip data
class TestPlayer extends Player {
  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = Math.max(0, gameState.currentBet - myState.bet);
    
    // Always go all-in to create eliminations
    if (myState.chips > 0) {
      return {
        action: Action.ALL_IN,
        amount: myState.chips,
        playerId: this.id,
        timestamp: Date.now()
      };
    }
    
    if (toCall > 0) {
      return {
        action: Action.FOLD,
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

async function testStaleDataBug() {
  console.log('🔍 TESTING FOR STALE DATA IN DELAYED EVENTS...\n');
  
  const manager = new PokerGameManager();
  const table = manager.createTable({
    id: 'stale-test',
    blinds: { small: 50, big: 100 },
    minPlayers: 3,
    maxPlayers: 3,
    dealerButton: 0
  });

  // Create 3 players with different stacks
  const players = [
    { id: 'p1', chips: 1000 },
    { id: 'p2', chips: 500 },
    { id: 'p3', chips: 2000 }
  ];
  
  const TOTAL_CHIPS = 3500;
  
  for (const config of players) {
    const player = new TestPlayer({ id: config.id, name: config.id });
    player.buyIn(config.chips);
    table.addPlayer(player);
  }

  console.log(`Initial chips: ${TOTAL_CHIPS}`);
  console.log('Player stacks:', players.map(p => `${p.id}: $${p.chips}`));
  
  let handEndedChips = 0;
  let actualChipsAfterEvent = 0;
  let potSize = 0;
  
  // Track pot size during game
  table.on('game:started', ({ pot }) => {
    console.log(`\n🎮 Game started, initial pot: $${pot}`);
  });
  
  // Track chip counts at different moments
  table.on('hand:ended', ({ winners, pot: reportedPot }) => {
    // What does hand:ended report?
    handEndedChips = winners.reduce((sum, w) => sum + w.amount, 0);
    potSize = reportedPot || 0;
    
    // What are the actual chip counts right now?
    actualChipsAfterEvent = Array.from(table.players.values())
      .reduce((sum, pd) => sum + pd.player.chips, 0);
    
    console.log('\n📡 hand:ended event fired:');
    console.log('  Winners reported:', winners.map(w => `${w.playerId}: $${w.amount}`));
    console.log('  Total in winners array:', handEndedChips);
    console.log('  Pot size reported:', potSize);
    console.log('  Actual table chips:', actualChipsAfterEvent);
    console.log('  Active players:', Array.from(table.players.values()).map(pd => `${pd.player.id}: $${pd.player.chips}`));
    
    if (handEndedChips !== actualChipsAfterEvent) {
      console.log('  🚨 MISMATCH! Event data is stale!');
    }
  });
  
  // Track eliminations
  table.on('player:eliminated', ({ playerId }) => {
    const currentChips = Array.from(table.players.values())
      .reduce((sum, pd) => sum + pd.player.chips, 0);
    console.log(`\n🗑️ Player ${playerId} eliminated`);
    console.log(`  Chips after elimination: ${currentChips}`);
  });

  // Start the game
  table.tryStartGame();
  
  // Wait for hand to complete
  await new Promise(resolve => {
    const handler = () => {
      table.off('hand:ended', handler);
      setTimeout(resolve, 1000); // Wait for all events
    };
    table.on('hand:ended', handler);
  });
  
  // Final check
  const finalChips = Array.from(table.players.values())
    .reduce((sum, pd) => sum + pd.player.chips, 0);
  
  console.log('\n=== FINAL ANALYSIS ===');
  console.log(`Initial chips: ${TOTAL_CHIPS}`);
  console.log(`Final chips: ${finalChips}`);
  console.log(`Winners array total: ${handEndedChips}`);
  console.log(`Actual when event fired: ${actualChipsAfterEvent}`);
  
  const chipLoss = TOTAL_CHIPS - finalChips;
  
  if (chipLoss > 0) {
    console.log(`\n🔥 CHIP LEAK DETECTED: ${chipLoss} chips lost!`);
    
    if (handEndedChips !== actualChipsAfterEvent) {
      console.log('🚨 ROOT CAUSE: Stale data in delayed hand:ended event!');
      console.log('The winners array was captured BEFORE chip redistribution!');
    }
    return false;
  } else if (handEndedChips !== actualChipsAfterEvent) {
    console.log('\n⚠️ No chip leak but event data is stale!');
    console.log('This could confuse external systems!');
    return false;
  } else {
    console.log('\n✅ No issues detected');
    return true;
  }
}

testStaleDataBug().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});