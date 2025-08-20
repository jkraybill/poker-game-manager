import { nanoid } from 'nanoid';
import { WildcardEventEmitter } from './base/WildcardEventEmitter.js';
import { GameEngine } from './game/GameEngine.js';
import { TableState, PlayerState } from './types/index.js';
import { validateIntegerAmount } from './utils/validation.js';
import { Deck } from './game/Deck.js';
import { BaseDeck } from './game/BaseDeck.js';

/**
 * Represents a poker table that manages games and players
 */
export class Table extends WildcardEventEmitter {
  constructor(config = {}) {
    super();

    this.id = config.id || nanoid();

    // Validate blinds are integers
    const validatedBlinds = {
      small: validateIntegerAmount(config.blinds?.small ?? 10, 'small blind'),
      big: validateIntegerAmount(config.blinds?.big ?? 20, 'big blind'),
    };

    this.config = {
      ...config,
      variant: config.variant || 'texas-holdem',
      maxPlayers: config.maxPlayers || 9,
      minPlayers: config.minPlayers || 2,
      blinds: validatedBlinds, // Ensure validated blinds override any spread config
      timeout: config.timeout || 30000,
    };

    // Simulation mode for fast execution without delays
    this.simulationMode = config.simulationMode === true;

    this.players = new Map();
    this.waitingList = [];
    this.state = TableState.WAITING;
    this.gameEngine = null;
    this.gameCount = 0;
    this.deck = null; // Deck instance for custom implementations
    this.handStartingChips = new Map(); // Track chip counts at start of each hand

    // Initialize deck from config or create default
    if (config.deck) {
      this.setDeck(config.deck);
    } else {
      this.deck = new Deck();
    }

    // Dead button rule tracking
    this.playerOrder = []; // Ordered list of player IDs by seat
    this.lastBigBlindPlayerId = null; // Track who posted BB last hand
    this.currentDealerButton = config.dealerButton ?? 0; // Initial button position
    this.nextBigBlindSeatNumber = null; // Track which seat posts BB next
    this.lastHandBlinds = { small: null, big: null }; // Track who posted blinds last hand
    this.isDeadButton = false; // Whether current button is on empty seat
    this.isDeadSmallBlind = false; // Whether small blind is dead this hand
  }

  /**
   * Add a player to the table
   * @param {Player} player - The player to add
   * @returns {boolean} True if player was added successfully
   */
  addPlayer(player) {
    if (this.players.size >= this.config.maxPlayers) {
      this.waitingList.push(player);
      this.emit('player:waiting', {
        player,
        position: this.waitingList.length,
      });
      return false;
    }

    if (this.players.has(player.id)) {
      throw new Error('Player already at table');
    }

    // Player should already have chips set before being added to the table
    // Tables no longer enforce buy-in limits - that's a tournament/room policy

    const seatNumber = this.getNextAvailableSeat();

    this.players.set(player.id, {
      player,
      state: PlayerState.WAITING,
      seatNumber,
    });

    this.emit('player:joined', {
      player,
      tableId: this.id,
      seatNumber,
    });

    // Emit event when minimum players first reached (consumer can decide to start)
    if (
      this.players.size === this.config.minPlayers &&
      this.state === TableState.WAITING
    ) {
      this.emit('table:ready', {
        playerCount: this.players.size,
        minPlayers: this.config.minPlayers,
      });
    }

    return true;
  }

  /**
   * Remove a player from the table
   * @param {string} playerId - The player ID to remove
   * @returns {boolean} True if player was removed
   */
  removePlayer(playerId) {
    const playerData = this.players.get(playerId);
    if (!playerData) {
      return false;
    }

    this.players.delete(playerId);
    this.emit('player:left', {
      playerId,
      tableId: this.id,
      chips: playerData.player.chips,
    });

    // Add waiting player if available
    if (this.waitingList.length > 0) {
      const nextPlayer = this.waitingList.shift();
      this.addPlayer(nextPlayer);
    }

    // Check if game should end
    if (
      this.players.size < this.config.minPlayers &&
      this.state === TableState.IN_PROGRESS
    ) {
      this.endGame('Not enough players');
    }

    return true;
  }

  /**
   * Set a custom deck instance for the next game
   * @param {BaseDeck} deck - Deck instance that extends BaseDeck
   */
  setDeck(deck) {
    if (this.state === TableState.IN_PROGRESS) {
      throw new Error('Cannot change deck while game is in progress');
    }

    // Validate deck extends BaseDeck
    if (!(deck instanceof BaseDeck)) {
      throw new Error('Provided deck must extend BaseDeck');
    }

    this.deck = deck;
  }

