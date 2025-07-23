import { Player } from '@poker-manager/core';
import { Action } from '@poker-manager/core/types';

/**
 * Simple AI player that makes basic decisions
 */
export class SimpleBot extends Player {
  constructor(config = {}) {
    super(config);
    this.aggressiveness = config.aggressiveness || 0.5;
  }

  /**
   * Get action from bot based on game state
   */
  async getAction(gameState) {
    // Simulate thinking time
    await this.simulateThinking();

    const myState = gameState.players[this.id];
    const currentBet = gameState.currentBet;
    const potOdds = this.calculatePotOdds(gameState);

    // Simple decision logic
    if (currentBet === 0) {
      // No bet to match
      return this.decideBetOrCheck(gameState);
    } else if (currentBet > myState.bet) {
      // Need to match a bet
      return this.decideCallOrFold(gameState, potOdds);
    } else {
      // Already matched current bet
      return {
        action: Action.CHECK,
        playerId: this.id,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Decide whether to bet or check when no bet to match
   */
  decideBetOrCheck(gameState) {
    const shouldBet = Math.random() < this.aggressiveness;

    if (shouldBet) {
      const myChips = gameState.players[this.id].chips;
      const betAmount = Math.floor(gameState.pot * (0.5 + Math.random() * 0.5));

      return {
        action: Action.BET,
        amount: Math.min(betAmount, myChips),
        playerId: this.id,
        timestamp: Date.now(),
      };
    }

    return {
      action: Action.CHECK,
      playerId: this.id,
      timestamp: Date.now(),
    };
  }

  /**
   * Decide whether to call or fold when facing a bet
   */
  decideCallOrFold(gameState, potOdds) {
    const myState = gameState.players[this.id];
    const callAmount = gameState.currentBet - myState.bet;

    // Simple logic: call if pot odds are favorable or we're aggressive
    const shouldCall = potOdds > 0.3 || Math.random() < this.aggressiveness;

    if (shouldCall && callAmount <= myState.chips) {
      return {
        action: Action.CALL,
        playerId: this.id,
        timestamp: Date.now(),
      };
    }

    return {
      action: Action.FOLD,
      playerId: this.id,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate simple pot odds
   */
  calculatePotOdds(gameState) {
    const myState = gameState.players[this.id];
    const callAmount = gameState.currentBet - myState.bet;

    if (callAmount === 0) {
      return 1;
    }

    return gameState.pot / (gameState.pot + callAmount);
  }

  /**
   * Simulate thinking delay
   */
  async simulateThinking() {
    const thinkTime = 1000 + Math.random() * 3000; // 1-4 seconds
    await new Promise((resolve) => setTimeout(resolve, thinkTime));
  }

  /**
   * Receive private cards
   */
  async receivePrivateCards(cards) {
    await super.receivePrivateCards(cards);
    // Bot could evaluate hand strength here
  }
}

/**
 * Factory function to create bots with different personalities
 */
export function createBot(name, personality = 'normal') {
  const personalities = {
    passive: { aggressiveness: 0.2 },
    normal: { aggressiveness: 0.5 },
    aggressive: { aggressiveness: 0.8 },
    maniac: { aggressiveness: 0.95 },
  };

  return new SimpleBot({
    name,
    ...personalities[personality],
  });
}
