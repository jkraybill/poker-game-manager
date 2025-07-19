import { PokerGameManager, Player, Action } from '../packages/core/src/index.js';

// Simple player implementations
class FoldingPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    
    if (toCall === 0) {
      console.log(`${this.name} checks`);
      return { playerId: this.id, action: Action.CHECK, timestamp: Date.now() };
    }
    
    console.log(`${this.name} folds`);
    return { playerId: this.id, action: Action.FOLD, timestamp: Date.now() };
  }
}

class CallingPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    
    if (toCall === 0) {
      console.log(`${this.name} checks`);
      return { playerId: this.id, action: Action.CHECK, timestamp: Date.now() };
    }
    
    const callAmount = Math.min(toCall, myState.chips);
    console.log(`${this.name} calls $${callAmount}`);
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
      console.log(`${this.name} goes all-in for $${myState.chips}`);
      return { playerId: this.id, action: Action.ALL_IN, amount: myState.chips, timestamp: Date.now() };
    }
    
    if (toCall === 0 && raiseAmount > 0) {
      const betAmount = Math.min(raiseAmount, myState.chips);
      console.log(`${this.name} bets $${betAmount}`);
      return { playerId: this.id, action: Action.BET, amount: betAmount, timestamp: Date.now() };
    } else if (toCall > 0) {
      const totalBet = gameState.currentBet + raiseAmount;
      const myTotalBet = totalBet - myState.bet;
      
      if (myTotalBet <= myState.chips && raiseAmount >= gameState.currentBet) {
        console.log(`${this.name} raises to $${totalBet}`);
        return { playerId: this.id, action: Action.RAISE, amount: totalBet, timestamp: Date.now() };
      } else {
        console.log(`${this.name} calls $${toCall}`);
        return { playerId: this.id, action: Action.CALL, amount: toCall, timestamp: Date.now() };
      }
    }
    
    console.log(`${this.name} checks`);
    return { playerId: this.id, action: Action.CHECK, timestamp: Date.now() };
  }
}

async function runGame() {
  console.log('=== POKER GAME MANAGER - EXAMPLE GAME ===\n');
  
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
  
  // Track game phases
  let currentPhase = '';
  let gameNumber = 0;
  let gameComplete = false;
  
  // Event listeners
  table.on('game:started', ({ gameNumber: num }) => {
    gameNumber = num;
    console.log(`\n========== GAME ${num} STARTED ==========\n`);
  });
  
  table.on('hand:started', ({ dealerIndex, smallBlindIndex, bigBlindIndex }) => {
    const players = [folder, caller, raiser];
    console.log(`Dealer: ${players[dealerIndex].name}`);
    console.log(`Small blind: ${players[smallBlindIndex].name} ($10)`);
    console.log(`Big blind: ${players[bigBlindIndex].name} ($20)`);
    console.log('');
  });
  
  table.on('cards:dealt', ({ phase }) => {
    currentPhase = phase;
    console.log(`\n--- ${phase} ---`);
  });
  
  table.on('cards:community', ({ cards }) => {
    console.log(`Community cards: ${cards.map(c => c.toString()).join(' ')}`);
    console.log('');
  });
  
  table.on('pot:updated', ({ total }) => {
    console.log(`Pot: $${total}\n`);
  });
  
  table.on('hand:complete', ({ winners, payouts }) => {
    console.log('\n--- SHOWDOWN ---');
    winners.forEach(winner => {
      const player = [folder, caller, raiser].find(p => p.id === winner.playerData.player.id);
      console.log(`${player.name} wins $${payouts[player.id]} with ${winner.hand.description}`);
      console.log(`Cards: ${winner.hand.cards.map(c => c.toString()).join(' ')}`);
    });
  });
  
  table.on('game:ended', ({ finalChips }) => {
    console.log('\n========== GAME ENDED ==========');
    console.log('\nFinal chip counts:');
    [folder, caller, raiser].forEach(player => {
      console.log(`${player.name}: $${finalChips[player.id] || 0}`);
    });
    gameComplete = true;
  });
  
  // Add hole card notifications
  const players = [folder, caller, raiser];
  players.forEach(player => {
    player.receivePrivateCards = function(cards) {
      console.log(`${this.name} receives: ${cards.map(c => c.toString()).join(' ')}`);
    };
  });
  
  // Add players
  console.log('Players joining table...');
  table.addPlayer(folder);
  table.addPlayer(caller);
  table.addPlayer(raiser);
  
  // Wait for one game
  await new Promise(resolve => {
    const checkInterval = setInterval(() => {
      if (gameComplete) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });
  
  console.log('\n=== EXAMPLE COMPLETE ===');
  process.exit(0);
}

runGame().catch(console.error);