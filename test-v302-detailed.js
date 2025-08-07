import { PokerGameManager, Player, Action } from './packages/core/src/index.js';

// Detailed test to show exactly where chips are lost
class TestPlayer extends Player {
  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = Math.max(0, gameState.currentBet - myState.bet);
    
    // Always go all-in
    if (myState.chips > 0) {
      return {
        action: Action.ALL_IN,
        amount: myState.chips,
        playerId: this.id,
        timestamp: Date.now()
      };
    }
    
    return toCall > 0 ? 
      { action: Action.FOLD, playerId: this.id, timestamp: Date.now() } :
      { action: Action.CHECK, playerId: this.id, timestamp: Date.now() };
  }
}

async function detailedChipTracking() {
  console.log('🔬 DETAILED CHIP TRACKING TEST\n');
  console.log('=' .repeat(60));
  
  const manager = new PokerGameManager();
  const table = manager.createTable({
    id: 'detailed-test',
    blinds: { small: 50, big: 100 },
    minPlayers: 3,
    maxPlayers: 3,
    dealerButton: 0
  });

  // Create players
  const configs = [
    { id: 'p1', chips: 1000 },  // Button/SB
    { id: 'p2', chips: 500 },   // BB  
    { id: 'p3', chips: 2000 }   // UTG
  ];
  
  const TOTAL = 3500;
  const players = [];
  
  for (const cfg of configs) {
    const p = new TestPlayer({ id: cfg.id, name: cfg.id });
    p.buyIn(cfg.chips);
    table.addPlayer(p);
    players.push(p);
  }

  // Helper to check chips
  const checkChips = (label) => {
    const chips = Array.from(table.players.values())
      .reduce((sum, pd) => sum + pd.player.chips, 0);
    const details = Array.from(table.players.values())
      .map(pd => `${pd.player.id}:$${pd.player.chips}`)
      .join(', ');
    console.log(`[${label}] Total: $${chips} (${details})`);
    if (chips !== TOTAL) {
      console.log(`  ⚠️ DISCREPANCY: ${TOTAL - chips} chips ${chips < TOTAL ? 'LOST' : 'CREATED'}!`);
    }
    return chips;
  };

  console.log('\nINITIAL STATE:');
  checkChips('Before game');
  
  // Hook into game events
  let gameEngineRef = null;
  let potInfo = null;
  
  table.on('game:started', ({ pot }) => {
    console.log(`\n🎮 GAME STARTED`);
    checkChips('After blinds posted');
    
    // Get reference to game engine
    if (table.gameEngine) {
      gameEngineRef = table.gameEngine;
      
      // Hook into pot distribution
      const originalDistribute = gameEngineRef.potManager.calculatePayouts.bind(gameEngineRef.potManager);
      gameEngineRef.potManager.calculatePayouts = function(rankedHands) {
        console.log('\n💰 POT DISTRIBUTION:');
        console.log('  Ranked hands:', rankedHands.map(h => `${h.player.id}: ${h.hand.descr}`));
        
        const result = originalDistribute(rankedHands);
        
        console.log('  Payouts:', result.map(p => `${p.playerId}: $${p.amount}`));
        const totalPayout = result.reduce((sum, p) => sum + p.amount, 0);
        console.log('  Total distributed: $' + totalPayout);
        
        potInfo = { payouts: result, total: totalPayout };
        return result;
      };
    }
  });
  
  table.on('hand:ended', ({ winners }) => {
    console.log('\n📡 HAND:ENDED EVENT:');
    console.log('  Winners:', winners.map(w => `${w.playerId}: $${w.amount}`));
    const eventTotal = winners.reduce((sum, w) => sum + w.amount, 0);
    console.log('  Event total: $' + eventTotal);
    checkChips('At hand:ended event');
    
    if (potInfo && potInfo.total !== eventTotal) {
      console.log('  🚨 EVENT DATA MISMATCH!');
      console.log(`     Pot distributed: $${potInfo.total}`);
      console.log(`     Event reports: $${eventTotal}`);
    }
  });
  
  table.on('player:eliminated', ({ playerId }) => {
    console.log(`\n🗑️ PLAYER ELIMINATED: ${playerId}`);
    checkChips('After elimination');
  });

  // Start game
  console.log('\n' + '='.repeat(60));
  console.log('STARTING GAME...\n');
  
  table.tryStartGame();
  
  // Wait for completion
  await new Promise(resolve => {
    table.once('hand:ended', () => {
      setTimeout(resolve, 1000);
    });
  });
  
  // Final analysis
  console.log('\n' + '='.repeat(60));
  console.log('FINAL ANALYSIS:\n');
  
  const finalChips = checkChips('Final state');
  const loss = TOTAL - finalChips;
  
  if (loss > 0) {
    console.log(`\n❌ CHIP CONSERVATION VIOLATED!`);
    console.log(`   ${loss} chips lost (${(loss/TOTAL*100).toFixed(1)}%)`);
    console.log(`\n🔥 THE BUG IS CONFIRMED!`);
    return false;
  } else {
    console.log(`\n✅ Chip conservation maintained`);
    return true;
  }
}

detailedChipTracking().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});