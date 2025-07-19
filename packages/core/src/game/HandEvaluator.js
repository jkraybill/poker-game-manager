import { HandRank } from '../types/index.js';

/**
 * Evaluates and compares poker hands
 */
export class HandEvaluator {
  /**
   * Evaluate a poker hand (hole cards + community cards)
   * Returns the best 5-card hand
   */
  static evaluate(cards) {
    if (cards.length < 5) {
      throw new Error('Need at least 5 cards to evaluate');
    }

    // Get all possible 5-card combinations
    const combinations = this.getCombinations(cards, 5);
    let bestHand = null;

    for (const combo of combinations) {
      const hand = this.evaluateFiveCards(combo);
      if (!bestHand || this.compareHands(hand, bestHand) > 0) {
        bestHand = hand;
      }
    }

    return bestHand;
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

    // Sort hands by strength (descending)
    const sorted = [...playerHands].sort((a, b) => 
      this.compareHands(b.hand, a.hand),
    );

    // Find all players with the best hand (could be ties)
    const winners = [sorted[0]];
    const bestHand = sorted[0].hand;

    for (let i = 1; i < sorted.length; i++) {
      if (this.compareHands(sorted[i].hand, bestHand) === 0) {
        winners.push(sorted[i]);
      } else {
        break;
      }
    }

    return winners;
  }

  /**
   * Evaluate a 5-card hand
   */
  static evaluateFiveCards(cards) {
    const sorted = this.sortByRank(cards);
    const flush = this.isFlush(cards);
    const straight = this.isStraight(sorted);
    const groups = this.groupByRank(cards);
    const counts = Object.values(groups).map(g => g.length).sort((a, b) => b - a);

    let rank, kickers;

    if (straight && flush) {
      rank = sorted[0].rank === 'A' && sorted[1].rank === '5' 
        ? HandRank.STRAIGHT_FLUSH 
        : sorted[0].rank === 'A' 
          ? HandRank.ROYAL_FLUSH 
          : HandRank.STRAIGHT_FLUSH;
      kickers = [this.getRankValue(sorted[0].rank)];
    } else if (counts[0] === 4) {
      rank = HandRank.FOUR_OF_A_KIND;
      kickers = this.getKickersForGroups(groups, [4, 1]);
    } else if (counts[0] === 3 && counts[1] === 2) {
      rank = HandRank.FULL_HOUSE;
      kickers = this.getKickersForGroups(groups, [3, 2]);
    } else if (flush) {
      rank = HandRank.FLUSH;
      kickers = sorted.slice(0, 5).map(c => this.getRankValue(c.rank));
    } else if (straight) {
      rank = HandRank.STRAIGHT;
      kickers = [this.getRankValue(sorted[0].rank)];
    } else if (counts[0] === 3) {
      rank = HandRank.THREE_OF_A_KIND;
      kickers = this.getKickersForGroups(groups, [3, 1, 1]);
    } else if (counts[0] === 2 && counts[1] === 2) {
      rank = HandRank.TWO_PAIR;
      kickers = this.getKickersForGroups(groups, [2, 2, 1]);
    } else if (counts[0] === 2) {
      rank = HandRank.PAIR;
      kickers = this.getKickersForGroups(groups, [2, 1, 1, 1]);
    } else {
      rank = HandRank.HIGH_CARD;
      kickers = sorted.slice(0, 5).map(c => this.getRankValue(c.rank));
    }

    return {
      rank,
      kickers,
      cards: cards.slice(0, 5),
      description: this.getHandDescription(rank, kickers),
    };
  }

  /**
   * Compare two hands
   * Returns: 1 if hand1 wins, -1 if hand2 wins, 0 if tie
   */
  static compareHands(hand1, hand2) {
    if (hand1.rank > hand2.rank) {
return 1;
}
    if (hand1.rank < hand2.rank) {
return -1;
}

    // Compare kickers
    for (let i = 0; i < Math.min(hand1.kickers.length, hand2.kickers.length); i++) {
      if (hand1.kickers[i] > hand2.kickers[i]) {
return 1;
}
      if (hand1.kickers[i] < hand2.kickers[i]) {
return -1;
}
    }

    return 0;
  }

