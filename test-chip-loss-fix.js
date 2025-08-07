/**
 * Quick test to demonstrate that the chip conservation race condition bug is FIXED
 * 
 * Run with: node test-chip-loss-fix.js
 */

import { PokerGameManager, Player } from './packages/core/src/index.js';

// Simple player that always calls
class AllInPlayer extends Player {
  constructor(name) {
    super({ name });
  }
  
  getAction(gameState) {
    return Promise.resolve({
      action: 'ALL_IN',
      playerId: this.id,
      timestamp: Date.now(),
    });
  }
  
  receivePrivateCards() {}
  receivePublicCards() {}
  receiveGameUpdate() {}
}

console.log('🧪 Testing Chip Conservation Race Condition Fix');
console.log('================================================\n');

const manager = new PokerGameManager();
const table = manager.createTable({
  id: 'race-condition-test',
  blinds: { small: 10, big: 20 },
  dealerButton: 0,
});

// Create elimination scenario: big vs small stack
const player1 = new AllInPlayer('Big Stack');
player1.buyIn(1000);

const player2 = new AllInPlayer('Small Stack');
player2.buyIn(50);

table.addPlayer(player1);
table.addPlayer(player2);

const totalChipsExpected = 1050;
let eventSequence = [];

// Track what external tournament managers would see
table.on('hand:ended', ({ winners }) => {
  const timestamp = Date.now();
  const chipCount = Array.from(table.players.values())
    .reduce((sum, pd) => sum + pd.player.chips, 0);
  const playerCount = table.players.size;
  
  eventSequence.push({
    event: 'hand:ended',
    timestamp,
    chipCount,
    playerCount,
    winners: winners.map(w => ({ id: w.playerId, amount: w.amount }))
  });
  
  console.log(`📊 hand:ended fired:`);
  console.log(`   Total chips: ${chipCount}/${totalChipsExpected}`);
  console.log(`   Players in table: ${playerCount}`);
  console.log(`   Winners:`, winners.map(w => `${w.playerId}: $${w.amount}`));
  
  if (chipCount === totalChipsExpected && playerCount === 1) {
    console.log('   ✅ CORRECT STATE: Chips conserved and eliminated players removed!');
  } else {
    console.log('   🚨 BUG: Inconsistent state detected');
  }
});

table.on('player:eliminated', ({ playerId }) => {
  const timestamp = Date.now();
  eventSequence.push({
    event: 'player:eliminated',
    timestamp,
    playerId
  });
  
  console.log(`🗑️  player:eliminated: ${playerId}`);
});

// Players are already set to go all-in via AllInPlayer class

console.log('🎮 Starting heads-up elimination scenario...\n');

// Start the game and wait for completion
const gameEndPromise = new Promise((resolve) => {
  table.on('hand:ended', () => {
    setTimeout(resolve, 100); // Give time for all events to process
  });
});

table.tryStartGame();

gameEndPromise.then(() => {
  console.log('\n📈 EVENT TIMELINE:');
  eventSequence.forEach((event, i) => {
    const timeDiff = i > 0 ? event.timestamp - eventSequence[0].timestamp : 0;
    console.log(`${i + 1}. ${event.event} (+${timeDiff}ms)`);
  });
  
  const handEndedEvent = eventSequence.find(e => e.event === 'hand:ended');
  const eliminationEvent = eventSequence.find(e => e.event === 'player:eliminated');
  
  console.log('\n🎯 RACE CONDITION FIX VERIFICATION:');
  if (eliminationEvent && handEndedEvent && eliminationEvent.timestamp < handEndedEvent.timestamp) {
    console.log('✅ SUCCESS: player:eliminated fires BEFORE hand:ended');
    console.log('✅ SUCCESS: External systems see correct state when hand:ended fires');
    console.log('✅ SUCCESS: Race condition has been FIXED!');
  } else {
    console.log('🚨 FAILURE: Race condition still exists');
  }
  
  console.log(`\n🏆 FINAL RESULT: ${handEndedEvent.chipCount}/${totalChipsExpected} chips conserved with ${handEndedEvent.playerCount} players remaining`);
  
  // Clean up
  manager.tables.forEach(table => table.close());
  process.exit(0);
}).catch(console.error);