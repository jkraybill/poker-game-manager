import { PokerGameManager, Player, Action } from './packages/core/src/index.js';

// Test gradual chip loss over multiple hands
class GradualPlayer extends Player {
  constructor(config) {
    super(config);
    this.handsPlayed = 0;
  }

  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = Math.max(0, gameState.currentBet - myState.bet);
    this.handsPlayed++;
    
    // Play more aggressively over time
    const aggression = Math.min(0.8, 0.2 + (this.handsPlayed * 0.05));
    const random = Math.random();
    
    // Early hands - play normal
    if (this.handsPlayed <= 3) {
      if (toCall === 0) {
        return {
          action: Action.CHECK,
          playerId: this.id,
          timestamp: Date.now()
        };
      } else if (toCall < myState.chips * 0.1) {
        // Small bet, call
        return {
          action: Action.CALL,
          playerId: this.id,
          timestamp: Date.now()
        };
      } else {
        // Big bet, fold
        return {
          action: Action.FOLD,
          playerId: this.id,
          timestamp: Date.now()
        };
      }
    }
    
    // Later hands - more aggressive
    if (toCall === 0) {
      if (random < 0.3 && gameState.currentBet === 0) {
        // Sometimes bet
        const betSize = Math.floor(gameState.pot * 0.75);
        return {
          action: Action.BET,
          amount: Math.min(betSize, myState.chips),
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
    if (toCall >= myState.chips) {
      // All-in decision
      if (random < aggression) {
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
    
    // Can afford the call
    if (random < 0.2) {
      return {
        action: Action.FOLD,
        playerId: this.id,
        timestamp: Date.now()
      };
    } else if (random < 0.7) {
      return {
        action: Action.CALL,
        playerId: this.id,
        timestamp: Date.now()
      };
    } else if (myState.chips > toCall * 3) {
      // Raise
      const raiseAmount = Math.min(toCall * 2 + gameState.currentBet, myState.chips);
      return {
        action: Action.RAISE,
        amount: raiseAmount,
        playerId: this.id,
        timestamp: Date.now()
      };
    } else {
      return {
        action: Action.CALL,
        playerId: this.id,
        timestamp: Date.now()
      };
    }
  }
}

async function testGradualChipLoss() {
  console.log('🔬 TESTING GRADUAL CHIP LOSS OVER MULTIPLE HANDS');
  console.log('=' .repeat(60));
  console.log('Simulating realistic gameplay to find chip leaks');
  console.log('=' .repeat(60));
  console.log();
  
  const manager = new PokerGameManager();
  const table = manager.createTable({
    id: 'gradual-test',
    blinds: { small: 100, big: 200 },
    minPlayers: 4,
    maxPlayers: 9,
    dealerButton: 0
  });

  // Start with 4 players
  const initialStacks = [10000, 10000, 10000, 10000];
  const players = [];
  
  for (let i = 0; i < 4; i++) {
    const player = new GradualPlayer({
      id: `player${i}`,
      name: `Player ${i}`
    });
    player.buyIn(initialStacks[i]);
    table.addPlayer(player);
    players.push(player);
  }
  
  let TOTAL_CHIPS = 40000;
  console.log(`Starting with 4 players, $${TOTAL_CHIPS} total\n`);
  
  // Detailed tracking
  let handsPlayed = 0;
  let lastChipCount = TOTAL_CHIPS;
  const lossHistory = [];
  let consecutiveLosses = 0;
  
  // Check chips and detect patterns
  const analyzeChips = (event) => {
    const currentChips = Array.from(table.players.values())
      .reduce((sum, pd) => sum + pd.player.chips, 0);
    
    const loss = TOTAL_CHIPS - currentChips;
    
    if (loss > 0) {
      consecutiveLosses++;
      lossHistory.push({
        hand: handsPlayed,
        event: event,
        loss: loss,
        total: currentChips
      });
      
      console.log(`[Hand ${handsPlayed}] ${event}: ${currentChips}/${TOTAL_CHIPS} (-${loss} chips, ${(loss/TOTAL_CHIPS*100).toFixed(1)}%)`);
      
      // Pattern detection
      if (lastChipCount > currentChips) {
        console.log(`  📉 Chips decreased: ${lastChipCount} → ${currentChips}`);
      }
    } else if (loss < 0) {
      console.log(`[Hand ${handsPlayed}] ${event}: CHIPS CREATED! ${currentChips}/${TOTAL_CHIPS} (+${-loss} chips)`);
    } else {
      consecutiveLosses = 0;
    }
    
    lastChipCount = currentChips;
    return currentChips;
  };
  
  table.on('hand:ended', ({ winners }) => {
    handsPlayed++;
    const chips = analyzeChips('hand:ended');
    
    // Log winners for debugging
    if (chips !== TOTAL_CHIPS) {
      console.log(`  Winners: ${winners.map(w => `${w.playerId}:$${w.amount}`).join(', ')}`);
    }
  });
  
  table.on('player:eliminated', ({ playerId }) => {
    console.log(`  ⚰️ ${playerId} eliminated`);
    analyzeChips('elimination');
    
    // Add a new player to keep the game going
    if (players.length < 9) {
      const newPlayer = new GradualPlayer({
        id: `player${players.length}`,
        name: `Player ${players.length}`
      });
      newPlayer.buyIn(10000);
      TOTAL_CHIPS += 10000;
      console.log(`  ➕ New player joins with $10,000 (Total now: $${TOTAL_CHIPS})`);
      
      // Add after a delay to avoid race conditions
      setTimeout(() => {
        table.addPlayer(newPlayer);
        players.push(newPlayer);
      }, 100);
    }
  });

  // Play many hands to accumulate losses
  console.log('Playing up to 50 hands to detect chip leaks...\n');
  
  for (let hand = 0; hand < 50; hand++) {
    const activePlayers = Array.from(table.players.values())
      .filter(pd => pd.player.chips > 0);
    
    if (activePlayers.length < 2) {
      console.log(`\nStopping - not enough active players`);
      break;
    }
    
    const started = table.tryStartGame();
    if (!started) {
      // Wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 200));
      continue;
    }
    
    // Wait for hand completion
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        table.off('hand:ended', handler);
        console.log(`Hand ${hand + 1} timed out`);
        resolve();
      }, 5000);
      
      const handler = () => {
        clearTimeout(timeout);
        table.off('hand:ended', handler);
        setTimeout(resolve, 150); // Let events settle
      };
      
      table.once('hand:ended', handler);
    });
    
    // Check for significant loss
    const currentChips = Array.from(table.players.values())
      .reduce((sum, pd) => sum + pd.player.chips, 0);
    const currentLoss = TOTAL_CHIPS - currentChips;
    const lossPercent = (currentLoss / TOTAL_CHIPS * 100);
    
    if (lossPercent >= 5 && hand % 10 === 0) {
      console.log(`\n⚠️ Significant loss detected: ${lossPercent.toFixed(1)}% after ${handsPlayed} hands`);
    }
    
    if (lossPercent >= 15) {
      console.log(`\n🎯 CUSTOMER'S 15% LOSS REPRODUCED!`);
      break;
    }
  }
  
