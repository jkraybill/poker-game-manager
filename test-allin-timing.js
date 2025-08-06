/**
 * Test all-in at different times to find the bug
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
      const myState = gameState.players[this.id];
      
      if (action.action === Action.ALL_IN) {
        console.log(`[${gameState.phase}] ${this.name}: ALL_IN (${myState.chips} chips remaining)`);
        return { action: Action.ALL_IN, timestamp: Date.now() };
      }
      
      console.log(`[${gameState.phase}] ${this.name}: ${action.action} ${action.amount || ''}`);
      return { ...action, timestamp: Date.now() };
    }
    
    if (gameState.validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK, timestamp: Date.now() };
    }
    return { action: Action.FOLD, timestamp: Date.now() };
  }
}

async function testScenario(scenarioName, playerAActions, playerBActions) {
  console.log(`\n=== ${scenarioName} ===`);
  
  const table = new Table({
    id: 'test',
    maxPlayers: 2,
    minPlayers: 2,
    blinds: { small: 10000, big: 20000 }
  });
  
  const playerA = new TestPlayer({
    id: 'player-a',
    name: 'A (56k)',
    actions: playerAActions
  });
  playerA.buyIn(56440);
  
  const playerB = new TestPlayer({
    id: 'player-b',
    name: 'B (150k)',
    actions: playerBActions
  });
  playerB.buyIn(150000);
  
  await table.addPlayer(playerA);
  await table.addPlayer(playerB);
  
  let finalPot = 0;
  table.on('pot:updated', (data) => {
    finalPot = data.total;
  });
  
  table.on('hand:ended', (data) => {
    console.log(`Final pot: ${finalPot}`);
    
    const playerAWinner = data.winners.find(w => w.playerId === 'player-a');
    if (playerAWinner) {
      const maxEligible = 56440 * 2;
      console.log(`Player A won: ${playerAWinner.amount}`);
      console.log(`Max eligible: ${maxEligible}`);
      
      if (playerAWinner.amount > maxEligible) {
        console.log(`❌ BUG: Won ${playerAWinner.amount - maxEligible} too much!`);
      } else {
        console.log(`✅ OK`);
      }
    } else {
      console.log('Player B won');
    }
    
    // Show side pots
    console.log('Side pots:', data.sidePots.map(p => ({
      name: p.potName,
      amount: p.amount,
      cap: p.maxContribution
    })));
  });
  
  table.tryStartGame();
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function runTests() {
  // Scenario 1: All-in immediately pre-flop
  await testScenario(
    'Scenario 1: Immediate all-in pre-flop',
    [{ action: Action.ALL_IN }],
    [{ action: Action.CALL, amount: 36440 }]
  );
  
  // Scenario 2: All-in after some betting
  await testScenario(
    'Scenario 2: All-in after raise',
    [
      { action: Action.RAISE, amount: 40000 },
      { action: Action.ALL_IN }
    ],
    [
      { action: Action.CALL, amount: 20000 },
      { action: Action.CALL, amount: 16440 }
    ]
  );
  
  // Scenario 3: All-in on later street
  await testScenario(
    'Scenario 3: All-in on flop',
    [
      { action: Action.CALL, amount: 10000 },
      { action: Action.ALL_IN }
    ],
    [
      { action: Action.CHECK },
      { action: Action.CALL, amount: 36440 }
    ]
  );
  
  // Scenario 4: Big raise then all-in
  await testScenario(
    'Scenario 4: Big pre-flop action',
    [
      { action: Action.RAISE, amount: 50000 },
      { action: Action.ALL_IN }
    ],
    [
      { action: Action.CALL, amount: 30000 },
      { action: Action.CALL, amount: 6440 }
    ]
  );
}

runTests().catch(console.error);