/**
 * Test for Issue #18: Double action:requested event when big blind can check
 * 
 * This test verifies that the action:requested event is only fired once
 * when the big blind has the option to check (no raises pre-flop).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('Big Blind Option Events', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach(table => table.close());
  });

  it('should only emit action:requested once when big blind has option to check', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minPlayers: 3,
      dealerButton: 0,
    });

    const actionRequestedEvents = [];
    let handStarted = false;
    let handEnded = false;

    // Track all action:requested events
    table.on('action:requested', (event) => {
      actionRequestedEvents.push({
        playerId: event.playerId,
        phase: event.gameState.phase,
        currentBet: event.gameState.currentBet,
        timestamp: Date.now(),
      });
      console.log(`action:requested event #${actionRequestedEvents.length}:`, {
        playerId: event.playerId,
        phase: event.gameState.phase,
        currentBet: event.gameState.currentBet,
      });
    });

    table.on('hand:started', () => {
      handStarted = true;
    });

    table.on('hand:ended', () => {
      handEnded = true;
    });

    // Simple players that fold/call/check
    class SimplePlayer extends Player {
      constructor(config) {
        super(config);
        this.strategy = config.strategy || 'fold';
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        console.log(`${this.name} getAction called - strategy: ${this.strategy}, toCall: ${toCall}`);

        if (this.strategy === 'fold' && toCall > 0) {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }

        if (this.strategy === 'call' && toCall > 0) {
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          };
        }

        // Check when possible
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    // Create players - positions with dealerButton: 0
    // P0: Button/SB (in 3-player), P1: SB/BB, P2: BB
    const buttonPlayer = new SimplePlayer({ id: 'button', name: 'Button', strategy: 'fold' });
    const sbPlayer = new SimplePlayer({ id: 'sb', name: 'Small Blind', strategy: 'call' });
    const bbPlayer = new SimplePlayer({ id: 'bb', name: 'Big Blind', strategy: 'check' });

    table.addPlayer(buttonPlayer);
    table.addPlayer(sbPlayer);
    table.addPlayer(bbPlayer);

    console.log('Starting game...');
    table.tryStartGame();

    // Wait for hand to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    expect(handStarted).toBe(true);
    expect(handEnded).toBe(true);

    // Log all action requested events
    console.log('\nAll action:requested events:');
    actionRequestedEvents.forEach((event, i) => {
      console.log(`${i + 1}. Player: ${event.playerId}, Phase: ${event.phase}, CurrentBet: ${event.currentBet}`);
    });

    // Find all events for the big blind in PRE_FLOP
    const bbPreFlopEvents = actionRequestedEvents.filter(event => 
      event.playerId === 'bb' && event.phase === 'PRE_FLOP'
    );

    console.log(`\nBig blind PRE_FLOP events: ${bbPreFlopEvents.length}`);
    
    // The bug is that we get 2 events when big blind has option
    // Expected: 1 event, Actual: 2 events
    expect(bbPreFlopEvents.length).toBe(1);
  });

  it('should correctly handle big blind option when everyone calls', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minPlayers: 3,
      dealerButton: 0,
    });

    const actionRequestedEvents = [];
    const playerActions = [];

    // Track events
    table.on('action:requested', (event) => {
      actionRequestedEvents.push({
        playerId: event.playerId,
        phase: event.gameState.phase,
        currentBet: event.gameState.currentBet,
      });
    });

    table.on('player:action', (event) => {
      playerActions.push({
        playerId: event.playerId,
        action: event.action,
        amount: event.amount,
      });
      console.log(`Player action: ${event.playerId} ${event.action} ${event.amount || ''}`);
    });

    // All players call/check
    class CallingPlayer extends Player {
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

    const p1 = new CallingPlayer({ id: 'p1', name: 'Player 1' });
    const p2 = new CallingPlayer({ id: 'p2', name: 'Player 2' });
    const p3 = new CallingPlayer({ id: 'p3', name: 'Player 3' });

    table.addPlayer(p1);
    table.addPlayer(p2);
    table.addPlayer(p3);

    table.tryStartGame();

    // Wait for hand to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // The big blind (p3) should only get ONE action:requested event
    const p3Events = actionRequestedEvents.filter(e => e.playerId === 'p3' && e.phase === 'PRE_FLOP');
    console.log(`\nPlayer 3 (BB) PRE_FLOP events: ${p3Events.length}`);
    
    expect(p3Events.length).toBe(1);
  });
});