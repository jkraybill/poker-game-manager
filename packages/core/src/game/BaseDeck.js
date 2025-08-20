/**
 * Abstract base class for Deck implementations
 * Defines the interface that all deck implementations must follow
 */
export class BaseDeck {
  constructor() {
    if (new.target === BaseDeck) {
      throw new Error(
        'BaseDeck is an abstract class and cannot be instantiated directly',
      );
    }
  }

  /**
   * Shuffle the deck
   * @abstract
   */
  shuffle() {
    throw new Error('shuffle() must be implemented by subclass');
  }

  /**
   * Deal hole cards to a player
   * @abstract
   * @param {string} _playerId - The player's ID
   * @param {number} _seatPosition - The player's seat position
   * @returns {Array} Array of 2 cards
   */
  dealHoleCards(_playerId, _seatPosition) {
    throw new Error('dealHoleCards() must be implemented by subclass');
  }

  /**
   * Deal the flop (3 community cards)
   * @abstract
   * @returns {Array} Array of 3 cards
   */
  dealFlop() {
    throw new Error('dealFlop() must be implemented by subclass');
  }

  /**
   * Deal the turn (1 community card)
   * @abstract
   * @returns {Object} Single card object
   */
  dealTurn() {
    throw new Error('dealTurn() must be implemented by subclass');
  }

  /**
   * Deal the river (1 community card)
   * @abstract
   * @returns {Object} Single card object
   */
  dealRiver() {
    throw new Error('dealRiver() must be implemented by subclass');
  }

  /**
   * Reset deck to initial state
   * @abstract
   */
  reset() {
    throw new Error('reset() must be implemented by subclass');
  }

  /**
   * Get remaining card count
   * @abstract
   * @returns {number} Number of cards remaining
   */
  getRemaining() {
    throw new Error('getRemaining() must be implemented by subclass');
  }

  /**
   * Helper method to create a card object
   * @protected
   * @param {string} rank - Card rank (2-9, T, J, Q, K, A)
   * @param {string} suit - Card suit (h, d, c, s)
   * @returns {Object} Card object
   */
  createCard(rank, suit) {
    return {
      rank,
      suit,
      toString() {
        return `${rank}${suit}`;
      },
    };
  }

  /**
   * Helper method to parse card string (e.g., 'As' -> {rank: 'A', suit: 's'})
   * @protected
   * @param {string} cardStr - Card string
   * @returns {Object} Card object
   */
  parseCard(cardStr) {
    if (!cardStr || cardStr.length !== 2) {
      throw new Error(`Invalid card string: ${cardStr}`);
    }
    const rank = cardStr[0];
    const suit = cardStr[1];
    return this.createCard(rank, suit);
  }

  /**
   * Validate that a card has valid rank and suit
   * @protected
   * @param {Object} card - Card object
   * @returns {boolean} true if valid
   */
  isValidCard(card) {
    const validRanks = [
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'T',
      'J',
      'Q',
      'K',
      'A',
    ];
    const validSuits = ['h', 'd', 'c', 's'];
    return validRanks.includes(card.rank) && validSuits.includes(card.suit);
  }
}
