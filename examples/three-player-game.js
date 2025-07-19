import { PokerGameManager, Player, Action, GamePhase } from '../packages/core/src/index.js';

// Player that always folds
class FoldingPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    
    // Always fold unless we can check
    if (toCall === 0) {
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now(),
      };
    }
    
    return {
      playerId: this.id,
      action: Action.FOLD,
      timestamp: Date.now(),
    };
  }
}

// Player that always calls
class CallingPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    
    if (toCall === 0) {
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now(),
      };
    }
    
    // Call up to all-in
    const callAmount = Math.min(toCall, myState.chips);
    return {
      playerId: this.id,
      action: callAmount === myState.chips ? Action.ALL_IN : Action.CALL,
      amount: callAmount,
      timestamp: Date.now(),
    };
  }
}

// Player that always raises half the pot
class AggressivePlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    const potSize = gameState.pot;
    
    // Calculate half-pot raise
    const raiseAmount = Math.floor(potSize / 2);
    const totalBet = gameState.currentBet + raiseAmount;
    const myTotalBet = totalBet - myState.bet;
    
    // If we can't afford the raise, just call or go all-in
    if (myTotalBet >= myState.chips) {
      return {
        playerId: this.id,
        action: Action.ALL_IN,
        amount: myState.chips,
        timestamp: Date.now(),
      };
    }
    
    // If it's already a big bet relative to our stack, just call
    if (toCall > myState.chips * 0.5) {
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now(),
      };
    }
    
    // Otherwise, raise half the pot
    if (toCall === 0 && raiseAmount > 0) {
      return {
        playerId: this.id,
        action: Action.BET,
        amount: raiseAmount,
        timestamp: Date.now(),
      };
    } else if (raiseAmount > gameState.currentBet) {
      return {
        playerId: this.id,
        action: Action.RAISE,
        amount: totalBet,
        timestamp: Date.now(),
      };
    } else {
      // Just call if raise would be too small
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now(),
      };
    }
  }
}

