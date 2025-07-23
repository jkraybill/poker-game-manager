/**
 * Example: Displaying Player Standings
 * 
 * This example shows how to properly display active and eliminated players
 * separately, addressing Issue #34.
 */

import { PokerGameManager } from '../src/PokerGameManager.js';
import { Player } from '../src/Player.js';
import { Action } from '../src/types/index.js';
import { getFormattedStandings } from '../src/utils/playerStatus.js';

// Create simple player for testing
class SimplePlayer extends Player {
  constructor(config) {
    super(config);
    this.targetAction = config.targetAction || 'check';
  }
  
  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    
    // Simple strategy based on config
    if (this.targetAction === 'all-in' && myState.chips > 0) {
      return {
        playerId: this.id,
        action: Action.ALL_IN,
        amount: myState.chips,
        timestamp: Date.now(),
      };
    }
    
    if (toCall > 0 && toCall <= myState.chips) {
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now(),
      };
    }
    
    return {
      playerId: this.id,
      action: Action.CHECK,
      timestamp: Date.now(),
    };
  }
}

async function demonstrateStandings() {
  console.log('=== Player Standings Display Example ===\n');
  
  const manager = new PokerGameManager();
  const table = manager.createTable({
    id: 'standings-demo',
    blinds: { small: 10, big: 20 },
    minBuyIn: 100,
    maxBuyIn: 500,
    minPlayers: 4,
    dealerButton: 0,
  });
  
  // Add players with different chip amounts
  const players = [
    new SimplePlayer({ name: 'Alice', targetAction: 'check' }),
    new SimplePlayer({ name: 'Bob', targetAction: 'all-in' }),
    new SimplePlayer({ name: 'Charlie', targetAction: 'check' }),
    new SimplePlayer({ name: 'David', targetAction: 'all-in' }),
  ];
  
  players.forEach(p => table.addPlayer(p));
  
  // Set custom chip amounts
  table.players.get(players[0].id).player.chips = 500; // Alice - big stack
  table.players.get(players[1].id).player.chips = 50;  // Bob - short stack (will go all-in)
  table.players.get(players[2].id).player.chips = 300; // Charlie - medium stack
  table.players.get(players[3].id).player.chips = 20;  // David - micro stack (will go all-in)
  
  console.log('Initial standings:');
  displayStandings(table);
  
  // Play a hand
  console.log('\n--- Playing Hand 1 ---');
  await playHand(table);
  
  console.log('\nStandings after Hand 1:');
  displayStandings(table);
  
  // If players remain, play another hand
  const standings = getFormattedStandings(table.players);
  if (standings.standings.length >= 2) {
    console.log('\n--- Playing Hand 2 ---');
    await playHand(table);
    
    console.log('\nStandings after Hand 2:');
    displayStandings(table);
  }
  
  // Clean up
  table.close();
}

function displayStandings(table) {
  const { standings, eliminated, summary } = getFormattedStandings(table.players);
  
  // Display active players
  console.log('\n=== ACTIVE PLAYERS ===');
  if (standings.length > 0) {
    standings.forEach(player => {
      console.log(`${player.rank}. ${player.name}: $${player.chips} (Seat ${player.seatNumber})`);
    });
    
    console.log(`\nTotal chips in play: $${summary.totalChipsInPlay}`);
    console.log(`Average stack: $${summary.averageStack}`);
  } else {
    console.log('No active players');
  }
  
  // Display eliminated players
  if (eliminated.length > 0) {
    console.log('\n=== ELIMINATED ===');
    eliminated.forEach(player => {
      console.log(`${player.name}: Eliminated (was in Seat ${player.seatNumber})`);
    });
  }
  
  console.log(`\nPlayers remaining: ${summary.playersRemaining}/${standings.length + eliminated.length}`);
}

async function playHand(table) {
  return new Promise((resolve) => {
    table.on('hand:ended', ({ winners }) => {
      console.log('Hand complete. Winners:', winners.map(w => ({
        player: table.players.get(w.playerId)?.player.name || w.playerId,
        amount: w.amount,
      })));
      
      // Give time for events to process
      setTimeout(resolve, 100);
    });
    
    table.tryStartGame();
  });
}

// Run the example
demonstrateStandings().catch(console.error);