  // Final report
  console.log('\n' + '=' .repeat(60));
  console.log('CHIP LOSS ANALYSIS REPORT');
  console.log('=' .repeat(60));
  
  const finalChips = Array.from(table.players.values())
    .reduce((sum, pd) => sum + pd.player.chips, 0);
  
  const totalLoss = TOTAL_CHIPS - finalChips;
  const lossPercent = (totalLoss / TOTAL_CHIPS * 100).toFixed(2);
  
  console.log(`Hands played: ${handsPlayed}`);
  console.log(`Initial chips: $40,000`);
  console.log(`Final total expected: $${TOTAL_CHIPS}`);
  console.log(`Final total actual: $${finalChips}`);
  console.log(`Chips lost: $${totalLoss} (${lossPercent}%)`);
  
  if (lossHistory.length > 0) {
    console.log(`\nLoss events: ${lossHistory.length}`);
    console.log('Pattern of losses:');
    lossHistory.slice(-5).forEach(loss => {
      console.log(`  Hand ${loss.hand}: -${loss.loss} chips (${(loss.loss/TOTAL_CHIPS*100).toFixed(1)}%)`);
    });
  }
  
  if (totalLoss > 0) {
    console.log('\n❌ CHIP CONSERVATION FAILURE DETECTED');
    
    if (parseFloat(lossPercent) >= 15) {
      console.log('🔥 CUSTOMER BUG CONFIRMED: 15%+ chip loss!');
    } else if (parseFloat(lossPercent) >= 5) {
      console.log('⚠️ SIGNIFICANT CHIP LEAK: ' + lossPercent + '%');
    } else {
      console.log('Minor chip leak: ' + lossPercent + '%');
    }
    
    return false;
  } else {
    console.log('\n✅ No chip loss detected');
    return true;
  }
}

testGradualChipLoss().then(success => {
  if (!success) {
    console.log('\n💔 Chip conservation is broken. The customers deserve better.');
  }
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});