  /**
   * Start a new game if conditions are met
   * @returns {Promise<Object>} Result object with success status and details
   *   - success: boolean indicating if game started
   *   - reason: string explaining why game failed to start (if applicable)
   *   - details: object with additional context about the failure
   */
  async tryStartGame() {
    try {
      // Check table state
      if (this.state !== TableState.WAITING) {
        const stateNames = {
          [TableState.IN_PROGRESS]: 'IN_PROGRESS',
          [TableState.CLOSED]: 'CLOSED',
          [TableState.WAITING]: 'WAITING',
        };
        const failureResult = {
          success: false,
          reason: 'TABLE_NOT_READY',
          details: {
            currentState: stateNames[this.state] || this.state,
            message: `Table is not in WAITING state. Current state: ${stateNames[this.state] || this.state}`,
            tableId: this.id,
            gameCount: this.gameCount,
            timestamp: new Date().toISOString(),
            isGameInProgress: this.state === TableState.IN_PROGRESS,
            gameEngine: this.gameEngine ? 'exists' : 'null',
          },
        };

        // Emit failure event for debugging
        this.emit('game:start-failed', failureResult);

        return failureResult;
      }

      // Check player count
      if (this.players.size < this.config.minPlayers) {
        const failureResult = {
          success: false,
          reason: 'INSUFFICIENT_PLAYERS',
          details: {
            currentPlayers: this.players.size,
            minPlayers: this.config.minPlayers,
            message: `Need at least ${this.config.minPlayers} players to start. Currently have ${this.players.size} players.`,
            tableId: this.id,
            playerIds: Array.from(this.players.keys()),
            playerDetails: Array.from(this.players.entries()).map(
              ([id, data]) => ({
                id,
                name: data.player.name,
                chips: data.player.chips,
                seatNumber: data.seatNumber,
              }),
            ),
            timestamp: new Date().toISOString(),
            waitingListSize: this.waitingList.length,
          },
        };

        // Emit failure event for debugging
        this.emit('game:start-failed', failureResult);

        return failureResult;
      }

      // Check if all players have chips
      const playersWithNoChips = [];
      for (const [playerId, playerData] of this.players.entries()) {
        if (playerData.player.chips <= 0) {
          playersWithNoChips.push({
            id: playerId,
            name: playerData.player.name,
            chips: playerData.player.chips,
          });
        }
      }

      const activePlayers = this.players.size - playersWithNoChips.length;
      if (activePlayers < this.config.minPlayers) {
        const failureResult = {
          success: false,
          reason: 'INSUFFICIENT_ACTIVE_PLAYERS',
          details: {
            totalPlayers: this.players.size,
            activePlayers,
            minPlayers: this.config.minPlayers,
            playersWithNoChips,
            allPlayerChips: Array.from(this.players.entries()).map(
              ([id, data]) => ({
                id,
                name: data.player.name,
                chips: data.player.chips,
                state: data.state,
              }),
            ),
            message: `Only ${activePlayers} players have chips. Need at least ${this.config.minPlayers} active players.`,
            tableId: this.id,
            timestamp: new Date().toISOString(),
            tableState: this.state,
          },
        };

        // Emit failure event for debugging
        this.emit('game:start-failed', failureResult);

        return failureResult;
      }

      // Define activePlayersList early for error handling
      let activePlayersList = [];

      // Track chip counts before starting (for blind refund if needed)
      const chipSnapshot = new Map();
      for (const [playerId, playerData] of this.players.entries()) {
        chipSnapshot.set(playerId, playerData.player.chips);
      }

      // Only change state to IN_PROGRESS when we're actually ready to start
      // This prevents race conditions if an error occurs during setup

      try {
        this.state = TableState.IN_PROGRESS;
        this.gameCount++;

        // Capture starting chip counts for this hand (needed for elimination ordering)
        this.handStartingChips.clear();
        for (const [playerId, playerData] of this.players.entries()) {
          this.handStartingChips.set(playerId, playerData.player.chips);
        }
        // Initialize game engine
        // Sort players by seat number to ensure correct position order
        const sortedPlayers = Array.from(this.players.values()).sort(
          (a, b) => a.seatNumber - b.seatNumber,
        );

        // Calculate dead button positions
        const positions = this.calculateDeadButtonPositions();

        // Convert seat-based positions to player array indices
        activePlayersList = sortedPlayers
          .filter((pd) => pd.player.chips > 0)
          .map((pd) => pd.player);

        const buttonPlayerIndex = positions.buttonIndex;
        const smallBlindPlayerIndex = positions.smallBlindIndex;
        const bigBlindPlayerIndex = positions.bigBlindIndex;

        this.gameEngine = new GameEngine({
          variant: this.config.variant,
          players: activePlayersList,
          blinds: this.config.blinds,
          timeout: this.config.timeout,
          dealerButton: this.currentDealerButton,
          deck: this.deck, // Deck instance
          buttonPlayerIndex,
          smallBlindPlayerIndex,
          bigBlindPlayerIndex,
          isDeadButton: positions.isDeadButton,
          isDeadSmallBlind: positions.isDeadSmallBlind,
          simulationMode: this.simulationMode,
        });

        // Forward specific game events we care about
        const eventsToForward = [
          'game:started',
          'hand:started',
          'cards:dealt',
          'cards:community',
          'action:requested',
          'action:performed',
          'player:action',
          'pot:updated',
          'round:ended',
          'hand:complete',
          'chips:awarded',
        ];

        eventsToForward.forEach((eventName) => {
          this.gameEngine.on(eventName, (data) => {
            // Special handling for hand:complete to ensure proper event ordering
            if (eventName === 'hand:complete') {
              // Store the hand:ended data but handle it in handleGameEnd
              this.pendingHandEndedData = {
                ...data,
                tableId: this.id,
                gameNumber: this.gameCount,
              };
              // Don't emit hand:ended yet - it will be emitted after eliminations
              return;
            }

            // Map hand:complete to hand:ended for backward compatibility
            const emitEventName =
              eventName === 'hand:complete' ? 'hand:ended' : eventName;
            this.emit(emitEventName, {
              ...data,
              tableId: this.id,
              gameNumber: this.gameCount,
            });

            // Don't check here - it's too late, players are already removed
          });
        });

        this.gameEngine.on('game:ended', (result) => {
          this.handleGameEnd(result);
        });

        this.emit('game:started', {
          tableId: this.id,
          gameNumber: this.gameCount,
          players: Array.from(this.players.keys()),
        });

        await this.gameEngine.start();

        // Game started successfully
        return {
          success: true,
          reason: 'GAME_STARTED',
          details: {
            tableId: this.id,
            gameNumber: this.gameCount,
            playerCount: activePlayersList.length,
            blinds: this.config.blinds,
            message: `Game #${this.gameCount} started successfully with ${activePlayersList.length} players`,
          },
        };
      } catch (error) {
        // If game fails to start, revert state and refund blinds
        this.state = TableState.WAITING;

        // Refund blinds by restoring chip counts
        for (const [playerId, originalChips] of chipSnapshot.entries()) {
          const playerData = this.players.get(playerId);
          if (playerData) {
            playerData.player.chips = originalChips;
          }
        }

        this.gameEngine = null;
        this.emit('game:error', {
          tableId: this.id,
          error: error.message,
        });

        // Game failed to start with engine error
        const failureResult = {
          success: false,
          reason: 'ENGINE_ERROR',
          details: {
            error: error.message,
            errorName: error.name,
            stack: error.stack,
            tableId: this.id,
            gameCount: this.gameCount,
            message: `Failed to start game engine: ${error.message}`,
            timestamp: new Date().toISOString(),
            tableState: this.state,
            playerCount: this.players.size,
            playerIds: Array.from(this.players.keys()),
            config: {
              blinds: this.config.blinds,
              minPlayers: this.config.minPlayers,
              maxPlayers: this.config.maxPlayers,
              variant: this.config.variant,
            },
            activePlayersList: activePlayersList?.length || 0,
          },
        };

        // Emit failure event for debugging
        this.emit('game:start-failed', failureResult);

        return failureResult;
      }
    } catch (unexpectedError) {
      // Catch any unexpected errors that happen outside the inner try-catch
      // Ensure we ALWAYS return an object and emit the failure event

      // Revert state if it was changed
      if (this.state === TableState.IN_PROGRESS && !this.gameEngine) {
        this.state = TableState.WAITING;
      }

      const failureResult = {
        success: false,
        reason: 'UNEXPECTED_ERROR',
        details: {
          error: unexpectedError.message || 'Unknown error',
          errorName: unexpectedError.name || 'Error',
          stack: unexpectedError.stack,
          tableId: this.id,
          gameCount: this.gameCount,
          message: `Unexpected error in tryStartGame: ${unexpectedError.message || 'Unknown error'}`,
          timestamp: new Date().toISOString(),
          tableState: this.state,
          playerCount: this.players?.size || 0,
          playerIds: this.players ? Array.from(this.players.keys()) : [],
        },
      };

      // Emit failure event for debugging
      this.emit('game:start-failed', failureResult);

      // Always return an object, never throw
      return failureResult;
    }
  }

