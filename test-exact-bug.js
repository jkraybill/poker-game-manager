/**
 * Exact reproduction of the bug scenario from pokersim report
 * Pre-existing pot of ~135k, player goes all-in for 56k, should only win 56k*2
 */

import { Table, Player } from './packages/core/src/index.js';
import { Action } from './packages/core/src/types/index.js';

class BugTestPlayer extends Player {
  constructor(config) {
    super(config);
    this.actions = config.actions || [];
    this.actionIndex = 0;
  }
  
  async getAction(gameState) {
    if (this.actionIndex < this.actions.length) {
      const action = this.actions[this.actionIndex++];
      const myState = gameState.players[this.id];
      
      // If it's an all-in, use actual chip count
      if (action.action === Action.ALL_IN) {
        console.log(`[${gameState.phase}] ${this.name}: ALL_IN for ${myState.chips} chips`);
        return { action: Action.ALL_IN, timestamp: Date.now() };
      }
      
      console.log(`[${gameState.phase}] ${this.name}: ${action.action} ${action.amount || ''}`);
      return { ...action, timestamp: Date.now() };
    }
    
    // Default to check/fold
    if (gameState.validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK, timestamp: Date.now() };
    }
    return { action: Action.FOLD, timestamp: Date.now() };
  }
}

async function testExactBug() {
  console.log('=== Reproducing Exact Bug Scenario ===\n');
  console.log('Scenario: Large pot already exists, small stack goes all-in');
  console.log('Expected: All-in player can only win their stack × number of players\n');
  
  const table = new Table({
    id: 'bug-test',
    maxPlayers: 2,
    minPlayers: 2,
    blinds: { small: 10000, big: 20000 }
  });
  
  // Player A (Ange): 56,440 chips - will go all-in
  const playerA = new BugTestPlayer({
    id: 'ange',
    name: 'Ange (56k)',
    actions: [
      { action: Action.RAISE, amount: 40000 }, // Build pot pre-flop
      { action: Action.BET, amount: 36440 },    // Go all-in on flop (remaining chips)
    ]
  });
  playerA.buyIn(56440);
  
  // Player B (Damian): 150,000 chips - will call
  const playerB = new BugTestPlayer({
    id: 'damian',
    name: 'Damian (150k)',
    actions: [
      { action: Action.CALL, amount: 20000 },  // Call pre-flop raise
      { action: Action.CALL, amount: 36440 },  // Call the all-in
    ]
  });
  playerB.buyIn(150000);
  
  await table.addPlayer(playerA);
  await table.addPlayer(playerB);
  
  console.log('Initial stacks:');
  console.log(`- ${playerA.name}: ${playerA.chips}`);
  console.log(`- ${playerB.name}: ${playerB.chips}`);
  console.log(`Total chips in play: ${playerA.chips + playerB.chips}\n`);
  
  // Track pot growth
  let currentPot = 0;
  table.on('pot:updated', (data) => {
    currentPot = data.total;
    console.log(`Pot updated to: ${data.total}`);
  });
  
  // Track the result
  table.on('hand:ended', (data) => {
    console.log('\n=== HAND RESULTS ===');
    console.log(`Final pot size: ${currentPot}`);
    console.log('Winners:', JSON.stringify(data.winners, null, 2));
    console.log('\nSide Pots:', JSON.stringify(data.sidePots, null, 2));
    
    // Check for the bug
    const angeWinner = data.winners.find(w => w.playerId === 'ange');
    if (angeWinner) {
      const maxEligible = 56440 * 2; // Ange's stack × 2 players
      
      console.log('\n=== BUG CHECK ===');
      console.log(`Ange went all-in with: 56,440 chips`);
      console.log(`Maximum Ange can win: ${maxEligible} (56,440 × 2 players)`);
      console.log(`Ange actually won: ${angeWinner.amount}`);
      
      if (angeWinner.amount > maxEligible) {
        console.log(`\n❌ BUG CONFIRMED!`);
        console.log(`Ange won ${angeWinner.amount - maxEligible} MORE than eligible!`);
        console.log('This violates fundamental poker side pot rules.');
      } else {
        console.log('\n✅ CORRECT: Winnings within eligible amount');
      }
    }
    
    const damianWinner = data.winners.find(w => w.playerId === 'damian');
    if (damianWinner) {
      console.log(`\nDamian won: ${damianWinner.amount}`);
    }
    
    // Verify chip conservation
    const totalBefore = 56440 + 150000;
    const totalAfter = playerA.chips + playerB.chips;
    console.log(`\nChip conservation check:`);
    console.log(`- Total before: ${totalBefore}`);
    console.log(`- Total after: ${totalAfter}`);
    console.log(`- Difference: ${totalAfter - totalBefore} (should be 0)`);
  });
  
  console.log('Starting game...\n');
  table.tryStartGame();
  
  await new Promise(resolve => setTimeout(resolve, 2000));
}

testExactBug().catch(console.error);