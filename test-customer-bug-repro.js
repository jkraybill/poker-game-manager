import { PokerGameManager, Player, Action } from './packages/core/src/index.js';

// Reproduce the EXACT bug from the customer report
// They claim 4-player games lose 15% of chips (40,000 → 34,002)

class RealisticPlayer extends Player {
  constructor(config) {
    super(config);
    this.aggressiveness = config.aggressiveness || 0.5;
  }

  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = Math.max(0, gameState.currentBet - myState.bet);
    const potOdds = toCall / (gameState.pot + toCall);
    
    // Mix of actions to create realistic scenarios
    const random = Math.random();
    
    // If we can check, sometimes do it
    if (toCall === 0) {
      // Only bet if no one has bet yet (currentBet === 0 means no bet)
      if (random < 0.4) {
        return {
          action: Action.CHECK,
          playerId: this.id,
          timestamp: Date.now()
        };
      } else if (random < 0.7 && myState.chips > gameState.bigBlind * 3 && gameState.currentBet === 0) {
        // Sometimes bet (only if no current bet)
        const betAmount = Math.floor(gameState.pot * 0.5);
        return {
          action: Action.BET,
          amount: Math.min(betAmount, myState.chips),
          playerId: this.id,
          timestamp: Date.now()
        };
      } else {
        return {
          action: Action.CHECK,
          playerId: this.id,
          timestamp: Date.now()
        };
      }
    }
    
    // Facing a bet
    if (toCall > 0) {
      // Can't afford it - must fold or all-in
      if (toCall >= myState.chips) {
        if (random < this.aggressiveness) {
          return {
            action: Action.ALL_IN,
            amount: myState.chips,
            playerId: this.id,
            timestamp: Date.now()
          };
        } else {
          return {
            action: Action.FOLD,
            playerId: this.id,
            timestamp: Date.now()
          };
        }
      }
      
      // Can afford it - decide based on pot odds and aggression
      if (random < 0.2) {
        // Sometimes fold
        return {
          action: Action.FOLD,
          playerId: this.id,
          timestamp: Date.now()
        };
      } else if (random < 0.6) {
        // Often call
        return {
          action: Action.CALL,
          playerId: this.id,
          timestamp: Date.now()
        };
      } else if (random < 0.8 && myState.chips > toCall * 3) {
        // Sometimes raise
        const raiseAmount = toCall * 2 + gameState.currentBet;
        return {
          action: Action.RAISE,
          amount: Math.min(raiseAmount, myState.chips),
          playerId: this.id,
          timestamp: Date.now()
        };
      } else {
        // Default to call
        return {
          action: Action.CALL,
          playerId: this.id,
          timestamp: Date.now()
        };
      }
    }
    
    // Shouldn't reach here
    return {
      action: Action.CHECK,
      playerId: this.id,
      timestamp: Date.now()
    };
  }
}

