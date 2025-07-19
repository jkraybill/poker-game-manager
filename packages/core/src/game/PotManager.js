/**
 * Manages pots, side pots, and chip distribution
 */
export class PotManager {
  constructor(players, smallBlind) {
    this.players = players;
    this.smallBlind = smallBlind;
    this.pots = [];
    this.currentPot = null;
    this.createMainPot();
  }

  /**
   * Create the main pot
   */
  createMainPot() {
    this.currentPot = {
      amount: 0,
      eligiblePlayers: [...this.players],
      contributions: new Map(),
    };
    this.pots = [this.currentPot];
  }

  /**
   * Add chips to the pot
   */
  addToPot(player, amount) {
    const currentContribution = this.currentPot.contributions.get(player) || 0;
    this.currentPot.contributions.set(player, currentContribution + amount);
    this.currentPot.amount += amount;
  }

  /**
   * End a betting round and create side pots if necessary
   */
  endBettingRound() {
    this.createSidePots();
  }

  /**
   * Create side pots for all-in players
   */
  createSidePots() {
    const allInPlayers = this.players
      .filter(p => p.state === 'ALL_IN')
      .sort((a, b) => {
        const aContrib = this.getTotalContribution(a);
        const bContrib = this.getTotalContribution(b);
        return aContrib - bContrib;
      });

    for (const allInPlayer of allInPlayers) {
      const allInAmount = this.getTotalContribution(allInPlayer);
      
      if (allInAmount > 0) {
        this.createSidePot(allInAmount);
      }
    }
  }

  /**
   * Create a side pot at the specified amount
   */
  createSidePot(maxAmount) {
    const newPot = {
      amount: 0,
      eligiblePlayers: [],
      contributions: new Map(),
    };

    // Move contributions up to maxAmount to the current pot
    for (const [player, contribution] of this.currentPot.contributions) {
      const transferAmount = Math.min(contribution, maxAmount);
      const remaining = contribution - transferAmount;

      if (transferAmount > 0) {
        this.currentPot.eligiblePlayers.push(player);
      }

      if (remaining > 0) {
        newPot.contributions.set(player, remaining);
        newPot.amount += remaining;
        this.currentPot.contributions.set(player, transferAmount);
      }
    }

    // Only create new pot if it has contributions
    if (newPot.amount > 0) {
      this.pots.push(newPot);
      this.currentPot = newPot;
    }
  }

  /**
   * Get total contribution from a player
   */
  getTotalContribution(player) {
    let total = 0;
    for (const pot of this.pots) {
      total += pot.contributions.get(player) || 0;
    }
    return total;
  }

  /**
   * Get total pot amount
   */
  getTotal() {
    return this.pots.reduce((sum, pot) => sum + pot.amount, 0);
  }

  /**
   * Calculate payouts for winners
   */
  calculatePayouts(winners) {
    const payouts = new Map();

    // Initialize payouts
    for (const winner of winners) {
      payouts.set(winner.playerData, 0);
    }

    // Distribute each pot
    for (const pot of this.pots) {
      const eligibleWinners = winners.filter(w => 
        pot.eligiblePlayers.includes(w.playerData)
      );

      if (eligibleWinners.length > 0) {
        const share = Math.floor(pot.amount / eligibleWinners.length);
        let remainder = pot.amount % eligibleWinners.length;

        for (const winner of eligibleWinners) {
          let winAmount = share;
          
          // Distribute remainder to first winners
          if (remainder > 0) {
            winAmount++;
            remainder--;
          }

          const currentPayout = payouts.get(winner.playerData) || 0;
          payouts.set(winner.playerData, currentPayout + winAmount);
        }
      }
    }

    return payouts;
  }

  /**
   * Update pot for a player action
   */
  updatePotForAction(player, action) {
    // This is called from legacy code - translate to new interface
    if (action.name === 'bet' || action.name === 'raise' || action.name === 'call') {
      this.addToPot(player, action.amount);
    }
  }
}