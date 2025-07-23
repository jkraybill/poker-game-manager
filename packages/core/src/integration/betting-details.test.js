/**
 * Test for Issue #19: Add betting details to action:requested event
 * 
 * This test verifies that the action:requested event includes comprehensive
 * betting information including toCall, minRaise, maxRaise, potSize, and validActions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('Betting Details in action:requested Event', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach(table => table.close());
  });

  it('should include betting details in action:requested event', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minPlayers: 3,
      dealerButton: 0,
    });

    const actionRequests = [];
    let handStarted = false;

    // Capture all action:requested events
    table.on('action:requested', (event) => {
      actionRequests.push({
        playerId: event.playerId,
        phase: event.gameState.phase,
        bettingDetails: event.bettingDetails,
      });
    });

    table.on('hand:started', () => {
      handStarted = true;
    });

    // Simple test players
    class TestPlayer extends Player {
      constructor(config) {
        super(config);
        this.strategy = config.strategy || 'check';
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // First player raises
        if (this.strategy === 'raise' && toCall === 0) {
          return {
            playerId: this.id,
            action: Action.BET,
            amount: 50,
            timestamp: Date.now(),
          };
        }

        // Second player calls
        if (this.strategy === 'call' && toCall > 0) {
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          };
        }

        // Default check/fold
        if (toCall > 0) {
          return {
            playerId: this.id,
            action: Action.FOLD,
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

    const p1 = new TestPlayer({ id: 'p1', name: 'Player 1', strategy: 'raise' });
    const p2 = new TestPlayer({ id: 'p2', name: 'Player 2', strategy: 'call' });
    const p3 = new TestPlayer({ id: 'p3', name: 'Player 3', strategy: 'check' });

    table.addPlayer(p1);
    table.addPlayer(p2);
    table.addPlayer(p3);

    table.tryStartGame();

    // Wait for some actions
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(handStarted).toBe(true);
    expect(actionRequests.length).toBeGreaterThan(0);

    // Check first action request (UTG player)
    const firstRequest = actionRequests[0];
    expect(firstRequest.playerId).toBe('p1');
    expect(firstRequest.phase).toBe('PRE_FLOP');
    expect(firstRequest.bettingDetails).toBeDefined();

    const details = firstRequest.bettingDetails;
    expect(details.currentBet).toBe(20); // Big blind
    expect(details.toCall).toBe(20); // UTG needs to call BB
    expect(details.potSize).toBe(30); // SB + BB
    expect(details.minRaise).toBe(40); // BB * 2
    expect(details.maxRaise).toBe(1000); // Player's stack
    expect(details.validActions).toContain(Action.FOLD);
    expect(details.validActions).toContain(Action.CALL);
    expect(details.validActions).toContain(Action.RAISE);

    // Find the action request after a raise
    const postRaiseRequest = actionRequests.find(req => 
      req.playerId === 'p2' && req.bettingDetails && req.bettingDetails.currentBet > 20
    );

    if (postRaiseRequest) {
      const raiseDetails = postRaiseRequest.bettingDetails;
      expect(raiseDetails.currentBet).toBe(50); // After raise
      expect(raiseDetails.toCall).toBeGreaterThan(0);
      expect(raiseDetails.validActions).toContain(Action.FOLD);
      expect(raiseDetails.validActions).toContain(Action.CALL);
    }
  });

  it('should correctly calculate betting details for all-in scenarios', async () => {
    const table = manager.createTable({
      blinds: { small: 5, big: 10 },
      minPlayers: 2,
      dealerButton: 0,
    });

    let capturedRequest = null;

    table.on('action:requested', (event) => {
      if (event.playerId === 'short' && event.gameState.phase === 'PRE_FLOP') {
        capturedRequest = event;
      }
    });

    // Players with different stacks
    class ShortStackPlayer extends Player {
      getAction(gameState) {
        // Will go all-in
        return {
          playerId: this.id,
          action: Action.ALL_IN,
          amount: gameState.players[this.id].chips,
          timestamp: Date.now(),
        };
      }
    }

    class BigStackPlayer extends Player {
      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;
        
        if (toCall > 0) {
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
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

    const shortStack = new ShortStackPlayer({ id: 'short', name: 'Short Stack' });
    const bigStack = new BigStackPlayer({ id: 'big', name: 'Big Stack' });

    table.addPlayer(shortStack);
    table.addPlayer(bigStack);

    // Set specific chip amounts
    shortStack.chips = 25; // Less than minimum raise
    bigStack.chips = 200;

    table.tryStartGame();

    // Wait for action
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(capturedRequest).toBeDefined();
    
    const details = capturedRequest.bettingDetails;
    expect(details.currentBet).toBe(10); // Big blind
    expect(details.toCall).toBe(5); // SB already posted 5, needs 5 more
    expect(details.potSize).toBe(15); // SB + BB
    
    // With 25 chips, after calling 5, player has 20 left
    // They can call or raise (but raising would put them all-in)
    expect(details.validActions).toContain(Action.CALL);
    expect(details.validActions).toContain(Action.RAISE);
    expect(details.maxRaise).toBe(25); // All chips
    
    // Min raise would be 20 (BB * 2) but player only has 25 total
    expect(details.minRaise).toBe(20); // Double the BB
  });

  it('should show correct valid actions based on game state', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
      dealerButton: 0,
    });

    const actionRequests = [];

    table.on('action:requested', (event) => {
      actionRequests.push({
        playerId: event.playerId,
        phase: event.gameState.phase,
        toCall: event.bettingDetails.toCall,
        validActions: event.bettingDetails.validActions,
      });
    });

    class VersatilePlayer extends Player {
      constructor(config) {
        super(config);
        this.actionCount = 0;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;
        
        this.actionCount++;
        
        // Mix up actions to test different scenarios
        if (this.actionCount === 1 && toCall > 0) {
          // First action - call
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          };
        }
        
        // Default check
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    const p1 = new VersatilePlayer({ id: 'p1', name: 'Player 1' });
    const p2 = new VersatilePlayer({ id: 'p2', name: 'Player 2' });

    table.addPlayer(p1);
    table.addPlayer(p2);

    table.tryStartGame();

    // Wait for several actions
    await new Promise(resolve => setTimeout(resolve, 300));

    // Check various scenarios
    const checkScenario = actionRequests.find(req => req.toCall === 0 && req.phase === 'FLOP');
    if (checkScenario) {
      expect(checkScenario.validActions).toContain(Action.CHECK);
      // If it's a new betting round (currentBet = 0), we can BET
      // If currentBet > 0 but toCall = 0 (like BB option), we can RAISE
      const canBet = checkScenario.validActions.includes(Action.BET);
      const canRaise = checkScenario.validActions.includes(Action.RAISE);
      expect(canBet || canRaise).toBe(true); // Should be able to bet or raise
      expect(checkScenario.validActions).not.toContain(Action.CALL);
    }

    const callScenario = actionRequests.find(req => req.toCall > 0);
    if (callScenario) {
      expect(callScenario.validActions).toContain(Action.FOLD);
      expect(callScenario.validActions).toContain(Action.CALL);
      expect(callScenario.validActions).not.toContain(Action.CHECK);
      expect(callScenario.validActions).not.toContain(Action.BET);
    }
  });
});