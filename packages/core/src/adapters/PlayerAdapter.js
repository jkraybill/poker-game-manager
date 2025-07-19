/**
 * Base PlayerAdapter class that all platform-specific adapters should extend
 */
export class PlayerAdapter {
  constructor(config = {}) {
    this.config = config;
    this.player = null;
  }

  /**
   * Set the player instance this adapter is attached to
   * @param {Player} player - The player instance
   */
  setPlayer(player) {
    this.player = player;
  }

  /**
   * Get action from the player
   * Must be implemented by subclasses
   * @param {GameState} gameState - Current game state
   * @returns {Promise<PlayerAction>} The player's action
   */
  async getAction(gameState) {
    throw new Error('getAction() must be implemented by adapter subclass');
  }

  /**
   * Send private cards to the player
   * @param {string[]} cards - The hole cards
   */
  async receivePrivateCards(cards) {
    // Default implementation - subclasses can override
    console.log(`Player ${this.player?.id} received ${cards.length} cards`);
  }

  /**
   * Send a message to the player
   * @param {Object} message - Message object
   */
  async receiveMessage(message) {
    // Default implementation - subclasses can override
    console.log(`Player ${this.player?.id} received message:`, message.type);
  }

  /**
   * Validate an action
   * @param {PlayerAction} action - The action to validate
   * @param {GameState} gameState - Current game state
   * @returns {boolean} True if action is valid
   */
  validateAction(action, gameState) {
    const playerState = gameState.players[action.playerId];
    
    if (!playerState) {
      return false;
    }
    
    if (gameState.currentPlayer !== action.playerId) {
      return false;
    }
    
    switch (action.action) {
      case 'CHECK':
        return gameState.currentBet === playerState.bet;
        
      case 'CALL':
        return gameState.currentBet > playerState.bet;
        
      case 'BET':
        return gameState.currentBet === 0 && action.amount > 0;
        
      case 'RAISE':
        return gameState.currentBet > 0 && action.amount > gameState.currentBet;
        
      case 'FOLD':
        return true;
        
      case 'ALL_IN':
        return playerState.chips > 0;
        
      default:
        return false;
    }
  }

  /**
   * Disconnect the adapter
   */
  disconnect() {
    // Subclasses can override for cleanup
  }
}