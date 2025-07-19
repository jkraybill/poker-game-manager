import { EventEmitter } from 'eventemitter3';
import { GamePhase, PlayerState, Action } from '../types/index.js';
import { Deck } from './Deck.js';
import { PotManager } from './PotManager.js';
import { HandEvaluator } from './HandEvaluator.js';

/**
 * Core game engine that handles Texas Hold'em game logic
 * This is abstracted from any platform-specific concerns
 */
export class GameEngine extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = {
      smallBlind: config.blinds.small,
      bigBlind: config.blinds.big,
      timeout: config.timeout || 30000,
      ...config,
    };
    
    this.players = config.players;
    this.phase = GamePhase.WAITING;
    this.board = [];
    this.deck = null;
    this.potManager = null;
    this.currentPlayerIndex = 0;
    this.dealerButtonIndex = Math.floor(Math.random() * this.players.length);
    this.roundBets = new Map();
    this.playerHands = new Map();
    this.lastBettor = null;
  }

  /**
   * Start a new hand
   */
  start() {
    if (this.phase !== GamePhase.WAITING) {
      throw new Error('Game already in progress');
    }
    
    this.emit('hand:started', {
      players: this.players.map(p => p.player.id),
      dealerButton: this.dealerButtonIndex,
    });
    
    this.initializeHand();
    this.startBettingRound();
  }

  /**
   * Initialize a new hand
   */
  initializeHand() {
    // Reset game state
    this.board = [];
    this.deck = new Deck();
    this.deck.shuffle();
    this.roundBets.clear();
    this.playerHands.clear();
    
    // Initialize pot manager
    const activePlayers = this.players.filter(p => p.chips > 0);
    this.potManager = new PotManager(activePlayers, this.config.smallBlind);
    
    // Reset player states
    for (const playerData of this.players) {
      playerData.state = playerData.chips > 0 ? PlayerState.ACTIVE : PlayerState.SITTING_OUT;
      playerData.bet = 0;
      playerData.hasActed = false;
    }
    
    // Deal hole cards
    this.dealHoleCards();
    
    // Post blinds
    this.postBlinds();
    
    // Start preflop
    this.phase = GamePhase.PRE_FLOP;
  }

  /**
   * Deal hole cards to all active players
   */
  dealHoleCards() {
    for (const playerData of this.players) {
      if (playerData.state === PlayerState.ACTIVE) {
        const cards = [this.deck.draw(), this.deck.draw()];
        this.playerHands.set(playerData.player.id, cards);
        
        // Notify player of their cards
        playerData.player.receivePrivateCards(cards);
        
        this.emit('cards:dealt', {
          playerId: playerData.player.id,
          cardCount: 2,
        });
      }
    }
  }

  /**
   * Post blinds
   */
  postBlinds() {
    const activePlayers = this.players.filter(p => p.state === PlayerState.ACTIVE);
    if (activePlayers.length < 2) {
return;
}
    
    // Find small blind position
    const sbIndex = this.getNextActivePlayerIndex(this.dealerButtonIndex);
    const bbIndex = this.getNextActivePlayerIndex(sbIndex);
    
    const sbPlayer = this.players[sbIndex];
    const bbPlayer = this.players[bbIndex];
    
    // Post small blind
    this.handleBet(sbPlayer, this.config.smallBlind, 'small blind');
    
    // Post big blind
    this.handleBet(bbPlayer, this.config.bigBlind, 'big blind');
    
    // Big blind has option
    bbPlayer.hasOption = true;
    
    // Set current player (UTG in preflop)
    this.currentPlayerIndex = this.getNextActivePlayerIndex(bbIndex);
  }

  /**
   * Start a new betting round
   */
  startBettingRound() {
    // Reset round state
    for (const player of this.players) {
      if (player.state === PlayerState.ACTIVE) {
        player.hasActed = false;
        player.bet = 0;
      }
    }
    
    this.lastBettor = null;
    this.promptNextPlayer();
  }

  /**
   * Prompt the next player for action
   */
  async promptNextPlayer() {
    const currentPlayer = this.players[this.currentPlayerIndex];
    
    if (!currentPlayer || currentPlayer.state !== PlayerState.ACTIVE) {
      this.moveToNextActivePlayer();
      return;
    }
    
    // Check if betting round is complete
    if (this.isBettingRoundComplete()) {
      this.endBettingRound();
      return;
    }
    
    // Build game state for player
    const gameState = this.buildGameState();
    
    this.emit('action:requested', {
      playerId: currentPlayer.player.id,
      gameState,
    });
    
    try {
      // Get action from player with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), this.config.timeout),
      );
      
      const action = await Promise.race([
        currentPlayer.player.getAction(gameState),
        timeoutPromise,
      ]);
      
      this.handlePlayerAction(currentPlayer, action);
    } catch (error) {
      // Default to fold on timeout or error
      this.handlePlayerAction(currentPlayer, {
        action: Action.FOLD,
        playerId: currentPlayer.player.id,
      });
    }
  }

  /**
   * Handle a player action
   */
  handlePlayerAction(playerData, action) {
    this.emit('player:action', {
      playerId: playerData.player.id,
      action: action.action,
      amount: action.amount,
    });
    
    switch (action.action) {
      case Action.FOLD:
        this.handleFold(playerData);
        break;
      case Action.CHECK:
        this.handleCheck(playerData);
        break;
      case Action.CALL:
        this.handleCall(playerData);
        break;
      case Action.BET:
      case Action.RAISE:
        this.handleBet(playerData, action.amount);
        break;
      case Action.ALL_IN:
        this.handleAllIn(playerData);
        break;
    }
    
    playerData.hasActed = true;
    this.moveToNextActivePlayer();
    
    // Continue to next player
    this.promptNextPlayer();
  }

  /**
   * Handle fold action
   */
  handleFold(playerData) {
    playerData.state = PlayerState.FOLDED;
    
    // Check if only one player remains
    const activePlayers = this.players.filter(p => 
      p.state === PlayerState.ACTIVE || p.state === PlayerState.ALL_IN,
    );
    
    if (activePlayers.length === 1) {
      this.endHand(activePlayers);
    }
  }

  /**
   * Handle check action
   */
  handleCheck(playerData) {
    // Check is only valid if no bet to match
    const currentBet = this.getCurrentBet();
    if (currentBet > playerData.bet) {
      // Invalid action, treat as fold
      this.handleFold(playerData);
    }
  }

  /**
   * Handle call action
   */
  handleCall(playerData) {
    const currentBet = this.getCurrentBet();
    const callAmount = Math.min(currentBet - playerData.bet, playerData.chips);
    
    if (callAmount > 0) {
      playerData.chips -= callAmount;
      playerData.bet += callAmount;
      this.potManager.addToPot(playerData, callAmount);
      
      if (playerData.chips === 0) {
        playerData.state = PlayerState.ALL_IN;
      }
    }
  }

  /**
   * Handle bet/raise action
   */
  handleBet(playerData, amount, blindType = '') {
    const actualAmount = Math.min(amount, playerData.chips);
    
    playerData.chips -= actualAmount;
    playerData.bet += actualAmount;
    this.potManager.addToPot(playerData, actualAmount);
    
    if (playerData.chips === 0) {
      playerData.state = PlayerState.ALL_IN;
    }
    
    // Track last bettor for betting round completion
    if (!blindType) {
      this.lastBettor = playerData;
    }
    
    this.emit('pot:updated', {
      total: this.potManager.getTotal(),
      playerBet: { playerId: playerData.player.id, amount: actualAmount },
    });
  }

  /**
   * Handle all-in action
   */
  handleAllIn(playerData) {
    const allInAmount = playerData.chips;
    this.handleBet(playerData, allInAmount);
  }

  /**
   * Get current bet amount
   */
  getCurrentBet() {
    return Math.max(...this.players.map(p => p.bet), 0);
  }

  /**
   * Check if betting round is complete
   */
  isBettingRoundComplete() {
    const activePlayers = this.players.filter(p => p.state === PlayerState.ACTIVE);
    
    // If only one active player, round is complete
    if (activePlayers.length <= 1) {
      return true;
    }
    
    // All active players must have acted
    const allActed = activePlayers.every(p => p.hasActed);
    if (!allActed) {
      return false;
    }
    
    // All active players must have matched the current bet
    const currentBet = this.getCurrentBet();
    const allMatched = activePlayers.every(p => p.bet === currentBet);
    
    // Special case: big blind option in preflop
    if (this.phase === GamePhase.PRE_FLOP) {
      const bbPlayer = activePlayers.find(p => p.hasOption);
      if (bbPlayer && !bbPlayer.hasActed) {
        return false;
      }
    }
    
    return allMatched;
  }

  /**
   * End the current betting round
   */
  endBettingRound() {
    this.potManager.endBettingRound();
    
    // Reset bets for next round
    for (const player of this.players) {
      player.bet = 0;
      player.hasActed = false;
      player.hasOption = false;
    }
    
    // Progress to next phase
    switch (this.phase) {
      case GamePhase.PRE_FLOP:
        this.dealFlop();
        break;
      case GamePhase.FLOP:
        this.dealTurn();
        break;
      case GamePhase.TURN:
        this.dealRiver();
        break;
      case GamePhase.RIVER:
        this.showdown();
        break;
    }
  }

  /**
   * Deal the flop
   */
  dealFlop() {
    this.phase = GamePhase.FLOP;
    const flop = [this.deck.draw(), this.deck.draw(), this.deck.draw()];
    this.board.push(...flop);
    
    this.emit('cards:community', {
      cards: this.board,
      phase: this.phase,
    });
    
    // Reset current player to first active player after button
    this.currentPlayerIndex = this.getNextActivePlayerIndex(this.dealerButtonIndex);
    this.startBettingRound();
  }

  /**
   * Deal the turn
   */
  dealTurn() {
    this.phase = GamePhase.TURN;
    const turn = this.deck.draw();
    this.board.push(turn);
    
    this.emit('cards:community', {
      cards: this.board,
      phase: this.phase,
    });
    
    this.currentPlayerIndex = this.getNextActivePlayerIndex(this.dealerButtonIndex);
    this.startBettingRound();
  }

  /**
   * Deal the river
   */
  dealRiver() {
    this.phase = GamePhase.RIVER;
    const river = this.deck.draw();
    this.board.push(river);
    
    this.emit('cards:community', {
      cards: this.board,
      phase: this.phase,
    });
    
    this.currentPlayerIndex = this.getNextActivePlayerIndex(this.dealerButtonIndex);
    this.startBettingRound();
  }

  /**
   * Perform showdown
   */
  showdown() {
    this.phase = GamePhase.SHOWDOWN;
    
    const activePlayers = this.players.filter(p => 
      p.state === PlayerState.ACTIVE || p.state === PlayerState.ALL_IN,
    );
    
    // Evaluate hands
    const playerHands = activePlayers.map(playerData => {
      const holeCards = this.playerHands.get(playerData.player.id);
      const hand = HandEvaluator.evaluate([...holeCards, ...this.board]);
      
      return {
        playerData,
        hand,
        cards: holeCards,
      };
    });
    
    // Determine winners
    const winners = HandEvaluator.findWinners(playerHands);
    this.distributeWinnings(winners);
    
    this.emit('hand:complete', {
      winners: winners.map(w => ({
        playerId: w.playerData.player.id,
        hand: w.hand,
        cards: w.cards,
      })),
      board: this.board,
    });
    
    this.endHand(winners.map(w => w.playerData));
  }

  /**
   * End the hand
   */
  endHand(winners) {
    this.phase = GamePhase.ENDED;
    
    const result = {
      winners: winners.map(w => w.player.id),
      finalChips: {},
      showdownHands: {},
    };
    
    // Record final chip counts
    for (const playerData of this.players) {
      result.finalChips[playerData.player.id] = playerData.chips;
      
      if (this.playerHands.has(playerData.player.id)) {
        result.showdownHands[playerData.player.id] = 
          this.playerHands.get(playerData.player.id);
      }
    }
    
    this.emit('game:ended', result);
  }

  /**
   * Distribute winnings to winners
   */
  distributeWinnings(winners) {
    const payouts = this.potManager.calculatePayouts(winners);
    
    for (const [playerData, amount] of payouts) {
      playerData.chips += amount;
      
      this.emit('chips:awarded', {
        playerId: playerData.player.id,
        amount,
        total: playerData.chips,
      });
    }
  }

  /**
   * Get next active player index
   */
  getNextActivePlayerIndex(currentIndex) {
    let nextIndex = (currentIndex + 1) % this.players.length;
    
    while (nextIndex !== currentIndex) {
      const player = this.players[nextIndex];
      if (player.state === PlayerState.ACTIVE) {
        return nextIndex;
      }
      nextIndex = (nextIndex + 1) % this.players.length;
    }
    
    return currentIndex;
  }

  /**
   * Move to next active player
   */
  moveToNextActivePlayer() {
    this.currentPlayerIndex = this.getNextActivePlayerIndex(this.currentPlayerIndex);
  }

  /**
   * Build current game state
   */
  buildGameState() {
    const pot = this.potManager.getTotal();
    const currentBet = this.getCurrentBet();
    const currentPlayerId = this.players[this.currentPlayerIndex].player.id;
    
    const players = {};
    for (const playerData of this.players) {
      players[playerData.player.id] = {
        id: playerData.player.id,
        chips: playerData.chips,
        bet: playerData.bet,
        state: playerData.state,
        hasActed: playerData.hasActed,
      };
    }
    
    return {
      phase: this.phase,
      communityCards: [...this.board],
      pot,
      currentBet,
      currentPlayer: currentPlayerId,
      players,
    };
  }

  /**
   * Abort the game
   */
  abort() {
    this.phase = GamePhase.ENDED;
    this.emit('game:aborted');
  }
}