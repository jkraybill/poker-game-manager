import { GamePhase, PlayerState, Action } from '../types/index.js';
import { WildcardEventEmitter } from '../base/WildcardEventEmitter.js';
import { Deck } from './Deck.js';
import { PotManager } from './PotManager.js';
import { HandEvaluator } from './HandEvaluator.js';
import { Player } from '../Player.js';

/**
 * Core game engine that handles Texas Hold'em game logic
 * This is abstracted from any platform-specific concerns
 */
export class GameEngine extends WildcardEventEmitter {
  constructor(config) {
    super();
    
    this.config = {
      smallBlind: config.blinds.small,
      bigBlind: config.blinds.big,
      timeout: config.timeout || 30000,
      ...config,
    };
    
    // Players are now the single source of truth - no wrappers
    // Support both wrapped format (for backward compatibility) and direct Player instances
    this.players = config.players.map(p => {
      if (p instanceof Player) {
        return p;
      } else if (p.player instanceof Player) {
        // Transfer chips from wrapper to Player instance
        p.player.chips = p.chips;
        return p.player;
      } else {
        throw new Error('Invalid player format');
      }
    });
    this.phase = GamePhase.WAITING;
    this.board = [];
    this.deck = null;
    this.potManager = null;
    this.currentPlayerIndex = 0;
    this.dealerButtonIndex = config.dealerButton !== undefined 
      ? config.dealerButton 
      : Math.floor(Math.random() * this.players.length);
    this.roundBets = new Map();
    this.playerHands = new Map();
    this.lastBettor = null;
    this.customDeck = config.customDeck || null;
    this.raiseHistory = []; // Track raise increments in current round
  }

