import { PokerGameManager, Player, Action } from '../packages/core/src/index.js';
import { getFormattedStandings } from '../packages/core/src/utils/playerStatus.js';

// Constants
const HANDS_TO_PLAY = 12;
const PLAYER_COUNT = 6;

// Simple player strategies for demonstration
class ConservativePlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    

    // Only raise with strong position
    if (toCall === 0 && Math.random() < 0.1) {
      const betAmount = Math.min(gameState.pot * 0.5, myState.chips);
      if (betAmount > 0) {
        return {
          playerId: this.id,
          action: Action.BET,
          amount: Math.floor(betAmount),
          timestamp: Date.now(),
        };
      }
    }

    // Call small bets
    if (toCall > 0 && toCall <= myState.chips * 0.1) {
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now(),
      };
    }

    // Check when possible
    if (toCall === 0) {
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now(),
      };
    }

    // Otherwise fold
    return {
      playerId: this.id,
      action: Action.FOLD,
      timestamp: Date.now(),
    };
  }
}

class LoosePlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    

    // Occasionally go all-in
    if (Math.random() < 0.05 && myState.chips > 0) {
      return {
        playerId: this.id,
        action: Action.ALL_IN,
        amount: myState.chips,
        timestamp: Date.now(),
      };
    }

    // Raise/bet frequently
    if (toCall === 0 && Math.random() < 0.3) {
      const betAmount = Math.min(gameState.pot * 0.75, myState.chips);
      if (betAmount > 0) {
        return {
          playerId: this.id,
          action: Action.BET,
          amount: Math.floor(betAmount),
          timestamp: Date.now(),
        };
      }
    }

    // Call most bets
    if (toCall > 0 && toCall <= myState.chips * 0.5) {
      if (toCall >= myState.chips) {
        return {
          playerId: this.id,
          action: Action.ALL_IN,
          amount: myState.chips,
          timestamp: Date.now(),
        };
      }
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now(),
      };
    }

    // Check when possible
    if (toCall === 0) {
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now(),
      };
    }

    // Fold only big bets
    return {
      playerId: this.id,
      action: Action.FOLD,
      timestamp: Date.now(),
    };
  }
}

// Track game state
let handsPlayed = 0;
let eliminatedPlayers = new Set();
let eliminatedPlayerData = []; // Track eliminated player details for standings
let players = [];
let table = null;
let manager = null;

// Helper to get player name from ID
const getPlayerName = (playerId) => {
  const player = players.find((p) => p.id === playerId);
  return player ? player.name : playerId;
};

