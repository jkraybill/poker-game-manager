import { describe, it, expect, afterEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

// Player that only raises if they're first to act (UTG/Button in 3-player)
class PositionalRaisePlayer extends Player {
  constructor(config) {
    super(config);
    this.isButton = false;
    this.targetAmount = config.targetAmount || 100;
  }

  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    // Only raise if we're marked as the button, facing just the big blind
    if (this.isButton && gameState.currentBet === 20) {
      return {
        playerId: this.id,
        action: Action.RAISE,
        amount: this.targetAmount,
        timestamp: Date.now(),
      };
    }

    // Fold to raises if we're not the button
    if (!this.isButton && gameState.currentBet > 20 && toCall > 0) {
      return {
        playerId: this.id,
        action: Action.FOLD,
        timestamp: Date.now(),
      };
    }

    // Otherwise call/check
    if (toCall > 0) {
      const callAmount = Math.min(toCall, myState.chips);
      return {
        playerId: this.id,
        action: callAmount === myState.chips ? Action.ALL_IN : Action.CALL,
        amount: callAmount,
        timestamp: Date.now(),
      };
    }

    return {
      playerId: this.id,
      action: Action.CHECK,
      timestamp: Date.now(),
    };
  }
}

describe('3-player: Button raises, blinds fold', () => {
  let manager;

  afterEach(() => {
    if (manager) {
      manager.tables.forEach(table => table.close());
    }
  });

  it('should handle Button raising to $100 and both blinds folding', async () => {
    manager = new PokerGameManager();
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      dealerButton: 0,
    });

    // Create three players that can adapt their strategy
    const players = [
      new PositionalRaisePlayer({ name: 'Player 1', targetAmount: 100 }),
      new PositionalRaisePlayer({ name: 'Player 2', targetAmount: 100 }),
      new PositionalRaisePlayer({ name: 'Player 3', targetAmount: 100 }),
    ];

    // Track game state
    let buttonPlayer = null;
    const actions = [];
    const positions = {};

    table.on('hand:started', ({ dealerButton }) => {
      const dealerButtonPos = dealerButton;
      
      // Determine positions and mark the button player
      const sbPos = (dealerButton + 1) % 3;
      const bbPos = (dealerButton + 2) % 3;
      
      positions[dealerButton] = 'Button/UTG';
      positions[sbPos] = 'Small Blind';
      positions[bbPos] = 'Big Blind';
      
      // Mark who is the button
      players.forEach((p, idx) => {
        p.isButton = (idx === dealerButton);
      });
      
      buttonPlayer = players[dealerButtonPos];
    });

    table.on('player:action', ({ playerId, action, amount }) => {
      const player = players.find(p => p.id === playerId);
      const pos = players.indexOf(player);
      actions.push({ 
        playerId,
        playerName: player?.name, 
        position: positions[pos], 
        action, 
        amount, 
      });
    });

    // Create promise for hand completion
    const handEndPromise = new Promise((resolve) => {
      table.on('hand:ended', ({ winners }) => {
        resolve({
          winnerId: winners[0]?.playerId,
          winnerAmount: winners[0]?.amount,
        });
      });
    });

    // Add players
    players.forEach(p => table.addPlayer(p));

    // Wait for hand to complete
    const { winnerId, winnerAmount } = await handEndPromise;

    // Verify the button player won
    expect(winnerId).toBe(buttonPlayer.id);
    expect(winnerAmount).toBe(130); // Button's $100 + SB's $10 + BB's $20

    // Verify action sequence
    const raiseAction = actions.find(a => a.action === Action.RAISE);
    expect(raiseAction).toBeDefined();
    expect(raiseAction.amount).toBe(100);
    expect(raiseAction.position).toBe('Button/UTG');

    const foldActions = actions.filter(a => a.action === Action.FOLD);
    expect(foldActions).toHaveLength(2);
    expect(foldActions[0].position).toBe('Small Blind');
    expect(foldActions[1].position).toBe('Big Blind');

    table.close();
  });
});