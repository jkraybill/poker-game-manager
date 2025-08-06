/**
 * Specific test for the side pot bug reported by pokersim team
 * Testing scenario where player goes all-in mid-hand with existing pot
 */

import { Table, Player } from './packages/core/src/index.js';
import { Action } from './packages/core/src/types/index.js';

class TestPlayer extends Player {
  constructor(config) {
    super(config);
    this.actions = config.actions || [];
    this.actionIndex = 0;
  }
  
  async getAction(gameState) {
    if (this.actionIndex < this.actions.length) {
      const action = this.actions[this.actionIndex++];
      console.log(`${this.name} action: ${action.action} ${action.amount || ''}`);
      return { ...action, timestamp: Date.now() };
    }
    
    // Default to check/fold
    if (gameState.validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK, timestamp: Date.now() };
    }
    return { action: Action.FOLD, timestamp: Date.now() };
  }
}

async function testScenario() {
  console.log('=== Testing Specific Side Pot Scenario ===\n');
  
  // Create table
  const table = new Table({
    id: 'test',
    maxPlayers: 3,
    minPlayers: 2,
    blinds: { small: 10000, big: 20000 }
  });
  
  // Player A: Will go all-in with smaller stack
  const playerA = new TestPlayer({
    id: 'player-a',
    name: 'Player A (Small)',
    actions: [
      { action: Action.RAISE, amount: 30000 }, // Raise to 40k total (20k BB + 20k raise)
      { action: Action.ALL_IN }, // Go all-in on flop
    ]
  });
  playerA.buyIn(56440); // Similar to bug report
  
  // Player B: Large stack that calls
  const playerB = new TestPlayer({
    id: 'player-b',
    name: 'Player B (Large)',
    actions: [
      { action: Action.CALL, amount: 20000 }, // Call the raise pre-flop
      { action: Action.CALL, amount: 16440 }, // Call the all-in
    ]
  });
  playerB.buyIn(150000);
  
  await table.addPlayer(playerA);
  await table.addPlayer(playerB);
  
  console.log('Initial stacks:');
  console.log(`- ${playerA.name}: ${playerA.chips}`);
  console.log(`- ${playerB.name}: ${playerB.chips}\n`);
  
  let handResult = null;
  
  // Track the hand
  table.on('hand:ended', (data) => {
    handResult = data;
    
    console.log('\n=== HAND RESULTS ===');
    console.log('Winners:', JSON.stringify(data.winners, null, 2));
    console.log('Side Pots:', JSON.stringify(data.sidePots, null, 2));
    
    // Check for bug
    const playerAWinner = data.winners.find(w => w.playerId === 'player-a');
    if (playerAWinner) {
      // Player A had 56,440 chips, so max eligible is 56,440 × 2 = 112,880
      const maxEligible = 56440 * 2;
      
      console.log('\n=== BUG CHECK ===');
      console.log(`Player A all-in amount: 56,440`);
      console.log(`Maximum eligible to win: ${maxEligible}`);
      console.log(`Actually won: ${playerAWinner.amount}`);
      
      if (playerAWinner.amount > maxEligible) {
        console.log(`\n❌ BUG CONFIRMED: Won ${playerAWinner.amount - maxEligible} more than eligible!`);
      } else {
        console.log('\n✅ Correct: Winnings within eligible amount');
      }
    }
    
    console.log('\nFinal stacks:');
    console.log(`- ${playerA.name}: ${playerA.chips}`);
    console.log(`- ${playerB.name}: ${playerB.chips}`);
  });
  
  // Track betting
  table.on('player:action', (data) => {
    const player = [playerA, playerB].find(p => p.id === data.playerId);
    if (data.action !== Action.CHECK) {
      console.log(`Action: ${player?.name} ${data.action} ${data.amount || ''}`);
    }
  });
  
  // Start game
  console.log('Starting game...\n');
  table.tryStartGame();
  
  // Wait for completion
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (!handResult) {
    console.log('Hand did not complete!');
  }
}

testScenario().catch(console.error);