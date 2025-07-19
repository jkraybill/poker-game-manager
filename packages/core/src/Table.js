import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import { GameEngine } from './game/GameEngine.js';
import { TableState, PlayerState } from './types/index.js';

/**
 * Represents a poker table that manages games and players
 */
export class Table extends EventEmitter {
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

    this.players.set(player.id, {
      player,
      chips: this.config.minBuyIn,
      state: PlayerState.WAITING,
      seatNumber: this.getNextAvailableSeat(),
    });

    this.emit('player:joined', { 
      player,
      tableId: this.id,
      seatNumber: this.players.get(player.id).seatNumber,
    });

    // Check if we can start a game
    if (this.players.size >= this.config.minPlayers && this.state === TableState.WAITING) {
      // Delay start to allow more players to join
      setTimeout(() => {
        if (this.state === TableState.WAITING) {
          this.tryStartGame();
        }
      }, 100);
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
      chips: playerData.chips,
    });

    // Add waiting player if available
    if (this.waitingList.length > 0) {
      const nextPlayer = this.waitingList.shift();
      this.addPlayer(nextPlayer);
    }

    // Check if game should end
    if (this.players.size < this.config.minPlayers && this.state === TableState.IN_PROGRESS) {
      this.endGame('Not enough players');
    }

    return true;
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

    try {
      // Initialize game engine
      // Sort players by seat number to ensure correct position order
      const sortedPlayers = Array.from(this.players.values())
        .sort((a, b) => a.seatNumber - b.seatNumber);
      
      this.gameEngine = new GameEngine({
        variant: this.config.variant,
        players: sortedPlayers.map(playerData => ({
          player: playerData.player,
          chips: playerData.chips,
        })),
        blinds: this.config.blinds,
        timeout: this.config.timeout,
      });

      // Forward specific game events we care about
      const eventsToForward = [
        'game:started', 'hand:started', 'cards:dealt', 'action:requested',
        'action:performed', 'player:action', 'pot:updated', 'round:ended',
        'hand:complete', 'chips:awarded',
      ];
      
      eventsToForward.forEach(eventName => {
        this.gameEngine.on(eventName, (data) => {
          // Map hand:complete to hand:ended for backward compatibility
          const emitEventName = eventName === 'hand:complete' ? 'hand:ended' : eventName;
          this.emit(emitEventName, {
            ...data,
            tableId: this.id,
            gameNumber: this.gameCount,
          });
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
  handleGameEnd(result) {
    this.state = TableState.WAITING;
    
    // Update chip counts
    for (const [playerId, chips] of Object.entries(result.finalChips)) {
      const playerData = this.players.get(playerId);
      if (playerData) {
        playerData.chips = chips;
      }
    }

    // Remove broke players
    for (const [playerId, playerData] of this.players.entries()) {
      if (playerData.chips <= 0) {
        this.removePlayer(playerId);
      }
    }

    // Start new game after delay
    setTimeout(() => {
      if (this.players.size >= this.config.minPlayers) {
        this.tryStartGame();
      }
    }, 5000);
  }

  /**
   * Get next available seat number
   */
  getNextAvailableSeat() {
    const occupiedSeats = new Set(
      Array.from(this.players.values()).map(p => p.seatNumber),
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