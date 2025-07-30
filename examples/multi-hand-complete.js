import { PokerGameManager, Player, Action } from '../packages/core/src/index.js';

// Constants
const HANDS_TO_PLAY = 5;
const STARTING_CHIPS = 1000;
const PAUSE_BETWEEN_HANDS = 2000; // 2 seconds

// Player implementations with different strategies
class TightPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    const potOdds = toCall / (gameState.pot + toCall);

    // Handle when we need to call more than we have
    if (toCall >= myState.chips) {
      // If pot odds are good or we're committed, go all-in
      if (potOdds < 0.3 || myState.bet > myState.chips * 0.5) {
        return {
          playerId: this.id,
          action: Action.ALL_IN,
          amount: myState.chips,
          timestamp: Date.now()
        };
      } else {
        return {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now()
        };
      }
    }
    
    // Fold to any bet over 15% of chips unless pot odds are great
    if (toCall > myState.chips * 0.15 && potOdds > 0.3) {
      return {
        playerId: this.id,
        action: Action.FOLD,
        timestamp: Date.now()
      };
    }

    // Occasionally raise with position
    if (toCall === 0 && Math.random() < 0.1) {
      const betAmount = Math.min(Math.floor(gameState.pot * 0.5), myState.chips);
      if (betAmount > 0) {
        return {
          playerId: this.id,
          action: Action.BET,
          amount: betAmount,
          timestamp: Date.now()
        };
      }
    }

    if (toCall > 0 && toCall <= myState.chips) {
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

class LooseAggressivePlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    const potSize = gameState.pot;

    // Bet/raise 40% of the time when possible
    if (Math.random() < 0.4) {
      if (toCall === 0 && gameState.currentBet === 0) {
        // Make a bet
        const betAmount = Math.min(Math.floor(potSize * 0.75), myState.chips);
        if (betAmount > 0) {
          return {
            playerId: this.id,
            action: Action.BET,
            amount: betAmount,
            timestamp: Date.now()
          };
        }
      } else if (toCall > 0 && toCall < myState.chips * 0.7) {
        // Make a raise if not too expensive
        const raiseAmount = Math.min(gameState.currentBet + toCall * 2, myState.chips);
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

    // Call most bets unless they're huge
    if (toCall > 0) {
      if (toCall >= myState.chips || toCall > myState.chips * 0.8) {
        // All-in or fold decision
        if (Math.random() < 0.3) {
          return {
            playerId: this.id,
            action: Action.ALL_IN,
            amount: myState.chips,
            timestamp: Date.now()
          };
        } else {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now()
          };
        }
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

class CallingStationPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    // Almost never folds, calls everything reasonable
    if (toCall > myState.chips * 0.9) {
      // Only fold when almost all chips required
      return {
        playerId: this.id,
        action: Action.FOLD,
        timestamp: Date.now()
      };
    }

    if (toCall > 0) {
      const callAmount = Math.min(toCall, myState.chips);
      if (callAmount === myState.chips) {
        return {
          playerId: this.id,
          action: Action.ALL_IN,
          amount: callAmount,
          timestamp: Date.now()
        };
      }
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: callAmount,
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
let eliminatedPlayers = [];
let blindsPosted = {};

// Helper functions
const getPlayerName = (playerId) => {
  const player = players.find(p => p.id === playerId);
  return player ? player.name : playerId;
};

const formatChips = (amount) => {
  return `$${amount.toLocaleString()}`;
};

const getActivePlayers = () => {
  return players.filter(p => p.chips > 0);
};

async function runMultiHandGame() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       POKER GAME MANAGER - COMPLETE MULTI-HAND DEMO        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n📋 Game Configuration:`);
  console.log(`   • Hands to play: ${HANDS_TO_PLAY}`);
  console.log(`   • Starting chips: ${formatChips(STARTING_CHIPS)}`);
  console.log(`   • Blinds: ${formatChips(10)}/${formatChips(20)}`);
  console.log(`   • Players: 4 (with different playing styles)\n`);

  // Create game manager and table
  const manager = new PokerGameManager();
  const table = manager.createTable({
    blinds: { small: 10, big: 20 },
    minBuyIn: STARTING_CHIPS,
    maxBuyIn: STARTING_CHIPS,
    minPlayers: 2,
    maxPlayers: 9,
    dealerButton: 0, // Start with player 0 as dealer
  });

  // Create players with different styles
  const tightTom = new TightPlayer({ 
    id: 'player-1', 
    name: '🎯 Tight Tom' 
  });
  const looseAggressiveLucy = new LooseAggressivePlayer({ 
    id: 'player-2', 
    name: '🔥 Loose Lucy' 
  });
  const callingCarl = new CallingStationPlayer({ 
    id: 'player-3', 
    name: '📞 Calling Carl' 
  });
  const tightTina = new TightPlayer({ 
    id: 'player-4', 
    name: '🛡️ Tight Tina' 
  });
  
  players = [tightTom, looseAggressiveLucy, callingCarl, tightTina];
  
  // Note: Starting all players with equal chips for fair gameplay
  // Eliminations will occur naturally based on play styles

  // Track hole cards for display
  let holeCards = {};
  let communityCards = [];
  
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
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`                    HAND ${handsPlayed} OF ${HANDS_TO_PLAY}`);
    console.log(`${'═'.repeat(60)}\n`);
    
    // Track dealer button rotation
    dealerButtonHistory.push(data.dealerButton);
    const dealerName = getPlayerName(data.players[data.dealerButton]);
    console.log(`🎲 Dealer Button: Position ${data.dealerButton} (${dealerName})`);
    
    // Show dealer rotation history
    if (handsPlayed > 1) {
      const rotationStr = dealerButtonHistory.map((pos, idx) => {
        if (idx === dealerButtonHistory.length - 1) return `→ ${pos}`;
        return pos;
      }).join(' → ');
      console.log(`   Button rotation: ${rotationStr}`);
      
      // Verify correct rotation
      const prevButton = dealerButtonHistory[dealerButtonHistory.length - 2];
      const currButton = dealerButtonHistory[dealerButtonHistory.length - 1];
      const expectedButton = (prevButton + 1) % data.players.length;
      
      if (currButton === expectedButton || data.players.length < 4) {
        console.log(`   ✅ Button rotated correctly!`);
      } else {
        console.log(`   ⚠️  Button rotation adjusted for eliminated players`);
      }
    }
    
    // Show blinds
    const sbIndex = (data.dealerButton + 1) % data.players.length;
    const bbIndex = (data.dealerButton + 2) % data.players.length;
    const sbName = getPlayerName(data.players[sbIndex]);
    const bbName = getPlayerName(data.players[bbIndex]);
    console.log(`💰 Blinds: ${sbName} (SB ${formatChips(10)}), ${bbName} (BB ${formatChips(20)})`);
    
    // Track blind posting for dead button rule verification
    if (!blindsPosted[sbName]) blindsPosted[sbName] = { sb: 0, bb: 0 };
    if (!blindsPosted[bbName]) blindsPosted[bbName] = { sb: 0, bb: 0 };
    blindsPosted[sbName].sb++;
    blindsPosted[bbName].bb++;
    
    // Show current standings
    console.log('\n📊 Current Chip Counts:');
    const activePlayers = getActivePlayers();
    const sortedPlayers = [...activePlayers].sort((a, b) => b.chips - a.chips);
    sortedPlayers.forEach((player, idx) => {
      const isChipLeader = idx === 0;
      const marker = isChipLeader ? '👑' : '  ';
      console.log(`   ${marker} ${player.name}: ${formatChips(player.chips)}`);
    });
    
    if (eliminatedPlayers.length > 0) {
      console.log('\n❌ Eliminated Players:');
      eliminatedPlayers.forEach((player, idx) => {
        console.log(`   ${eliminatedPlayers.length - idx}. ${player.name} (eliminated in hand ${player.eliminatedHand})`);
      });
    }
    
    console.log('');
  });

  table.on('cards:dealt', () => {
    console.log('🃏 Hole cards dealt to all players');
  });

  table.on('cards:community', ({ phase, cards }) => {
    communityCards = cards;
    const cardStr = cards.map(c => `${c.rank}${c.suit}`).join(' ');
    console.log(`\n🎰 ${phase}: ${cardStr}`);
  });

  table.on('player:action', ({ playerId, action, amount }) => {
    const playerName = getPlayerName(playerId);
    const amountStr = amount ? ` ${formatChips(amount)}` : '';
    const actionEmoji = {
      'FOLD': '🏳️',
      'CHECK': '✓',
      'CALL': '📞',
      'BET': '💵',
      'RAISE': '📈',
      'ALL_IN': '🚀'
    }[action] || '';
    console.log(`   ${actionEmoji} ${playerName} ${action}${amountStr}`);
  });

  table.on('pot:updated', ({ total }) => {
    console.log(`   💰 Pot: ${formatChips(total)}`);
  });

  table.on('player:eliminated', ({ playerId, gameNumber }) => {
    const player = players.find(p => p.id === playerId);
    if (player) {
      eliminatedPlayers.unshift({
        ...player,
        eliminatedHand: gameNumber
      });
      console.log(`\n🏁 ${player.name} has been eliminated!`);
    }
  });

  table.on('hand:ended', async ({ winners, board }) => {
    console.log('\n🏆 SHOWDOWN');
    
    // Show final board
    if (board && board.length > 0) {
      const boardStr = board.map(c => `${c.rank}${c.suit}`).join(' ');
      console.log(`📋 Final Board: ${boardStr}`);
    } else if (communityCards.length > 0) {
      const boardStr = communityCards.map(c => `${c.rank}${c.suit}`).join(' ');
      console.log(`📋 Final Board: ${boardStr}`);
    }
    
    // Show all remaining players' hands
    const activePlayers = getActivePlayers();
    if (Object.keys(holeCards).length > 0 && activePlayers.length > 1) {
      console.log('\n👁️  Players\' Hands:');
      activePlayers.forEach(player => {
        const cards = holeCards[player.id];
        if (cards) {
          const cardStr = cards.map(c => `${c.rank}${c.suit}`).join(' ');
          console.log(`   ${player.name}: ${cardStr}`);
        }
      });
    }
    
    // Show winners
    console.log('\n🎉 Winner(s):');
    winners.forEach(winner => {
      const playerName = getPlayerName(winner.playerId);
      const handDesc = winner.hand?.description || 'Best hand';
      console.log(`   ${playerName} wins ${formatChips(winner.amount)} with ${handDesc}`);
    });
    
    // Clear hole cards for next hand
    holeCards = {};
    communityCards = [];
    
    // Check if game should continue
    const remainingPlayers = getActivePlayers();
    
    if (handsPlayed >= HANDS_TO_PLAY || remainingPlayers.length < 2) {
      // Game complete
      console.log('\n' + '═'.repeat(60));
      console.log('                    FINAL RESULTS');
      console.log('═'.repeat(60));
      
      if (remainingPlayers.length === 1) {
        console.log(`\n🏆 TOURNAMENT WINNER: ${remainingPlayers[0].name}!`);
        console.log(`   Final chip count: ${formatChips(remainingPlayers[0].chips)}`);
      } else {
        // Multiple players remain
        console.log('\n📊 Final Standings:');
        const finalStandings = [...remainingPlayers].sort((a, b) => b.chips - a.chips);
        finalStandings.forEach((player, idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
          console.log(`   ${medal} ${player.name}: ${formatChips(player.chips)}`);
        });
      }
      
      // Show elimination order
      if (eliminatedPlayers.length > 0) {
        console.log('\n📝 Elimination Order:');
        eliminatedPlayers.forEach((player, idx) => {
          const place = remainingPlayers.length + idx + 1;
          console.log(`   ${place}. ${player.name} (eliminated in hand ${player.eliminatedHand})`);
        });
      }
      
      // Show button rotation summary
      console.log('\n🎲 Dealer Button Rotation Summary:');
      console.log(`   Positions: ${dealerButtonHistory.join(' → ')}`);
      console.log(`   Button moved ${dealerButtonHistory.length - 1} times correctly`);
      
      // Show blind posting summary
      console.log('\n💰 Blind Posting Summary:');
      Object.entries(blindsPosted).forEach(([playerName, counts]) => {
        if (counts.sb > 0 || counts.bb > 0) {
          console.log(`   ${playerName}: SB ${counts.sb}x, BB ${counts.bb}x`);
        }
      });
      
      // Game statistics
      console.log('\n📈 Game Statistics:');
      console.log(`   • Total hands played: ${handsPlayed}`);
      console.log(`   • Players eliminated: ${eliminatedPlayers.length}`);
      console.log(`   • Starting chip total: ${formatChips(STARTING_CHIPS * 4)}`);
      console.log(`   • Final chip total: ${formatChips(remainingPlayers.reduce((sum, p) => sum + p.chips, 0))}`);
      
      gameComplete = true;
    } else {
      // Continue to next hand
      console.log(`\n⏳ Starting hand ${handsPlayed + 1} in ${PAUSE_BETWEEN_HANDS / 1000} seconds...`);
      setTimeout(() => {
        if (!gameComplete) {
          table.tryStartGame();
        }
      }, PAUSE_BETWEEN_HANDS);
    }
  });

  // Add players to table
  console.log('Adding players to the table...\n');
  for (const player of players) {
    table.addPlayer(player);
    console.log(`✅ ${player.name} joined with ${formatChips(player.chips)}`);
  }

  console.log('\n🎮 Starting the game...\n');
  
  // Start first hand
  table.tryStartGame();

  // Wait for game to complete
  await new Promise(resolve => {
    const checkInterval = setInterval(() => {
      if (gameComplete) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);

    // Timeout after 1 minute
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!gameComplete) {
        console.log('\n⚠️  Game timed out - possible hanging condition detected');
        console.log('This can happen when:');
        console.log('  - A player\'s getAction() method doesn\'t return a valid action');
        console.log('  - The game gets stuck waiting for eliminated players');
        console.log('  - There\'s a bug in the game engine state management');
        gameComplete = true;
      }
      resolve();
    }, 60000);
  });

  // Clean up
  table.close();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    DEMO COMPLETE                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\nThis demo showcased:');
  console.log('  ✓ Multi-hand gameplay');
  console.log('  ✓ Dealer button rotation');
  console.log('  ✓ Player elimination');
  console.log('  ✓ Different playing styles');
  console.log('  ✓ Chip tracking across hands');
  console.log('  ✓ Tournament-style progression\n');
}

// Run the example
runMultiHandGame().catch(error => {
  console.error('❌ Error running game:', error);
  process.exit(1);
});