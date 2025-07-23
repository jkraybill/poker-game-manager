/**
 * Test for Issue #18: Double action:requested event when big blind can check (Using Test Utilities)
 * 
 * This test verifies that the action:requested event is only fired once
 * when the big blind has the option to check (no raises pre-flop).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  createTestTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  Action,
  cleanupTables,
} from '../test-utils/index.js';

describe('Big Blind Option Events (v2)', () => {
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

  it('should only emit action:requested once when big blind has option to check', async () => {
    // Create 3-player table
    const result = createTestTable('standard', {
      minPlayers: 3,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    const actionRequestedEvents = [];

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

    // Set up event capture
    events = setupEventCapture(table);

    // Simple fold/call/check strategy
    const simpleStrategy = ({ player, toCall }) => {
      console.log(`${player.name} getAction called - strategy: ${player.strategy}, toCall: ${toCall}`);

      if (player.strategy === 'fold' && toCall > 0) {
        return { action: Action.FOLD };
      }

      if (player.strategy === 'call' && toCall > 0) {
        return { action: Action.CALL, amount: toCall };
      }

      // Check when possible
      return { action: Action.CHECK };
    };

    // Create players - positions with dealerButton: 0
    // P0: Button/SB (in 3-player), P1: SB/BB, P2: BB
    const buttonPlayer = new StrategicPlayer({ 
      id: 'button', 
      name: 'Button', 
      strategy: simpleStrategy 
    });
    buttonPlayer.strategy = 'fold';

    const sbPlayer = new StrategicPlayer({ 
      id: 'sb', 
      name: 'Small Blind', 
      strategy: simpleStrategy 
    });
    sbPlayer.strategy = 'call';

    const bbPlayer = new StrategicPlayer({ 
      id: 'bb', 
      name: 'Big Blind', 
      strategy: simpleStrategy 
    });
    bbPlayer.strategy = 'check';

    table.addPlayer(buttonPlayer);
    table.addPlayer(sbPlayer);
    table.addPlayer(bbPlayer);

    console.log('Starting game...');
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    expect(events.handStarted).toBe(true);
    expect(events.handEnded).toBe(true);

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
    // Create 3-player table
    const result = createTestTable('standard', {
      minPlayers: 3,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    const actionRequestedEvents = [];

    // Track events
    table.on('action:requested', (event) => {
      actionRequestedEvents.push({
        playerId: event.playerId,
        phase: event.gameState.phase,
        currentBet: event.gameState.currentBet,
      });
    });

    table.on('player:action', (event) => {
      console.log(`Player action: ${event.playerId} ${event.action} ${event.amount || ''}`);
    });

    // Set up event capture
    events = setupEventCapture(table);

    // All players call/check strategy
    const callingStrategy = ({ toCall }) => {
      if (toCall > 0) {
        return { action: Action.CALL, amount: toCall };
      }
      return { action: Action.CHECK };
    };

    const p1 = new StrategicPlayer({ 
      id: 'p1', 
      name: 'Player 1',
      strategy: callingStrategy,
    });

    const p2 = new StrategicPlayer({ 
      id: 'p2', 
      name: 'Player 2',
      strategy: callingStrategy,
    });

    const p3 = new StrategicPlayer({ 
      id: 'p3', 
      name: 'Player 3',
      strategy: callingStrategy,
    });

    table.addPlayer(p1);
    table.addPlayer(p2);
    table.addPlayer(p3);

    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // The big blind (p3) should only get ONE action:requested event
    const p3Events = actionRequestedEvents.filter(e => e.playerId === 'p3' && e.phase === 'PRE_FLOP');
    console.log(`\nPlayer 3 (BB) PRE_FLOP events: ${p3Events.length}`);
    
    expect(p3Events.length).toBe(1);
  });
});