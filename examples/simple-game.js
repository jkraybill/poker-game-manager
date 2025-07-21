import { PokerGameManager, Player, Action } from '../packages/core/src/index.js';

// Simple player implementations with lastAction awareness
class FoldingPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    if (toCall === 0) {
      console.log(`${this.name} checks`);
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now()
      };
    }

    console.log(`${this.name} folds to $${toCall} bet`);
    return {
      playerId: this.id,
      action: Action.FOLD,
      timestamp: Date.now()
    };
  }
}

class CallingPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    // Show awareness of other players' actions
    const raisers = Object.values(gameState.players)
      .filter(p => p.lastAction === Action.RAISE).length;

    if (raisers > 0) {
      console.log(`${this.name} sees ${raisers} player(s) raised`);
    }

    if (toCall === 0) {
      console.log(`${this.name} checks`);
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now()
      };
    }

    const callAmount = Math.min(toCall, myState.chips);
    if (callAmount === myState.chips) {
      console.log(`${this.name} goes all-in for $${callAmount}`);
      return {
        playerId: this.id,
        action: Action.ALL_IN,
        amount: callAmount,
        timestamp: Date.now(),
      };
    }

    console.log(`${this.name} calls $${callAmount}`);
    return {
      playerId: this.id,
      action: Action.CALL,
      amount: callAmount,
      timestamp: Date.now(),
    };
  }
}

class AggressivePlayer extends Player {
  constructor(config) {
    super(config);
    this.hasRaised = false; // Track if we've raised this round
  }

  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    const potSize = gameState.pot;

    // Reset hasRaised flag on new betting round
    if (gameState.phase !== this.lastPhase) {
      this.hasRaised = false;
      this.lastPhase = gameState.phase;
    }

    // Check for squeeze play opportunity using lastAction
    const raisers = Object.values(gameState.players)
      .filter(p => p.lastAction === Action.RAISE).length;
    const callers = Object.values(gameState.players)
      .filter(p => p.lastAction === Action.CALL).length;

    if (raisers === 1 && callers >= 1 && toCall > 0 && !this.hasRaised) {
      const squeezeAmount = Math.min(toCall * 3, myState.chips);
      console.log(`${this.name} attempts squeeze play!`);
      this.hasRaised = true;
      if (squeezeAmount === myState.chips) {
        return {
          playerId: this.id,
          action: Action.ALL_IN,
          amount: myState.chips,
          timestamp: Date.now()
        };
      }
      return {
        playerId: this.id,
        action: Action.RAISE,
        amount: gameState.currentBet + squeezeAmount,
        timestamp: Date.now()
      };
    }

    // Standard aggressive play
    if (myState.chips <= toCall) {
      console.log(`${this.name} goes all-in for $${myState.chips}`);
      return {
        playerId: this.id,
        action: Action.ALL_IN,
        amount: myState.chips,
        timestamp: Date.now()
      };
    }

    // Only bet/raise once per round unless re-raised
    if (!this.hasRaised && myState.lastAction !== Action.RAISE) {
      const raiseAmount = Math.floor(potSize / 2);

      if (toCall === 0 && raiseAmount > 0) {
        const betAmount = Math.min(raiseAmount, myState.chips);
        console.log(`${this.name} bets $${betAmount}`);
        this.hasRaised = true;
        return {
          playerId: this.id,
          action: Action.BET,
          amount: betAmount,
          timestamp: Date.now()
        };
      } else if (toCall > 0 && raiseAmount >= gameState.currentBet) {
        const totalBet = gameState.currentBet + raiseAmount;
        const myTotalBet = totalBet - myState.bet;

        if (myTotalBet <= myState.chips) {
          console.log(`${this.name} raises to $${totalBet}`);
          this.hasRaised = true;
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: totalBet,
            timestamp: Date.now()
          };
        }
      }
    }

    // If we've already raised or can't raise profitably, just call or check
    if (toCall > 0) {
      console.log(`${this.name} calls $${toCall}`);
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now()
      };
    }

    console.log(`${this.name} checks`);
    return {
      playerId: this.id,
      action: Action.CHECK,
      timestamp: Date.now()
    };
  }
}

 const logEvent = (source, eventName, data) => {
    const timestamp = new Date().toTimeString().split(' ')[0];

    // Special formatting for key events
    switch (eventName) {
      case 'player:action':
        console.log(`** [${timestamp}] [${source}] ${eventName}: ${data.playerId} ${data.action} ${data.amount ? `$${data.amount}` : ''}`);
        break;
      case 'hand:ended':
        const winners = data.winners?.map(w => `${w.playerId}($${w.amount})`).join(', ') || 'none';
        console.log(`** [${timestamp}] [${source}] ${eventName}: Winners: ${winners}`);
        break;
      case 'cards:community':
        console.log(`** [${timestamp}] [${source}] ${eventName}: ${data.phase} - ${data.cards?.join(', ')}`);
        break;
      default:
        console.log(`** [${timestamp}] [${source}] ${eventName}:`, JSON.stringify(data));
    }
  };

