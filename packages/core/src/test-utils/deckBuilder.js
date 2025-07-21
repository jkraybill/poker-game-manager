/**
 * Deck Builder Utility
 * 
 * Provides a fluent interface for creating custom decks with proper dealing order
 * and burn cards. Handles the complexity of poker dealing sequence automatically.
 */

/**
 * Builder class for creating custom poker decks
 */
export class DeckBuilder {
  constructor(playerCount) {
    this.playerCount = playerCount;
    this.cards = [];
    this.burnCardSuit = 'h'; // Default burn card suit
    this.burnCardRank = '2'; // Default burn card rank
  }
  
  /**
   * Deal hole cards to players in proper dealing order
   * @param {Array<Array<string>>} hands - Array of hands, e.g. [['8h', '9h'], ['8d', '9d']]
   * @returns {DeckBuilder} For method chaining
   */
  dealHoleCards(hands) {
    if (hands.length !== this.playerCount) {
      throw new Error(`Expected ${this.playerCount} hands, got ${hands.length}`);
    }
    
    // Validate each hand has 2 cards
    hands.forEach((hand, index) => {
      if (hand.length !== 2) {
        throw new Error(`Player ${index + 1} hand must have exactly 2 cards, got ${hand.length}`);
      }
    });
    
    // Deal first card to each player, then second card to each player
    for (let cardIndex = 0; cardIndex < 2; cardIndex++) {
      for (let playerIndex = 0; playerIndex < this.playerCount; playerIndex++) {
        const cardStr = hands[playerIndex][cardIndex];
        this.cards.push(this.createCard(cardStr));
      }
    }
    
    return this;
  }
  
  /**
   * Add a single burn card
   * @param {string} card - Optional specific burn card, defaults to '2h'
   * @returns {DeckBuilder} For method chaining
   */
  addBurn(card = null) {
    const burnCard = card || `${this.burnCardRank}${this.burnCardSuit}`;
    this.cards.push(this.createCard(burnCard));
    
    // Cycle burn card for variety if using defaults
    if (!card) {
      this.burnCardRank = this.burnCardRank === '2' ? '3' : '2';
      this.burnCardSuit = this.burnCardSuit === 'h' ? 'd' : 'h';
    }
    
    return this;
  }
  
  /**
   * Add flop cards (automatically adds burn card first)
   * @param {string} card1 - First flop card
   * @param {string} card2 - Second flop card  
   * @param {string} card3 - Third flop card
   * @returns {DeckBuilder} For method chaining
   */
  addFlop(card1, card2, card3) {
    this.addBurn(); // Burn before flop
    this.cards.push(this.createCard(card1));
    this.cards.push(this.createCard(card2));
    this.cards.push(this.createCard(card3));
    return this;
  }
  
  /**
   * Add turn card (automatically adds burn card first)
   * @param {string} card - Turn card
   * @returns {DeckBuilder} For method chaining
   */
  addTurn(card) {
    this.addBurn(); // Burn before turn
    this.cards.push(this.createCard(card));
    return this;
  }
  
  /**
   * Add river card (automatically adds burn card first)
   * @param {string} card - River card
   * @returns {DeckBuilder} For method chaining
   */
  addRiver(card) {
    this.addBurn(); // Burn before river
    this.cards.push(this.createCard(card));
    return this;
  }
  
  /**
   * Add community cards all at once (automatically adds burn cards)
   * @param {Array<string>} cards - Community cards [flop1, flop2, flop3, turn, river]
   * @returns {DeckBuilder} For method chaining
   */
  addCommunityCards(cards) {
    if (cards.length < 3 || cards.length > 5) {
      throw new Error('Community cards must be 3-5 cards (flop required, turn/river optional)');
    }
    
    // Add flop
    this.addFlop(cards[0], cards[1], cards[2]);
    
    // Add turn if provided
    if (cards.length >= 4) {
      this.addTurn(cards[3]);
    }
    
    // Add river if provided
    if (cards.length === 5) {
      this.addRiver(cards[4]);
    }
    
    return this;
  }
  
  /**
   * Add arbitrary cards to the deck
   * @param {...string} cards - Cards to add
   * @returns {DeckBuilder} For method chaining
   */
  addCards(...cards) {
    cards.forEach(card => {
      this.cards.push(this.createCard(card));
    });
    return this;
  }
  
  /**
   * Set custom burn card pattern
   * @param {string} rank - Default burn card rank ('2', '3', etc.)
   * @param {string} suit - Default burn card suit ('h', 'd', 'c', 's')
   * @returns {DeckBuilder} For method chaining
   */
  setBurnPattern(rank = '2', suit = 'h') {
    this.burnCardRank = rank;
    this.burnCardSuit = suit;
    return this;
  }
  
  /**
   * Get the number of cards currently in the deck
   * @returns {number} Card count
   */
  getCardCount() {
    return this.cards.length;
  }
  
  /**
   * Preview the deck without building it
   * @returns {Array<string>} Array of card strings
   */
  preview() {
    return this.cards.map(card => card.toString());
  }
  
