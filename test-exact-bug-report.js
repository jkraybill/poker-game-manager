import { PokerGameManager, Player, Action } from './packages/core/src/index.js';

// Test the EXACT scenario from the bug report
class ConservativePlayer extends Player {
  constructor(config) {
    super(config);
    this.handCount = 0;
  }

  getAction(gameState) {
    const myState = gameState.players[this.id];
    this.handCount++;
    
    // Calculate what we need to call
    const toCall = Math.max(0, gameState.currentBet - myState.bet);
    
    // Sometimes go all-in for complex side pots
    if (Math.random() > 0.7 && myState.chips > 0) {
      return {
        action: Action.ALL_IN,
        amount: myState.chips,
        playerId: this.id,
        timestamp: Date.now()
      };
    }

    // If facing a bet
    if (toCall > 0) {
      // Can we afford to call?
      if (toCall <= myState.chips) {
        // Sometimes call, sometimes fold
        if (Math.random() > 0.3) {
          return {
            action: Action.CALL,
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
      } else if (myState.chips > 0) {
        // Can't cover, go all-in
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
    
    // No bet to call - we can check
    return {
      action: Action.CHECK,
      playerId: this.id,
      timestamp: Date.now()
    };
  }
}

async function testForChipLeak() {
  console.log('🔍 TESTING FOR THE EXACT BUG REPORT SCENARIO...\n');
  
  const manager = new PokerGameManager();
  const table = manager.createTable({
    id: 'bug-test',
    blinds: { small: 100, big: 200 },
    minPlayers: 4,
    maxPlayers: 9,
    dealerButton: 0
  });

  // Create 4 players with different stacks (like the report)
  const stacks = [10000, 8000, 12000, 10000]; // 40,000 total
  const players = [];
  
  for (let i = 0; i < 4; i++) {
    const player = new ConservativePlayer({
      id: `p${i}`,
      name: `Player ${i}`
    });
    player.buyIn(stacks[i]);
    table.addPlayer(player);
    players.push(player);
  }

  const TOTAL_EXPECTED = 40000;
  console.log(`Initial chips: ${TOTAL_EXPECTED}`);
  
  let handNumber = 0;
  const chipSnapshots = [];
  
  // Track chips at EVERY event
  let lastSnapshot = TOTAL_EXPECTED;
  
  const checkChips = (event) => {
    const currentChips = Array.from(table.players.values())
      .reduce((sum, pd) => sum + pd.player.chips, 0);
    
    if (currentChips !== lastSnapshot) {
      const diff = currentChips - TOTAL_EXPECTED;
      console.log(`[${event}] Hand ${handNumber}: ${currentChips} chips (${diff > 0 ? '+' : ''}${diff})`);
      
      if (Math.abs(diff) > 0) {
        console.log(`🚨 CHIP DISCREPANCY: ${Math.abs(diff)} chips ${diff > 0 ? 'CREATED' : 'LOST'}`);
      }
      
      chipSnapshots.push({
        hand: handNumber,
        event: event,
        chips: currentChips,
        diff: diff
      });
      
      lastSnapshot = currentChips;
    }
  };
  
  // Monitor ALL events
  table.on('hand:ended', ({ winners }) => {
    handNumber++;
    checkChips(`HAND_${handNumber}_ENDED`);
  });
  
  table.on('player:eliminated', ({ playerId }) => {
    checkChips(`PLAYER_${playerId}_ELIMINATED`);
  });
  
  table.on('game:started', () => {
    checkChips('GAME_STARTED');
  });

  // Play multiple hands
  console.log('\nPlaying hands to reproduce the bug...\n');
  
  for (let h = 0; h < 10; h++) {
    const activePlayers = Array.from(table.players.values())
      .filter(pd => pd.player.chips > 0);
    
    if (activePlayers.length < 2) {
      console.log(`Game over after ${h} hands`);
      break;
    }
    
    // Check before starting
    checkChips('BEFORE_START');
    
    const started = table.tryStartGame();
    if (!started) {
      console.log(`Could not start hand ${h + 1}`);
      break;
    }
    
    // Wait for hand completion
    await new Promise(resolve => {
      const handler = () => {
        table.off('hand:ended', handler);
        // Wait longer to catch any delayed chip updates
        setTimeout(resolve, 500);
      };
      table.on('hand:ended', handler);
      
      // Timeout in case hand never ends
      setTimeout(() => {
        table.off('hand:ended', handler);
        resolve();
      }, 5000);
    });
    
    // Check after hand
    checkChips('AFTER_HAND');
  }
  
  // Final analysis
  console.log('\n=== CHIP LEAK ANALYSIS ===');
  
  const finalChips = Array.from(table.players.values())
    .reduce((sum, pd) => sum + pd.player.chips, 0);
  
  const totalLoss = TOTAL_EXPECTED - finalChips;
  const lossPercent = (totalLoss / TOTAL_EXPECTED * 100).toFixed(1);
  
  console.log(`Expected: ${TOTAL_EXPECTED}`);
  console.log(`Final: ${finalChips}`);
  console.log(`Loss: ${totalLoss} (${lossPercent}%)`);
  
  // Show the pattern they described
  if (chipSnapshots.length > 0) {
    console.log('\n=== SNAPSHOT HISTORY ===');
    chipSnapshots.forEach(snap => {
      if (snap.diff !== 0) {
        console.log(`${snap.event}: ${snap.chips} (${snap.diff > 0 ? '+' : ''}${snap.diff})`);
      }
    });
  }
  
  if (totalLoss > 0) {
    console.log('\n🔥 BUG CONFIRMED: Chips are leaking!');
    console.log('The bug report is CORRECT - we have a chip conservation problem!');
    return false;
  } else {
    console.log('\n✅ No chip leaks detected in this test');
    return true;
  }
}

testForChipLeak().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});