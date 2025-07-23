import { PokerGameManager, Player, Action, TableState } from '../packages/core/src/index.js';

// Simple player implementations
class FoldingPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    
    if (toCall === 0) {
      return { playerId: this.id, action: Action.CHECK, timestamp: Date.now() };
    }
    return { playerId: this.id, action: Action.FOLD, timestamp: Date.now() };
  }
}

class CallingPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    
    if (toCall === 0) {
      return { playerId: this.id, action: Action.CHECK, timestamp: Date.now() };
    }
    
    const callAmount = Math.min(toCall, myState.chips);
    return {
      playerId: this.id,
      action: callAmount === myState.chips ? Action.ALL_IN : Action.CALL,
      amount: callAmount,
      timestamp: Date.now(),
    };
  }
}

class AggressivePlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    const potSize = gameState.pot;
    const raiseAmount = Math.floor(potSize / 2);
    
    if (myState.chips <= toCall) {
      return { playerId: this.id, action: Action.ALL_IN, amount: myState.chips, timestamp: Date.now() };
    }
    
    if (toCall === 0 && raiseAmount > 0 && raiseAmount <= myState.chips) {
      return { playerId: this.id, action: Action.BET, amount: raiseAmount, timestamp: Date.now() };
    } else if (toCall > 0) {
      const totalBet = gameState.currentBet + raiseAmount;
      const myTotalBet = totalBet - myState.bet;
      
      if (myTotalBet <= myState.chips && raiseAmount >= gameState.currentBet) {
        return { playerId: this.id, action: Action.RAISE, amount: totalBet, timestamp: Date.now() };
      } else {
        return { playerId: this.id, action: Action.CALL, amount: toCall, timestamp: Date.now() };
      }
    }
    
    return { playerId: this.id, action: Action.CHECK, timestamp: Date.now() };
  }
}

async function runSingleGame() {
  console.log('========== POKER GAME SIMULATION ==========\n');
  
  const manager = new PokerGameManager();
  const table = manager.createTable({
    blinds: { small: 10, big: 20 },
    minBuyIn: 1000,
    maxBuyIn: 1000,
  });
  
  // Create players
  const players = [
    new FoldingPlayer({ name: 'Fearful Fred' }),
    new CallingPlayer({ name: 'Calling Carl' }),
    new AggressivePlayer({ name: 'Aggressive Amy' }),
  ];
  
  // Add event listeners
  table.gameEngine?.on('hand:started', ({ dealerIndex, smallBlindIndex, bigBlindIndex }) => {
    console.log(`Fearful Fred posts small blind $10`);
    console.log(`Calling Carl posts big blind $20`);
  });
  
  table.gameEngine?.on('cards:dealt', ({ phase, playerCards }) => {
    console.log(`\n--- ${phase} ---`);
    if (playerCards) {
      players.forEach(player => {
        const cards = playerCards[player.id];
        if (cards) {
          console.log(`${player.name} receives: ${cards.map(c => c.toString()).join(' ')}`);
        }
      });
    }
  });
  
  table.gameEngine?.on('cards:community', ({ cards }) => {
    console.log(`Community cards: ${cards.map(c => c.toString()).join(' ')}`);
  });
  
  table.gameEngine?.on('player:action', ({ playerId, action, amount }) => {
    const player = players.find(p => p.id === playerId);
    console.log(`${player.name} ${action}${amount ? ` $${amount}` : ''}`);
  });
  
  table.gameEngine?.on('pot:updated', ({ total }) => {
    console.log(`Pot: $${total}`);
  });
  
  table.gameEngine?.on('hand:complete', ({ winners, payouts }) => {
    console.log('\n--- SHOWDOWN ---');
    winners.forEach(winner => {
      const player = players.find(p => p.id === winner.playerId);
      console.log(`${player.name} wins $${payouts[player.id]} with ${winner.hand.description}`);
      console.log(`Winning hand: ${winner.hand.cards.map(c => c.toString()).join(' ')}`);
    });
  });
  
  // Add players
  players.forEach(player => table.addPlayer(player));
  
  // Wait for game to end
  await new Promise(resolve => {
    table.on('game:ended', ({ finalChips }) => {
      console.log('\n========== FINAL CHIP COUNTS ==========');
      players.forEach(player => {
        console.log(`${player.name}: $${finalChips[player.id] || 0}`);
      });
      
      // Prevent new games from starting
      table.state = TableState.CLOSED;
      resolve();
    });
  });
  
  console.log('\n========== SIMULATION COMPLETE ==========');
  process.exit(0);
}

runSingleGame().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});