import { Hand } from 'pokersolver';
import { HandRank } from '../types/index.js';

/**
 * Evaluates and compares poker hands using pokersolver library
 */
export class HandEvaluator {
  /**
   * Convert our card to pokersolver format
   * Since we now use pokersolver format natively, just return toString()
   * @param {Object} card - Card with {rank, suit}
   * @returns {string} Card in pokersolver format (e.g., 'As', '2h')
   */
  static cardToPokersolverFormat(card) {
    return card.toString();
  }

  /**
   * Convert pokersolver hand rank to our HandRank enum
   * @param {string} rank - Pokersolver rank name
   * @returns {number} Our HandRank enum value
   */
  static mapPokersolverRank(rank) {
    const rankMap = {
      'high card': HandRank.HIGH_CARD,
      'pair': HandRank.PAIR,
      'two pair': HandRank.TWO_PAIR,
      'three of a kind': HandRank.THREE_OF_A_KIND,
      'straight': HandRank.STRAIGHT,
      'flush': HandRank.FLUSH,
      'full house': HandRank.FULL_HOUSE,
      'four of a kind': HandRank.FOUR_OF_A_KIND,
      'straight flush': HandRank.STRAIGHT_FLUSH,
      'royal flush': HandRank.ROYAL_FLUSH
    };
    return rankMap[rank.toLowerCase()] || HandRank.HIGH_CARD;
  }

  /**
   * Evaluate a poker hand (hole cards + community cards)
   * Returns the best 5-card hand
   */
  static evaluate(cards) {
    if (cards.length < 5) {
      throw new Error('Need at least 5 cards to evaluate');
    }

    // Convert cards to pokersolver format
    const pokersolverCards = cards.map(card => this.cardToPokersolverFormat(card));
    
    // Use pokersolver to evaluate the hand
    const solved = Hand.solve(pokersolverCards);
    
    // Debug: log what pokersolver returns
    // console.log('Pokersolver result:', { name: solved.name, descr: solved.descr });
    
    // Special case: pokersolver calls royal flush a "Straight Flush" with descr "Royal Flush"
    const isRoyalFlush = solved.name === 'Straight Flush' && solved.descr === 'Royal Flush';
    const mappedRank = isRoyalFlush ? HandRank.ROYAL_FLUSH : this.mapPokersolverRank(solved.name);
    
    // Convert back to our format
    return {
      rank: mappedRank,
      kickers: solved.cards.map(card => {
        // Extract rank value from pokersolver card
        const rank = card.value;
        return this.getRankValue(rank);
      }),
      cards: solved.cards.slice(0, 5).map(card => {
        // Convert back to our card format
        const rank = card.value;
        const suit = card.suit;
        return { 
          rank, 
          suit,
          toString() {
            return `${rank}${suit}`;
          }
        };
      }),
      description: solved.descr
    };
  }

  /**
   * Find winners from an array of player hands
   */
  static findWinners(playerHands) {
    if (playerHands.length === 0) {
      return [];
    }
    if (playerHands.length === 1) {
      return playerHands;
    }

    // Convert all hands to pokersolver format
    const solvedHands = playerHands.map(ph => {
      // The playerHands array has objects with: playerData, hand, cards
      // We need to combine hole cards with board cards
      const allCards = ph.cards;
      const pokersolverCards = allCards.map(card => this.cardToPokersolverFormat(card));
      const solved = Hand.solve(pokersolverCards);
      return {
        original: ph,
        solved
      };
    });

    // Use pokersolver to find winners
    const winningHands = Hand.winners(solvedHands.map(sh => sh.solved));
    
    // Map back to our player hands
    const winners = [];
    for (const winningHand of winningHands) {
      const winner = solvedHands.find(sh => sh.solved === winningHand);
      if (winner) {
        // Return the original player hand structure with updated hand info
        const winnerData = {
          ...winner.original,
          hand: {
            rank: this.mapPokersolverRank(winner.solved.name),
            kickers: winner.solved.cards.map(card => this.getRankValue(card.value)),
            cards: winner.solved.cards.slice(0, 5).map(card => {
              const rank = card.value;
              const suit = card.suit;
              return { 
                rank, 
                suit,
                toString() {
                  return `${rank}${suit}`;
                }
              };
            }),
            description: winner.solved.descr
          }
        };
        winners.push(winnerData);
      }
    }

    return winners;
  }

  /**
   * Compare two hands
   * Returns: 1 if hand1 wins, -1 if hand2 wins, 0 if tie
   */
  static compareHands(hand1, hand2) {
    // Convert to pokersolver format and compare
    const cards1 = hand1.cards.map(card => this.cardToPokersolverFormat(card));
    const cards2 = hand2.cards.map(card => this.cardToPokersolverFormat(card));
    
    const solved1 = Hand.solve(cards1);
    const solved2 = Hand.solve(cards2);
    
    const winners = Hand.winners([solved1, solved2]);
    
    if (winners.includes(solved1) && winners.includes(solved2)) {
      return 0; // Tie
    } else if (winners.includes(solved1)) {
      return 1; // Hand1 wins
    } else {
      return -1; // Hand2 wins
    }
  }

  /**
   * Get numeric value for rank (for compatibility)
   */
  static getRankValue(rank) {
    const values = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
      '8': 8, '9': 9, '10': 10, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return values[rank] || values[rank.toUpperCase()] || 0;
  }
}