// Comprehensive event logging
function setupEventListeners(manager, table) {
  console.log('\n=== SETTING UP EVENT LISTENERS ===\n');

  // Manager events
  manager.on('table:created', (data) => {
    console.log(`📊 [MANAGER] Table created: ${data.tableId} with ${data.minPlayers} min players`);
  });

  manager.on('table:destroyed', (data) => {
    console.log(`🔚 [MANAGER] Table destroyed: ${data.tableId}`);
  });

  // Table events - Player Management
  table.on('player:joined', (data) => {
    const chips = data.buyIn || data.player.chips || 1000;
    console.log(`👤 [TABLE] Player joined: ${data.player.name} in seat ${data.seatNumber} with $${chips}`);
  });

  table.on('player:left', (data) => {
    console.log(`👋 [TABLE] Player left: ${getPlayerName(data.playerId)}`);
  });

  table.on('table:ready', (data) => {
    console.log(`✅ [TABLE] Table ready: ${data.playerCount}/${data.minPlayers} players`);
  });

  // Game lifecycle events
  table.on('game:started', (data) => {
    console.log(`\n🎮 [TABLE] Game ${data.gameNumber} started with ${data.players.length} players`);
  });

  table.on('hand:started', (data) => {
    handsPlayed++;
    console.log(`\n🃏 === HAND ${handsPlayed} OF ${HANDS_TO_PLAY} ===`);
    console.log(`🎯 Dealer button: Position ${data.dealerButton} (${getPlayerName(data.players[data.dealerButton])})`);
    
    // Show blinds - get from table config since not in event data
    const sbIndex = (data.dealerButton + 1) % data.players.length;
    const bbIndex = (data.dealerButton + 2) % data.players.length;
    console.log(`💰 Small blind: ${getPlayerName(data.players[sbIndex])} posts $${table.config.blinds.small}`);
    console.log(`💰 Big blind: ${getPlayerName(data.players[bbIndex])} posts $${table.config.blinds.big}`);
    console.log(`📍 Players in hand: ${data.players.map(p => getPlayerName(p)).join(', ')}`);
  });

  // Betting round events
  table.on('round:started', (data) => {
    console.log(`\n🔄 === ${data.phase} ROUND STARTED ===`);
  });

  table.on('round:ended', (data) => {
    console.log(`✔️  ${data.phase} round complete`);
  });

  // Card events
  table.on('cards:dealt', (data) => {
    // Skip logging individual card deals since we log them in receivePrivateCards
  });

  table.on('cards:community', (data) => {
    const cards = data.cards.map((c) => `${c.rank}${c.suit}`).join(' ');
    console.log(`🎰 Community cards (${data.phase}): ${cards}`);
  });

  // Action events
  table.on('action:requested', (data) => {
    const { bettingDetails } = data;
    if (bettingDetails) {
      console.log(`\n⏳ Action on ${getPlayerName(data.playerId)}:`);
      console.log(`   Pot: $${bettingDetails.potSize} | To call: $${bettingDetails.toCall}`);
      console.log(`   Valid actions: ${bettingDetails.validActions.join(', ')}`);
    }
  });

  table.on('player:action', (data) => {
    const amount = data.amount ? ` $${data.amount}` : '';
    console.log(`🎯 ${getPlayerName(data.playerId)} ${data.action}${amount}`);
  });

  // Pot events
  table.on('pot:updated', (data) => {
    console.log(`💰 Pot updated: ${data.potName} now $${data.total}`);
  });

  table.on('pot:created', (data) => {
    console.log(`🏆 New pot created: ${data.potName} with $${data.amount}`);
  });

  // Showdown and winner events
  table.on('showdown:started', (data) => {
    console.log(`\n👁️  === SHOWDOWN ===`);
    console.log(`Players in showdown: ${data.players.map(p => getPlayerName(p)).join(', ')}`);
  });

  table.on('hand:ended', (data) => {
    console.log(`\n🏁 === HAND ${handsPlayed} COMPLETE ===`);
    
    // Show board
    if (data.board) {
      const board = data.board.map((c) => `${c.rank}${c.suit}`).join(' ');
      console.log(`📋 Final board: ${board}`);
    }

    // Show winners
    data.winners.forEach((winner) => {
      const playerName = getPlayerName(winner.playerId);
      console.log(`🏆 ${playerName} wins $${winner.amount} with ${winner.hand.description}`);
      const cards = winner.cards.map((c) => `${c.rank}${c.suit}`).join(' ');
      console.log(`   Winning cards: ${cards}`);
    });

    // Show side pots if any
    if (data.sidePots && data.sidePots.length > 1) {
      console.log(`\n💵 Side pots:`);
      data.sidePots.forEach((pot) => {
        console.log(`   ${pot.potName}: $${pot.amount} (${pot.eligiblePlayers.length} eligible)`);
      });
    }
  });

  table.on('chips:awarded', (data) => {
    console.log(`💸 ${getPlayerName(data.playerId)} awarded $${data.amount} (total: $${data.total})`);
  });

  // Error events
  table.on('error', (data) => {
    console.error(`❌ [TABLE ERROR] ${data.message || JSON.stringify(data)}`);
  });

  // Catch any game errors
  table.on('game:error', (data) => {
    console.error(`❌ [GAME ERROR] ${data.message || JSON.stringify(data)}`);
  });

  // Player state events
  table.on('player:eliminated', (data) => {
    const playerName = getPlayerName(data.playerId);
    console.log(`☠️  ${playerName} eliminated from game!`);
    eliminatedPlayers.add(data.playerId);
    
    // Track eliminated player data for standings display (Issue #34)
    eliminatedPlayerData.push({
      id: data.playerId,
      name: playerName,
      chips: 0,
      seatNumber: data.seatNumber || 0, // May not be available in elimination event
      status: 'eliminated',
      eliminationOrder: eliminatedPlayerData.length + 1, // Simple ordering
    });
  });

  // Custom event for tracking private cards (for demo purposes)
  players.forEach((player) => {
    const originalReceiveCards = player.receivePrivateCards.bind(player);
    player.receivePrivateCards = function (cards) {
      originalReceiveCards(cards);
      const cardStr = cards.map((c) => `${c.rank}${c.suit}`).join(' ');
      console.log(`🤫 ${this.name} receives: ${cardStr}`);
    };
  });
}

