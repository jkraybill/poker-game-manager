/**
 * Represents a single pot in a poker game
 * Tracks contributions and eligible players
 */
export class Pot {
  constructor(id, eligiblePlayers = []) {
    this.id = id;
    this.name = id === 0 ? 'Main Pot' : `Side Pot ${id}`;
    this.amount = 0;
    this.eligiblePlayers = [...eligiblePlayers]; // Players who can win this pot
    this.contributions = new Map(); // Track each player's contribution
    this.isActive = true; // Can this pot accept more bets?
    this.maxContributionPerPlayer = null; // Cap for all-in situations
  }

  /**
   * Add a contribution from a player
   * @param {Player} player - The player contributing
   * @param {number} amount - Amount to contribute
   * @returns {number} Amount actually contributed (may be less if pot is capped)
   */
  addContribution(player, amount) {
    // Check if player is eligible
    if (!this.eligiblePlayers.some(p => p.id === player.id)) {
      return 0;
    }

    // Check if pot is capped
    const currentContribution = this.contributions.get(player) || 0;
    let allowedAmount = amount;
    
    if (this.maxContributionPerPlayer !== null) {
      const remainingAllowed = this.maxContributionPerPlayer - currentContribution;
      allowedAmount = Math.min(amount, remainingAllowed);
    }

    if (allowedAmount > 0) {
      this.contributions.set(player, currentContribution + allowedAmount);
      this.amount += allowedAmount;
    }

    return allowedAmount;
  }

  /**
   * Get a player's total contribution to this pot
   * @param {Player} player 
   * @returns {number}
   */
  getPlayerContribution(player) {
    return this.contributions.get(player) || 0;
  }

  /**
   * Cap this pot at a specific contribution level
   * Used when a player goes all-in
   * @param {number} maxPerPlayer - Maximum contribution per player
   */
  cap(maxPerPlayer) {
    this.maxContributionPerPlayer = maxPerPlayer;
    this.isActive = false;
  }

  /**
   * Check if this pot can accept contributions from a player
   * @param {Player} player 
   * @returns {boolean}
   */
  canAcceptFrom(player) {
    if (!this.isActive) {
return false;
}
    if (!this.eligiblePlayers.some(p => p.id === player.id)) {
return false;
}
    
    if (this.maxContributionPerPlayer !== null) {
      const current = this.contributions.get(player) || 0;
      return current < this.maxContributionPerPlayer;
    }
    
    return true;
  }

  /**
   * Get remaining capacity for a player
   * @param {Player} player 
   * @returns {number} Amount player can still contribute, or Infinity if uncapped
   */
  getRemainingCapacity(player) {
    if (!this.canAcceptFrom(player)) {
return 0;
}
    
    if (this.maxContributionPerPlayer === null) {
      return Infinity;
    }
    
    const current = this.contributions.get(player) || 0;
    return this.maxContributionPerPlayer - current;
  }

  /**
   * Close this pot to further contributions
   */
  close() {
    this.isActive = false;
  }

  /**
   * Get pot info for display/events
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      amount: this.amount,
      eligiblePlayers: this.eligiblePlayers.map(p => p.id),
      contributions: Array.from(this.contributions.entries()).map(([player, amount]) => ({
        playerId: player.id,
        amount,
      })),
      isActive: this.isActive,
      maxContributionPerPlayer: this.maxContributionPerPlayer,
    };
  }
}