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
  const playerMap = new Map(players.map(p => [p.id, p]));

  // Track game state
  let gameNumber = 0;
  let handNumber = 0;
  let currentBoard = [];
  let playerHoleCards = {};
  let playerChips = {};
  let gameEnded = false;
  let dealerIndex = 0;
  let lastAction = null;
  let blindsPosted = false;

  // Initialize chip counts
  players.forEach(p => {
    playerChips[p.id] = 1000;
  });

  // Function to get ordered players
  function getHandOrder(dealerIdx) {
    const sbIdx = (dealerIdx + 1) % players.length;
    const bbIdx = (dealerIdx + 2) % players.length;
    const order = [];
    
    // In 3-player game: SB, BB, Dealer
    order.push(players[sbIdx]);
    order.push(players[bbIdx]);
    if (players.length > 2) {
      order.push(players[dealerIdx]);
    }
    
    return order;
  }

  // Add event listeners
  table.on('game:started', ({ gameNumber: num }) => {
    gameNumber = num;
    handNumber = 0;
    console.log(`\n========== GAME ${gameNumber} STARTED ==========\n`);
    
    // Only process first game
    if (gameNumber > 1) {
      gameEnded = true;
    }
  });

  table.on('hand:started', ({ dealerButton }) => {
    handNumber++;
    currentBoard = [];
    playerHoleCards = {};
    dealerIndex = dealerButton;
    blindsPosted = false;

    console.log(`== HAND ${handNumber} ==`);

    // Show hand order with chip counts
    const handOrder = getHandOrder(dealerIndex);
    console.log(`Hand order: ${handOrder.map(p => `${p.name} ($${playerChips[p.id]})`).join(', ')}`);
  });

  // Track blinds from pot updates
  table.on('pot:updated', ({ playerBet }) => {
    if (!blindsPosted && playerBet) {
      const player = playerMap.get(playerBet.playerId);
      if (player) {
        const sbIndex = (dealerIndex + 1) % players.length;
        const bbIndex = (dealerIndex + 2) % players.length;
        
        if (playerBet.playerId === players[sbIndex].id && playerBet.amount === 10) {
          console.log(`${player.name} ($${playerChips[player.id]}) puts in a small blind of $${playerBet.amount}.`);
          playerChips[player.id] -= playerBet.amount;
        } else if (playerBet.playerId === players[bbIndex].id && playerBet.amount === 20) {
          console.log(`${player.name} ($${playerChips[player.id]}) puts in a big blind of $${playerBet.amount}.`);
          playerChips[player.id] -= playerBet.amount;
          blindsPosted = true;
        }
      }
    }
  });

  table.on('cards:dealt', ({ playerId, cardCount }) => {
    if (cardCount === 2) {
      // Store that player received hole cards
      const player = playerMap.get(playerId);
      if (player) {
        if (!playerHoleCards[playerId]) {
          playerHoleCards[playerId] = true; // Mark as received
        }
      }
    }
  });

  // Override receivePrivateCards on each player to capture hole cards
  players.forEach(player => {
    const originalReceive = player.receivePrivateCards.bind(player);
    player.receivePrivateCards = function(cards) {
      originalReceive(cards);
      playerHoleCards[player.id] = cards;
      
      // Show hole cards immediately when received
      if (player === raiser) {
        console.log(`${player.name} receives hole cards: [...]`);
      } else {
        console.log(`${player.name} ($${playerChips[player.id]}) receives hole cards: [${cards.map(c => c.toString()).join(' ')}]`);
      }
    };
  });

  table.on('action:requested', ({ playerId, gameState }) => {
    // Print empty line after hole cards if this is the first action
    if (Object.keys(playerHoleCards).length === players.length && !lastAction) {
      console.log('');
    }
    
    const player = playerMap.get(playerId);
    if (!player) return;
    
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

    console.log('');
    console.log(`The pot is $${gameState.pot}. ${gameState.currentBet > 0 ? `Bet is $${gameState.currentBet}. ` : ''}${player.name} ($${playerState.chips}) ${actionOptions}.`);
  });

  // Store player actions as they happen
  players.forEach(player => {
    const originalGetAction = player.getAction.bind(player);
    player.getAction = async function(gameState) {
      const action = await originalGetAction(gameState);
      
      // Display the action immediately
      const myState = gameState.players[player.id];
      const beforeChips = myState.chips;
      let actionStr = '';
      
      switch (action.action) {
        case Action.FOLD:
          actionStr = 'folds';
          break;
        case Action.CHECK:
          actionStr = 'checks';
          break;
        case Action.CALL:
          actionStr = `calls $${action.amount}`;
          playerChips[player.id] = beforeChips - action.amount;
          break;
        case Action.BET:
          actionStr = `bets $${action.amount}`;
          playerChips[player.id] = beforeChips - action.amount;
          break;
        case Action.RAISE:
          actionStr = `raises to $${action.amount}`;
          playerChips[player.id] = beforeChips - action.amount;
          break;
        case Action.ALL_IN:
          actionStr = `goes all-in for $${action.amount}`;
          playerChips[player.id] = beforeChips - action.amount;
          break;
      }

      console.log('');
      console.log(`${player.name} ($${beforeChips}) ${actionStr}.`);
      lastAction = action;
      
      return action;
    };
  });

  table.on('round:ended', ({ phase, communityCards }) => {
    if (communityCards && communityCards.length > 0) {
      currentBoard = communityCards;
      const phaseNames = {
        [GamePhase.FLOP]: 'FLOP',
        [GamePhase.TURN]: 'TURN',
        [GamePhase.RIVER]: 'RIVER',
      };

      const nextPhase = phaseNames[phase];
      if (nextPhase) {
        console.log(`Play advances to the next phase (${nextPhase}).`);
        console.log(`Board: [${currentBoard.map(c => c.toString()).join(' ')}]`);
      }
    }
  });

  table.on('hand:ended', ({ winners, payouts, hands }) => {
    const potTotal = Object.values(payouts).reduce((sum, v) => sum + v, 0);
    console.log(`The pot is $${potTotal}. Play advances to the next phase (SHOWDOWN).`);
    console.log('');
    console.log(`Board: [${currentBoard.map(c => c.toString()).join(' ')}]`);

    // Show all hands
    if (hands) {
      hands.forEach(({ playerId, hand }) => {
        const player = playerMap.get(playerId);
        if (player && playerHoleCards[playerId]) {
          const holeCards = playerHoleCards[playerId];
          const handDesc = hand.description;
          const bestCards = hand.cards.slice(0, 5).map(c => c.toString()).join(' ');
          console.log(`${player.name} ($${playerChips[playerId]}) [${holeCards.map(c => c.toString()).join(' ')}] has ${handDesc} [${bestCards}]`);
        }
      });
    }

    // Show winner and update chips
    winners.forEach(({ playerId, amount }) => {
      const player = playerMap.get(playerId);
      if (player) {
        playerChips[playerId] += amount;
        console.log(`${player.name} ($${playerChips[playerId]}) wins $${amount}.`);
      }
    });

    console.log('');
  });

  table.on('game:ended', ({ finalStandings }) => {
    console.log('\n========== GAME ENDED ==========');
    console.log('\nFinal chip counts:');
    
    if (finalStandings) {
      finalStandings.forEach(({ playerId, chips }) => {
        const player = playerMap.get(playerId);
        if (player) {
          console.log(`${player.name}: $${chips}`);
        }
      });
    } else {
      // Fallback to our tracked chips
      players.forEach(player => {
        console.log(`${player.name}: $${playerChips[player.id] || 0}`);
      });
    }
    
    gameEnded = true;
  });

  // Add players to table
  table.addPlayer(folder);
  table.addPlayer(caller);
  table.addPlayer(raiser);

  // Wait for one game to complete
  await new Promise(resolve => {
    const checkInterval = setInterval(() => {
      if (gameEnded) {
        clearInterval(checkInterval);
        // Wait a bit for final output then close
        setTimeout(() => {
          table.close();
          resolve();
        }, 100);
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