  /**
   * Calculate button and blind positions according to dead button rule
   * @returns {Object} Position information including dead button/blind status
   */
  calculateDeadButtonPositions() {
    const allPlayers = Array.from(this.players.values()).sort(
      (a, b) => a.seatNumber - b.seatNumber,
    );

    const activePlayers = allPlayers.filter((pd) => pd.player.chips > 0);

    // If less than 2 active players, no positions to calculate
    if (activePlayers.length < 2) {
      return {
        buttonIndex: 0,
        smallBlindIndex: null,
        bigBlindIndex: null,
        isDeadButton: false,
        isDeadSmallBlind: false,
      };
    }

    // CORE RULE: Big blind always advances forward one position each hand
    // We need to find the next player (by seat order) who can post BB

    let nextBBPlayerId = null;
    let nextBBSeatNumber = null;

    if (this.lastBigBlindPlayerId) {
      // Find the player who posted BB last hand
      const lastBBPlayerData = allPlayers.find(
        (pd) => pd.player.id === this.lastBigBlindPlayerId,
      );

      if (lastBBPlayerData) {
        // Find next active player clockwise from last BB
        const startIndex = allPlayers.indexOf(lastBBPlayerData);

        for (let i = 1; i <= allPlayers.length; i++) {
          const checkIndex = (startIndex + i) % allPlayers.length;
          const checkPlayer = allPlayers[checkIndex];

          if (checkPlayer.player.chips > 0) {
            nextBBPlayerId = checkPlayer.player.id;
            nextBBSeatNumber = checkPlayer.seatNumber;
            break;
          }
        }
      }
    }

    // Fallback for first hand or if last BB player not found
    if (!nextBBPlayerId) {
      // First hand - BB is 2 positions after initial button in active players
      if (activePlayers.length === 2) {
        // Heads-up: BB is opposite of button
        const bbIndex = (this.currentDealerButton + 1) % 2;
        nextBBPlayerId = activePlayers[bbIndex].player.id;
        nextBBSeatNumber = activePlayers[bbIndex].seatNumber;
      } else {
        // Multi-way: BB is 2 positions after button
        const bbIndex = (this.currentDealerButton + 2) % activePlayers.length;
        nextBBPlayerId = activePlayers[bbIndex].player.id;
        nextBBSeatNumber = activePlayers[bbIndex].seatNumber;
      }
    }

    // Now work backwards from BB to determine button and SB positions
    const bbPlayerData = allPlayers.find(
      (pd) => pd.player.id === nextBBPlayerId,
    );
    const bbSeatIndex = allPlayers.indexOf(bbPlayerData);

    // Find button position (2 seats before BB by seat order)
    const buttonSeatIndex =
      (bbSeatIndex - 2 + allPlayers.length) % allPlayers.length;
    const buttonPlayerData = allPlayers[buttonSeatIndex];
    const isDeadButton = buttonPlayerData.player.chips <= 0;

    // Find SB position (1 seat before BB by seat order)
    const sbSeatIndex =
      (bbSeatIndex - 1 + allPlayers.length) % allPlayers.length;
    const sbPlayerData = allPlayers[sbSeatIndex];
    const isDeadSmallBlind = sbPlayerData.player.chips <= 0;

    // Special handling for heads-up
    if (activePlayers.length === 2) {
      // In heads-up, button = SB, and they're opposite of BB
      const bbActiveIndex = activePlayers.findIndex(
        (p) => p.player.id === nextBBPlayerId,
      );
      const buttonActiveIndex = (bbActiveIndex + 1) % 2;

      return {
        buttonIndex: buttonActiveIndex,
        smallBlindIndex: buttonActiveIndex,
        bigBlindIndex: bbActiveIndex,
        isDeadButton: false,
        isDeadSmallBlind: false,
        nextBBSeatNumber,
      };
    }

    // For multi-way, we need to map seat positions to active player indices
    // But if button or SB is dead, we still track the "would-be" position

    // Find active player indices
    const bbActiveIndex = activePlayers.findIndex(
      (p) => p.player.id === nextBBPlayerId,
    );

    // For button: if dead, find next active player counter-clockwise
    let buttonActiveIndex;
    if (!isDeadButton) {
      buttonActiveIndex = activePlayers.findIndex(
        (p) => p.player.id === buttonPlayerData.player.id,
      );
    } else {
      // Dead button - find the active player who would act as if button was there
      // This is the last active player before the dead button position
      for (let i = 1; i <= allPlayers.length; i++) {
        const checkIndex =
          (buttonSeatIndex - i + allPlayers.length) % allPlayers.length;
        const checkPlayer = allPlayers[checkIndex];
        if (checkPlayer.player.chips > 0) {
          buttonActiveIndex = activePlayers.findIndex(
            (p) => p.player.id === checkPlayer.player.id,
          );
          break;
        }
      }
      // But we still want to show button at the dead seat for display
      buttonActiveIndex = buttonSeatIndex;
    }

    // For SB: if dead, no one posts small blind
    let smallBlindActiveIndex;
    if (!isDeadSmallBlind) {
      smallBlindActiveIndex = activePlayers.findIndex(
        (p) => p.player.id === sbPlayerData.player.id,
      );
    } else {
      smallBlindActiveIndex = null; // No one posts SB
    }

    // Store the next BB seat number for next hand
    this.nextBigBlindSeatNumber = nextBBSeatNumber;

    return {
      buttonIndex: isDeadButton ? buttonSeatIndex : buttonActiveIndex,
      smallBlindIndex: smallBlindActiveIndex,
      bigBlindIndex: bbActiveIndex,
      isDeadButton,
      isDeadSmallBlind,
      nextBBSeatNumber,
    };
  }