  /**
   * Start a new hand
   */
  start() {
    if (this.phase !== GamePhase.WAITING) {
      throw new Error('Game already in progress');
    }
    
    this.emit('hand:started', {
      players: this.players.map(p => p.id),
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
    
    // Use custom deck if provided, otherwise create new deck
    if (this.customDeck && this.customDeck.length > 0) {
      this.deck = new Deck();
      this.deck.cards = [...this.customDeck];
    } else {
      this.deck = new Deck();
      this.deck.shuffle();
    }
    
    this.roundBets.clear();
    this.playerHands.clear();
    this.raiseHistory = []; // Reset raise history for new hand
    
    // Initialize pot manager with Player instances directly
    this.potManager = new PotManager(this.players, this.config.smallBlind);
    
    // Reset player states directly on Player instances
    for (const player of this.players) {
      player.state = player.chips > 0 ? PlayerState.ACTIVE : PlayerState.SITTING_OUT;
      player.bet = 0;
      player.hasActed = false;
      player.lastAction = null;
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
    const activePlayers = this.players.filter(p => p.state === PlayerState.ACTIVE);
    
    // Deal first card to each player
    for (const player of activePlayers) {
      const firstCard = this.deck.draw();
      this.playerHands.set(player.id, [firstCard]);
    }
    
    // Deal second card to each player
    for (const player of activePlayers) {
      const cards = this.playerHands.get(player.id);
      cards.push(this.deck.draw());
      
      // Notify player of their cards
      player.receivePrivateCards(cards);
      
      this.emit('cards:dealt', {
        playerId: player.id,
        cardCount: 2,
      });
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
    
    let sbIndex, bbIndex;
    
    // Special handling for heads-up play
    if (activePlayers.length === 2) {
      // In heads-up, the dealer/button is the small blind
      sbIndex = this.dealerButtonIndex;
      bbIndex = this.getNextActivePlayerIndex(sbIndex);
    } else {
      // Normal blind positions for 3+ players
      sbIndex = this.getNextActivePlayerIndex(this.dealerButtonIndex);
      bbIndex = this.getNextActivePlayerIndex(sbIndex);
    }
    
    const sbPlayer = this.players[sbIndex];
    const bbPlayer = this.players[bbIndex];
    
    // Post small blind
    this.handleBet(sbPlayer, this.config.smallBlind, 'small blind');
    
    // Post big blind
    this.handleBet(bbPlayer, this.config.bigBlind, 'big blind');
    
    // Big blind has option
    bbPlayer.hasOption = true;
    
    // Set current player
    if (activePlayers.length === 2) {
      // In heads-up, small blind (button) acts first pre-flop
      this.currentPlayerIndex = sbIndex;
    } else {
      // Normal: UTG acts first (player after BB)
      this.currentPlayerIndex = this.getNextActivePlayerIndex(bbIndex);
    }
    
  }

  /**
   * Start a new betting round
   */
  startBettingRound() {
    // Reset round state
    for (const player of this.players) {
      if (player.state === PlayerState.ACTIVE || player.state === PlayerState.ALL_IN) {
        player.hasActed = false;
        player.lastAction = null; // Reset last action for new round
        // Only reset bets if not in pre-flop (blinds already posted)
        if (this.phase !== GamePhase.PRE_FLOP) {
          player.bet = 0;
        }
      }
    }
    
    this.lastBettor = null;
    this.raiseHistory = []; // Reset raise history for new betting round
    
    // Check if there are any active players who can act
    const activePlayers = this.players.filter(p => p.state === PlayerState.ACTIVE);
    if (activePlayers.length === 0) {
      // No one can act, immediately end the betting round
      this.endBettingRound();
    } else {
      this.promptNextPlayer();
    }
  }

  /**
   * Calculate betting details for current player
   */
  calculateBettingDetails(player) {
    const currentBet = this.getCurrentBet();
    const toCall = Math.max(0, currentBet - player.bet);
    const potSize = this.potManager.getTotal();
    
    // Calculate minimum raise
    let minRaise = currentBet;
    if (this.lastBettor && this.raiseHistory.length > 0) {
      // Minimum raise is the size of the last raise
      const lastRaiseAmount = this.raiseHistory[this.raiseHistory.length - 1];
      minRaise = currentBet + lastRaiseAmount;
    } else {
      // First raise must be at least double the big blind
      minRaise = currentBet + Math.max(this.config.bigBlind, currentBet);
    }
    
    // Ensure minimum raise doesn't exceed player's stack
    minRaise = Math.min(minRaise, player.bet + player.chips);
    
    // Maximum raise is player's remaining chips
    const maxRaise = player.bet + player.chips;
    
    // Determine valid actions
    const validActions = [];
    
    // Fold is always valid (unless player is all-in)
    if (player.state === PlayerState.ACTIVE) {
      validActions.push(Action.FOLD);
    }
    
    // Check if player can check
    if (toCall === 0) {
      validActions.push(Action.CHECK);
    }
    
    // Call if there's something to call and player has chips
    if (toCall > 0 && player.chips > 0) {
      if (toCall >= player.chips) {
        validActions.push(Action.ALL_IN);
      } else {
        validActions.push(Action.CALL);
      }
    }
    
    // Bet/Raise if player has enough chips
    if (currentBet === 0 && player.chips > 0) {
      // Can bet when no current bet
      validActions.push(Action.BET);
      if (player.chips <= this.config.bigBlind) {
        validActions.push(Action.ALL_IN);
      }
    } else if (currentBet > 0 && toCall === 0 && player.chips > 0) {
      // Can raise when already matched the bet (like BB with option)
      validActions.push(Action.RAISE);
      if (player.chips <= minRaise - player.bet) {
        validActions.push(Action.ALL_IN);
      }
    } else if (currentBet > 0 && player.chips > toCall) {
      // Can raise if they have more than just the call amount
      validActions.push(Action.RAISE);
      if (player.chips <= minRaise - player.bet) {
        validActions.push(Action.ALL_IN);
      }
    }
    
    return {
      currentBet,
      toCall,
      minRaise,
      maxRaise,
      potSize,
      validActions,
    };
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
    
    // Build game state for player
    const gameState = this.buildGameState();
    
    // Calculate betting details
    const bettingDetails = this.calculateBettingDetails(currentPlayer);
    
    this.emit('action:requested', {
      playerId: currentPlayer.id,
      gameState,
      bettingDetails,
    });
    
    try {
      // Get action from player with timeout
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Timeout')), this.config.timeout);
      });
      
      const action = await Promise.race([
        currentPlayer.getAction(gameState),
        timeoutPromise,
      ]);
      
      // Clear the timeout since action completed
      clearTimeout(timeoutId);
      
      this.handlePlayerAction(currentPlayer, action);
    } catch (error) {
      // Default to fold on timeout or error
      this.handlePlayerAction(currentPlayer, {
        action: Action.FOLD,
        playerId: currentPlayer.id,
      });
    }
  }

  /**
   * Validate a player action according to poker rules
   */
  validateAction(player, action) {
    const currentBet = this.getCurrentBet();
    const toCall = currentBet - player.bet;
    
    switch (action.action) {
      case Action.FOLD:
        return { valid: true };
        
      case Action.CHECK:
        if (toCall > 0) {
          return { valid: false, reason: 'Cannot check when facing a bet' };
        }
        return { valid: true };
        
      case Action.CALL:
        if (toCall <= 0) {
          return { valid: false, reason: 'Nothing to call' };
        }
        if (toCall > player.chips) {
          return { valid: false, reason: 'Insufficient chips to call' };
        }
        return { valid: true };
        
      case Action.BET:
        if (currentBet > 0) {
          return { valid: false, reason: 'Cannot bet when facing a bet - use raise' };
        }
        return this.validateBetAmount(action.amount, player);
        
      case Action.RAISE:
        if (currentBet === 0) {
          return { valid: false, reason: 'Cannot raise without a bet - use bet' };
        }
        return this.validateRaiseAmount(action.amount, player);
        
      case Action.ALL_IN:
        return { valid: true }; // All-in is always valid
        
      default:
        return { valid: false, reason: 'Unknown action' };
    }
  }
  
  /**
   * Validate bet amount according to poker rules
   */
  validateBetAmount(amount, player) {
    // Rule 5.2.1.1: Opening bet must be at least the big blind
    const minBet = this.config.bigBlind;
    
    if (amount < minBet) {
      return { 
        valid: false, 
        reason: `Minimum bet is ${minBet}`, 
      };
    }
    
    if (amount > player.chips) {
      return { 
        valid: false, 
        reason: 'Insufficient chips', 
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate raise amount according to poker rules
   */
  validateRaiseAmount(amount, player) {
    const currentBet = this.getCurrentBet();
    // const toCall = currentBet - player.bet;
    
    // The 'amount' parameter appears to be the total bet amount (raise TO)
    // not the raise increment (raise BY)
    const proposedTotalBet = amount;
    // const raiseIncrement = proposedTotalBet - currentBet;
    
    if (proposedTotalBet > player.chips + player.bet) {
      return { 
        valid: false, 
        reason: 'Insufficient chips for raise', 
      };
    }
    
    // Rule 5.2.1.2: A raise must be at least equal to the largest prior bet or raise of the current round
    const minRaiseIncrement = this.getMinimumRaiseIncrement();
    const minTotalBet = currentBet + minRaiseIncrement;
    
    if (proposedTotalBet < minTotalBet) {
      return { 
        valid: false, 
        reason: `Minimum total bet is ${minTotalBet}`, 
      };
    }
    return { valid: true };
  }
  
  /**
   * Calculate minimum raise increment according to poker rules
   */
  getMinimumRaiseIncrement() {
    const bigBlind = this.config.bigBlind;
    const lastRaiseSize = this.getLastRaiseSize();
    
    if (lastRaiseSize === 0) {
      // First raise: minimum total bet should be 2x big blind
      // Current bet is bigBlind, so minimum raise increment is bigBlind
      return bigBlind;
    }
    
    // Subsequent raises: must be at least the size of the previous raise
    return lastRaiseSize;
  }
  
  /**
   * Get the size of the last raise in the current betting round
   */
  getLastRaiseSize() {
    // Return the last raise increment from our history
    if (this.raiseHistory.length === 0) {
      return 0;
    }
    return this.raiseHistory[this.raiseHistory.length - 1];
  }

  /**
   * Handle a player action
   */
  handlePlayerAction(player, action) {
    // Validate the action before processing
    const validationResult = this.validateAction(player, action);
    if (!validationResult.valid) {
      // Invalid action - emit error and re-prompt the same player
      this.emit('action:invalid', {
        playerId: player.id,
        action: action.action,
        amount: action.amount,
        reason: validationResult.reason,
      });
      
      
      // Re-prompt the same player (don't mark as acted, don't move to next player)
      this.promptNextPlayer();
      return;
    }
    
    // Store the player's last action
    player.lastAction = action.action;
    
    
    this.emit('player:action', {
      playerId: player.id,
      action: action.action,
      amount: action.amount,
    });
    
    let handEnded = false;
    
    switch (action.action) {
      case Action.FOLD:
        handEnded = this.handleFold(player);
        break;
      case Action.CHECK:
        this.handleCheck(player);
        break;
      case Action.CALL:
        this.handleCall(player);
        break;
      case Action.BET:
        this.handleBet(player, action.amount);
        break;
      case Action.RAISE:
        this.handleRaise(player, action.amount);
        break;
      case Action.ALL_IN:
        this.handleAllIn(player);
        break;
    }
    
    // If hand ended (e.g., all but one folded), don't continue
    if (handEnded) {
      return;
    }
    
    player.hasActed = true;
    
    // Check if betting round is complete after this action
    const isComplete = this.isBettingRoundComplete();
    if (isComplete) {
      this.endBettingRound();
    } else {
      // Continue to next player
      this.moveToNextActivePlayer();
      this.promptNextPlayer();
    }
  }

  /**
   * Handle fold action
   */
  handleFold(player) {
    player.state = PlayerState.FOLDED;
    
    // Check if only one player remains
    const activePlayers = this.players.filter(p => 
      p.state === PlayerState.ACTIVE || p.state === PlayerState.ALL_IN,
    );
    
    if (activePlayers.length === 1) {
      // Last player wins the pot - PotManager expects playerData property
      const winners = activePlayers.map(p => ({ playerData: p }));
      const payouts = this.potManager.calculatePayouts(winners);
      this.distributeWinnings(payouts);
      
      // Build winners array with amounts
      const winnersArray = [];
      for (const [player, amount] of payouts) {
        winnersArray.push({
          playerId: player.id,
          hand: 'Won by fold',
          cards: this.playerHands.get(player.id) || [],
          amount,
        });
      }
      
      this.emit('hand:complete', {
        winners: winnersArray,
        board: this.board,
        sidePots: this.getSidePotInfo(),
      });
      
      this.endHand(activePlayers);
      return true; // Indicate hand has ended
    }
    return false; // Hand continues
  }

  /**
   * Handle check action
   */
  handleCheck(player) {
    // Check is only valid if no bet to match
    const currentBet = this.getCurrentBet();
    if (currentBet > player.bet) {
      // Invalid action, treat as fold
      this.handleFold(player);
    }
    
    // Clear the big blind option flag if this is BB checking
    if (player.hasOption) {
      player.hasOption = false;
    }
  }

  /**
   * Handle call action
   */
  handleCall(player) {
    const currentBet = this.getCurrentBet();
    const callAmount = Math.min(currentBet - player.bet, player.chips);
    
    if (callAmount > 0) {
      player.chips -= callAmount;
      player.bet += callAmount;
      this.potManager.addToPot(player, callAmount);
      
      if (player.chips === 0) {
        player.state = PlayerState.ALL_IN;
      }
    }
  }

  /**
   * Handle bet action
   */
  handleBet(player, amount, blindType = '') {
    const actualAmount = Math.min(amount, player.chips);
    
    player.chips -= actualAmount;
    player.bet += actualAmount;
    this.potManager.addToPot(player, actualAmount);
    
    if (player.chips === 0) {
      player.state = PlayerState.ALL_IN;
    }
    
    // Track last bettor for betting round completion
    if (!blindType) {
      this.lastBettor = player;
    }
    
    this.emit('pot:updated', {
      total: this.potManager.getTotal(),
      playerBet: { playerId: player.id, amount: actualAmount },
    });
  }

  /**
   * Handle raise action - tracks raise increments
   */
  handleRaise(player, amount) {
    const currentBet = this.getCurrentBet();
    const raiseIncrement = amount - currentBet;
    
    // Track this raise increment for minimum re-raise validation
    this.raiseHistory.push(raiseIncrement);
    
    // Use the same betting logic as handleBet
    this.handleBet(player, amount);
  }

  /**
   * Handle all-in action
   */
  handleAllIn(player) {
    const allInAmount = player.chips;
    this.handleBet(player, allInAmount);
  }

  /**
   * Get current bet amount
   */
  getCurrentBet() {
    const activePlayers = this.players.filter(p => 
      p.state === PlayerState.ACTIVE || p.state === PlayerState.ALL_IN,
    );
    return Math.max(...activePlayers.map(p => p.bet), 0);
  }

  /**
   * Check if betting round is complete
   */
  isBettingRoundComplete() {
    const activePlayers = this.players.filter(p => p.state === PlayerState.ACTIVE);
    const allInPlayers = this.players.filter(p => p.state === PlayerState.ALL_IN);
    const playersInHand = activePlayers.length + allInPlayers.length;
    
    // If only one player left in hand (active or all-in), round is complete
    if (playersInHand <= 1) {
      return true;
    }
    
    // If no active players left (all are all-in), round is complete
    if (activePlayers.length === 0 && allInPlayers.length > 0) {
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
    
    // Emit pot update after side pots are created
    this.emit('pot:updated', {
      total: this.potManager.getTotal(),
    });
    
    // Clear option flags
    for (const player of this.players) {
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
    
    // Burn one card
    this.deck.draw();
    
    // Deal three flop cards
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
    
    // Burn one card
    this.deck.draw();
    
    // Deal the turn card
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
    
    // Burn one card
    this.deck.draw();
    
    // Deal the river card
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
    
    // Evaluate hands - PotManager expects playerData property
    const playerHands = activePlayers.map(player => {
      const holeCards = this.playerHands.get(player.id);
      const hand = HandEvaluator.evaluate([...holeCards, ...this.board]);
      
      return {
        playerData: player,
        hand,
        cards: holeCards,
      };
    });
    
    // Determine winners
    const winners = HandEvaluator.findWinners(playerHands);
    const payouts = this.potManager.calculatePayouts(winners);
    this.distributeWinnings(payouts);
    
    // Build winners array with amounts
    const winnersWithAmounts = [];
    for (const winner of winners) {
      const amount = Array.from(payouts).find(([p]) => {
        return p.id === winner.playerData.id;
      })?.[1] || 0;
      winnersWithAmounts.push({
        playerId: winner.playerData.id,
        hand: winner.hand,
        cards: winner.cards,
        amount,
      });
    }
    
    this.emit('hand:complete', {
      winners: winnersWithAmounts,
      board: this.board,
      sidePots: this.getSidePotInfo(),
    });
    
    this.endHand(winners.map(w => w.playerData));
  }

  /**
   * Get side pot information for display/testing
   */
  getSidePotInfo() {
    if (!this.potManager || !this.potManager.pots) {
      return [];
    }
    
    return this.potManager.pots.map((pot, index) => ({
      potId: index,
      amount: pot.amount,
      eligiblePlayers: pot.eligiblePlayers.map(p => p.id),
      isMain: index === 0,
    }));
  }

  /**
   * End the hand
   */
  endHand(winners) {
    this.phase = GamePhase.ENDED;
    
    const result = {
      winners: winners.map(w => w.id),
      finalChips: {},
      showdownHands: {},
    };
    
    // Record final chip counts
    for (const player of this.players) {
      result.finalChips[player.id] = player.chips;
      
      if (this.playerHands.has(player.id)) {
        result.showdownHands[player.id] = 
          this.playerHands.get(player.id);
      }
    }
    
    this.emit('game:ended', result);
  }

  /**
   * Distribute winnings to winners
   */
  distributeWinnings(payouts) {
    for (const [player, amount] of payouts) {
      player.addChips(amount);
      
      this.emit('chips:awarded', {
        playerId: player.id,
        amount,
        total: player.chips,
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
    const currentPlayerId = this.players[this.currentPlayerIndex].id;
    
    const players = {};
    for (const player of this.players) {
      players[player.id] = {
        id: player.id,
        chips: player.chips,
        bet: player.bet,
        state: player.state,
        hasActed: player.hasActed,
        lastAction: player.lastAction,
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
    this.removeAllListeners();
  }
}