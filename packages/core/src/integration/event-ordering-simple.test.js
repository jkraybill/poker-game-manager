import { describe, it, expect, afterEach } from 'vitest';
import {
  createTestScenario,
  StrategicPlayer,
  STRATEGIES,
  waitForHandEnd,
} from '../test-utils/index.js';

/**
 * Simplified test for Issue #33: Event ordering
 * Focus on verifying elimination events fire after hand:ended
 */

describe('Event Ordering - Simple (Issue #33)', () => {
  let scenario;

  afterEach(() => {
    if (scenario) {
      scenario.cleanup();
    }
  });

  it('should fire player:eliminated after hand:ended', async () => {
    console.log('TEST START: Creating scenario...');
    
    // Create test scenario with explicit chip amounts
    scenario = createTestScenario({
      tableConfig: 'standard',
      chipAmounts: [20, 100, 200], // Short stack will go all-in with 20
      tableOverrides: {
        blinds: { small: 10, big: 20 },
        minPlayers: 3,
        dealerButton: 0,
      },
    });

    console.log('Scenario created, getting table and events...');
    const { table, events } = scenario;
    const eventLog = [];

    // Debug all events
    table.on('*', (eventName, data) => {
      if (eventName === 'action:requested') {
        const playerId = data?.playerId;
        const playerName = playerId === shortStack.id ? 'ShortStack' : 
                          playerId === medium.id ? 'Medium' : 
                          playerId === bigStack.id ? 'BigStack' : 'Unknown';
        console.log(`EVENT: ${eventName} for ${playerName} (${playerId})`);
      } else if (eventName === 'player:action') {
        const playerId = data?.playerId;
        const playerName = playerId === shortStack.id ? 'ShortStack' : 
                          playerId === medium.id ? 'Medium' : 
                          playerId === bigStack.id ? 'BigStack' : 'Unknown';
        console.log(`EVENT: ${eventName} from ${playerName} - action: ${data?.action}, amount: ${data?.amount}`);
      } else {
        console.log(`EVENT: ${eventName}`, data?.playerId || data?.winners?.length || '');
      }
    });

    // Track specific events with timestamps
    table.on('hand:ended', ({ winners }) => {
      eventLog.push({
        event: 'hand:ended',
        timestamp: Date.now(),
        winners: winners.length,
      });
      console.log('TRACKED: hand:ended fired');
    });

    table.on('player:eliminated', ({ playerId }) => {
      eventLog.push({
        event: 'player:eliminated',
        timestamp: Date.now(),
        playerId,
      });
      console.log('TRACKED: player:eliminated fired for', playerId);
    });

    console.log('Creating players...');
    // Create players with specific strategies
    // Short stack will go all-in immediately
    const shortStack = new StrategicPlayer({
      name: 'ShortStack',
      strategy: STRATEGIES.pushOrFold, // Will go all-in
    });

    // Use alwaysCall strategy directly
    const medium = new StrategicPlayer({
      name: 'Medium',
      strategy: STRATEGIES.alwaysCall, // Will call any bet
    });

    const bigStack = new StrategicPlayer({
      name: 'BigStack',
      strategy: STRATEGIES.alwaysCheck, // Will check when possible
    });

    console.log('Adding players to scenario...');
    // Add players
    scenario.addPlayers([shortStack, medium, bigStack]);

    console.log('Players added, setting custom chips...');
    // Override chips to create elimination scenario
    // With dealerButton: 0, positions are:
    // Position 0 (Button): shortStack
    // Position 1 (SB): medium pays 10
    // Position 2 (BB): bigStack pays 20
    table.players.get(shortStack.id).player.chips = 25;  // Button, will act first preflop
    table.players.get(medium.id).player.chips = 100;    // SB
    table.players.get(bigStack.id).player.chips = 200;  // BB
    
    console.log('Starting chips:', {
      shortStack: table.players.get(shortStack.id).player.chips,
      medium: table.players.get(medium.id).player.chips,
      bigStack: table.players.get(bigStack.id).player.chips,
    });

    console.log('Starting game...');
    // Start game
    scenario.startGame();

    console.log('Waiting for hand to end...');
    // Wait for hand to complete
    await waitForHandEnd(events);

    console.log('Hand ended, waiting for elimination events...');
    // Give time for elimination events
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Wait complete, analyzing results...');

    // Analyze results
    console.log('Event log:', eventLog);

    // Find event types
    const handEndedEvents = eventLog.filter(e => e.event === 'hand:ended');
    const eliminationEvents = eventLog.filter(e => e.event === 'player:eliminated');

    // Should have exactly one hand:ended
    expect(handEndedEvents).toHaveLength(1);

    // Check final chip counts
    const shortStackData = table.players.get(shortStack.id);
    console.log('ShortStack still in table?', !!shortStackData);
    console.log('ShortStack chips:', shortStackData?.player.chips);

    // If someone was eliminated, verify event ordering
    if (eliminationEvents.length > 0) {
      const handEndedTime = handEndedEvents[0].timestamp;
      const eliminatedTime = eliminationEvents[0].timestamp;
      
      console.log('Time difference:', eliminatedTime - handEndedTime, 'ms');
      expect(eliminatedTime).toBeGreaterThan(handEndedTime);
      console.log('✓ Elimination event fired after hand:ended');
    } else {
      // If no elimination events but player has 0 chips, that's the bug
      if (!shortStackData || shortStackData?.player.chips === 0) {
        console.log('WARNING: Player has 0 chips but no elimination event fired');
        // This might happen if they won or split the pot
        // Check if they were in the winners
        const wasWinner = events.winners.some(w => w.playerId === shortStack.id);
        if (!wasWinner) {
          console.error('BUG: Player lost with 0 chips but no elimination event!');
          expect(eliminationEvents.length).toBeGreaterThan(0);
        }
      }
    }
  });
});