  /**
   * Handle game end
   */
  handleGameEnd(_result) {
    // Don't change state to WAITING yet - do it after all cleanup and events
    // This prevents race conditions where clients try to start new games too early

    // Update chip counts are already handled by GameEngine via player.chips setter
    // No need to update here since Player instances are shared

    // Get all players sorted by seat number
    const allPlayers = Array.from(this.players.values()).sort(
      (a, b) => a.seatNumber - b.seatNumber,
    );

    // Get only active players (those who will remain after eliminations)
    const activePlayers = allPlayers.filter((pd) => pd.player.chips > 0);

    // Track who posted big blind this hand for next hand's dead button calculation
    const gameEngine = this.gameEngine;
    if (
      gameEngine &&
      gameEngine.bigBlindPlayerIndex !== undefined &&
      gameEngine.bigBlindPlayerIndex !== null
    ) {
      // Use the explicit big blind index from game engine
      const bbPlayer = gameEngine.players[gameEngine.bigBlindPlayerIndex];
      if (bbPlayer) {
        this.lastBigBlindPlayerId = bbPlayer.id;
      }
    } else if (gameEngine && activePlayers.length >= 2) {
      // Fallback to old calculation for backward compatibility
      const bbIndex =
        activePlayers.length === 2
          ? (this.currentDealerButton + 1) % 2
          : (this.currentDealerButton + 2) % activePlayers.length;

      if (bbIndex >= 0 && bbIndex < activePlayers.length) {
        this.lastBigBlindPlayerId = activePlayers[bbIndex].player.id;
      }
    }

    // Calculate dead button positions for next hand
    if (activePlayers.length >= 2) {
      const positions = this.calculateDeadButtonPositions();

      // Update button position for next hand
      this.currentDealerButton = positions.buttonIndex;
      this.isDeadButton = positions.isDeadButton;
      this.isDeadSmallBlind = positions.isDeadSmallBlind;

      // Store who should post BB next
      if (
        positions.bigBlindIndex >= 0 &&
        positions.bigBlindIndex < activePlayers.length
      ) {
        const nextBBPlayer = activePlayers[positions.bigBlindIndex];
        this.nextBigBlindSeatNumber = nextBBPlayer.seatNumber;
      }
    }

    // Collect players to eliminate
    const playersToEliminate = [];
    for (const [playerId, playerData] of this.players.entries()) {
      if (playerData.player.chips <= 0) {
        const startingChips = this.handStartingChips.get(playerId) || 0;
        playersToEliminate.push({
          playerId,
          playerData,
          startingChips,
        });
      }
    }

    // Handle player eliminations BEFORE hand:ended (v3.0.2 fix for event ordering)
    if (playersToEliminate.length > 0) {
      // Sort players by starting chip count (smallest stack first = lower finishing position)
      // This follows tournament rules: players with smaller stacks finish lower
      playersToEliminate.sort((a, b) => a.startingChips - b.startingChips);

      // Process eliminations atomically - remove player then emit elimination event
      playersToEliminate.forEach(({ playerId, startingChips }, index) => {
        // Remove player from table first
        this.players.delete(playerId);

        // Add waiting player if available (same logic as removePlayer)
        if (this.waitingList.length > 0) {
          const nextPlayer = this.waitingList.shift();
          this.addPlayer(nextPlayer);
        }

        // ATOMIC: Emit elimination event AFTER removal (table state is consistent)
        this.emit('player:eliminated', {
          playerId,
          tableId: this.id,
          finalChips: 0,
          gameNumber: this.gameCount,
          startingChips, // Include starting chips for tournament tracking
          finishingPosition: playersToEliminate.length - index, // Lower position = earlier elimination
        });
      });

      // Check if game should end due to insufficient players (same logic as removePlayer)
      // Note: This happens after eliminations, so table state is about to become WAITING anyway
      if (
        this.players.size < this.config.minPlayers &&
        this.state === TableState.IN_PROGRESS
      ) {
        this.endGame('Not enough players after eliminations');
      }
    }

    // CRITICAL FIX (v4.4.3): Change state to WAITING before emitting hand:ended
    // This ensures isGameInProgress() returns false when hand:ended fires,
    // preventing race conditions in tournament managers
    this.state = TableState.WAITING;

    // Now emit hand:ended AFTER eliminations have been processed AND state changed
    // Events are already in the correct order (eliminations first, then hand:ended)
    if (this.pendingHandEndedData) {
      const dataToEmit = this.pendingHandEndedData;
      this.pendingHandEndedData = null;
      this.emit('hand:ended', dataToEmit);
    }

    // Clean up game engine
    if (this.gameEngine) {
      this.gameEngine.removeAllListeners();
      this.gameEngine = null;
    }

    // Game has ended - table consumer can start a new game if desired
  }