// Run the simulation
async function runSimulation() {
  const manager = new PokerGameManager();
  
  const table = manager.createTable({
    blinds: { small: 10, big: 20 },
    minBuyIn: 1000,
    maxBuyIn: 1000,
  });
  
  // Create players
  const folder = new FoldingPlayer({ name: 'Fearful Fred' });
  const caller = new CallingPlayer({ name: 'Calling Carl' });
  const raiser = new AggressivePlayer({ name: 'Aggressive Amy' });
  const players = [folder, caller, raiser];
  
  // Track game state
  let gameNumber = 0;
  let handNumber = 0;
  let currentBoard = [];
  let playerHoleCards = {};
  let playerChips = {};
  let gameEnded = false;
  
  // Initialize chip counts
  players.forEach(p => {
    playerChips[p.id] = 1000;
  });
  
  // Add event listeners
  table.on('game:started', ({ gameNumber: num }) => {
    gameNumber = num;
    handNumber = 0;
    console.log(`\n========== GAME ${gameNumber} STARTED ==========\n`);
  });
  
  // Listen to game engine events after game starts
  table.on('game:started', () => {
    const engine = table.gameEngine;
    
    engine.on('hand:started', ({ dealerIndex, smallBlind, bigBlind }) => {
      handNumber++;
      currentBoard = [];
      playerHoleCards = {};
      
      console.log(`== HAND ${handNumber} ==`);
      
      // Show hand order with chip counts
      const handOrder = [];
      const dealerPlayer = players[dealerIndex];
      const sbIndex = (dealerIndex + 1) % players.length;
      const bbIndex = (dealerIndex + 2) % players.length;
      
      // Order: SB, BB, Dealer (in 3-player game)
      handOrder.push(players[sbIndex]);
      handOrder.push(players[bbIndex]);
      handOrder.push(dealerPlayer);
      
      console.log(`Hand order: ${handOrder.map(p => `${p.name} ($${playerChips[p.id]})`).join(', ')}`);
      
      // Update chips for blinds
      playerChips[smallBlind.playerId] -= smallBlind.amount;
      playerChips[bigBlind.playerId] -= bigBlind.amount;
      
      const sbPlayer = players.find(p => p.id === smallBlind.playerId);
      const bbPlayer = players.find(p => p.id === bigBlind.playerId);
      
      console.log(`${sbPlayer.name} ($${playerChips[sbPlayer.id] + smallBlind.amount}) puts in a small blind of $${smallBlind.amount}.`);
      console.log(`${bbPlayer.name} ($${playerChips[bbPlayer.id] + bigBlind.amount}) puts in a big blind of $${bigBlind.amount}.`);
      console.log('');
    });
    
    engine.on('cards:dealt', ({ phase, playerCards }) => {
      if (phase === GamePhase.PRE_FLOP && playerCards) {
        // Store hole cards
        Object.entries(playerCards).forEach(([playerId, cards]) => {
          playerHoleCards[playerId] = cards;
          const player = players.find(p => p.id === playerId);
          console.log(`${player.name} ($${playerChips[playerId]}) receives hole cards: [${cards.map(c => c.toString()).join(' ')}]`);
        });
        console.log('');
      }
    });
    
    engine.on('action:requested', ({ playerId, gameState }) => {
      const player = players.find(p => p.id === playerId);
      const playerState = gameState.players[playerId];
      const toCall = gameState.currentBet - playerState.bet;
      
      let actionOptions = '';
      if (toCall === 0) {
        actionOptions = 'to check or bet';
      } else if (toCall >= playerState.chips) {
        actionOptions = `to go all-in for $${playerState.chips} or fold`;
      } else {
        actionOptions = `to call $${toCall}, raise, or fold`;
      }
      
      console.log(`The pot is $${gameState.pot}. ${gameState.currentBet > 0 ? `Bet is $${gameState.currentBet}. ` : ''}${player.name} ($${playerState.chips}) ${actionOptions}.`);
      console.log('');
    });
    
    engine.on('player:action', ({ playerId, action, amount }) => {
      const player = players.find(p => p.id === playerId);
      const beforeChips = playerChips[playerId];
      
      // Update chip counts
      if (amount) {
        playerChips[playerId] -= amount;
      }
      
      let actionStr = '';
      switch (action) {
        case Action.FOLD:
          actionStr = 'folds';
          break;
        case Action.CHECK:
          actionStr = 'checks';
          break;
        case Action.CALL:
          actionStr = 'calls';
          break;
        case Action.BET:
          actionStr = `bets $${amount}`;
          break;
        case Action.RAISE:
          actionStr = `raises to $${amount}`;
          break;
        case Action.ALL_IN:
          actionStr = `goes all-in for $${amount}`;
          break;
      }
      
      console.log(`${player.name} ($${beforeChips}) ${actionStr}.`);
    });
    
    engine.on('cards:community', ({ phase, cards }) => {
      currentBoard = cards;
      const phaseNames = {
        [GamePhase.FLOP]: 'FLOP',
        [GamePhase.TURN]: 'TURN',
        [GamePhase.RIVER]: 'RIVER',
      };
      
      console.log(`Play advances to the next phase (${phaseNames[phase]}).`);
      console.log(`Board: [${currentBoard.map(c => c.toString()).join(' ')}]`);
    });
    
    engine.on('pot:updated', ({ total }) => {
      // This is handled inline with actions
    });
    
    engine.on('hand:complete', async ({ winners, payouts }) => {
      console.log(`The pot is $${Object.values(payouts).reduce((sum, v) => sum + v, 0)}. Play advances to the next phase (SHOWDOWN).`);
      console.log('');
      console.log(`Board: [${currentBoard.map(c => c.toString()).join(' ')}]`);
      
      // Show all hands from the winners array (which has full hand info)
      // First, show all active players' hands
      const activePlayers = [];
      for (const playerData of engine.players) {
        if (playerData.state === 'ACTIVE' || playerData.state === 'ALL_IN') {
          activePlayers.push(playerData);
        }
      }
      
      // Show each active player's hand
      for (const playerData of activePlayers) {
        const player = players.find(p => p.id === playerData.player.id);
        const holeCards = playerHoleCards[player.id];
        const winnerInfo = winners.find(w => w.playerId === player.id);
        
        if (winnerInfo && winnerInfo.hand) {
          // Format hand type
          let handType = winnerInfo.hand.description.toLowerCase();
          if (handType.includes('two pair')) {
            handType = '2 pair';
          } else if (handType.includes('one pair') || handType.includes('pair')) {
            handType = '1 pair';
          } else if (handType.includes('three of a kind')) {
            handType = '3 of a kind';
          } else if (handType.includes('four of a kind')) {
            handType = '4 of a kind';
          } else if (handType.includes('full house')) {
            handType = 'full house';
          } else if (handType.includes('flush')) {
            handType = 'flush';
          } else if (handType.includes('straight')) {
            handType = 'straight';
          } else if (handType.includes('high card')) {
            handType = 'high card';
          }
          
          console.log(`${player.name} ($${playerChips[player.id]}) [${holeCards.map(c => c.toString()).join(' ')}] has ${handType} [${winnerInfo.hand.cards.map(c => c.toString()).join(' ')}]`);
        } else {
          // For non-winners, just show hole cards
          console.log(`${player.name} ($${playerChips[player.id]}) [${holeCards.map(c => c.toString()).join(' ')}]`);
        }
      }
      
      // Show winner and update chips
      winners.forEach(winner => {
        const player = players.find(p => p.id === winner.playerId);
        const winAmount = payouts[player.id];
        playerChips[player.id] += winAmount;
        console.log(`${player.name} ($${playerChips[player.id]}) wins $${winAmount}.`);
      });
      
      console.log('');
    });
    
    engine.on('game:ended', ({ finalChips }) => {
      console.log('\n========== GAME ENDED ==========');
      console.log('\nFinal chip counts:');
      players.forEach(player => {
        console.log(`${player.name}: $${finalChips[player.id] || 0}`);
      });
      gameEnded = true;
    });
  });
  
  // Add players to table
  table.addPlayer(folder);
  table.addPlayer(caller);
  table.addPlayer(raiser);
  
  // Wait for one game
  await new Promise(resolve => {
    const checkInterval = setInterval(() => {
      if (gameEnded) {
        clearInterval(checkInterval);
        // Close the table to prevent more games
        table.close();
        resolve();
      }
    }, 100);
    
    // Safety timeout
    setTimeout(() => {
      clearInterval(checkInterval);
      table.close();
      resolve();
    }, 30000); // 30 second timeout
  });
  
  console.log('\n=== SIMULATION COMPLETE ===');
}

// Run the example
runSimulation().catch(console.error);