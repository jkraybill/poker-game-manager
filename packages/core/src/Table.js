import { nanoid } from 'nanoid';
import { WildcardEventEmitter } from './base/WildcardEventEmitter.js';
import { GameEngine } from './game/GameEngine.js';
import { TableState, PlayerState } from './types/index.js';

/**
 * Represents a poker table that manages games and players
 */
export class Table extends WildcardEventEmitter {
  constructor(config = {}) {
    super();

    this.id = config.id || nanoid();
    this.config = {
      variant: config.variant || 'texas-holdem',
      maxPlayers: config.maxPlayers || 9,
      minPlayers: config.minPlayers || 2,
      blinds: config.blinds || { small: 10, big: 20 },
      minBuyIn: config.minBuyIn || 1000,
      maxBuyIn: config.maxBuyIn || 10000,
      timeout: config.timeout || 30000,
      ...config,
    };

    this.players = new Map();
    this.waitingList = [];
    this.state = TableState.WAITING;
    this.gameEngine = null;
    this.gameCount = 0;
    this.customDeck = null;
    this.handStartingChips = new Map(); // Track chip counts at start of each hand
    
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
      this.emit('player:waiting', { player, position: this.waitingList.length });
      return false;
    }

    if (this.players.has(player.id)) {
      throw new Error('Player already at table');
    }

    // Set player's initial chips
    player.buyIn(this.config.minBuyIn);

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
   * Set a custom deck for deterministic testing
   * @param {Array} cards - Array of card objects
   */
  setCustomDeck(cards) {
    if (this.state === TableState.IN_PROGRESS) {
      throw new Error('Cannot set custom deck while game is in progress');
    }
    this.customDeck = cards;
  }