  /**
   * Get next available seat number
   */
  getNextAvailableSeat() {
    const occupiedSeats = new Set(
      Array.from(this.players.values()).map((p) => p.seatNumber),
    );

    for (let i = 1; i <= this.config.maxPlayers; i++) {
      if (!occupiedSeats.has(i)) {
        return i;
      }
    }

    throw new Error('No available seats');
  }

  /**
   * End the current game
   */
  endGame(reason) {
    if (this.gameEngine) {
      this.gameEngine.abort();
      this.gameEngine = null;
    }
    this.state = TableState.WAITING;
    this.emit('game:ended', {
      tableId: this.id,
      reason,
    });
  }

  /**
   * Check if game is in progress
   */
  isGameInProgress() {
    return this.state === TableState.IN_PROGRESS;
  }

  /**
   * Get player count
   */
  getPlayerCount() {
    return this.players.size;
  }

  /**
   * Get table info
   */
  getInfo() {
    return {
      id: this.id,
      variant: this.config.variant,
      players: this.players.size,
      maxPlayers: this.config.maxPlayers,
      blinds: this.config.blinds,
      state: this.state,
      gameCount: this.gameCount,
      waitingList: this.waitingList.length,
    };
  }

  /**
   * Remove all players from the table
   */
  removeAllPlayers() {
    // Create a copy of player IDs to avoid modifying while iterating
    const playerIds = Array.from(this.players.keys());

    for (const playerId of playerIds) {
      this.removePlayer(playerId);
    }

    // Clear waiting list as well
    this.waitingList = [];
  }

