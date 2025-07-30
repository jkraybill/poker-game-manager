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
    
    // Button rotation: move to next active player
    if (activePlayers.length >= 2) {
      // Find the next active player after current button
      let nextButtonIndex = -1;
      
      // Start searching from the position after current button
      for (let i = 1; i <= allPlayers.length; i++) {
        const checkIndex = (this.currentDealerButton + i) % allPlayers.length;
        const playerData = allPlayers[checkIndex];
        
        // If this player will remain active, they get the button
        if (playerData && playerData.player.chips > 0) {
          // Find this player's index in the active players array
          nextButtonIndex = activePlayers.findIndex(ap => ap.player.id === playerData.player.id);
          break;
        }
      }
      
      // Update button position to the active player index
      if (nextButtonIndex >= 0) {
        this.currentDealerButton = nextButtonIndex;
      } else {
        // Fallback: just move to next position in active players
        this.currentDealerButton = 0;
      }
      
      // TODO: Implement proper dead button rule (Issue #37) to prevent players
      // from posting BB twice in a row when others are eliminated
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