  /**
   * Get all combinations of k items from array
   */
  static getCombinations(arr, k) {
    const combinations = [];
    
    function combine(start, combo) {
      if (combo.length === k) {
        combinations.push([...combo]);
        return;
      }
      
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        combine(i + 1, combo);
        combo.pop();
      }
    }
    
    combine(0, []);
    return combinations;
  }

  /**
   * Sort cards by rank (high to low)
   */
  static sortByRank(cards) {
    return [...cards].sort((a, b) => 
      this.getRankValue(b.rank) - this.getRankValue(a.rank),
    );
  }

  /**
   * Check if cards form a flush
   */
  static isFlush(cards) {
    const suit = cards[0].suit;
    return cards.every(c => c.suit === suit);
  }

  /**
   * Check if sorted cards form a straight
   */
  static isStraight(sorted) {
    const values = sorted.map(c => this.getRankValue(c.rank));
    
    // Check for regular straight
    for (let i = 0; i < values.length - 1; i++) {
      if (values[i] - values[i + 1] !== 1) {
        // Check for A-2-3-4-5 straight
        if (i === 0 && values[0] === 14 && values[1] === 5) {
          continue;
        }
        return false;
      }
    }
    
    return true;
  }

  /**
   * Group cards by rank
   */
  static groupByRank(cards) {
    const groups = {};
    
    for (const card of cards) {
      const rank = card.rank;
      if (!groups[rank]) {
        groups[rank] = [];
      }
      groups[rank].push(card);
    }
    
    return groups;
  }

  /**
   * Get kickers for grouped cards
   */
  static getKickersForGroups(groups, pattern) {
    const kickers = [];
    const sortedGroups = Object.entries(groups)
      .sort((a, b) => {
        // Sort by group size first, then by rank
        if (b[1].length !== a[1].length) {
          return b[1].length - a[1].length;
        }
        return this.getRankValue(b[0]) - this.getRankValue(a[0]);
      });

    for (const count of pattern) {
      const group = sortedGroups.find(g => g[1].length === count);
      if (group) {
        kickers.push(this.getRankValue(group[0]));
        sortedGroups.splice(sortedGroups.indexOf(group), 1);
      }
    }

    return kickers;
  }

  /**
   * Get numeric value for rank
   */
  static getRankValue(rank) {
    const values = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
      '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
    };
    return values[rank];
  }

  /**
   * Get description for hand
   */
  static getHandDescription(rank, kickers) {
    const rankNames = {
      1: 'High Card',
      2: 'Pair',
      3: 'Two Pair',
      4: 'Three of a Kind',
      5: 'Straight',
      6: 'Flush',
      7: 'Full House',
      8: 'Four of a Kind',
      9: 'Straight Flush',
      10: 'Royal Flush',
    };

    const cardNames = {
      14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack',
      10: 'Ten', 9: 'Nine', 8: 'Eight', 7: 'Seven',
      6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two',
    };

    let description = rankNames[rank];

    switch (rank) {
      case HandRank.PAIR:
      case HandRank.THREE_OF_A_KIND:
      case HandRank.FOUR_OF_A_KIND:
        description = `${description} of ${cardNames[kickers[0]]}s`;
        break;
      case HandRank.TWO_PAIR:
        description = `${description}, ${cardNames[kickers[0]]}s and ${cardNames[kickers[1]]}s`;
        break;
      case HandRank.FULL_HOUSE:
        description = `${description}, ${cardNames[kickers[0]]}s full of ${cardNames[kickers[1]]}s`;
        break;
      case HandRank.STRAIGHT:
      case HandRank.STRAIGHT_FLUSH:
        description = `${description}, ${cardNames[kickers[0]]} high`;
        break;
    }

    return description;
  }
}