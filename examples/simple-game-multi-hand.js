import { PokerGameManager, Player, Action } from '../packages/core/src/index.js';

// Constants
const HANDS_TO_PLAY = 5;
const STARTING_CHIPS = 1000;

// Simple player implementations
class ConservativePlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    // Fold to any bet over 10% of chips
    if (toCall > myState.chips * 0.1) {
      return {
        playerId: this.id,
        action: Action.FOLD,
        timestamp: Date.now()
      };
    }

    // Call small bets or check
    if (toCall > 0) {
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now()
      };
    }

    return {
      playerId: this.id,
      action: Action.CHECK,
      timestamp: Date.now()
    };
  }
}

class AggressivePlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    const potSize = gameState.pot;

    // Bet/raise 30% of the time when possible
    if (Math.random() < 0.3) {
      if (toCall === 0 && gameState.currentBet === 0) {
        // Make a bet
        const betAmount = Math.min(Math.floor(potSize * 0.5), myState.chips);
        if (betAmount > 0) {
          return {
            playerId: this.id,
            action: Action.BET,
            amount: betAmount,
            timestamp: Date.now()
          };
        }
      } else if (toCall > 0 && toCall < myState.chips * 0.5) {
        // Make a raise
        const raiseAmount = Math.min(gameState.currentBet + toCall, myState.chips);
        if (raiseAmount > gameState.currentBet) {
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: raiseAmount,
            timestamp: Date.now()
          };
        }
      }
    }

    // Otherwise call or check
    if (toCall > 0) {
      if (toCall >= myState.chips) {
        return {
          playerId: this.id,
          action: Action.ALL_IN,
          amount: myState.chips,
          timestamp: Date.now()
        };
      }
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now()
      };
    }

    return {
      playerId: this.id,
      action: Action.CHECK,
      timestamp: Date.now()
    };
  }
}

// Game state tracking
let handsPlayed = 0;
let gameComplete = false;
let players = [];
let dealerButtonHistory = [];

// Helper functions
const getPlayerName = (playerId) => {
  const player = players.find(p => p.id === playerId);
  return player ? player.name : playerId;
};

const getChipLeader = () => {
  return players.reduce((leader, player) => {
    return player.chips > leader.chips ? player : leader;
  });
};

