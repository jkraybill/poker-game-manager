import { PokerGameManager, Player, Action } from '../packages/core/src/index.js';

// Simple player implementations with lastAction awareness
class FoldingPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    if (toCall === 0) {
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now()
      };
    }

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
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now()
      };
    }

    const callAmount = Math.min(toCall, myState.chips);
    if (callAmount === myState.chips) {
      return {
        playerId: this.id,
        action: Action.ALL_IN,
        amount: callAmount,
        timestamp: Date.now(),
      };
    }

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

      if (toCall === 0 && gameState.currentBet === 0 && raiseAmount > 0) {
        const betAmount = Math.min(raiseAmount, myState.chips);
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

    return {
      playerId: this.id,
      action: Action.CHECK,
      timestamp: Date.now()
    };
  }
}

// Players array that will be populated later
let players = [];

 // Helper to get player name from ID
  const getPlayerName = (playerId) => {
    const player = players.find(p => p.id === playerId);
    return player ? player.name : playerId;
  };

 const logEvent = (source, eventName, data) => {
    const timestamp = new Date().toTimeString().split(' ')[0];

    // Special formatting for key events
    switch (eventName) {
      case 'player:joined':
        console.log(`[${timestamp}] [${source}] ${eventName}: ${data.player.name} joined in seat ${data.seatNumber}.`);
        break;
      case 'table:ready':
        console.log(`[${timestamp}] [${source}] ${eventName}: ${data.playerCount} are at table (min ${data.minPlayers}), table is ready for a deal.`);
        break;
      case 'game:started':
        console.log(`[${timestamp}] [${source}] ${eventName}: game started with ${data.players.length} players.`);
        break;
      case 'hand:started':
        console.log(`[${timestamp}] [${source}] ${eventName}: hand started with ${data.players.length} players.`);
        console.log(`[${timestamp}] [${source}] ${eventName}: Dealer button (${getPlayerName(data.players[data.dealerButton])}) at position: ${data.dealerButton}`);

        // Calculate positions based on dealer button
        const sbIndex = (data.dealerButton + 1) % data.players.length;
        const bbIndex = (data.dealerButton + 2) % data.players.length;

        console.log(`[${timestamp}] [${source}] ${eventName}: Small blind (${getPlayerName(data.players[sbIndex])}) posts $10`);
        console.log(`[${timestamp}] [${source}] ${eventName}: Big blind (${getPlayerName(data.players[bbIndex])}) posts $20`);
        break;

      case 'action:requested':
        const { bettingDetails } = data;
        if (bettingDetails) {
          console.log(`[${timestamp}] [${source}] ${eventName}: ${getPlayerName(data.playerId)} to act`);
          console.log(`    Pot: $${bettingDetails.potSize}, Current bet: $${bettingDetails.currentBet}, To call: $${bettingDetails.toCall}`);
          console.log(`    Min raise: $${bettingDetails.minRaise}, Max raise: $${bettingDetails.maxRaise}`);
          console.log(`    Valid actions: ${bettingDetails.validActions.join(', ')}`);
        } else {
          // Fallback for older format
          console.log(`[${timestamp}] [${source}] ${eventName}: ${getPlayerName(data.playerId)} to act, bet is ${data.gameState.phase} $${data.gameState.currentBet}`);
        }
        break;
      case 'pot:updated':
        console.log(`[${timestamp}] [${source}] ${eventName}: Pot: $${data.total}`);
        break;
      case 'player:action':
        console.log(`[${timestamp}] [${source}] ${eventName}: ${getPlayerName(data.playerId)} ${data.action} ${data.amount ? `$${data.amount}` : ''}`);
        break;
      case 'hand:ended':
        //console.log(JSON.stringify(data, null, 4));
        const winners = data.winners?.map(w => `${getPlayerName(w.playerId)} wins $${w.amount} with ${w.hand.description} (${w.hand.cards.map(c => c.rank+c.suit).join(' ')})`).join(', ') || 'none';
        console.log(`[${timestamp}] [${source}] ${eventName}: Winners: ${winners}`);
        break;
      case 'cards:community':
        console.log(`[${timestamp}] [${source}] ${eventName}: ${data.phase} - ${data.cards?.join(', ')}`);
        break;
      case 'chips:awarded':
        console.log(`[${timestamp}] [${source}] ${eventName}: ${getPlayerName(data.playerId)} awarded $${data.amount}, total chips: $${data.total}`);
        break;
      case 'cards:dealt':
        break;
      case 'table:event':
        if (data.eventName === 'player:joined' || data.eventName === 'table:ready' || data.eventName === 'game:started' || data.eventName === 'hand:started' || data.eventName === 'cards:dealt' || data.eventName === 'pot:updated' || data.eventName === 'action:requested' || data.eventName === 'player:action' || data.eventName === 'cards:community' || data.eventName === 'chips:awarded' || data.eventName === 'hand:ended') {
          break;
        }
      default:
        console.log(`** [${timestamp}] [${source}] ${eventName}:`, JSON.stringify(data, null, 4));
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
  const folder = new FoldingPlayer({ id: 'player-1', name: 'Fearful Fred' });
  const caller = new CallingPlayer({ id: 'player-2', name: 'Calling Carl' });
  const raiser = new AggressivePlayer({ id: 'player-3', name: 'Aggressive Amy' });
  
  // Set global players array for name lookup
  players = [folder, caller, raiser];

  // Track game state
  let currentPhase = '';
  let gameNumber = 0;
  let handComplete = false;
  let communityCards = [];
  let holeCards = {};


  table.on('round:started', ({ phase }) => {
    currentPhase = phase;
    if (phase !== 'PRE_FLOP') {
      console.log(`*\n--- ${phase} ---`);
    }
  });

  table.on('cards:community', ({ cards }) => {
    communityCards = cards.map(card => `${card.rank}${card.suit}`);
  });

  table.on('hand:ended', ({ winners, board }) => {
    console.log('\n--- SHOWDOWN ---');
    // Use board from event if available, otherwise use tracked communityCards
    const finalBoard = board ? board.map(card => `${card.rank}${card.suit}`).join(' ') : communityCards.join(' ');
    console.log(`*Final board: ${finalBoard}`);
    console.log('');

    // Show all players' hands
    players.forEach(player => {
      console.log(`${player.name} ${player.state}`);
    });

    console.log('Players\' hands:');
    players.forEach(player => {
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
      console.log(`${player.name}: $${player.chips}`);
    });

    handComplete = true;
  });

  manager.on('*', (eventName, data) => logEvent('MANAGER', eventName, data));
  table.on('*', (eventName, data) => logEvent('TABLE', eventName, data));


  // Override receivePrivateCards to show and store hole cards
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

  console.log('Starting game...');
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