  /**
   * Start a new game if conditions are met
   */
  tryStartGame() {
    if (this.state !== TableState.WAITING) {
      return;
    }

    if (this.players.size < this.config.minPlayers) {
      return;
    }

    this.state = TableState.IN_PROGRESS;
    this.gameCount++;

    // Capture starting chip counts for this hand (needed for elimination ordering)
    this.handStartingChips.clear();
    for (const [playerId, playerData] of this.players.entries()) {
      this.handStartingChips.set(playerId, playerData.player.chips);
    }

    try {
      // Initialize game engine
      // Sort players by seat number to ensure correct position order
      const sortedPlayers = Array.from(this.players.values()).sort(
        (a, b) => a.seatNumber - b.seatNumber,
      );

      this.gameEngine = new GameEngine({
        variant: this.config.variant,
        players: sortedPlayers.map((pd) => pd.player), // Pass Player instances directly
        blinds: this.config.blinds,
        timeout: this.config.timeout,
        dealerButton: this.currentDealerButton,
        customDeck: this.customDeck,
        isDeadButton: this.isDeadButton,
        isDeadSmallBlind: this.isDeadSmallBlind,
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

      this.gameEngine.start();

      // Clear custom deck after use
      this.customDeck = null;
    } catch (error) {
      // If game fails to start, revert state
      this.state = TableState.WAITING;
      this.gameEngine = null;
      this.emit('game:error', {
        tableId: this.id,
        error: error.message,
      });
    }
  }


  /**
   * Calculate button and blind positions according to dead button rule
   * @returns {Object} Position information including dead button/blind status
   */
  calculateDeadButtonPositions() {
    const allPlayers = Array.from(this.players.values())
      .sort((a, b) => a.seatNumber - b.seatNumber);
    
    const activePlayers = allPlayers.filter(pd => pd.player.chips > 0);
    
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
      const lastBBPlayerData = allPlayers.find(pd => pd.player.id === this.lastBigBlindPlayerId);
      
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
    const bbPlayerData = allPlayers.find(pd => pd.player.id === nextBBPlayerId);
    const bbSeatIndex = allPlayers.indexOf(bbPlayerData);
    
    // Find button position (2 seats before BB by seat order)
    const buttonSeatIndex = (bbSeatIndex - 2 + allPlayers.length) % allPlayers.length;
    const buttonPlayerData = allPlayers[buttonSeatIndex];
    const isDeadButton = buttonPlayerData.player.chips <= 0;
    
    // Find SB position (1 seat before BB by seat order)
    const sbSeatIndex = (bbSeatIndex - 1 + allPlayers.length) % allPlayers.length;
    const sbPlayerData = allPlayers[sbSeatIndex];
    const isDeadSmallBlind = sbPlayerData.player.chips <= 0;
    
    // Special handling for heads-up
    if (activePlayers.length === 2) {
      // In heads-up, button = SB, and they're opposite of BB
      const bbActiveIndex = activePlayers.findIndex(p => p.player.id === nextBBPlayerId);
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
    const bbActiveIndex = activePlayers.findIndex(p => p.player.id === nextBBPlayerId);
    
    // For button: if dead, find next active player counter-clockwise
    let buttonActiveIndex;
    if (!isDeadButton) {
      buttonActiveIndex = activePlayers.findIndex(p => p.player.id === buttonPlayerData.player.id);
    } else {
      // Dead button - find the active player who would act as if button was there
      // This is the last active player before the dead button position
      for (let i = 1; i <= allPlayers.length; i++) {
        const checkIndex = (buttonSeatIndex - i + allPlayers.length) % allPlayers.length;
        const checkPlayer = allPlayers[checkIndex];
        if (checkPlayer.player.chips > 0) {
          buttonActiveIndex = activePlayers.findIndex(p => p.player.id === checkPlayer.player.id);
          break;
        }
      }
      // But we still want to show button at the dead seat for display
      buttonActiveIndex = buttonSeatIndex;
    }
    
    // For SB: if dead, no one posts small blind
    let smallBlindActiveIndex;
    if (!isDeadSmallBlind) {
      smallBlindActiveIndex = activePlayers.findIndex(p => p.player.id === sbPlayerData.player.id);
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
    this.state = TableState.WAITING;

    // Update chip counts are already handled by GameEngine via player.chips setter
    // No need to update here since Player instances are shared

    // Get all players sorted by seat number
    const allPlayers = Array.from(this.players.values())
      .sort((a, b) => a.seatNumber - b.seatNumber);
    
    // Get only active players (those who will remain after eliminations)
    const activePlayers = allPlayers.filter(pd => pd.player.chips > 0);
    
    // Track who posted big blind this hand before updating for next hand
    const gameEngine = this.gameEngine;
    if (gameEngine && activePlayers.length >= 2) {
      // Find who posted BB this hand
      const bbIndex = activePlayers.length === 2 ? 
        (this.currentDealerButton + 1) % 2 : 
        (this.currentDealerButton + 2) % activePlayers.length;
      
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
      if (positions.bigBlindIndex >= 0 && positions.bigBlindIndex < activePlayers.length) {
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
    
    // Use process.nextTick to ensure elimination events fire after hand:ended
    if (playersToEliminate.length > 0) {
      process.nextTick(() => {
        // Sort players by starting chip count (smallest stack first = lower finishing position)
        // This follows tournament rules: players with smaller stacks finish lower
        playersToEliminate.sort((a, b) => a.startingChips - b.startingChips);
        
        // Emit elimination events sequentially, not simultaneously
        // Use small delays to ensure proper ordering and avoid simultaneous timestamps
        playersToEliminate.forEach(({ playerId, startingChips }, index) => {
          setTimeout(() => {
            this.emit('player:eliminated', {
              playerId,
              tableId: this.id,
              finalChips: 0,
              gameNumber: this.gameCount,
              startingChips, // Include starting chips for tournament tracking
              finishingPosition: playersToEliminate.length - index, // Lower position = earlier elimination
            });
          }, index * 10); // 10ms delay between eliminations for proper ordering
        });
        
        // Remove players after all elimination events are scheduled
        setTimeout(() => {
          for (const { playerId } of playersToEliminate) {
            this.removePlayer(playerId);
          }
        }, playersToEliminate.length * 10 + 50); // Wait for all eliminations + buffer
      });
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
}