async function reproduceCustomerBug() {
  console.log('🔍 REPRODUCING CUSTOMER BUG REPORT');
  console.log('=' .repeat(60));
  console.log('Customer claims: 4-player game loses 15% of chips');
  console.log('Expected: 40,000 chips → 40,000 chips');
  console.log('Customer sees: 40,000 chips → 34,002 chips (15% loss!)');
  console.log('=' .repeat(60));
  console.log();
  
  const manager = new PokerGameManager();
  const table = manager.createTable({
    id: 'customer-bug',
    blinds: { small: 100, big: 200 },
    minPlayers: 4,
    maxPlayers: 4,
    dealerButton: 0
  });

  // Create 4 players with 10,000 chips each (40,000 total)
  const players = [];
  for (let i = 0; i < 4; i++) {
    const player = new RealisticPlayer({
      id: `player${i}`,
      name: `Player ${i}`,
      aggressiveness: 0.3 + (i * 0.2) // Different play styles
    });
    player.buyIn(10000);
    table.addPlayer(player);
    players.push(player);
  }
  
  const TOTAL_CHIPS = 40000;
  console.log(`Initial setup: 4 players × $10,000 = $${TOTAL_CHIPS} total\n`);
  
  // Track chip conservation at every hand
  const chipHistory = [];
  let lastChipCount = TOTAL_CHIPS;
  let handsPlayed = 0;
  let maxLoss = 0;
  let maxLossHand = 0;
  
  // Monitor all events
  table.on('hand:ended', ({ winners }) => {
    handsPlayed++;
    
    // Count chips immediately when hand:ended fires
    const currentChips = Array.from(table.players.values())
      .reduce((sum, pd) => sum + pd.player.chips, 0);
    
    const loss = TOTAL_CHIPS - currentChips;
    const lossPercent = (loss / TOTAL_CHIPS * 100).toFixed(1);
    
    chipHistory.push({
      hand: handsPlayed,
      chips: currentChips,
      loss: loss,
      lossPercent: lossPercent,
      winners: winners.map(w => ({ id: w.playerId, amount: w.amount }))
    });
    
    if (loss > maxLoss) {
      maxLoss = loss;
      maxLossHand = handsPlayed;
    }
    
    // Log significant losses
    if (loss > 0) {
      console.log(`[HAND ${handsPlayed}] Chips: ${currentChips}/${TOTAL_CHIPS} (${loss} lost, ${lossPercent}%)`);
      
      // The smoking gun - chips disappear and reappear?
      if (lastChipCount > currentChips && handsPlayed > 1) {
        console.log(`  🚨 CHIPS VANISHED: ${lastChipCount} → ${currentChips}`);
      } else if (lastChipCount < currentChips) {
        console.log(`  🎭 CHIPS REAPPEARED: ${lastChipCount} → ${currentChips}`);
      }
    }
    
    lastChipCount = currentChips;
  });
  
  table.on('player:eliminated', ({ playerId }) => {
    const remainingPlayers = Array.from(table.players.values())
      .filter(pd => pd.player.chips > 0).length;
    console.log(`  ⚰️ ${playerId} eliminated (${remainingPlayers} players remain)`);
  });

  // Play multiple hands to accumulate the loss
  console.log('Playing hands to reproduce 15% chip loss...\n');
  
  for (let hand = 0; hand < 30; hand++) {
    // Check if we have enough players
    const activePlayers = Array.from(table.players.values())
      .filter(pd => pd.player.chips > 0);
    
    if (activePlayers.length < 2) {
      console.log(`\nGame over after ${hand} hands - not enough players`);
      break;
    }
    
    // Start a hand
    const started = table.tryStartGame();
    if (!started) {
      console.log(`Could not start hand ${hand + 1}`);
      break;
    }
    
    // Wait for hand to complete
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        table.off('hand:ended', handler);
        reject(new Error('Hand timeout'));
      }, 10000);
      
      const handler = () => {
        clearTimeout(timeout);
        table.off('hand:ended', handler);
        // Small delay to let events settle
        setTimeout(resolve, 100);
      };
      
      table.once('hand:ended', handler);
    }).catch(err => {
      console.log(`Hand ${hand + 1} error:`, err.message);
    });
    
    // Check if we've hit the 15% loss threshold
    const currentChips = Array.from(table.players.values())
      .reduce((sum, pd) => sum + pd.player.chips, 0);
    const currentLoss = TOTAL_CHIPS - currentChips;
    const currentLossPercent = (currentLoss / TOTAL_CHIPS * 100);
    
    if (currentLossPercent >= 15) {
      console.log(`\n🎯 REPRODUCED! 15% chip loss achieved after ${handsPlayed} hands`);
      break;
    }
  }
  
  // Final analysis
  console.log('\n' + '=' .repeat(60));
  console.log('FINAL ANALYSIS');
  console.log('=' .repeat(60));
  
  const finalChips = Array.from(table.players.values())
    .reduce((sum, pd) => sum + pd.player.chips, 0);
  
  const totalLoss = TOTAL_CHIPS - finalChips;
  const lossPercent = (totalLoss / TOTAL_CHIPS * 100).toFixed(1);
  
  console.log(`Hands played: ${handsPlayed}`);
  console.log(`Initial chips: $${TOTAL_CHIPS}`);
  console.log(`Final chips: $${finalChips}`);
  console.log(`Total loss: $${totalLoss} (${lossPercent}%)`);
  console.log(`Worst hand: Hand ${maxLossHand} lost ${maxLoss} chips`);
  
  // Show the pattern the customer described
  if (chipHistory.length > 1) {
    console.log('\nChip loss pattern:');
    chipHistory.filter(h => h.loss > 0).forEach(h => {
      console.log(`  Hand ${h.hand}: ${h.chips}/${TOTAL_CHIPS} (-${h.loss}, ${h.lossPercent}%)`);
    });
  }
  
  if (lossPercent >= 15) {
    console.log('\n🔥 CUSTOMER BUG CONFIRMED!');
    console.log('The v3.0.2 library DOES lose 15% of chips in 4-player games!');
    console.log('\nThis is UNACCEPTABLE for a poker library.');
    return false;
  } else if (totalLoss > 0) {
    console.log(`\n⚠️ Chip loss detected (${lossPercent}%) but not 15% yet`);
    console.log('The bug exists but may need more hands to reach 15%');
    return false;
  } else {
    console.log('\n✅ No chip loss detected');
    console.log('Could not reproduce the customer\'s 15% loss claim');
    return true;
  }
}

reproduceCustomerBug().then(success => {
  if (!success) {
    console.log('\n💔 The customers were right. We failed them.');
  }
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});