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
    // Only create side pots if we have contributions
    if (this.currentPot.contributions.size === 0) {
      return;
    }
    
    // Get all contributions for current pot
    const playerContributions = [];
    for (const [player, amount] of this.currentPot.contributions) {
      playerContributions.push({ player, amount });
    }
    
    // Sort by contribution amount
    playerContributions.sort((a, b) => a.amount - b.amount);
    
    
    // Clear pots to rebuild
    this.pots = [];
    let previousAmount = 0;
    
    for (let i = 0; i < playerContributions.length; i++) {
      const currentAmount = playerContributions[i].amount;
      const eligibleCount = playerContributions.length - i;
      
      if (currentAmount > previousAmount) {
        // Create a pot for the difference
        const pot = {
          amount: (currentAmount - previousAmount) * eligibleCount,
          eligiblePlayers: [],
          contributions: new Map(),
        };
        
        // All players who contributed at least up to the current pot amount are eligible
        for (let j = 0; j < playerContributions.length; j++) {
          if (playerContributions[j].amount >= currentAmount) {
            pot.eligiblePlayers.push(playerContributions[j].player);
            const contrib = currentAmount - previousAmount;
            pot.contributions.set(playerContributions[j].player, contrib);
          }
        }
        
        this.pots.push(pot);
        previousAmount = currentAmount;
      }
    }
    
    // If no pots were created, keep the original pot
    if (this.pots.length === 0) {
      this.pots = [this.currentPot];
    } else {
      // Set current pot to the last pot
      this.currentPot = this.pots[this.pots.length - 1];
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

    // Initialize payouts - winners have playerData property pointing to Player instance
    for (const winner of winners) {
      payouts.set(winner.playerData, 0);
    }

    // Distribute each pot
    for (const pot of this.pots) {
      const eligibleWinners = winners.filter(w => 
        pot.eligiblePlayers.some(ep => {
          // Both ep and w.playerData are Player instances now
          return ep.id === w.playerData.id;
        }),
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