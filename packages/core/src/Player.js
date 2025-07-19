import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';

/**
 * Base Player class that can be extended by different implementations
 */
export class Player extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.id = config.id || nanoid();
    this.name = config.name || `Player ${this.id.slice(0, 6)}`;
    this.avatar = config.avatar || null;
    this.adapter = config.adapter || null;
  }

  /**
   * Get action from player
   * @param {GameState} gameState - Current game state
   * @returns {Promise<PlayerAction>} The player's action
   */
  async getAction(gameState) {
    if (!this.adapter) {
      throw new Error('No adapter configured for player');
    }
    
    const startTime = Date.now();
    
    try {
      const action = await this.adapter.getAction(gameState);
      
      this.emit('action:taken', {
        playerId: this.id,
        action,
        duration: Date.now() - startTime,
      });
      
      return action;
    } catch (error) {
      this.emit('action:error', {
        playerId: this.id,
        error: error.message,
      });
      
      // Default to fold on error
      return {
        playerId: this.id,
        action: 'FOLD',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Receive private cards
   * @param {string[]} cards - The hole cards
   */
  async receivePrivateCards(cards) {
    if (this.adapter && this.adapter.receivePrivateCards) {
      await this.adapter.receivePrivateCards(cards);
    }
    
    this.emit('cards:received', {
      playerId: this.id,
      cardCount: cards.length,
    });
  }

  /**
   * Receive a message/notification
   * @param {Object} message - Message object
   */
  async receiveMessage(message) {
    if (this.adapter && this.adapter.receiveMessage) {
      await this.adapter.receiveMessage(message);
    }
    
    this.emit('message:received', {
      playerId: this.id,
      messageType: message.type,
    });
  }

  /**
   * Set the player's adapter
   * @param {PlayerAdapter} adapter - The adapter instance
   */
  setAdapter(adapter) {
    this.adapter = adapter;
    adapter.setPlayer(this);
  }

  /**
   * Get player info
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      adapterType: this.adapter ? this.adapter.constructor.name : 'none',
    };
  }

  /**
   * Disconnect the player
   */
  disconnect() {
    if (this.adapter && this.adapter.disconnect) {
      this.adapter.disconnect();
    }
    
    this.emit('disconnected', { playerId: this.id });
    this.removeAllListeners();
  }
}