  /**
   * Run a complete hand synchronously without events
   * Used for Monte Carlo simulations and fast hand resolution
   * @returns {Object} Hand results including winners, pot, and final chips
   */
  runHandToCompletion() {
    // Check if we have enough players
    if (this.players.size < this.config.minPlayers) {
      return {
        success: false,
        error: `Not enough players. Need ${this.config.minPlayers}, have ${this.players.size}`,
      };
    }

    // Check if game is already in progress
    if (this.state === TableState.IN_PROGRESS) {
      return {
        success: false,
        error: 'Game already in progress',
      };
    }

    // Save current state for restoration
    const savedState = this.state;
    const savedListeners = this.listeners('hand:ended');

    try {
      // Remove event listeners to prevent external notifications
      this.removeAllListeners('hand:ended');

      // Track the result
      let handResult = null;

      // Add internal listener to capture result
      this.once('hand:ended', (data) => {
        handResult = data;
      });

      // Start the game synchronously
      const startResult = this.tryStartGameSync();
      if (!startResult.success) {
        return {
          success: false,
          error: startResult.reason || 'Failed to start game',
        };
      }

      // Run the game engine synchronously
      if (!this.gameEngine) {
        return {
          success: false,
          error: 'Game engine not initialized',
        };
      }

      // Temporarily disable async events
      const originalEmit = this.gameEngine.emit;
      this.gameEngine.emit = () => {}; // Disable events temporarily

      // Run the hand to completion
      const engineResult = this.gameEngine.runToCompletion();

      // Restore emit
      this.gameEngine.emit = originalEmit;

      // Process the result
      if (!engineResult.success) {
        return {
          success: false,
          error: engineResult.error || 'Hand failed to complete',
        };
      }

      // Build the final result
      const finalChips = {};
      for (const [playerId, playerData] of this.players) {
        finalChips[playerId] = playerData.player.chips;
      }

      return {
        success: true,
        winners: engineResult.winners || handResult?.winners || [],
        pot: engineResult.pot || handResult?.pot || 0,
        finalChips,
        board: engineResult.board || handResult?.board,
        sidePots: engineResult.sidePots,
        showdownParticipants:
          engineResult.showdownParticipants || handResult?.showdownParticipants,
        handHistory: engineResult.handHistory,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unexpected error during hand execution',
      };
    } finally {
      // Restore state
      this.state = savedState;

      // Restore listeners
      for (const listener of savedListeners) {
        this.on('hand:ended', listener);
      }

      // Clean up game engine
      if (this.gameEngine) {
        this.gameEngine.removeAllListeners();
        this.gameEngine = null;
      }
    }
  }