  /**
   * Build and return the final deck array
   * @returns {Array<Object>} Array of card objects ready for setCustomDeck()
   */
  build() {
    if (this.cards.length === 0) {
      throw new Error('Deck is empty. Add some cards before building.');
    }
    return [...this.cards]; // Return copy to prevent mutation
  }
  
  /**
   * Create a card object from a string representation
   * @param {string} cardStr - Card string like '8h', 'As', 'Tc'
   * @returns {Object} Card object with rank, suit, and toString method
   */
  createCard(cardStr) {
    if (!cardStr || cardStr.length < 2) {
      throw new Error(`Invalid card string: ${cardStr}`);
    }
    
    const rank = cardStr.slice(0, -1);
    const suit = cardStr.slice(-1);
    
    // Validate rank
    const validRanks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    if (!validRanks.includes(rank)) {
      throw new Error(`Invalid card rank: ${rank}. Valid ranks: ${validRanks.join(', ')}`);
    }
    
    // Validate suit
    const validSuits = ['h', 'd', 'c', 's'];
    if (!validSuits.includes(suit)) {
      throw new Error(`Invalid card suit: ${suit}. Valid suits: ${validSuits.join(', ')}`);
    }
    
    return {
      rank,
      suit,
      toString() {
        return cardStr;
      },
    };
  }
  
  /**
   * Static method to create a simple heads-up deck
   * @param {Array<string>} p1Hand - Player 1 hand ['card1', 'card2']
   * @param {Array<string>} p2Hand - Player 2 hand ['card1', 'card2']
   * @param {Array<string>} community - Community cards [flop1, flop2, flop3, turn?, river?]
   * @returns {Array<Object>} Complete deck ready for setCustomDeck()
   */
  static createHeadsUpDeck(p1Hand, p2Hand, community) {
    return new DeckBuilder(2)
      .dealHoleCards([p1Hand, p2Hand])
      .addCommunityCards(community)
      .build();
  }
  
  /**
   * Static method to create a deck for split pot scenarios
   * @param {Array<Array<string>>} identicalHands - Array of identical hands
   * @param {Array<string>} community - Community cards
   * @returns {Array<Object>} Complete deck ready for setCustomDeck()
   */
  static createSplitPotDeck(identicalHands, community) {
    return new DeckBuilder(identicalHands.length)
      .dealHoleCards(identicalHands)
      .addCommunityCards(community)
      .build();
  }
  
  /**
   * Static method to create a deck where all players play the board
   * @param {number} playerCount - Number of players
   * @param {Array<string>} weakHands - Array of weak hole cards for each player
   * @param {Array<string>} strongBoard - Strong community cards that beat all hole cards
   * @returns {Array<Object>} Complete deck ready for setCustomDeck()
   */
  static createBoardPlayDeck(playerCount, weakHands, strongBoard) {
    if (weakHands.length !== playerCount) {
      throw new Error(`Need ${playerCount} weak hands, got ${weakHands.length}`);
    }
    
    // Convert single cards to pairs for hole cards
    const hands = weakHands.map(card => [card, '2c']); // Pair weak cards with 2c
    
    return new DeckBuilder(playerCount)
      .dealHoleCards(hands)
      .addCommunityCards(strongBoard)
      .build();
  }
}

/**
 * Convenience function for creating simple custom decks
 * @param {number} playerCount - Number of players
 * @returns {DeckBuilder} New deck builder instance
 */
export function createDeck(playerCount) {
  return new DeckBuilder(playerCount);
}

/**
 * Predefined deck scenarios for common test cases
 */
export const DECK_SCENARIOS = {
  /**
   * Two players both make straights (split pot)
   */
  headsUpStraightSplit: () => DeckBuilder.createHeadsUpDeck(
    ['8h', '9h'], ['8d', '9d'],
    ['5c', '6s', '7h', 'Tc', 'Jc'],
  ),
  
  /**
   * Three players all play the board (royal flush)
   */
  threeWayBoardPlay: () => DeckBuilder.createBoardPlayDeck(
    3,
    ['2h', '3d', '4c'],
    ['As', 'Ks', 'Qs', 'Js', 'Ts'],
  ),
  
  /**
   * Heads-up with one player having nuts
   */
  headsUpNuts: () => DeckBuilder.createHeadsUpDeck(
    ['As', 'Ah'], ['Kh', 'Kd'],
    ['Ac', 'Ad', '2c', '3h', '4s'],
  ),
  
  /**
   * Multi-way all-in with different hand strengths
   */
  fourWayAllIn: () => new DeckBuilder(4)
    .dealHoleCards([
      ['As', 'Ah'], // AA
      ['Ks', 'Kh'], // KK  
      ['Qs', 'Qh'], // QQ
      ['2c', '3c'],  // Weak hand
    ])
    .addFlop('4c', '5c', '6c') // Gives 2c3c straight flush
    .addTurn('7c')
    .addRiver('9c')
    .build(),
};