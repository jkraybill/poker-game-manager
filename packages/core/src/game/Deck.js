/**
 * Standard 52-card deck implementation
 */
export class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  /**
   * Reset deck to full 52 cards
   */
  reset() {
    this.cards = [];
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    
    for (const suit of suits) {
      for (const rank of ranks) {
        this.cards.push({
          rank,
          suit,
          toString() {
            return `${rank}${suit[0]}`;
          },
        });
      }
    }
  }

  /**
   * Shuffle the deck using Fisher-Yates algorithm
   */
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * Draw a card from the deck
   */
  draw() {
    if (this.cards.length === 0) {
      throw new Error('Cannot draw from empty deck');
    }
    return this.cards.pop();
  }

  /**
   * Get remaining card count
   */
  getRemaining() {
    return this.cards.length;
  }
}