async function runMultiHandGame() {
  console.log('=== POKER GAME MANAGER - MULTI-HAND EXAMPLE ===');
  console.log(`Playing ${HANDS_TO_PLAY} hands of Texas Hold'em\n`);

  // Create game manager and table
  const manager = new PokerGameManager();
  const table = manager.createTable({
    blinds: { small: 10, big: 20 },
    minBuyIn: STARTING_CHIPS,
    maxBuyIn: STARTING_CHIPS,
    minPlayers: 3,
    dealerButton: 0, // Start with player 0 as dealer
  });

  // Create players
  const conservative = new ConservativePlayer({ 
    id: 'player-1', 
    name: 'Conservative Carl' 
  });
  const aggressive = new AggressivePlayer({ 
    id: 'player-2', 
    name: 'Aggressive Amy' 
  });
  const balanced = new ConservativePlayer({ 
    id: 'player-3', 
    name: 'Balanced Bob' 
  });
  
  players = [conservative, aggressive, balanced];
  
  // Override starting chips for one player to test elimination
  // This will cause them to be eliminated early
  aggressive.chips = 50;

  // Track hole cards for display
  let holeCards = {};
  players.forEach(player => {
    const originalReceiveCards = player.receivePrivateCards.bind(player);
    player.receivePrivateCards = function(cards) {
      originalReceiveCards(cards);
      holeCards[this.id] = cards;
    };
  });

  // Set up event handlers
  table.on('hand:started', (data) => {
    handsPlayed++;
    console.log(`\n${'='.repeat(50)}`);
    console.log(`HAND ${handsPlayed} OF ${HANDS_TO_PLAY}`);
    console.log(`${'='.repeat(50)}\n`);
    
    // Track dealer button rotation
    dealerButtonHistory.push(data.dealerButton);
    console.log(`🎯 Dealer Button: Position ${data.dealerButton} (${getPlayerName(data.players[data.dealerButton])})`);
    
    // Show dealer rotation history
    if (handsPlayed > 1) {
      console.log(`   Button history: ${dealerButtonHistory.join(' → ')}`);
      console.log(`   ✅ Button rotated clockwise!`);
    }
    
    // Show blinds
    const sbIndex = (data.dealerButton + 1) % data.players.length;
    const bbIndex = (data.dealerButton + 2) % data.players.length;
    console.log(`💰 Blinds: ${getPlayerName(data.players[sbIndex])} (SB $10), ${getPlayerName(data.players[bbIndex])} (BB $20)`);
    
    // Show chip counts at start of hand
    console.log('\n📊 Chip Counts:');
    players.forEach(player => {
      console.log(`   ${player.name}: $${player.chips}`);
    });
    console.log('');
  });

  table.on('cards:dealt', () => {
    console.log('🃏 Cards dealt to all players');
  });

  table.on('cards:community', ({ phase, cards }) => {
    const cardStr = cards.map(c => `${c.rank}${c.suit}`).join(' ');
    console.log(`\n🎰 ${phase}: ${cardStr}`);
  });

  table.on('player:action', ({ playerId, action, amount }) => {
    const amountStr = amount ? ` $${amount}` : '';
    console.log(`   ${getPlayerName(playerId)} ${action}${amountStr}`);
  });

  table.on('pot:updated', ({ total }) => {
    console.log(`   💰 Pot: $${total}`);
  });

  table.on('hand:ended', async ({ winners, board }) => {
    console.log('\n🏁 SHOWDOWN');
    
    // Show final board
    if (board) {
      const boardStr = board.map(c => `${c.rank}${c.suit}`).join(' ');
      console.log(`📋 Board: ${boardStr}`);
    }
    
    // Show all hands (for educational purposes)
    console.log('\n👁️  All Hands:');
    players.forEach(player => {
      const cards = holeCards[player.id];
      if (cards && player.chips > 0) {
        const cardStr = cards.map(c => `${c.rank}${c.suit}`).join(' ');
        console.log(`   ${player.name}: ${cardStr}`);
      }
    });
    
    // Show winners
    console.log('\n🏆 Winner(s):');
    winners.forEach(winner => {
      const playerName = getPlayerName(winner.playerId);
      console.log(`   ${playerName} wins $${winner.amount} with ${winner.hand.description}`);
    });
    
    // Clear hole cards for next hand
    holeCards = {};
    
    // Check if game should continue
    const activePlayers = players.filter(p => p.chips > 0);
    
    if (handsPlayed >= HANDS_TO_PLAY || activePlayers.length < 2) {
      // Game complete
      console.log('\n' + '='.repeat(50));
      console.log('FINAL RESULTS');
      console.log('='.repeat(50));
      
      // Sort players by chips
      const sortedPlayers = [...players].sort((a, b) => b.chips - a.chips);
      
      console.log('\n🏆 FINAL STANDINGS:');
      sortedPlayers.forEach((player, index) => {
        const status = player.chips === 0 ? ' (ELIMINATED)' : '';
        const medal = index === 0 && player.chips > 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        console.log(`${medal} ${index + 1}. ${player.name}: $${player.chips}${status}`);
      });
      
      // Declare overall winner
      const winner = getChipLeader();
      if (winner.chips > 0) {
        console.log(`\n🎊 TOURNAMENT WINNER: ${winner.name} with $${winner.chips}!`);
      }
      
      // Show statistics
      console.log('\n📈 GAME STATISTICS:');
      console.log(`   Total hands played: ${handsPlayed}`);
      console.log(`   Dealer button rotations: ${dealerButtonHistory.join(' → ')}`);
      console.log(`   Starting chips per player: $${STARTING_CHIPS}`);
      console.log(`   Total chips in play: $${players.reduce((sum, p) => sum + p.chips, 0)}`);
      
      gameComplete = true;
    } else {
      // Continue to next hand
      console.log(`\n⏳ Starting hand ${handsPlayed + 1} in 2 seconds...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Important: Must explicitly start next hand
      table.tryStartGame();
    }
  });

  table.on('player:eliminated', ({ playerId }) => {
    const playerName = getPlayerName(playerId);
    console.log(`\n☠️  ${playerName} has been eliminated!`);
  });

  // Add players to table
  console.log('Adding players to the table...\n');
  for (const player of players) {
    table.addPlayer(player);
    console.log(`✅ ${player.name} joined with $${STARTING_CHIPS}`);
  }

  // Start the first hand
  console.log('\nStarting the game...');
  table.tryStartGame();

  // Wait for game completion
  await new Promise(resolve => {
    const checkInterval = setInterval(() => {
      if (gameComplete) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);

    // Safety timeout
    setTimeout(() => {
      clearInterval(checkInterval);
      console.log('\n⏱️  Game timed out');
      resolve();
    }, 60000); // 1 minute timeout
  });

  // Clean up
  table.close();
  console.log('\n=== MULTI-HAND EXAMPLE COMPLETE ===');
  process.exit(0);
}

// Run the example
runMultiHandGame().catch(error => {
  console.error('❌ Error running game:', error);
  process.exit(1);
});