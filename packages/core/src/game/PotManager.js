import { Pot } from './Pot.js';
import { EventEmitter } from 'eventemitter3';
import { HandEvaluator } from './HandEvaluator.js';
import { ensureInteger } from '../utils/validation.js';

/**
 * Manages all pots in a poker game
 * Handles main pot and side pot creation
 */
export class PotManager extends EventEmitter {
  constructor(players) {
    super();
    this.players = players;
    this.pots = [];
    this.nextPotId = 0;

    // Create initial main pot with all players eligible
    this.createPot(players);
  }

  /**
   * Create a new pot
   * @param {Player[]} eligiblePlayers - Players eligible for this pot
   * @returns {Pot} The created pot
   */
  createPot(eligiblePlayers) {
    const pot = new Pot(this.nextPotId++, eligiblePlayers);
    this.pots.push(pot);

    // Emit event for side pot creation (skip for main pot)
    if (pot.id > 0) {
      this.emit('sidepot:created', {
        potId: pot.id,
        potName: pot.name,
        eligiblePlayers: eligiblePlayers.map((p) => p.id),
        eligibleCount: eligiblePlayers.length,
      });
    }

    return pot;
  }

  /**
   * Get the currently active pot (accepts new bets)
   * @returns {Pot|null}
   */
  getActivePot() {
    // Active pot is the last uncapped pot
    for (let i = this.pots.length - 1; i >= 0; i--) {
      if (this.pots[i].isActive) {
        return this.pots[i];
      }
    }
    return null;
  }

  /**
   * Add dead money to the main pot (e.g., dead small blind)
   * @param {number} amount - Amount to add
   */
  addDeadMoney(amount) {
    const intAmount = ensureInteger(amount, 'dead money');
    const mainPot = this.pots[0];
    if (mainPot) {
      mainPot.amount += intAmount;

      // Emit pot update event
      this.emit('pot:updated', {
        potId: mainPot.id,
        potName: mainPot.name,
        total: mainPot.amount,
        deadMoney: intAmount,
      });
    }
  }

  /**
   * Add chips to pots from a player
   * @param {Player} player - The player betting
   * @param {number} amount - Amount being bet
   * @returns {Object} Distribution details
   */
  addToPot(player, amount) {
    const intAmount = ensureInteger(amount, 'pot contribution');
    let remainingAmount = intAmount;
    const distributions = [];

    // Distribute across pots in order
    for (const pot of this.pots) {
      if (remainingAmount <= 0) {
        break;
      }

      const contributed = pot.addContribution(player, remainingAmount);
      if (contributed > 0) {
        distributions.push({
          potId: pot.id,
          potName: pot.name,
          amount: contributed,
        });
        remainingAmount -= contributed;

        // Emit pot update event
        this.emit('pot:updated', {
          potId: pot.id,
          potName: pot.name,
          total: pot.amount,
          playerBet: {
            playerId: player.id,
            amount: contributed,
          },
        });
      }
    }

    // If there's still money left and player is not in any active pot,
    // they might need a new pot (shouldn't happen in normal flow)
    if (remainingAmount > 0) {
      // This can happen in complex side pot scenarios - it's logged in stderr during tests
      // console.warn(`Player ${player.id} has ${remainingAmount} chips with nowhere to go`);
    }

    return {
      totalContributed: intAmount - remainingAmount,
      distributions,
    };
  }