  /**
   * Try to start a game synchronously (without async/await)
   * Internal method for runHandToCompletion
   */
  tryStartGameSync() {
    // Check minimum players
    const activePlayers = Array.from(this.players.values()).filter(
      (p) => p.player.chips > 0,
    );

    if (activePlayers.length < this.config.minPlayers) {
      return {
        success: false,
        reason: 'Not enough active players',
        details: {
          required: this.config.minPlayers,
          active: activePlayers.length,
          total: this.players.size,
        },
      };
    }

    // Check if game is already in progress
    if (this.state === TableState.IN_PROGRESS) {
      return {
        success: false,
        reason: 'Game already in progress',
        details: {
          state: this.state,
        },
      };
    }

    // Start the game
    this.startGameSync();

    return {
      success: true,
    };
  }

  /**
   * Start a game synchronously (internal method)
   */
  startGameSync() {
    // Store starting chip counts for comparison
    this.handStartingChips.clear();
    for (const [playerId, playerData] of this.players) {
      this.handStartingChips.set(playerId, playerData.player.chips);
    }

    // Get all players sorted by seat
    const sortedPlayers = Array.from(this.players.values()).sort(
      (a, b) => a.seatNumber - b.seatNumber,
    );

    const positions = this.calculateDeadButtonPositions();

    // Get active players list
    const activePlayersList = sortedPlayers
      .filter((pd) => pd.player.chips > 0)
      .map((pd) => pd.player);

    this.state = TableState.IN_PROGRESS;
    this.gameCount++;

    // Create game engine with proper configuration
    this.gameEngine = new GameEngine({
      variant: this.config.variant,
      players: activePlayersList,
      blinds: this.config.blinds,
      timeout: this.config.timeout,
      dealerButton: this.currentDealerButton,
      deck: this.deck,
      buttonPlayerIndex: positions.buttonIndex,
      smallBlindPlayerIndex: positions.smallBlindIndex,
      bigBlindPlayerIndex: positions.bigBlindIndex,
      isDeadButton: positions.isDeadButton,
      isDeadSmallBlind: positions.isDeadSmallBlind,
      simulationMode: this.simulationMode,
    });

    // No event listeners in sync mode - we'll handle everything internally
    // Don't call start() as that triggers async flow

    this.emit('game:started', {
      tableId: this.id,
      gameCount: this.gameCount,
      players: activePlayersList.length,
      dealerButton: positions.buttonIndex,
      isDeadButton: positions.isDeadButton,
      isDeadSmallBlind: positions.isDeadSmallBlind,
    });
  }

