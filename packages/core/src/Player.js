import { nanoid } from 'nanoid';
import { WildcardEventEmitter } from './base/WildcardEventEmitter.js';

/**
 * Base Player class that implementations should extend or follow as interface
 * This provides a template for what methods a player must implement
 */
export class Player extends WildcardEventEmitter {
  constructor(config = {}) {
    super();

    this.id = config.id || nanoid();
    this.name = config.name || `${this.id}`;
    this.avatar = config.avatar || null;
  }

  /**
   * Get action from player - MUST BE IMPLEMENTED
   * @param {GameState} gameState - Current game state
   * @returns {Promise<PlayerAction>} The player's action
   */
  // eslint-disable-next-line require-await
  getAction(_gameState) {
    throw new Error('getAction() must be implemented by Player subclass');
  }

  /**
   * Receive private cards - SHOULD BE IMPLEMENTED
   * @param {string[]} cards - The hole cards
   */
  receivePrivateCards(_cards) {
    // Default implementation - subclasses should override
    this.emit('cards:received', {
      playerId: this.id,
      cardCount: _cards.length,
    });
  }

  /**
   * Receive a message/notification - OPTIONAL
   * @param {Object} message - Message object
   */
  receiveMessage(message) {
    // Default implementation - subclasses can override
    this.emit('message:received', {
      playerId: this.id,
      messageType: message.type,
    });
  }

  /**
   * Get player info
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
    };
  }

  /**
   * Disconnect the player - OPTIONAL
   */
  disconnect() {
    this.emit('disconnected', { playerId: this.id });
    this.removeAllListeners();
  }
}