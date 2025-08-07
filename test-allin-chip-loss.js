import { PokerGameManager, Player, Action } from './packages/core/src/index.js';

// Test with all-in scenarios that seem to trigger the bug
class AllInPlayer extends Player {
  constructor(config) {
    super(config);
    this.allInRound = config.allInRound || 0; // Which round to go all-in
  }

  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = Math.max(0, gameState.currentBet - myState.bet);
    
    // Determine which betting round we're in
    let round = 0;
    if (gameState.communityCards.length === 0) round = 0; // Pre-flop
    else if (gameState.communityCards.length === 3) round = 1; // Flop
    else if (gameState.communityCards.length === 4) round = 2; // Turn
    else if (gameState.communityCards.length === 5) round = 3; // River
    
    // Go all-in on our designated round
    if (round === this.allInRound && myState.chips > 0) {
      return {
        action: Action.ALL_IN,
        amount: myState.chips,
        playerId: this.id,
        timestamp: Date.now()
      };
    }
    
    // Otherwise play conservatively
    if (toCall === 0) {
      return {
        action: Action.CHECK,
        playerId: this.id,
        timestamp: Date.now()
      };
    } else if (toCall < myState.chips) {
      // Call if we can afford it
      return {
        action: Action.CALL,
        playerId: this.id,
        timestamp: Date.now()
      };
    } else if (myState.chips > 0) {
      // Can't afford full call, go all-in
      return {
        action: Action.ALL_IN,
        amount: myState.chips,
        playerId: this.id,
        timestamp: Date.now()
      };
    } else {
      // No chips, must fold
      return {
        action: Action.FOLD,
        playerId: this.id,
        timestamp: Date.now()
      };
    }
  }
}

async function testAllInChipLoss() {
  console.log('🎰 TESTING ALL-IN CHIP CONSERVATION');
  console.log('=' .repeat(60));
  console.log('Testing multiple all-in scenarios with side pots');
  console.log('=' .repeat(60));
  console.log();
  
  const manager = new PokerGameManager();
  const table = manager.createTable({
    id: 'allin-test',
    blinds: { small: 100, big: 200 },
    minPlayers: 4,
    maxPlayers: 4,
    dealerButton: 0
  });

  // Create 4 players with different stacks to create side pots
  const stacks = [15000, 8000, 12000, 5000]; // Total: 40,000
  const players = [];
  
  for (let i = 0; i < 4; i++) {
    const player = new AllInPlayer({
      id: `p${i}`,
      name: `Player ${i}`,
      allInRound: i % 2 // Some go all-in preflop, some on flop
    });
    player.buyIn(stacks[i]);
    table.addPlayer(player);
    players.push(player);
    console.log(`Player ${i}: $${stacks[i]} (${i % 2 === 0 ? 'preflop' : 'flop'} all-in)`);
  }
  
  const TOTAL_CHIPS = 40000;
  console.log(`\nTotal chips in play: $${TOTAL_CHIPS}\n`);
  
  // Track every chip movement
  let handsPlayed = 0;
  const chipLog = [];
  
  const checkChips = (event) => {
    const chips = Array.from(table.players.values())
      .reduce((sum, pd) => sum + pd.player.chips, 0);
    const loss = TOTAL_CHIPS - chips;
    
    if (loss !== 0) {
      console.log(`[${event}] Chips: ${chips}/${TOTAL_CHIPS} (${loss > 0 ? 'LOST' : 'CREATED'}: ${Math.abs(loss)})`);
      chipLog.push({ event, chips, loss });
    }
    
    return chips;
  };
  
  // Monitor key events
  table.on('game:started', () => {
    console.log(`\n--- HAND ${handsPlayed + 1} STARTED ---`);
    checkChips('game:started');
  });
  
  table.on('hand:ended', ({ winners }) => {
    handsPlayed++;
    console.log('Winners:', winners.map(w => `${w.playerId}: $${w.amount}`));
    const chips = checkChips('hand:ended');
    
    if (chips !== TOTAL_CHIPS) {
      console.log(`🚨 CHIP CONSERVATION VIOLATION AT HAND ${handsPlayed}!`);
    }
  });
  
  table.on('player:eliminated', ({ playerId }) => {
    console.log(`💀 ${playerId} eliminated`);
    checkChips('player:eliminated');
  });

  // Play several hands
  console.log('Playing hands with all-in scenarios...\n');
  
  for (let hand = 0; hand < 10; hand++) {
    const activePlayers = Array.from(table.players.values())
      .filter(pd => pd.player.chips > 0);
    
    if (activePlayers.length < 2) {
      console.log(`\nGame over - only ${activePlayers.length} players left`);
      break;
    }
    
    // For variety, change all-in rounds every few hands
    if (hand === 3) {
      players.forEach((p, i) => {
        p.allInRound = (i + 1) % 4; // Change strategy
      });
      console.log('\n🔄 Changing all-in strategy...');
    }
    
    const started = table.tryStartGame();
    if (!started) {
      console.log(`Could not start hand ${hand + 1}`);
      continue;
    }
    
    // Wait for hand to complete
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        table.off('hand:ended', handler);
        resolve(); // Don't reject, just continue
      }, 5000);
      
      const handler = () => {
        clearTimeout(timeout);
        table.off('hand:ended', handler);
        setTimeout(resolve, 200); // Let events settle
      };
      
      table.once('hand:ended', handler);
    });
  }
  
  // Final analysis
  console.log('\n' + '=' .repeat(60));
  console.log('FINAL CHIP CONSERVATION ANALYSIS');
  console.log('=' .repeat(60));
  
  const finalChips = Array.from(table.players.values())
    .reduce((sum, pd) => sum + pd.player.chips, 0);
  
  const totalLoss = TOTAL_CHIPS - finalChips;
  const lossPercent = (totalLoss / TOTAL_CHIPS * 100).toFixed(1);
  
  console.log(`Hands played: ${handsPlayed}`);
  console.log(`Initial chips: $${TOTAL_CHIPS}`);
  console.log(`Final chips: $${finalChips}`);
  console.log(`Total loss: $${totalLoss} (${lossPercent}%)`);
  
  if (chipLog.length > 0) {
    console.log('\nChip discrepancies detected:');
    chipLog.forEach(entry => {
      console.log(`  ${entry.event}: ${entry.loss > 0 ? 'lost' : 'created'} ${Math.abs(entry.loss)} chips`);
    });
  }
  
  if (totalLoss > 0) {
    console.log('\n❌ CHIP CONSERVATION BUG CONFIRMED!');
    console.log(`${totalLoss} chips (${lossPercent}%) vanished into the void!`);
    
    // Check if this matches customer's claim
    if (lossPercent >= 15) {
      console.log('\n🔥 THIS MATCHES THE CUSTOMER\'S 15% LOSS REPORT!');
    }
    
    return false;
  } else {
    console.log('\n✅ Perfect chip conservation maintained');
    return true;
  }
}

testAllInChipLoss().then(success => {
  if (!success) {
    console.log('\n😱 The customers were right - we have a serious bug!');
  }
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});