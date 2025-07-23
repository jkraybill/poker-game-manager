/**
 * 3-Player Button Raises BB Calls Folds Flop Test (Using Test Utilities)
 * 
 * Tests a specific 3-player scenario where:
 * 1. Button raises pre-flop
 * 2. SB folds
 * 3. BB calls
 * 4. BB checks flop
 * 5. Button bets flop
 * 6. BB folds
 * 
 * This tests phase-aware strategy and continuation betting.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  createTestTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  Action,
  GamePhase,
  cleanupTables,
} from '../test-utils/index.js';

describe('3-player: Button raises, BB calls, then folds to flop bet (v2)', () => {
  let manager;
  let table;
  let events;

  beforeEach(() => {
    // Initialize but don't create yet
    manager = null;
    table = null;
    events = null;
  });

  afterEach(() => {
    // Clean up if created
    if (manager) {
      cleanupTables(manager);
    }
  });

  it('should handle Button raising pre-flop, BB calling, then BB folding to flop bet', async () => {
    // Create 3-player table
    const result = createTestTable('standard', {
      minPlayers: 3,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // Phase-aware strategy
    const phaseAwareStrategy = ({ player, gameState, myState, toCall }) => {
      // Use player's assigned position flags
      const isButton = player.isButton;
      const isBB = player.isBB;
      
      // Button strategy
      if (isButton) {
        // Pre-flop: raise to 100 (whether opening or facing BB)
        if (gameState.phase === 'PRE_FLOP' && !player.hasRaisedPreflop) {
          player.hasRaisedPreflop = true;
          return { action: Action.RAISE, amount: 100 };
        }
        
        // Flop: bet 200 if checked to
        if (gameState.phase === 'FLOP' && !player.hasBetFlop && gameState.currentBet === 0) {
          player.hasBetFlop = true;
          return { action: Action.BET, amount: 200 };
        }
        
        // Default button action: check or call
        if (toCall === 0) {
          return { action: Action.CHECK };
        }
        if (toCall <= myState.chips) {
          return { action: Action.CALL, amount: toCall };
        }
      }
      
      // BB strategy: call pre-flop raise, check/fold flop
      if (isBB) {
        // Pre-flop: call raises up to 100
        if (gameState.phase === 'PRE_FLOP' && toCall > 0 && toCall <= 80) {
          return { action: Action.CALL, amount: toCall };
        }
        
        // Pre-flop: check when having the option
        if (gameState.phase === 'PRE_FLOP' && toCall === 0) {
          return { action: Action.CHECK };
        }
        
        // Flop: check if no bet
        if (gameState.phase === 'FLOP' && toCall === 0) {
          return { action: Action.CHECK };
        }
        
        // Flop: fold to any bet
        if (gameState.phase === 'FLOP' && toCall > 0) {
          return { action: Action.FOLD };
        }
      }
      
      // SB strategy: fold to raises
      if (!isButton && !isBB && toCall > 10) {
        return { action: Action.FOLD };
      }

      // Default: check or fold
      if (toCall === 0) {
        return { action: Action.CHECK };
      }

      // Fold by default
      return { action: Action.FOLD };
    };

    // Create players without positions
    const players = Array.from({ length: 3 }, (_, i) => {
      const player = new StrategicPlayer({
        name: `Player ${i + 1}`,
        strategy: phaseAwareStrategy,
      });
      player.hasRaisedPreflop = false;
      player.hasBetFlop = false;
      player.isButton = false;
      player.isBB = false;
      return player;
    });

    // Track positions and button player
    let buttonPlayer = null;
    const positions = {};
    
    // Assign positions when hand starts
    table.on('hand:started', ({ dealerButton }) => {
      const sbPos = (dealerButton + 1) % 3;
      const bbPos = (dealerButton + 2) % 3;
      
      positions[dealerButton] = 'Button/UTG';
      positions[sbPos] = 'Small Blind';
      positions[bbPos] = 'Big Blind';
      
      // Assign roles to players
      players.forEach((p, idx) => {
        p.isButton = (idx === dealerButton);
        p.isBB = (idx === bbPos);
        p.hasRaisedPreflop = false; // Reset for new hand
        p.hasBetFlop = false;
      });
      
      buttonPlayer = players[dealerButton];
    });

    // Add players
    players.forEach(p => table.addPlayer(p));
    
    // Pre-assign positions based on dealerButton: 0
    // In 3-player with dealerButton 0:
    // Position 0: Button/UTG
    // Position 1: SB
    // Position 2: BB
    players[0].isButton = true;
    players[0].isBB = false;
    players[1].isButton = false;
    players[1].isBB = false;
    players[2].isButton = false;
    players[2].isBB = true;
    buttonPlayer = players[0];
    
    // Start game
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { winners, actions } = events;


    // Verify the button player won
    expect(winners).toHaveLength(1);
    expect(winners[0].playerId).toBe(buttonPlayer.id);
    // Button should win entire pot: 
    // Pre-flop: Button $100 + SB $10 (folded) + BB $100 (called) = $210
    // Flop: Button bets $200, BB folds, so total pot = $210 + $200 = $410
    expect(winners[0].amount).toBe(410);

    // Verify pre-flop action sequence
    const preflopActions = actions.filter(a => a.phase === 'PRE_FLOP');
    const raiseAction = preflopActions.find(a => a.action === Action.RAISE);
    expect(raiseAction).toBeDefined();
    expect(raiseAction.amount).toBe(100);
    expect(raiseAction.playerId).toBe(buttonPlayer.id);

    // SB should fold
    const sbPlayer = players.find(p => positions[players.indexOf(p)] === 'Small Blind');
    const sbFold = preflopActions.find(a => a.playerId === sbPlayer.id && a.action === Action.FOLD);
    expect(sbFold).toBeDefined();

    // BB should call
    const bbPlayer = players.find(p => p.isBB);
    const bbCall = preflopActions.find(a => a.playerId === bbPlayer.id && a.action === Action.CALL);
    expect(bbCall).toBeDefined();
    expect(bbCall.amount).toBe(80); // BB already has 20 in, needs 80 more

    // Verify flop action sequence
    const flopActions = actions.filter(a => a.phase === 'FLOP');
    
    // BB should check
    const bbCheck = flopActions.find(a => a.playerId === bbPlayer.id && a.action === Action.CHECK);
    expect(bbCheck).toBeDefined();

    // Button should bet
    const buttonBet = flopActions.find(a => a.playerId === buttonPlayer.id && a.action === Action.BET);
    expect(buttonBet).toBeDefined();
    expect(buttonBet.amount).toBe(200);

    // BB should fold
    const bbFold = flopActions.find(a => a.playerId === bbPlayer.id && a.action === Action.FOLD);
    expect(bbFold).toBeDefined();
  });
});