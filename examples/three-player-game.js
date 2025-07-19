import { PokerGameManager, Player, Action } from '../packages/core/src/index.js';

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
  
  // Add event listeners
  table.on('game:started', ({ gameNumber }) => {
    console.log(`\n========== GAME ${gameNumber} STARTED ==========\n`);
  });
  
  table.on('player:action', ({ playerId, action, amount }) => {
    const player = [folder, caller, raiser].find(p => p.id === playerId);
    console.log(`${player.name} ${action}${amount ? ` $${amount}` : ''}`);
  });
  
  table.on('cards:dealt', ({ phase, cards }) => {
    if (cards && cards.length > 0) {
      console.log(`\n--- ${phase} ---`);
      console.log(`Community cards: ${cards.join(' ')}`);
    }
  });
  
  table.on('pot:updated', ({ total }) => {
    console.log(`Pot size: $${total}`);
  });
  
  table.on('blinds:posted', ({ small, big }) => {
    const smallPlayer = [folder, caller, raiser].find(p => p.id === small.playerId);
    const bigPlayer = [folder, caller, raiser].find(p => p.id === big.playerId);
    console.log(`${smallPlayer.name} posts small blind $${small.amount}`);
    console.log(`${bigPlayer.name} posts big blind $${big.amount}`);
  });
  
  table.on('game:ended', ({ winners, payouts }) => {
    console.log('\n--- SHOWDOWN ---');
    winners.forEach(winner => {
      const player = [folder, caller, raiser].find(p => p.id === winner.playerData.player.id);
      console.log(`${player.name} wins with ${winner.hand.description}!`);
      console.log(`Hand: ${winner.hand.cards.map(c => c.toString()).join(' ')}`);
    });
    console.log('\nPayouts:');
    Object.entries(payouts).forEach(([playerId, amount]) => {
      const player = [folder, caller, raiser].find(p => p.id === playerId);
      console.log(`${player.name}: $${amount}`);
    });
  });
  
  // Handle hole cards being dealt
  folder.receivePrivateCards = function(cards) {
    console.log(`\n${this.name} receives hole cards: [** **]`);
  };
  caller.receivePrivateCards = function(cards) {
    console.log(`${this.name} receives hole cards: [** **]`);
  };
  raiser.receivePrivateCards = function(cards) {
    console.log(`${this.name} receives hole cards: [** **]`);
  };
  
  // Add players to table
  table.addPlayer(folder);
  table.addPlayer(caller);
  table.addPlayer(raiser);
  
  // Game will start automatically when minimum players are reached
  // Wait for ONE game to complete
  await new Promise(resolve => {
    let gameEnded = false;
    table.on('game:ended', () => {
      if (!gameEnded) {
        gameEnded = true;
        // Stop new games from starting
        table.state = 'PAUSED';
        setTimeout(resolve, 100);
      }
    });
  });
  
  // Check final chip counts
  console.log('\n========== FINAL CHIP COUNTS ==========');
  [folder, caller, raiser].forEach(player => {
    const playerData = table.players.get(player.id);
    console.log(`${player.name}: $${playerData.chips}`);
  });
}

// Run the example
runSimulation().catch(console.error);