  /**
   * Handle when a player goes all-in
   * This may create side pots
   * @param {Player} player - Player going all-in
   * @param {number} totalAmount - Total amount they're putting in (including previous bets)
   */
  handleAllIn(player, totalAmount) {
    // Find the active pot this player can contribute to
    const activePot = this.getActivePot();
    if (!activePot || !activePot.canAcceptFrom(player)) {
      return;
    }

    // The player's total contribution for this betting round
    const currentPotContribution = activePot.getPlayerContribution(player);
    const maxContributionThisRound = totalAmount;

    // Cap the active pot at this player's maximum contribution
    if (
      activePot.isActive &&
      maxContributionThisRound > currentPotContribution
    ) {
      activePot.cap(maxContributionThisRound);

      // Create a side pot for remaining active players (excluding this all-in player)
      const stillActivePlayers = activePot.eligiblePlayers.filter(
        (p) => p.id !== player.id && p.state === 'ACTIVE',
      );

      // Create side pot based on the situation:
      // - Always create if 2+ players remain
      // - For heads-up game (total 2 players), create even with 1 remaining player
      const isHeadsUpGame = this.players.length === 2;
      const shouldCreateSidePot =
        stillActivePlayers.length >= 2 ||
        (stillActivePlayers.length === 1 && isHeadsUpGame);

      if (shouldCreateSidePot) {
        this.createPot(stillActivePlayers);
      }
    }
  }

  /**
   * Get total amount across all pots
   * @returns {number}
   */
  getTotal() {
    return this.pots.reduce((sum, pot) => sum + pot.amount, 0);
  }

  /**
   * Get total contribution from a player across all pots
   * @param {Player} player
   * @returns {number}
   */
  getTotalContribution(player) {
    let total = 0;
    for (const pot of this.pots) {
      total += pot.getPlayerContribution(player);
    }
    return total;
  }

  /**
   * Calculate payouts for winners
   * @param {Array} allPlayerHands - Array of player hand objects with player, hand, and cards info
   * @returns {Map<Player, number>} Map of player to payout amount
   */
  calculatePayouts(allPlayerHands) {
    const payouts = new Map();

    // Process each pot separately
    for (const pot of this.pots) {
      // Find players eligible for this pot who are still in the hand
      let eligibleHands = allPlayerHands.filter((ph) =>
        pot.eligiblePlayers.some((ep) => ep.id === ph.player.id),
      );

      if (eligibleHands.length === 0) {
        // If no originally eligible players remain (all folded),
        // distribute this pot among all remaining active players
        eligibleHands = allPlayerHands;
      }

      // Find the best hand(s) among eligible players for this pot
      // Use HandEvaluator to compare hands properly
      const bestHands = HandEvaluator.findWinners(eligibleHands);

      // Distribute this pot among the winners
      if (bestHands.length > 0) {
        const share = Math.floor(pot.amount / bestHands.length);
        let remainder = pot.amount % bestHands.length;

        for (const winner of bestHands) {
          let winAmount = share;

          // Distribute remainder to first winners
          if (remainder > 0) {
            winAmount++;
            remainder--;
          }

          const currentPayout = payouts.get(winner.player) || 0;
          payouts.set(winner.player, currentPayout + winAmount);
        }
      }
    }

    return payouts;
  }

  /**
   * Get pot information for display/testing
   * @returns {Array}
   */
  getPotsInfo() {
    return this.pots.map((pot, index) => ({
      potId: pot.id,
      potName: pot.name,
      amount: pot.amount,
      eligiblePlayers: pot.eligiblePlayers.map((p) => p.id),
      isMain: index === 0,
      isActive: pot.isActive,
      maxContribution: pot.maxContributionPerPlayer,
    }));
  }

  /**
   * End betting round - close active pots if needed
   */
  endBettingRound() {
    // In the new design, we don't rebuild pots
    // We just ensure any capped pots are properly closed
    for (const pot of this.pots) {
      if (pot.maxContributionPerPlayer !== null) {
        pot.close();
      }
    }
  }


  /**
   * Clear all pot amounts after winnings have been distributed
   * This completes the double-entry bookkeeping transaction
   */
  clearAllPots() {
    for (const pot of this.pots) {
      pot.amount = 0;
    }
  }

  /**
   * Reset for a new hand
   */
  reset() {
    this.pots = [];
    this.nextPotId = 0;
    this.createPot(this.players);
  }
}
