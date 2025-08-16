#!/usr/bin/env node

/**
 * Test customer's scenario with our fixed local version
 */

import { Table } from './packages/core/src/Table.js';
import { Player } from './packages/core/src/Player.js';
import { Action } from './packages/core/src/types/index.js';

// Simple test player that can be configured to fold or call
class TestPlayer extends Player {
  constructor(config) {
    super(config);
    this.chips = config.chips;
    this.shouldFold = config.shouldFold || false;
  }
  
  async getAction(gameState) {
    // Player 1 will fold to the big blind
    // Player 2 will win by default
    if (this.shouldFold && gameState.toCall > 0) {
      console.log(`[${this.name}] Folding to bet of ${gameState.toCall}`);
      return { action: Action.FOLD, amount: 0, timestamp: Date.now() };
    }
    
    // Otherwise check/call
    if (gameState.validActions.includes(Action.CHECK)) {
      console.log(`[${this.name}] Checking`);
      return { action: Action.CHECK, amount: 0, timestamp: Date.now() };
    }
    if (gameState.validActions.includes(Action.CALL)) {
      console.log(`[${this.name}] Calling ${gameState.toCall}`);
      return { action: Action.CALL, amount: gameState.toCall, timestamp: Date.now() };
    }
    
    // Fallback to fold
    return { action: Action.FOLD, amount: 0, timestamp: Date.now() };
  }
}

async function demonstrateFix() {
  console.log('=== TESTING POKER-GAME-MANAGER v4.4.9 BET CLEARING FIX ===');
  console.log('Testing with local fixed version\n');
  
  // Create a simple 2-player table
  const table = new Table({
    id: 'test-table',
    maxPlayers: 2,
    minPlayers: 2,
    blinds: { small: 100, big: 200 }
  });

  // Create two players
  const p1 = new TestPlayer({ 
    id: 1, 
    name: 'Player1_Folds', 
    chips: 10000, 
    shouldFold: true  // This player will fold
  });
  
  const p2 = new TestPlayer({ 
    id: 2, 
    name: 'Player2_Wins', 
    chips: 10000, 
    shouldFold: false  // This player will win
  });

  // Add players to table
  await table.addPlayer(p1, 0);
  await table.addPlayer(p2, 1);

  // Check initial state
  console.log('BEFORE HAND:');
  console.log(`  P1: chips=${p1.chips}, bet=${p1.bet}`);
  console.log(`  P2: chips=${p2.chips}, bet=${p2.bet}`);
  console.log(`  Expected total: ${p1.chips + p2.chips}\n`);

  // Start the game
  console.log('Starting hand (P1 will fold to P2\'s big blind)...\n');
  
  const handEndedPromise = new Promise(resolve => {
    table.once('hand:ended', resolve);
  });
  
  await table.tryStartGame();
  
  // Wait for hand to complete
  await handEndedPromise;

  // Check final state
  console.log('\nAFTER HAND:');
  console.log(`  P1: chips=${p1.chips}, bet=${p1.bet}`);
  console.log(`  P2: chips=${p2.chips}, bet=${p2.bet}`);
  
  // Calculate totals
  const totalChipsInStacks = p1.chips + p2.chips;
  const totalChipsInBets = p1.bet + p2.bet;
  const totalChipsOverall = totalChipsInStacks + totalChipsInBets;
  
  console.log(`\nCHIP ACCOUNTING:`);
  console.log(`  In stacks: ${totalChipsInStacks}`);
  console.log(`  In bets: ${totalChipsInBets} ${totalChipsInBets > 0 ? '❌ (should be 0!)' : '✅'}`);
  console.log(`  Total: ${totalChipsOverall} ${totalChipsOverall !== 20000 ? '❌ (should be 20000!)' : '✅'}`);
  
  // Check for the bug
  console.log('\n' + '='.repeat(50));
  console.log('RESULT:');
  console.log('='.repeat(50));
  
  if (p1.bet > 0 || p2.bet > 0) {
    console.log('❌ BUG STILL EXISTS: player.bet fields not cleared after fold!');
    console.log(`   P1.bet = ${p1.bet} (should be 0)`);
    console.log(`   P2.bet = ${p2.bet} (should be 0)`);
    return false;
  } else {
    console.log('✅ BUG FIXED! All bets properly cleared after fold');
    console.log('   P1.bet = 0 ✅');
    console.log('   P2.bet = 0 ✅');
    console.log('\nThe fix in v4.4.9 successfully resolves the bet clearing issue.');
    return true;
  }
}

// Run the test
demonstrateFix()
  .then(success => {
    console.log('\nTest ' + (success ? 'PASSED' : 'FAILED'));
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\nError running test:', error);
    process.exit(1);
  });