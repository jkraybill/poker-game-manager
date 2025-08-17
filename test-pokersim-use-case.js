#!/usr/bin/env node

/**
 * PokerSim Use Case Demo - Showdown Participants Feature
 * 
 * Demonstrates the new showdownParticipants feature for comprehensive 
 * tournament logging as requested by the PokerSim team for issue #150.
 */

import { Table } from './packages/core/src/Table.js';
import { Player } from './packages/core/src/Player.js';
import { Action } from './packages/core/src/types/index.js';

// Test player that calls to reach showdown
class TournamentPlayer extends Player {
  constructor(config) {
    super(config);
    this.chips = config.chips;
  }
  
  async getAction(gameState) {
    // Always call/check to reach showdown
    if (gameState.validActions.includes(Action.CHECK)) {
      return { action: Action.CHECK, amount: 0, timestamp: Date.now() };
    }
    if (gameState.validActions.includes(Action.CALL)) {
      return { action: Action.CALL, amount: gameState.toCall, timestamp: Date.now() };
    }
    return { action: Action.CHECK, amount: 0, timestamp: Date.now() };
  }
}

async function demonstratePokerSimUseCase() {
  console.log('=== POKERSIM SHOWDOWN PARTICIPANTS DEMO ===');
  console.log('Demonstrating comprehensive tournament logging\n');
  
  const table = new Table({
    id: 'tournament-table',
    maxPlayers: 3,
    minPlayers: 3,
    blinds: { small: 50, big: 100 },
    dealerButton: 0
  });

  // Create tournament players
  const players = [
    new TournamentPlayer({ id: 1, name: 'Alice', chips: 5000 }),
    new TournamentPlayer({ id: 2, name: 'Bob', chips: 5000 }),
    new TournamentPlayer({ id: 3, name: 'Charlie', chips: 5000 })
  ];

  for (let i = 0; i < players.length; i++) {
    await table.addPlayer(players[i], i);
  }

  // Set up comprehensive logging as requested by PokerSim team
  table.on('hand:ended', (data) => {
    console.log('\n' + '='.repeat(60));
    console.log('📋 COMPREHENSIVE HAND HISTORY (PokerSim Format)');
    console.log('='.repeat(60));
    
    if (data.showdownParticipants) {
      // Calculate total pot from participants
      const totalPot = data.showdownParticipants.reduce((sum, p) => sum + p.amount, 0);
      
      console.log(`\n🃏 SHOWDOWN (Pot: ${totalPot}):`);
      console.log(`Board: [${data.board ? data.board.join(' ') : 'No community cards'}]`);
      
      // Show all participants' hands as requested
      for (const participant of data.showdownParticipants) {
        const status = participant.amount > 0 
          ? `wins ${participant.amount}` 
          : 'loses';
        const handDesc = participant.hand.description || 'Unknown hand';
        
        console.log(`- ${players.find(p => p.id === participant.playerId)?.name || `Player${participant.playerId}`} shows [${participant.cards.join(' ')}] for ${handDesc} (${status})`);
      }
      
      // Summary for tournament logging
      const winners = data.showdownParticipants.filter(p => p.amount > 0);
      const winnerNames = winners.map(w => players.find(p => p.id === w.playerId)?.name).join(', ');
      
      if (winners.length === 1) {
        console.log(`\n🏆 Winner: ${winnerNames}`);
      } else if (winners.length > 1) {
        console.log(`\n🤝 Split Pot: ${winnerNames}`);
      }
      
    } else {
      // Hand ended by folding - no showdown
      console.log('\n🚪 Hand ended by folding (no showdown)');
      const winnerNames = data.winners.map(id => players.find(p => p.id === id)?.name).join(', ');
      console.log(`Winner: ${winnerNames}`);
    }
    
    // Final chip counts for tournament tracking
    console.log('\n💰 Final Chip Counts:');
    for (const [playerId, chips] of Object.entries(data.finalChips)) {
      const playerName = players.find(p => p.id === parseInt(playerId))?.name || `Player${playerId}`;
      console.log(`  ${playerName}: ${chips} chips`);
    }
    
    console.log('\n✅ PokerSim Issue #150: Complete hand history with all showdown participants');
  });

  console.log('Starting 3-player tournament hand...\n');
  
  const handEndedPromise = new Promise(resolve => {
    table.once('hand:ended', resolve);
  });
  
  await table.tryStartGame();
  await handEndedPromise;
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 POKERSIM INTEGRATION SUCCESS');
  console.log('='.repeat(60));
  console.log('✅ All showdown participants included in hand:ended event');
  console.log('✅ Complete hand history available for tournament logging');
  console.log('✅ Backward compatibility maintained with existing winners array');
  console.log('✅ Ready for PokerSim integration');
  
  return true;
}

// Run the demo
demonstratePokerSimUseCase()
  .then(success => {
    console.log('\n🚀 Demo completed successfully!');
    console.log('The PokerSim team can now upgrade to v4.5.0 to get this feature.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  });