// Main game runner
async function runMultiHandGame() {
  console.log('=== POKER GAME MANAGER - MULTI-HAND EXAMPLE ===');
  console.log(`Playing ${HANDS_TO_PLAY} hands with ${PLAYER_COUNT} players\n`);

  // Create manager and table
  manager = new PokerGameManager();
  table = manager.createTable({
    blinds: { small: 10, big: 20 },
    minBuyIn: 1000,
    maxBuyIn: 1000,
    minPlayers: 3, // Minimum 3 to handle eliminations
    dealerButton: 0, // Set initial dealer button position
  });

  // Create diverse player pool
  const playerTypes = [
    { type: ConservativePlayer, prefix: 'Cautious' },
    { type: LoosePlayer, prefix: 'Loose' },
  ];

  players = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const playerType = playerTypes[i % playerTypes.length];
    const player = new playerType.type({
      id: `player-${i + 1}`,
      name: `${playerType.prefix} Player ${i + 1}`,
    });
    players.push(player);
  }

  // Set up all event listeners
  setupEventListeners(manager, table);

  // Add players to table
  console.log('Adding players to table...\n');
  for (const player of players) {
    table.addPlayer(player);
  }

  // Start first game
  console.log('\nStarting first hand...');
  table.tryStartGame();

  // Track if we're processing to avoid duplicate handlers
  let isProcessing = false;

  // Game loop
  await new Promise((resolve) => {
    table.on('hand:ended', async () => {
      // Prevent duplicate processing
      if (isProcessing) return;
      isProcessing = true;
      // Show current standings using proper utilities (fixes Issue #34)
      console.log('\n📊 === CURRENT STANDINGS ===');
      const { standings, eliminated, summary } = getFormattedStandings(table.players, eliminatedPlayerData);
      
      // Display active players
      console.log('\n🏆 ACTIVE PLAYERS:');
      if (standings.length > 0) {
        standings.forEach(player => {
          console.log(`${player.rank}. ${player.name}: $${player.chips} (Seat ${player.seatNumber})`);
        });
        console.log(`\nTotal chips in play: $${summary.totalChipsInPlay} | Average stack: $${summary.averageStack}`);
      } else {
        console.log('No active players remaining');
      }
      
      // Display eliminated players separately (addresses Issue #34)
      if (eliminated.length > 0) {
        console.log('\n☠️  ELIMINATED PLAYERS:');
        eliminated.forEach(player => {
          console.log(`   ${player.name} (elimination order: ${player.eliminationOrder || 'unknown'})`);
        });
      }
      
      console.log(`\nPlayers remaining: ${summary.playersRemaining}/${standings.length + eliminated.length}`);

      // Check if we should continue
      if (handsPlayed >= HANDS_TO_PLAY || standings.length < 2) {
        console.log('\n🎊 === GAME COMPLETE ===');
        
        if (standings.length === 1) {
          console.log(`\n🏆 WINNER: ${standings[0].name} wins the tournament!`);
        } else if (standings.length > 0) {
          // Winner is already sorted by chips (rank 1)
          const winner = standings[0];
          console.log(`\n🏆 WINNER: ${winner.name} with $${winner.chips}!`);
        } else {
          console.log('\n🤔 No active players remain - tournament ended');
        }

        resolve();
      } else {
        // Brief pause between hands
        console.log(`\n⏰ Starting hand ${handsPlayed + 1} in 2 seconds...\n`);
        await new Promise((r) => setTimeout(r, 2000));
        
        // Start next hand
        isProcessing = false;
        table.tryStartGame();
      }
    });

    // Safety timeout
    setTimeout(() => {
      console.log('\n⏱️  Game timed out');
      console.log(`Hands played: ${handsPlayed}/${HANDS_TO_PLAY}`);
      resolve();
    }, 60000); // 1 minute max for demo
  });

  // Clean up
  table.close();
  console.log('\n=== MULTI-HAND EXAMPLE COMPLETE ===');
  process.exit(0);
}

// Run the example
runMultiHandGame().catch((error) => {
  console.error('❌ Error running game:', error);
  process.exit(1);
});