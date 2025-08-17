import { GamePhase, PlayerState, Action } from '../types/index.js';
import { WildcardEventEmitter } from '../base/WildcardEventEmitter.js';
import { Deck } from './Deck.js';
import { PotManager } from './PotManager.js';
import { HandEvaluator } from './HandEvaluator.js';
import { Player } from '../Player.js';
import { validateIntegerAmount, ensureInteger } from '../utils/validation.js';
// import { gameStatePool } from '../utils/performance.js'; // Not using pool to avoid reset issues
import { monitor } from '../utils/monitoring.js';

/**
 * Core game engine that handles Texas Hold'em game logic
 * This is abstracted from any platform-specific concerns
 */
export class GameEngine extends WildcardEventEmitter {
  constructor(config) {
    super();

    // Validate and ensure blinds are integers
    this.config = {
      smallBlind: validateIntegerAmount(config.blinds.small, 'small blind'),
      bigBlind: validateIntegerAmount(config.blinds.big, 'big blind'),
      timeout: config.timeout || 30000,
      ...config,
    };

    // Players are now the single source of truth - no wrappers
    // Support both wrapped format (for backward compatibility) and direct Player instances
    this.players = config.players.map((p) => {
      if (p instanceof Player) {
        return p;
      } else if (p.player instanceof Player) {
        // Transfer chips from wrapper to Player instance (ensure integer)
        p.player.chips = ensureInteger(p.chips, 'player.chips');
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
    this.dealerButtonIndex =
      config.dealerButton !== undefined
        ? config.dealerButton
        : Math.floor(Math.random() * this.players.length);

    // Dead button rule support - explicit position indices
    this.buttonPlayerIndex = config.buttonPlayerIndex;
    this.smallBlindPlayerIndex = config.smallBlindPlayerIndex;
    this.bigBlindPlayerIndex = config.bigBlindPlayerIndex;
    this.isDeadButton = config.isDeadButton || false;
    this.isDeadSmallBlind = config.isDeadSmallBlind || false;

    this.roundBets = new Map();
    this.playerHands = new Map();
    this.lastBettor = null;
    this.customDeck = config.customDeck || null;
    this.raiseHistory = []; // Track raise increments in current round
    this.bettingRoundStarted = null; // v4.4.7: Track which phase started betting to prevent duplicates
    this.endingBettingRound = false; // v4.4.7: Prevent promptNextPlayer after endBettingRound starts
  }

  /**
   * Start a new hand
   */
  async start() {
    if (this.phase !== GamePhase.WAITING) {
      throw new Error('Game already in progress');
    }

    // Calculate position information before blinds are posted
    const positionInfo = this.calculatePositionInfo();

    this.emit('hand:started', {
      players: this.players.map((p) => p.id),
      dealerButton: this.dealerButtonIndex,
      positions: positionInfo,
    });

    this.initializeHand();
    await this.startBettingRound();
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
    this.bettingRoundStarted = null; // v4.4.7: Reset betting round tracking for new hand
    this.endingBettingRound = false; // v4.4.7: Reset betting round ending flag for new hand

    // Initialize pot manager with Player instances directly
    this.potManager = new PotManager(this.players);

    // Listen for pot events to forward
    this.potManager.on('pot:updated', (data) => {
      this.emit('pot:updated', data);
    });

    this.potManager.on('sidepot:created', (data) => {
      this.emit('sidepot:created', data);
    });

    // Reset player states directly on Player instances
    for (const player of this.players) {
      player.state =
        player.chips > 0 ? PlayerState.ACTIVE : PlayerState.SITTING_OUT;
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
    const activePlayers = this.players.filter(
      (p) => p.state === PlayerState.ACTIVE,
    );

    // Deal first card to each player
    for (const player of activePlayers) {
      const firstCard = this.deck.draw();
      this.playerHands.set(player.id, [firstCard]);
    }

    // Deal second card to each player
    for (const player of activePlayers) {
      const cards = this.playerHands.get(player.id);
      cards.push(this.deck.draw());

      // Notify player of their cards - fail fast on any error
      try {
        player.receivePrivateCards(cards);
      } catch (error) {
        // Player broke contract - fatal error, no retry
        throw new Error(
          `Fatal: Player ${player.id} threw error in receivePrivateCards(): ${error.message}. ` +
            'This is a contract violation. Players must not throw errors from notification methods.',
        );
      }

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
    const activePlayers = this.players.filter(
      (p) => p.state === PlayerState.ACTIVE,
    );
    if (activePlayers.length < 2) {
      return;
    }

    let sbIndex, bbIndex, sbPlayer, bbPlayer;

    // Use explicit position indices if provided (dead button rule)
    if (
      this.bigBlindPlayerIndex !== undefined &&
      this.bigBlindPlayerIndex !== null
    ) {
      bbIndex = this.bigBlindPlayerIndex;
      bbPlayer = this.players[bbIndex];

      if (
        !this.isDeadSmallBlind &&
        this.smallBlindPlayerIndex !== undefined &&
        this.smallBlindPlayerIndex !== null
      ) {
        sbIndex = this.smallBlindPlayerIndex;
        sbPlayer = this.players[sbIndex];
      }
    } else {
      // Fallback to old behavior for backward compatibility

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

      sbPlayer = this.players[sbIndex];
      bbPlayer = this.players[bbIndex];
    }

    // Post small blind (unless it's dead or no player assigned)
    if (!this.isDeadSmallBlind && sbPlayer) {
      this.handleBet(sbPlayer, this.config.smallBlind, 'small blind');
    } else if (this.isDeadSmallBlind) {
      // Dead small blind - add to pot without attributing to any player
      this.potManager.addDeadMoney(this.config.smallBlind);
      this.emit('blind:dead', {
        type: 'small',
        amount: this.config.smallBlind,
      });
    }

    // Post big blind (always posted, never dead)
    if (bbPlayer) {
      this.handleBet(bbPlayer, this.config.bigBlind, 'big blind');
      // Big blind has option
      bbPlayer.hasOption = true;
    }

    // Set current player
    if (activePlayers.length === 2) {
      // In heads-up, small blind (button) acts first pre-flop
      this.currentPlayerIndex = sbIndex;
    } else {
      // Normal: UTG acts first (player after BB)
      this.currentPlayerIndex = this.getNextActivePlayerIndex(bbIndex, false);
    }
  }

  /**
   * Start a new betting round
   */
  async startBettingRound() {
    // v4.4.7: Reset flag when new betting round starts
    this.endingBettingRound = false;

    // Reset round state
    for (const player of this.players) {
      if (player.state === PlayerState.ACTIVE) {
        // Only reset hasActed for ACTIVE players
        // ALL_IN players should keep hasActed=true since they can't act anymore
        player.hasActed = false;
        player.lastAction = null; // Reset last action for new round
        // Only reset bets if not in pre-flop (blinds already posted)
        if (this.phase !== GamePhase.PRE_FLOP) {
          player.bet = 0;
        }
      } else if (player.state === PlayerState.ALL_IN) {
        // ALL_IN players: reset lastAction but keep hasActed=true
        player.lastAction = null; // Reset last action for new round
        // Only reset bets if not in pre-flop (blinds already posted)
        if (this.phase !== GamePhase.PRE_FLOP) {
          player.bet = 0;
        }
        // CRITICAL: Don't reset hasActed for ALL_IN players - they can't act!
      }
    }

    this.lastBettor = null;
    this.raiseHistory = []; // Reset raise history for new betting round

    // Check if there are any active players who can act
    const activePlayers = this.players.filter(
      (p) => p.state === PlayerState.ACTIVE,
    );
    if (activePlayers.length === 0) {
      // No one can act, immediately end the betting round
      await this.endBettingRound();
    } else {
      // Only start prompting if game hasn't been aborted
      if (this.phase !== GamePhase.ENDED) {
        await this.promptNextPlayer();
      }
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

    // Check if player can check (when nothing to call)
    if (toCall === 0) {
      validActions.push(Action.CHECK);
    }

    // Fold is only valid when facing a bet (toCall > 0)
    // In a simulation, players cannot fold when they can check for free
    if (player.state === PlayerState.ACTIVE && toCall > 0) {
      validActions.push(Action.FOLD);
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
    // Don't create promises if game is already ended/aborted
    if (this.phase === GamePhase.ENDED) {
      return;
    }

    // v4.4.7: Don't prompt if betting round is being ended (prevents race condition)
    if (this.endingBettingRound) {
      return;
    }

    const currentPlayer = this.players[this.currentPlayerIndex];

    if (!currentPlayer || currentPlayer.state !== PlayerState.ACTIVE) {
      // Player is all-in, folded, or doesn't exist - try next player
      this.moveToNextActivePlayer();

      // Check if we found a different player
      if (
        this.currentPlayerIndex !==
        this.players.findIndex((p) => p === currentPlayer)
      ) {
        // We moved to a different player, continue prompting
        // But only if the game is still active
        if (this.phase && this.potManager) {
          await this.promptNextPlayer();
        }
      } else {
        // No other players to prompt - check if betting round is complete
        const isComplete = this.isBettingRoundComplete();
        if (isComplete) {
          await this.endBettingRound();
        }
      }
      return;
    }

    // Calculate valid actions for the current player
    const validActions = this.calculateValidActions(currentPlayer);

    // Build game state for player
    const gameState = this.buildGameState();

    // Add valid actions to the game state
    gameState.validActions = validActions;

    // Calculate betting details
    const bettingDetails = this.calculateBettingDetails(currentPlayer);

    // Add validation-relevant numbers to gameState for player convenience
    gameState.toCall = bettingDetails.toCall;
    gameState.minRaise = bettingDetails.minRaise;
    gameState.maxRaise = bettingDetails.maxRaise;
    gameState.potSize = bettingDetails.potSize;
    gameState.currentBet = bettingDetails.currentBet;

    // Add additional validation context
    gameState.players[currentPlayer.id].toCall = bettingDetails.toCall;
    gameState.players[currentPlayer.id].canRaise =
      bettingDetails.maxRaise > bettingDetails.currentBet;
    gameState.players[currentPlayer.id].effectiveStack = currentPlayer.chips;

    // Add betting history context for min raise calculations
    gameState.bettingHistory = {
      raiseHistory: [...this.raiseHistory],
      lastBettor: this.lastBettor?.id || null,
      lastRaiseSize:
        this.raiseHistory.length > 0
          ? this.raiseHistory[this.raiseHistory.length - 1]
          : 0,
      minRaiseIncrement: bettingDetails.minRaise - bettingDetails.currentBet,
    };

    this.emit('action:requested', {
      playerId: currentPlayer.id,
      gameState,
      bettingDetails,
    });

    // Get action from player with timeout
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () =>
          reject(
            new Error(
              `Player ${currentPlayer.id} action timeout after ${this.config.timeout}ms`,
            ),
          ),
        this.config.timeout,
      );
    });

    let action;
    try {
      action = await Promise.race([
        currentPlayer.getAction(gameState),
        timeoutPromise,
      ]);
    } catch (error) {
      // Clear timeout immediately
      clearTimeout(timeoutId);

      // Player broke contract - fatal error, no retry
      throw new Error(
        `Fatal: Player ${currentPlayer.id} threw error in getAction(): ${error.message}. ` +
          'This is a contract violation. Players must return valid actions or timeout gracefully.',
      );
    }

    // Clear the timeout since action completed
    clearTimeout(timeoutId);

    // Check if the player returned a valid action
    if (!action) {
      // Player returned undefined/null - this is a developer error, crash immediately
      throw new Error(
        `Player ${currentPlayer.id} returned invalid action (undefined/null). ` +
          'This is a developer error. Players must always return a valid action object.',
      );
    }

    await this.handlePlayerAction(currentPlayer, action);
  }

  /**
   * Build detailed error context for debugging
   */
  buildErrorContext(player, action) {
    const currentBet = this.getCurrentBet();
    const toCall = currentBet - player.bet;
    const activePlayers = this.players.filter(
      (p) => p.state === PlayerState.ACTIVE,
    );
    const allInPlayers = this.players.filter(
      (p) => p.state === PlayerState.ALL_IN,
    );

    return {
      gamePhase: this.phase,
      currentBet,
      pot: this.potManager ? this.potManager.getTotal() : 0,
      player: {
        id: player.id,
        chips: player.chips,
        bet: player.bet,
        state: player.state,
        hasActed: player.hasActed,
        lastAction: player.lastAction,
        toCall,
      },
      table: {
        activePlayers: activePlayers.length,
        allInPlayers: allInPlayers.length,
        board: this.board,
        dealerButton: this.dealerButtonIndex,
        currentPlayerIndex: this.currentPlayerIndex,
        bigBlind: this.config.bigBlind,
        smallBlind: this.config.smallBlind,
      },
      attemptedAction: {
        action: action?.action,
        amount: action?.amount,
      },
      bettingHistory: {
        raiseHistory: this.raiseHistory,
        lastRaiseSize: this.getLastRaiseSize(),
        minRaiseIncrement: this.getMinimumRaiseIncrement(),
      },
      playerBets: this.players.map((p) => ({
        id: p.id,
        bet: p.bet,
        chips: p.chips,
        state: p.state,
      })),
    };
  }

  /**
   * Validate a player action according to poker rules
   */
  validateAction(player, action) {
    const currentBet = this.getCurrentBet();
    const toCall = currentBet - player.bet;

    // Check if action is defined
    if (!action || !action.action) {
      const context = this.buildErrorContext(player, action);
      throw new Error(
        `Invalid action: action object is ${action ? 'missing action property' : 'undefined'}. ` +
          'Expected format: { action: Action.FOLD, amount?: number }\n' +
          `Game State: ${JSON.stringify(context, null, 2)}`,
      );
    }

    // First, enforce that only Action enum values are accepted
    const validActionValues = Object.values(Action);
    if (!validActionValues.includes(action.action)) {
      const context = this.buildErrorContext(player, action);
      const receivedAction =
        typeof action.action === 'string'
          ? `"${action.action}"`
          : action.action;
      throw new Error(
        `Invalid action type: ${receivedAction}. ` +
          `Must use Action enum values: ${validActionValues.join(', ')}. ` +
          'Example: { action: Action.ALL_IN } not { action: "allIn" }\n' +
          `Game State: ${JSON.stringify(context, null, 2)}`,
      );
    }

    switch (action.action) {
      case Action.FOLD:
        // Fold is only valid when facing a bet (simulation framework rule)
        if (toCall <= 0) {
          const context = this.buildErrorContext(player, action);
          throw new Error(
            'Cannot fold when you can check for free.\n' +
              `Reason: Player can check (toCall=${toCall}, currentBet=${currentBet}, playerBet=${player.bet})\n` +
              'Solution: Use Action.CHECK instead of Action.FOLD\n' +
              `Game State: ${JSON.stringify(context, null, 2)}`,
          );
        }
        return;

      case Action.CHECK:
        if (toCall > 0) {
          const context = this.buildErrorContext(player, action);
          throw new Error(
            'Cannot check when facing a bet.\n' +
              `Reason: Player must call ${toCall} chips (currentBet=${currentBet}, playerBet=${player.bet})\n` +
              'Solutions: Use Action.CALL to match the bet, Action.RAISE to increase it, or Action.FOLD to give up\n' +
              `Game State: ${JSON.stringify(context, null, 2)}`,
          );
        }
        return;

      case Action.CALL:
        if (toCall <= 0) {
          const context = this.buildErrorContext(player, action);
          throw new Error(
            'Nothing to call.\n' +
              `Reason: No bet to match (currentBet=${currentBet}, playerBet=${player.bet}, toCall=${toCall})\n` +
              'Solution: Use Action.CHECK instead of Action.CALL\n' +
              `Game State: ${JSON.stringify(context, null, 2)}`,
          );
        }
        if (toCall > player.chips) {
          const context = this.buildErrorContext(player, action);
          throw new Error(
            'Insufficient chips to call.\n' +
              `Reason: Need ${toCall} chips to call but player only has ${player.chips} chips\n` +
              `Solution: Use Action.ALL_IN to go all-in with remaining ${player.chips} chips, or Action.FOLD\n` +
              `Game State: ${JSON.stringify(context, null, 2)}`,
          );
        }
        return;

      case Action.BET: {
        if (currentBet > 0) {
          const context = this.buildErrorContext(player, action);
          throw new Error(
            'Cannot bet when facing a bet - use raise.\n' +
              `Reason: There's already a bet of ${currentBet} on the table\n` +
              `Solution: Use Action.RAISE to increase the bet to ${action.amount || 'desired amount'}\n` +
              `Current bet details: ${this.players
                .filter((p) => p.bet > 0)
                .map((p) => `${p.id}: ${p.bet} chips`)
                .join(', ')}\n` +
              `Game State: ${JSON.stringify(context, null, 2)}`,
          );
        }
        const betResult = this.validateBetAmount(action.amount, player);
        if (!betResult.valid) {
          const context = this.buildErrorContext(player, action);
          throw new Error(
            `Invalid bet amount: ${action.amount}.\n` +
              `Reason: ${betResult.reason}\n` +
              `Constraints: Minimum bet=${this.config.bigBlind}, Player chips=${player.chips}\n` +
              `Game State: ${JSON.stringify(context, null, 2)}`,
          );
        }
        return;
      }

      case Action.RAISE: {
        if (currentBet === 0) {
          const context = this.buildErrorContext(player, action);
          throw new Error(
            'Cannot raise without a bet - use bet.\n' +
              'Reason: No current bet to raise (currentBet=0)\n' +
              `Solution: Use Action.BET with amount ${action.amount || this.config.bigBlind}\n` +
              `Game State: ${JSON.stringify(context, null, 2)}`,
          );
        }
        const raiseResult = this.validateRaiseAmount(action.amount, player);
        if (!raiseResult.valid) {
          const context = this.buildErrorContext(player, action);
          const minRaise = currentBet + this.getMinimumRaiseIncrement();
          throw new Error(
            `Invalid raise amount: ${action.amount}.\n` +
              `Reason: ${raiseResult.reason}\n` +
              `Constraints: Current bet=${currentBet}, Minimum raise to=${minRaise}, Player chips=${player.chips}, Player current bet=${player.bet}\n` +
              `Raise history this round: ${this.raiseHistory.length > 0 ? this.raiseHistory.join(', ') : 'none'}\n` +
              `Game State: ${JSON.stringify(context, null, 2)}`,
          );
        }
        return;
      }

      case Action.ALL_IN:
        // All-in is always valid
        return;

      default:
        // This should never happen now due to the enum check above
        throw new Error(
          `Unexpected action validation error for: ${action.action}`,
        );
    }
  }

  /**
   * Validate bet amount according to poker rules
   */
  validateBetAmount(amount, player) {
    // First validate it's an integer
    try {
      const validatedAmount = validateIntegerAmount(amount, 'bet amount');

      // Rule 5.2.1.1: Opening bet must be at least the big blind
      const minBet = this.config.bigBlind;

      if (validatedAmount < minBet) {
        return {
          valid: false,
          reason: `Minimum bet is ${minBet} (big blind), but tried to bet ${validatedAmount}. Player has ${player.chips} chips available`,
        };
      }

      if (validatedAmount > player.chips) {
        return {
          valid: false,
          reason: `Insufficient chips: tried to bet ${validatedAmount} but player only has ${player.chips} chips. Use Action.ALL_IN to bet all remaining chips`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: error.message,
      };
    }
  }

  /**
   * Validate raise amount according to poker rules
   */
  validateRaiseAmount(amount, player) {
    // First validate it's an integer
    try {
      const validatedAmount = validateIntegerAmount(amount, 'raise amount');
      amount = validatedAmount;
    } catch (error) {
      return {
        valid: false,
        reason: error.message,
      };
    }

    const currentBet = this.getCurrentBet();

    // The 'amount' parameter appears to be the total bet amount (raise TO)
    // not the raise increment (raise BY)
    const proposedTotalBet = amount;

    // Rule 5.2.2.2: Check if player has already acted and betting wasn't reopened
    if (player.hasActed) {
      return {
        valid: false,
        reason:
          'Cannot re-raise - betting was not reopened by a full raise. Player already acted this round. ' +
          `Last raise size: ${this.getLastRaiseSize()}, Minimum full raise: ${this.getMinimumRaiseIncrement()}`,
      };
    }

    if (proposedTotalBet > player.chips + player.bet) {
      const maxRaise = player.chips + player.bet;
      return {
        valid: false,
        reason:
          `Insufficient chips for raise to ${proposedTotalBet}. ` +
          `Player has ${player.chips} chips, current bet is ${player.bet}, ` +
          `maximum possible raise is to ${maxRaise}. Use Action.ALL_IN to go all-in`,
      };
    }

    // Rule 5.2.1.2: A raise must be at least equal to the largest prior bet or raise of the current round
    const minRaiseIncrement = this.getMinimumRaiseIncrement();
    const minTotalBet = currentBet + minRaiseIncrement;

    if (proposedTotalBet < minTotalBet) {
      return {
        valid: false,
        reason:
          `Minimum raise is to ${minTotalBet} (current bet: ${currentBet} + minimum increment: ${minRaiseIncrement}). ` +
          `Attempted raise to ${proposedTotalBet} is too small. ` +
          `Previous raises this round: ${this.raiseHistory.length > 0 ? this.raiseHistory.join(', ') : 'none'}`,
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
  async handlePlayerAction(player, action) {
    const endTimer = monitor.startTimer('handlePlayerAction');

    // Ensure amount is an integer before validation
    if (action.amount !== undefined) {
      action.amount = ensureInteger(action.amount, 'action amount');
    }

    // Validate the action - will throw if invalid (developer error)
    this.validateAction(player, action);

    // Store the player's last action
    player.lastAction = action.action;

    // CRITICAL FIX (v4.4.5): Emit action event BEFORE processing the action,
    // but AFTER validation and state setup. This ensures the action is always emitted,
    // even if the action ends the hand immediately (like a fold that wins the pot)
    this.emit('player:action', {
      playerId: player.id,
      action: action.action,
      amount: action.amount,
      potSize: this.potManager.getTotal(), // Include pot size for tournament logging
    });

    // Mark player as having acted BEFORE processing the action
    // This prevents infinite loops where fold ends the hand but player isn't marked as acted
    player.hasActed = true;

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
        // A bet opens a new betting round - reset hasActed for all other active players
        this.reopenBetting(player);
        break;
      case Action.RAISE:
        this.handleRaise(player, action.amount);
        break;
      case Action.ALL_IN:
        this.handleAllIn(player);
        break;
    }

    // If hand ended (e.g., all but one folded), don't continue betting
    if (handEnded) {
      endTimer();
      return;
    }

    // Check if betting round is complete after this action
    const isComplete = this.isBettingRoundComplete();
    if (isComplete) {
      await this.endBettingRound();
    } else {
      // Continue to next player
      const prevIndex = this.currentPlayerIndex;
      this.moveToNextActivePlayer();

      // Check if we found a valid next player
      const currentPlayer = this.players[this.currentPlayerIndex];
      if (
        this.currentPlayerIndex === prevIndex ||
        !currentPlayer ||
        currentPlayer.state !== PlayerState.ACTIVE ||
        currentPlayer.hasActed
      ) {
        // No valid next player found - this means all active players have acted
        // but betting round is not complete (bets not matched)
        // This shouldn't happen in normal flow but can occur in edge cases
        // Force end betting round to prevent stuck games
        await this.endBettingRound();
      } else if (this.phase !== GamePhase.ENDED) {
        // Valid next player found, continue
        await this.promptNextPlayer();
      }
    }

    endTimer();
  }

  /**
   * Handle fold action
   */
  handleFold(player) {
    player.state = PlayerState.FOLDED;

    // Check if only one player remains
    const activePlayers = this.players.filter(
      (p) => p.state === PlayerState.ACTIVE || p.state === PlayerState.ALL_IN,
    );

    if (activePlayers.length === 1) {
      // Last player wins by default
      const lastPlayer = activePlayers[0];
      const mockHand = {
        player: lastPlayer,
        hand: { rank: 999, description: 'Won by fold' },
        cards: this.playerHands.get(lastPlayer.id) || [],
      };
      const payouts = this.potManager.calculatePayouts([mockHand]);
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

      // Add to pot and check if all chips were accepted
      const result = this.potManager.addToPot(player, callAmount);
      const uncalledAmount = callAmount - result.totalContributed;

      // Return any uncalled chips to the player
      if (uncalledAmount > 0) {
        player.chips += uncalledAmount;
        player.bet -= uncalledAmount;
      }

      if (player.chips === 0) {
        player.state = PlayerState.ALL_IN;
      }
    }
  }

  /**
   * Handle bet action - ATOMIC version to prevent race conditions
   */
  handleBet(player, amount, blindType = '') {
    // Ensure amount is an integer
    const intAmount = ensureInteger(amount, 'bet amount');
    const actualAmount = Math.min(intAmount, player.chips);

    // ATOMIC FIX: Perform all state changes in one synchronous block
    // The key is that player.bet field acts as the "in-transit" tracking
    // So observers must count: player.chips + player.bet + pots

    player.chips -= actualAmount;
    player.bet += actualAmount;

    // Add to pot and get back what was actually accepted
    const result = this.potManager.addToPot(player, actualAmount);
    const uncalledAmount = actualAmount - result.totalContributed;

    // Return any uncalled chips
    if (uncalledAmount > 0) {
      player.chips += uncalledAmount;
      player.bet -= uncalledAmount;
    }

    if (player.chips === 0) {
      player.state = PlayerState.ALL_IN;
    }

    // Track last bettor for betting round completion
    if (!blindType) {
      this.lastBettor = player;
    }
  }

  /**
   * Handle raise action - tracks raise increments
   */
  handleRaise(player, amount) {
    // Ensure amount is an integer
    const intAmount = ensureInteger(amount, 'raise amount');
    const currentBet = this.getCurrentBet();
    const raiseIncrement = intAmount - currentBet;

    // Track this raise increment for minimum re-raise validation
    this.raiseHistory.push(raiseIncrement);

    // Use the same betting logic as handleBet
    this.handleBet(player, intAmount);

    // Check if this raise reopens betting (Rule 5.2.2.2)
    const minRaiseIncrement = this.getMinimumRaiseIncrement();
    if (raiseIncrement >= minRaiseIncrement) {
      // This is a full raise - reopen betting for all active players who already acted
      this.reopenBetting(player);
    }
  }

  /**
   * Handle all-in action
   */
  handleAllIn(player) {
    const allInAmount = player.chips;
    const totalBet = player.bet + allInAmount;
    const currentBet = this.getCurrentBet();

    // Let PotManager handle the all-in logic for side pot creation
    this.potManager.handleAllIn(player, totalBet);

    // Now do the actual bet
    this.handleBet(player, allInAmount);

    // CRITICAL: Set player state to ALL_IN after going all-in
    player.state = PlayerState.ALL_IN;

    // Check if this all-in reopens betting (Rule 5.2.2.2)
    // An all-in less than a full raise does not reopen betting
    const raiseIncrement = totalBet - currentBet;
    const minRaiseIncrement = this.getMinimumRaiseIncrement();

    if (raiseIncrement >= minRaiseIncrement) {
      // This is a full raise - reopen betting for all active players who already acted
      this.reopenBetting(player);
      // Also track this as a raise for future minimum calculations
      this.raiseHistory.push(raiseIncrement);
    }
  }

  /**
   * Reopen betting for players who have already acted
   * Called when a raise is large enough to constitute a full raise
   */
  reopenBetting(raisingPlayer) {
    // Reset hasActed for all active players except the one who just raised
    for (const player of this.players) {
      if (
        player.state === PlayerState.ACTIVE &&
        player.id !== raisingPlayer.id &&
        player.hasActed
      ) {
        player.hasActed = false;
      }
    }
  }

  /**
   * Get current bet amount
   */
  getCurrentBet() {
    const activePlayers = this.players.filter(
      (p) => p.state === PlayerState.ACTIVE || p.state === PlayerState.ALL_IN,
    );
    return Math.max(...activePlayers.map((p) => p.bet), 0);
  }

  /**
   * Check if betting round is complete
   */
  isBettingRoundComplete() {
    const activePlayers = this.players.filter(
      (p) => p.state === PlayerState.ACTIVE,
    );
    const allInPlayers = this.players.filter(
      (p) => p.state === PlayerState.ALL_IN,
    );
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
    const allActed = activePlayers.every((p) => p.hasActed);
    if (!allActed) {
      return false;
    }

    // All active players must have matched the current bet
    const currentBet = this.getCurrentBet();
    const allMatched = activePlayers.every((p) => p.bet === currentBet);

    // Special case: big blind option in preflop
    if (this.phase === GamePhase.PRE_FLOP) {
      const bbPlayer = activePlayers.find((p) => p.hasOption);
      if (bbPlayer && !bbPlayer.hasActed) {
        return false;
      }
    }

    return allMatched;
  }

  /**
   * End the current betting round
   */
  async endBettingRound() {
    // v4.4.7: Prevent multiple calls to endBettingRound for the same phase (race condition fix)
    if (this.endingBettingRound) {
      return;
    }
    this.endingBettingRound = true;

    this.potManager.endBettingRound();

    // Clear option flags
    for (const player of this.players) {
      player.hasOption = false;
    }

    // Progress to next phase
    switch (this.phase) {
      case GamePhase.PRE_FLOP:
        await this.dealFlop();
        break;
      case GamePhase.FLOP:
        await this.dealTurn();
        break;
      case GamePhase.TURN:
        await this.dealRiver();
        break;
      case GamePhase.RIVER:
        this.showdown();
        // v4.4.7: Reset flag after showdown since hand is complete (no more betting rounds)
        this.endingBettingRound = false;
        break;
    }

    // v4.4.7: Reset flag after phase transition (except for RIVER which resets above)
    if (this.phase !== GamePhase.RIVER) {
      this.endingBettingRound = false;
    }
  }

  /**
   * Deal the flop
   */
  async dealFlop() {
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

    // Check if betting is needed (more than one active player)
    const activePlayers = this.players.filter(
      (p) => p.state === PlayerState.ACTIVE,
    );

    if (activePlayers.length <= 1) {
      // No betting needed - all players except one (or none) are all-in
      // Progress directly to next phase without calling endBettingRound (avoids mutex issue)
      await this.dealTurn();
    } else {
      // Reset current player to first active player after button
      this.currentPlayerIndex = this.getNextActivePlayerIndex(
        this.dealerButtonIndex,
        false, // Don't skip acted players when starting new round
      );
      await this.startBettingRound();
    }
  }

  /**
   * Deal the turn
   */
  async dealTurn() {
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

    // Check if betting is needed (more than one active player)
    const activePlayers = this.players.filter(
      (p) => p.state === PlayerState.ACTIVE,
    );

    if (activePlayers.length <= 1) {
      // No betting needed - all players except one (or none) are all-in
      // Progress directly to next phase without calling endBettingRound (avoids mutex issue)
      await this.dealRiver();
    } else {
      this.currentPlayerIndex = this.getNextActivePlayerIndex(
        this.dealerButtonIndex,
        false, // Don't skip acted players when starting new round
      );
      await this.startBettingRound();
    }
  }

  /**
   * Deal the river
   */
  async dealRiver() {
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

    // Check if betting is needed (more than one active player)
    const activePlayers = this.players.filter(
      (p) => p.state === PlayerState.ACTIVE,
    );

    if (activePlayers.length <= 1) {
      // No betting needed - all players except one (or none) are all-in
      // Progress directly to showdown without calling endBettingRound (avoids mutex issue)
      this.showdown();
    } else {
      this.currentPlayerIndex = this.getNextActivePlayerIndex(
        this.dealerButtonIndex,
        false, // Don't skip acted players when starting new round
      );
      await this.startBettingRound();
    }
  }

  /**
   * Perform showdown
   */
  showdown() {
    this.phase = GamePhase.SHOWDOWN;

    const activePlayers = this.players.filter(
      (p) => p.state === PlayerState.ACTIVE || p.state === PlayerState.ALL_IN,
    );

    // Evaluate hands
    const playerHands = activePlayers.map((player) => {
      const holeCards = this.playerHands.get(player.id);
      const hand = HandEvaluator.evaluate([...holeCards, ...this.board]);

      return {
        player,
        hand,
        cards: holeCards,
      };
    });

    // Calculate payouts for all pots
    const payouts = this.potManager.calculatePayouts(playerHands);
    this.distributeWinnings(payouts);

    // Build winners array with amounts from payouts
    const winnersWithAmounts = [];
    for (const [player, amount] of payouts) {
      if (amount > 0) {
        const playerHandInfo = playerHands.find(
          (ph) => ph.player.id === player.id,
        );
        winnersWithAmounts.push({
          playerId: player.id,
          hand: playerHandInfo.hand,
          cards: playerHandInfo.cards,
          amount,
        });
      }
    }

    // Build showdown participants array - includes ALL players who reached showdown
    const showdownParticipants = [];
    for (const playerHandInfo of playerHands) {
      const amount = payouts.get(playerHandInfo.player) || 0;
      showdownParticipants.push({
        playerId: playerHandInfo.player.id,
        hand: playerHandInfo.hand,
        cards: playerHandInfo.cards,
        amount,
      });
    }

    this.emit('hand:complete', {
      winners: winnersWithAmounts,
      showdownParticipants,
      board: this.board,
      sidePots: this.getSidePotInfo(),
    });

    this.endHand(
      winnersWithAmounts.map((w) =>
        this.players.find((p) => p.id === w.playerId),
      ),
      showdownParticipants,
    );
  }

  /**
   * Get side pot information for display/testing
   */
  getSidePotInfo() {
    if (!this.potManager) {
      return [];
    }

    return this.potManager.getPotsInfo();
  }

  /**
   * End the hand
   */
  endHand(winners, showdownParticipants = null) {
    this.phase = GamePhase.ENDED;

    const result = {
      winners: winners.map((w) => w.id),
      finalChips: {},
      showdownHands: {},
    };

    // Include showdown participants if provided (from showdown scenarios)
    if (showdownParticipants) {
      result.showdownParticipants = showdownParticipants;
    }

    // Clear all player bets when hand ends - fixes bet clearing bug
    // This ensures bets are cleared even when hands end by folding
    for (const player of this.players) {
      player.bet = 0;
      result.finalChips[player.id] = player.chips;

      if (this.playerHands.has(player.id)) {
        result.showdownHands[player.id] = this.playerHands.get(player.id);
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

    // Clear all pots after distribution to complete double-entry bookkeeping
    this.potManager.clearAllPots();
  }

  /**
   * Get next active player index
   * @param {number} currentIndex - Current player index
   * @param {boolean} skipActedPlayers - If true, skip players who have already acted
   */
  getNextActivePlayerIndex(currentIndex, skipActedPlayers = false) {
    let nextIndex = (currentIndex + 1) % this.players.length;
    let loopCount = 0;

    while (nextIndex !== currentIndex && loopCount < this.players.length) {
      const player = this.players[nextIndex];
      if (player.state === PlayerState.ACTIVE) {
        // If we're skipping acted players, check hasActed
        if (!skipActedPlayers || !player.hasActed) {
          return nextIndex;
        }
      }
      nextIndex = (nextIndex + 1) % this.players.length;
      loopCount++;
    }

    // If we've looped through all players and found none, return -1 to indicate no valid player
    // This prevents infinite loops when all active players have acted
    if (skipActedPlayers && loopCount >= this.players.length) {
      return -1;
    }

    return currentIndex;
  }

  /**
   * Move to next active player
   * @param {boolean} skipActedPlayers - If true, skip players who have already acted (for betting rounds)
   */
  moveToNextActivePlayer(skipActedPlayers = true) {
    // When moving to next player during betting, skip players who have already acted
    const nextIndex = this.getNextActivePlayerIndex(
      this.currentPlayerIndex,
      skipActedPlayers,
    );

    // If no valid next player found (all have acted), keep current index
    if (nextIndex !== -1) {
      this.currentPlayerIndex = nextIndex;
    }
  }

  /**
   * Calculate valid actions for a player
   */
  calculateValidActions(player) {
    const validActions = [];
    const currentBet = this.getCurrentBet();
    const toCall = currentBet - player.bet;

    // CHECK is valid if nothing to call
    if (toCall === 0) {
      validActions.push(Action.CHECK);
    }

    // FOLD is only valid when facing a bet (toCall > 0)
    // In a simulation framework, players cannot fold when they can check for free
    if (toCall > 0) {
      validActions.push(Action.FOLD);
    }

    // CALL is valid if there's something to call and player has chips
    if (toCall > 0 && player.chips >= toCall) {
      validActions.push(Action.CALL);
    }

    // BET is valid if no current bet and player has chips
    if (currentBet === 0 && player.chips >= this.config.bigBlind) {
      validActions.push(Action.BET);
    }

    // RAISE is valid if there's a bet, player has chips, and hasn't already acted (or betting was reopened)
    if (currentBet > 0 && player.chips > toCall) {
      // Check if player can raise (hasn't acted or betting was reopened)
      if (!player.hasActed) {
        const minRaiseIncrement = this.getMinimumRaiseIncrement();
        const minTotalBet = currentBet + minRaiseIncrement;
        const maxRaise = player.chips + player.bet;

        if (maxRaise >= minTotalBet) {
          validActions.push(Action.RAISE);
        }
      }
    }

    // ALL_IN is always valid if player has chips
    if (player.chips > 0) {
      validActions.push(Action.ALL_IN);
    }

    return validActions;
  }

  /**
   * Calculate position information for all players
   * @returns {Object} Position mapping with player IDs and their roles
   */
  calculatePositionInfo() {
    const activePlayers = this.players.filter((p) => p.chips > 0);

    if (activePlayers.length < 2) {
      return {
        button: null,
        smallBlind: null,
        bigBlind: null,
        utg: null,
        positions: {},
        playerOrder: [],
      };
    }

    const positions = {};
    const playerOrder = this.players.map((p) => p.id);

    let buttonPlayerId = null;
    let smallBlindPlayerId = null;
    let bigBlindPlayerId = null;
    let utgPlayerId = null;

    // Use explicit position indices if provided (dead button rule)
    if (
      this.bigBlindPlayerIndex !== undefined &&
      this.bigBlindPlayerIndex !== null
    ) {
      const bbPlayer = this.players[this.bigBlindPlayerIndex];
      if (bbPlayer) {
        bigBlindPlayerId = bbPlayer.id;
        positions[bbPlayer.id] = 'big-blind';
      }

      if (
        !this.isDeadSmallBlind &&
        this.smallBlindPlayerIndex !== undefined &&
        this.smallBlindPlayerIndex !== null
      ) {
        const sbPlayer = this.players[this.smallBlindPlayerIndex];
        if (sbPlayer) {
          smallBlindPlayerId = sbPlayer.id;
          positions[sbPlayer.id] = 'small-blind';
        }
      }

      // Button is either explicit or derived
      if (
        this.buttonPlayerIndex !== undefined &&
        this.buttonPlayerIndex !== null
      ) {
        const buttonPlayer = this.players[this.buttonPlayerIndex];
        if (buttonPlayer) {
          buttonPlayerId = buttonPlayer.id;
          positions[buttonPlayer.id] = positions[buttonPlayer.id] || 'button';
        }
      }

      // Calculate UTG for explicit positions (3+ players)
      if (
        activePlayers.length >= 3 &&
        this.bigBlindPlayerIndex !== undefined &&
        this.bigBlindPlayerIndex !== null
      ) {
        const utgIndex = (this.bigBlindPlayerIndex + 1) % this.players.length;
        const utgPlayer = this.players[utgIndex];
        if (utgPlayer && utgPlayer.chips > 0) {
          utgPlayerId = utgPlayer.id;
          positions[utgPlayer.id] = 'under-the-gun';
        }
      }
    } else {
      // Fallback calculation for backward compatibility
      let sbIndex, bbIndex;

      if (activePlayers.length === 2) {
        // Heads-up: button is small blind
        sbIndex = this.dealerButtonIndex;
        bbIndex = this.getNextActivePlayerIndex(sbIndex);

        const sbPlayer = this.players[sbIndex];
        const bbPlayer = this.players[bbIndex];

        if (sbPlayer) {
          buttonPlayerId = sbPlayer.id;
          smallBlindPlayerId = sbPlayer.id;
          positions[sbPlayer.id] = 'button-small-blind';
        }
        if (bbPlayer) {
          bigBlindPlayerId = bbPlayer.id;
          positions[bbPlayer.id] = 'big-blind';
        }
      } else {
        // Multi-way: separate button, SB, BB
        const buttonIndex = this.dealerButtonIndex;
        sbIndex = (buttonIndex + 1) % this.players.length;
        bbIndex = (sbIndex + 1) % this.players.length;

        const buttonPlayer = this.players[buttonIndex];
        const sbPlayer = this.players[sbIndex];
        const bbPlayer = this.players[bbIndex];

        if (buttonPlayer) {
          buttonPlayerId = buttonPlayer.id;
          positions[buttonPlayer.id] = 'button';
        }
        if (sbPlayer) {
          smallBlindPlayerId = sbPlayer.id;
          positions[sbPlayer.id] = 'small-blind';
        }
        if (bbPlayer) {
          bigBlindPlayerId = bbPlayer.id;
          positions[bbPlayer.id] = 'big-blind';
        }

        // UTG is next player after BB (in 3+ player games)
        if (activePlayers.length >= 3) {
          const utgIndex = (bbIndex + 1) % this.players.length;
          const utgPlayer = this.players[utgIndex];
          if (utgPlayer && utgPlayer.chips > 0) {
            utgPlayerId = utgPlayer.id;
            positions[utgPlayer.id] = 'under-the-gun';
          }
        }
      }
    }

    // Mark remaining active players with positional names if possible
    if (activePlayers.length >= 4) {
      const remainingPlayers = activePlayers.filter((p) => !positions[p.id]);

      // Simple position naming for multi-way games
      remainingPlayers.forEach((player, index) => {
        if (!positions[player.id]) {
          if (
            remainingPlayers.length > 2 &&
            index < remainingPlayers.length - 2
          ) {
            positions[player.id] = 'middle-position';
          } else if (index === remainingPlayers.length - 2) {
            positions[player.id] = 'cutoff';
          } else if (index === remainingPlayers.length - 1) {
            positions[player.id] = 'late-position';
          }
        }
      });
    }

    return {
      button: buttonPlayerId,
      smallBlind: smallBlindPlayerId,
      bigBlind: bigBlindPlayerId,
      utg: utgPlayerId,
      positions, // Map of playerId -> position name
      playerOrder, // Array of all player IDs in seat order
      isDeadButton: this.isDeadButton,
      isDeadSmallBlind: this.isDeadSmallBlind,
    };
  }

  /**
   * Build current game state
   */
  buildGameState() {
    const endTimer = monitor.startTimer('buildGameState');

    // Create a fresh game state object instead of using the pool
    // This prevents issues with the object being reset while still in use
    const gameState = {
      phase: this.phase,
      communityCards: [...this.board],
      pot: this.potManager.getTotal(),
      currentBet: this.getCurrentBet(),
      currentPlayer: this.players[this.currentPlayerIndex].id,
      bigBlind: this.config.bigBlind,
      smallBlind: this.config.smallBlind,
      players: {},
    };

    // Add player states
    for (const player of this.players) {
      gameState.players[player.id] = {
        id: player.id,
        chips: player.chips,
        bet: player.bet,
        state: player.state,
        hasActed: player.hasActed,
        lastAction: player.lastAction,
      };
    }

    endTimer();
    return gameState;
  }

  /**
   * Abort the game
   */
  abort() {
    this.phase = GamePhase.ENDED;
    this.emit('game:aborted');
    this.removeAllListeners();
  }

  /**
   * Release a game state back to the pool
   * @deprecated No longer using object pool for game state
   */
  releaseGameState(_gameState) {
    // No-op: we're not using the pool anymore to avoid reset issues
    // Game state objects will be garbage collected normally
  }
}