  /**
   * Close the table
   */
  close() {
    if (this.gameEngine) {
      this.gameEngine.abort();
    }

    this.state = TableState.CLOSED;
    this.emit('table:closed', { tableId: this.id });
    this.removeAllListeners();
  }

  /**
   * Static method to run multiple poker simulations efficiently
   * Enables Monte Carlo analysis with parallel execution support
   *
   * @param {Object} options - Simulation configuration
   * @param {number} options.count - Number of simulations to run
   * @param {Object} options.config - Table configuration for each simulation
   * @param {Array<Player>} options.players - Player instances to use in simulations
   * @param {BaseDeck} [options.deck] - Optional custom deck (will be reset for each simulation)
   * @param {number} [options.parallel=1] - Number of concurrent simulations (default: sequential)
   * @returns {Promise<Object>} Results with simulations array and aggregated statistics
   */
  static async runSimulations(options) {
    const { count, config, players, deck = null, parallel = 1 } = options;

    // Validate inputs
    if (!count || count <= 0) {
      throw new Error('count must be a positive number');
    }
    if (!config) {
      throw new Error('config is required');
    }
    if (!players || !Array.isArray(players) || players.length === 0) {
      throw new Error('players array is required and must not be empty');
    }

    const results = {
      simulations: [],
      stats: {
        totalSimulations: count,
        successfulSimulations: 0,
        successRate: 0,
        averagePot: 0,
        playerWins: {},
      },
    };

    // Initialize player win counters
    players.forEach((player) => {
      results.stats.playerWins[player.id] = 0;
    });

    // Create simulation tasks
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push(() => Table._runSingleSimulation(config, players, deck));
    }

    // Execute simulations (sequential or parallel)
    if (parallel <= 1) {
      // Sequential execution
      for (const task of tasks) {
        const result = await task();
        results.simulations.push(result);
      }
    } else {
      // Parallel execution with controlled concurrency
      const batches = [];
      for (let i = 0; i < tasks.length; i += parallel) {
        batches.push(tasks.slice(i, i + parallel));
      }

      for (const batch of batches) {
        const batchPromises = batch.map((task) => task());
        const batchResults = await Promise.all(batchPromises);
        results.simulations.push(...batchResults);
      }
    }

    // Calculate aggregated statistics
    let totalPot = 0;
    let successCount = 0;

    results.simulations.forEach((simulation) => {
      if (simulation.success) {
        successCount++;
        totalPot += simulation.pot || 0;

        // Count wins for each player
        if (simulation.winners) {
          simulation.winners.forEach((winner) => {
            if (results.stats.playerWins[winner.playerId] !== undefined) {
              results.stats.playerWins[winner.playerId]++;
            }
          });
        }
      }
    });

    results.stats.successfulSimulations = successCount;
    results.stats.successRate = count > 0 ? successCount / count : 0;
    results.stats.averagePot = successCount > 0 ? totalPot / successCount : 0;

    return results;
  }

  /**
   * Run a single simulation (internal helper)
   * @private
   */
  static _runSingleSimulation(config, players, customDeck) {
    try {
      // Create a temporary table for this simulation
      const table = new Table({
        ...config,
        simulationMode: true, // Force simulation mode for performance
      });

      // Set custom deck if provided (create a fresh copy for each simulation)
      if (customDeck) {
        // Create a fresh deck with the same configuration
        const DeckClass = customDeck.constructor;
        const freshDeck = new DeckClass({
          cards: customDeck.originalCards,
          dealAlternating: customDeck.dealAlternating,
        });
        table.setDeck(freshDeck);
      }

      // Add players to the table (with fresh chip amounts)
      players.forEach((player, index) => {
        // Reset player chips from config if specified
        if (config.chipAmounts && config.chipAmounts[index]) {
          player.chips = config.chipAmounts[index];
        } else {
          // Default chip amount if not specified
          player.chips = 1000;
        }
        table.addPlayer(player);
      });

      // Run the hand synchronously
      const result = table.runHandToCompletion();

      // Clean up
      table.close();

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        winners: [],
        pot: 0,
        finalChips: {},
      };
    }
  }
}
