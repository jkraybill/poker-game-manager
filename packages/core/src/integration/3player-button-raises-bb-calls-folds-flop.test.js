import { describe, it, expect, afterEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';
import { GamePhase } from '../types/index.js';

// Player with phase-aware strategy
class PhaseAwarePlayer extends Player {
  constructor(config) {
    super(config);
    this.isButton = false;
    this.isBB = false;
    this.hasRaisedPreflop = false;
    this.hasBetFlop = false;
  }

  getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;

    // Button strategy
    if (this.isButton) {
      // Pre-flop: raise to 100
      if (gameState.phase === GamePhase.PRE_FLOP && !this.hasRaisedPreflop && gameState.currentBet === 20) {
        this.hasRaisedPreflop = true;
        return {
          playerId: this.id,
          action: Action.RAISE,
          amount: 100,
          timestamp: Date.now(),
        };
      }
      
      // Flop: bet 200 if checked to
      if (gameState.phase === GamePhase.FLOP && !this.hasBetFlop && gameState.currentBet === 0) {
        this.hasBetFlop = true;
        return {
          playerId: this.id,
          action: Action.BET,
          amount: 200,
          timestamp: Date.now(),
        };
      }
    }
    
    // BB strategy: call pre-flop raise, check/fold flop
    if (this.isBB) {
      // Pre-flop: call raises up to 100
      if (gameState.phase === GamePhase.PRE_FLOP && toCall > 0 && toCall <= 80) {
        return {
          playerId: this.id,
          action: Action.CALL,
          amount: toCall,
          timestamp: Date.now(),
        };
      }
      
      // Pre-flop: check when having the option (toCall = 0 after calling a raise)
      if (gameState.phase === GamePhase.PRE_FLOP && toCall === 0) {
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
      
      // Flop: fold to any bet
      if (gameState.phase === GamePhase.FLOP && toCall > 0) {
        return {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now(),
        };
      }
    }
    
    // SB always folds to raises
    if (!this.isButton && !this.isBB && gameState.currentBet > 20 && toCall > 0) {
      return {
        playerId: this.id,
        action: Action.FOLD,
        timestamp: Date.now(),
      };
    }

    // Default: check or call small amounts
    if (toCall === 0) {
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now(),
      };
    }
    
    if (toCall > 0 && toCall <= myState.chips) {
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now(),
      };
    }

    // Fold if can't afford
    return {
      playerId: this.id,
      action: Action.FOLD,
      timestamp: Date.now(),
    };
  }
}

describe('3-player: Button raises, BB calls, then folds to flop bet', () => {
  let manager;

  afterEach(() => {
    if (manager) {
      manager.tables.forEach(table => table.close());
    }
  });

  it('should handle Button raising pre-flop, BB calling, then BB folding to flop bet', async () => {
    manager = new PokerGameManager();
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      dealerButton: 0,
    });

    // Create three phase-aware players
    const players = [
      new PhaseAwarePlayer({ name: 'Player 1' }),
      new PhaseAwarePlayer({ name: 'Player 2' }),
      new PhaseAwarePlayer({ name: 'Player 3' }),
    ];

    // Track game state
    let buttonPlayer = null;
    const actions = [];
    const positions = {};
    let currentPhase = null;

    table.on('cards:community', ({ phase }) => {
      currentPhase = phase;
    });
    
    table.on('hand:started', () => {
      currentPhase = GamePhase.PRE_FLOP;
    });


    table.on('hand:started', ({ dealerButton }) => {
      const dealerButtonPos = dealerButton;
      
      // Determine positions and assign roles
      const sbPos = (dealerButton + 1) % 3;
      const bbPos = (dealerButton + 2) % 3;
      
      positions[dealerButton] = 'Button/UTG';
      positions[sbPos] = 'Small Blind';
      positions[bbPos] = 'Big Blind';
      
      // Assign roles to players
      players.forEach((p, idx) => {
        p.isButton = (idx === dealerButton);
        p.isBB = (idx === bbPos);
      });
      
      buttonPlayer = players[dealerButtonPos];
    });

    table.on('player:action', ({ playerId, action, amount }) => {
      const player = players.find(p => p.id === playerId);
      const pos = players.indexOf(player);
      const actionData = { 
        playerId,
        playerName: player?.name, 
        position: positions[pos], 
        action, 
        amount,
        phase: currentPhase,
      };
      actions.push(actionData);
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

    // console.log('Final pot size:', potSize);
    // console.log('Winner amount:', winnerAmount);
    // console.log('Actions:', JSON.stringify(actions, null, 2));

    // Verify the button player won
    expect(winnerId).toBe(buttonPlayer.id);
    // Button should win entire pot: pre-flop $210 + uncalled flop bet $200 = $410
    expect(winnerAmount).toBe(410);

    // Verify pre-flop action sequence
    const preflopActions = actions.filter(a => a.phase === GamePhase.PRE_FLOP);
    const raiseAction = preflopActions.find(a => a.action === Action.RAISE);
    expect(raiseAction).toBeDefined();
    expect(raiseAction.amount).toBe(100);
    expect(raiseAction.position).toBe('Button/UTG');

    // SB should fold
    const sbFold = preflopActions.find(a => a.position === 'Small Blind' && a.action === Action.FOLD);
    expect(sbFold).toBeDefined();

    // BB should call
    const bbCall = preflopActions.find(a => a.position === 'Big Blind' && a.action === Action.CALL);
    expect(bbCall).toBeDefined();
    expect(bbCall.amount).toBe(80); // BB already has 20 in, needs 80 more

    // Verify flop action sequence
    const flopActions = actions.filter(a => a.phase === GamePhase.FLOP);
    
    // BB should check
    const bbCheck = flopActions.find(a => a.position === 'Big Blind' && a.action === Action.CHECK);
    expect(bbCheck).toBeDefined();

    // Button should bet
    const buttonBet = flopActions.find(a => a.position === 'Button/UTG' && a.action === Action.BET);
    expect(buttonBet).toBeDefined();
    expect(buttonBet.amount).toBe(200);

    // BB should fold
    const bbFold = flopActions.find(a => a.position === 'Big Blind' && a.action === Action.FOLD);
    expect(bbFold).toBeDefined();

    table.close();
  });
});