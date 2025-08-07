import { PokerGameManager, Player, Action } from './packages/core/src/index.js';

// FORENSIC ANALYSIS: Where do chips disappear?
class ForensicPlayer extends Player {
  constructor(config) {
    super(config);
    this.handNum = 0;
  }

  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = Math.max(0, gameState.currentBet - myState.bet);
    this.handNum++;
    
    // Hand 1: Just check/call to complete normally
    if (this.handNum === 1) {
      if (toCall === 0) {
        return { action: Action.CHECK, playerId: this.id, timestamp: Date.now() };
      } else if (toCall < myState.chips) {
        return { action: Action.CALL, playerId: this.id, timestamp: Date.now() };
      } else {
        return { action: Action.FOLD, playerId: this.id, timestamp: Date.now() };
      }
    }
    
    // Hand 2: Same simple strategy
    if (toCall === 0) {
      return { action: Action.CHECK, playerId: this.id, timestamp: Date.now() };
    } else if (toCall < myState.chips * 0.1) {
      return { action: Action.CALL, playerId: this.id, timestamp: Date.now() };
    } else {
      return { action: Action.FOLD, playerId: this.id, timestamp: Date.now() };
    }
  }
}

async function forensicAnalysis() {
  console.log('🔬 FORENSIC CHIP TRACKING ANALYSIS');
  console.log('=' .repeat(70));
  console.log('Tracking every single chip movement to find where they disappear');
  console.log('=' .repeat(70));
  console.log();
  
  const manager = new PokerGameManager();
  const table = manager.createTable({
    id: 'forensic',
    blinds: { small: 100, big: 200 },
    minPlayers: 4,
    maxPlayers: 4,
    dealerButton: 0
  });

  // 4 players with 10k each
  const players = [];
  for (let i = 0; i < 4; i++) {
    const player = new ForensicPlayer({
      id: `p${i}`,
      name: `Player${i}`
    });
    
    // Hook chip setter to track changes
    const originalChips = 10000;
    player.buyIn(originalChips);
    
    let lastChips = originalChips;
    Object.defineProperty(player, '_chips', {
      value: originalChips,
      writable: true,
      enumerable: false
    });
    
    Object.defineProperty(player, 'chips', {
      get() { return this._chips; },
      set(value) {
        const diff = value - this._chips;
        if (diff !== 0) {
          console.log(`  💰 ${this.id} chips: ${this._chips} → ${value} (${diff > 0 ? '+' : ''}${diff})`);
        }
        this._chips = value;
      },
      enumerable: true,
      configurable: true
    });
    
    table.addPlayer(player);
    players.push(player);
  }
  
  const TOTAL_CHIPS = 40000;
  console.log(`Starting chips: $${TOTAL_CHIPS} (4 × $10,000)\n`);
  
  // Global chip tracker
  const getTableChips = () => {
    return Array.from(table.players.values())
      .reduce((sum, pd) => sum + pd.player.chips, 0);
  };
  
  // Detailed event tracking
  let handNumber = 0;
  let potSizeBeforeDistribution = 0;
  let winnersTotal = 0;
  
  table.on('game:started', ({ pot }) => {
    handNumber++;
    console.log(`\n${'='.repeat(70)}`);
    console.log(`HAND ${handNumber} STARTED`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Chips at start: ${getTableChips()}`);
    
    // Hook into GameEngine
    if (table.gameEngine) {
      const ge = table.gameEngine;
      
      // Track pot size
      const originalCalculatePayouts = ge.potManager.calculatePayouts.bind(ge.potManager);
      ge.potManager.calculatePayouts = function(rankedHands) {
        console.log('\n📊 POT DISTRIBUTION:');
        console.log(`  Pot total: $${this.getTotalPot()}`);
        console.log(`  Main pot: $${this.mainPot}`);
        console.log(`  Side pots: ${this.sidePots.length}`);
        
        potSizeBeforeDistribution = this.getTotalPot();
        
        const payouts = originalCalculatePayouts(rankedHands);
        
        console.log('  Payouts:');
        payouts.forEach(p => {
          console.log(`    ${p.playerId}: $${p.amount}`);
        });
        
        winnersTotal = payouts.reduce((sum, p) => sum + p.amount, 0);
        console.log(`  Total distributed: $${winnersTotal}`);
        
        if (winnersTotal !== potSizeBeforeDistribution) {
          console.log(`  ⚠️ MISMATCH: Pot was $${potSizeBeforeDistribution}, distributed $${winnersTotal}`);
        }
        
        return payouts;
      };
      
      // Track blind posting
      const originalPostBlinds = ge.postBlinds.bind(ge);
      ge.postBlinds = function() {
        console.log('\n💵 POSTING BLINDS:');
        const chipsBefore = getTableChips();
        console.log(`  Chips before blinds: ${chipsBefore}`);
        
        const result = originalPostBlinds();
        
        const chipsAfter = getTableChips();
        console.log(`  Chips after blinds: ${chipsAfter}`);
        console.log(`  Pot after blinds: $${this.potManager.getTotalPot()}`);
        
        if (chipsBefore !== chipsAfter + this.potManager.getTotalPot()) {
          const discrepancy = chipsBefore - (chipsAfter + this.potManager.getTotalPot());
          console.log(`  🚨 BLIND POSTING DISCREPANCY: ${discrepancy} chips!`);
        }
        
        return result;
      };
    }
  });
  
  table.on('hand:ended', ({ winners }) => {
    console.log('\n🏁 HAND ENDED:');
    const currentChips = getTableChips();
    console.log(`  Table chips: ${currentChips}`);
    console.log(`  Winners: ${winners.map(w => `${w.playerId}:$${w.amount}`).join(', ')}`);
    
    const winnersReported = winners.reduce((sum, w) => sum + w.amount, 0);
    console.log(`  Total in winners array: $${winnersReported}`);
    
    if (winnersReported !== winnersTotal) {
      console.log(`  ⚠️ EVENT MISMATCH: Calculated ${winnersTotal}, reported ${winnersReported}`);
    }
    
    if (currentChips !== TOTAL_CHIPS) {
      const loss = TOTAL_CHIPS - currentChips;
      console.log(`  🚨 CHIP LOSS: ${loss} chips missing! (${(loss/TOTAL_CHIPS*100).toFixed(1)}%)`);
    }
  });
  
  table.on('player:eliminated', ({ playerId }) => {
    console.log(`\n⚰️ ELIMINATION: ${playerId}`);
    console.log(`  Chips after elimination: ${getTableChips()}`);
  });
  
  // HAND 1
  console.log('\n🎮 Starting Hand 1...');
  table.tryStartGame();
  
  await new Promise(resolve => {
    table.once('hand:ended', () => {
      setTimeout(resolve, 500);
    });
  });
  
  let chipsAfterHand1 = getTableChips();
  console.log(`\n✅ Hand 1 complete. Chips: ${chipsAfterHand1}/${TOTAL_CHIPS}`);
  
  if (chipsAfterHand1 !== TOTAL_CHIPS) {
    console.log('🚨 CHIPS ALREADY MISSING AFTER HAND 1!');
  }
  
  // HAND 2
  console.log('\n🎮 Starting Hand 2...');
  const started = table.tryStartGame();
  
  if (!started) {
    console.log('Could not start hand 2');
  } else {
    await new Promise(resolve => {
      table.once('hand:ended', () => {
        setTimeout(resolve, 500);
      });
    });
    
    let chipsAfterHand2 = getTableChips();
    console.log(`\n✅ Hand 2 complete. Chips: ${chipsAfterHand2}/${TOTAL_CHIPS}`);
    
    if (chipsAfterHand2 !== TOTAL_CHIPS) {
      const loss = TOTAL_CHIPS - chipsAfterHand2;
      console.log(`\n${'='.repeat(70)}`);
      console.log('🔥 BUG CONFIRMED!');
      console.log(`${'='.repeat(70)}`);
      console.log(`${loss} chips lost (${(loss/TOTAL_CHIPS*100).toFixed(1)}%)`);
      console.log(`This matches the customer's report!`);
    }
  }
  
  // Final summary
  const finalChips = getTableChips();
  const totalLoss = TOTAL_CHIPS - finalChips;
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('FORENSIC SUMMARY');
  console.log(`${'='.repeat(70)}`);
  console.log(`Initial chips: $${TOTAL_CHIPS}`);
  console.log(`Final chips: $${finalChips}`);
  console.log(`Total lost: $${totalLoss} (${(totalLoss/TOTAL_CHIPS*100).toFixed(1)}%)`);
  
  if (totalLoss > 0) {
    console.log('\n❌ CHIP CONSERVATION FAILURE');
    console.log('The bug is real and we found it!');
    return false;
  } else {
    console.log('\n✅ No chip loss detected');
    return true;
  }
}

forensicAnalysis().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});