async function runGame() {
  console.log('=== POKER GAME MANAGER - EXAMPLE GAME ===\n');

  const manager = new PokerGameManager();
  const table = manager.createTable({
    blinds: { small: 10, big: 20 },
    minBuyIn: 1000,
    maxBuyIn: 1000,
    minPlayers: 3,
    dealerButton: 0, // Deterministic for example
  });

  // Create players
  const folder = new FoldingPlayer({ name: 'Fearful Fred' });
  const caller = new CallingPlayer({ name: 'Calling Carl' });
  const raiser = new AggressivePlayer({ name: 'Aggressive Amy' });

  // Track game state
  let currentPhase = '';
  let gameNumber = 0;
  let handComplete = false;
  let communityCards = [];
  let holeCards = {};

  // Event listeners
  table.on('game:started', ({ gameNumber: num }) => {
    gameNumber = num;
    console.log(`\n*========== GAME ${num} STARTED ==========\n`);
  });

  table.on('hand:started', ({ dealerButton }) => {
    const players = [folder, caller, raiser];
    console.log(`*Dealer button at position: ${dealerButton}`);

    // Calculate positions based on dealer button
    const sbIndex = (dealerButton + 1) % 3;
    const bbIndex = (dealerButton + 2) % 3;

    console.log(`*Small blind: ${players[sbIndex].name} posts $10`);
    console.log(`*Big blind: ${players[bbIndex].name} posts $20`);
    console.log('');
  });

  table.on('round:started', ({ phase }) => {
    currentPhase = phase;
    if (phase !== 'PRE_FLOP') {
      console.log(`*\n--- ${phase} ---`);
    }
  });

  table.on('cards:community', ({ phase, cards }) => {
    if (phase === 'FLOP') {
      communityCards = [...cards];
      console.log(`*Flop: ${cards.join(' ')}`);
    } else if (phase === 'TURN') {
      communityCards = [...cards];
      console.log(`*Turn: ${cards[cards.length - 1]} (Board: ${cards.join(' ')})`);
    } else if (phase === 'RIVER') {
      communityCards = [...cards];
      console.log(`*River: ${cards[cards.length - 1]} (Board: ${cards.join(' ')})`);
    }
  });

  table.on('player:action', ({ playerId, action, amount }) => {
    // Actions are already logged by player classes
  });

  table.on('pot:updated', ({ total }) => {
    console.log(`*Pot: $${total}\n`);
  });

  table.on('hand:ended', ({ winners }) => {
    console.log('\n--- SHOWDOWN ---');
    console.log(`*Final board: ${communityCards.join(' ')}`);
    console.log('');

    // Show all players' hands
    const players = [folder, caller, raiser];
    const activePlayers = players.filter(player => {
      const playerData = table.players.get(player.id);
      return playerData && playerData.state !== 'FOLDED';
    });

    console.log('Players\' hands:');
    activePlayers.forEach(player => {
      const cards = holeCards[player.id];
      if (cards) {
        console.log(`${player.name}: ${cards.join(' ')}`);
      }
    });
    console.log('');

    // Show winners
    winners.forEach(winner => {
      const player = players.find(p => p.id === winner.playerId);
      console.log(`${player.name} wins $${winner.amount}!`);
      if (winner.hand && winner.hand.descr) {
        console.log(`Winning hand: ${winner.hand.descr}`);
      }
    });

    console.log('\n--- CHIP COUNTS ---');
    players.forEach(player => {
      const playerData = table.players.get(player.id);
      if (playerData) {
        console.log(`${player.name}: $${playerData.chips}`);
      }
    });

    handComplete = true;
  });

  manager.on('*', (eventName, data) => logEvent('MANAGER', eventName, data));
  table.on('*', (eventName, data) => logEvent('TABLE', eventName, data));


  // Override receivePrivateCards to show and store hole cards
  const players = [folder, caller, raiser];
  players.forEach(player => {
    const originalReceiveCards = player.receivePrivateCards.bind(player);
    player.receivePrivateCards = function(cards) {
      originalReceiveCards(cards);
      holeCards[this.id] = cards;
      console.log(`${this.name} receives: ${cards.join(' ')}`);
    };
  });

  // Add players
  console.log('Players joining table...');
  table.addPlayer(folder);
  table.addPlayer(caller);
  table.addPlayer(raiser);

  console.log('\nStarting game...');
  // IMPORTANT: Must explicitly start the game
  table.tryStartGame();

  // Wait for hand to complete
  await new Promise(resolve => {
    const checkInterval = setInterval(() => {
      if (handComplete) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      console.log('\nGame timed out');
      resolve();
    }, 10000);
  });

  // Clean up
  table.close();

  console.log('\n=== EXAMPLE COMPLETE ===');
  process.exit(0);
}

// Run the example
runGame().catch(error => {
  console.error('Error running game:', error);
  process.exit(1);
});