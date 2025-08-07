#!/usr/bin/env node

/**
 * Test for progressive chip loss using local code
 */

import { Table, Player, Action } from './packages/core/src/index.js';

// Minimal player that just folds/checks
class MinimalPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    
    // Fold to any bet
    if (toCall > 0) {
      return { action: Action.FOLD };
    }
    
    // Check if we can
    if (gameState.validActions?.includes(Action.CHECK)) {
      return { action: Action.CHECK };
    }
    
    // Otherwise fold
    return { action: Action.FOLD };
  }
}

async function runProgressiveTest() {
  console.log('='.repeat(70));
  console.log('PROGRESSIVE CHIP LOSS TEST - LOCAL CODE');
  console.log('='.repeat(70));
  console.log('\nThis test demonstrates chips are lost progressively over multiple hands.\n');
  
  const PLAYERS = 8;
  const STARTING_CHIPS = 50000;
  const TOTAL_EXPECTED = PLAYERS * STARTING_CHIPS;
  
  // Create single table
  const table = new Table({
    id: 'test-table',
    blinds: { small: 100, big: 200 }
  });
  
  // Add players
  const players = [];
  for (let i = 0; i < PLAYERS; i++) {
    const player = new MinimalPlayer({
      id: `player${i + 1}`,
      name: `Player ${i + 1}`
    });
    player.buyIn(STARTING_CHIPS);
    table.addPlayer(player);
    players.push(player);
  }
  
  console.log(`Setup: ${PLAYERS} players at 1 table`);
  console.log(`Starting chips per player: ${STARTING_CHIPS.toLocaleString()}`);
  console.log(`Total chips in play: ${TOTAL_EXPECTED.toLocaleString()}\n`);
  
  // Track chip loss over time
  const lossHistory = [];
  
  // Helper to count total chips
  function countChips() {
    return players.reduce((sum, p) => sum + p.chips, 0);
  }
  
  // Play 30 hands
  console.log('Playing 30 hands and tracking chip totals...\n');
  console.log('Hand | Total Chips  | Lost    | Lost %  | Loss/Hand');
  console.log('-----|--------------|---------|---------|----------');
  
  for (let hand = 1; hand <= 30; hand++) {
    // Start hand
    const started = table.tryStartGame();
    if (!started) {
      console.log(`Hand ${hand}: Failed to start`);
      continue;
    }
    
    // Wait for completion
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`Hand ${hand}: Timed out`);
        resolve();
      }, 2000);
      
      table.once('hand:ended', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    
    // Count chips after hand
    const currentTotal = countChips();
    const chipsLost = TOTAL_EXPECTED - currentTotal;
    const lostPct = (chipsLost / TOTAL_EXPECTED * 100).toFixed(3);
    const avgLossPerHand = Math.round(chipsLost / hand);
    
    lossHistory.push({
      hand,
      total: currentTotal,
      lost: chipsLost,
      lostPct: parseFloat(lostPct)
    });
    
    // Print every 5 hands or if significant loss
    if (hand % 5 === 0 || chipsLost > TOTAL_EXPECTED * 0.01) {
      const handStr = hand.toString().padEnd(4);
      const totalStr = currentTotal.toLocaleString().padEnd(12);
      const lostStr = chipsLost.toLocaleString().padEnd(7);
      const pctStr = lostPct.padStart(7);
      const avgStr = avgLossPerHand.toLocaleString().padStart(9);
      
      console.log(`${handStr} | ${totalStr} | ${lostStr} | ${pctStr}% | ${avgStr}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('ANALYSIS');
  console.log('='.repeat(70));
  
  // Calculate progression
  const firstLoss = lossHistory[0]?.lost || 0;
  const lastLoss = lossHistory[lossHistory.length - 1]?.lost || 0;
  const avgLossPerHand = lastLoss / lossHistory.length;
  
  console.log('\nChip Loss Progression:');
  console.log(`  First hand loss:  ${firstLoss.toLocaleString()} chips`);
  console.log(`  Final total loss: ${lastLoss.toLocaleString()} chips`);
  console.log(`  Average per hand: ${Math.round(avgLossPerHand).toLocaleString()} chips`);
  
  // Check if loss is progressive (gets worse over time)
  let isProgressive = true;
  for (let i = 1; i < lossHistory.length; i++) {
    if (lossHistory[i].lost < lossHistory[i - 1].lost) {
      isProgressive = false;
      break;
    }
  }
  
  console.log(`  Pattern: ${isProgressive ? 'PROGRESSIVE (gets worse over time)' : 'VARIABLE'}`);
  
  // Final verdict
  console.log('\n' + '='.repeat(70));
  if (lastLoss === 0) {
    console.log('✅ PASSED: Perfect chip conservation!');
  } else {
    console.log(`❌ FAILED: Lost ${lastLoss.toLocaleString()} chips (${(lastLoss/TOTAL_EXPECTED*100).toFixed(2)}%) over ${lossHistory.length} hands`);
    console.log('\nThis demonstrates a progressive chip loss bug where chips disappear');
    console.log('gradually during normal gameplay, violating poker\'s fundamental');
    console.log('chip conservation rule.');
  }
  console.log('='.repeat(70));
  
  // Show final player distribution
  console.log('\nFinal chip distribution:');
  players.forEach(p => {
    console.log(`  ${p.name}: ${p.chips.toLocaleString()} chips`);
  });
  
  const verify = players.reduce((sum, p) => sum + p.chips, 0);
  console.log(`  Total: ${verify.toLocaleString()} / Expected: ${TOTAL_EXPECTED.toLocaleString()}`);
}

// Run the test
runProgressiveTest().catch(console.error);