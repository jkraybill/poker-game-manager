/**
 * Test for All-In No Further Betting Bug
 *
 * When all players except one are all-in, the remaining player with chips
 * should NOT be prompted for any further betting actions. The hand should
 * proceed directly to showdown through flop/turn/river without any action requests.
 *
 * Bug Report: After an all-in is called by a bigger stack, the bigger stack
 * is incorrectly allowed to continue betting on subsequent streets.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  createChipStackTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  cleanupTables,
  DeckBuilder,
  Action,
} from '../test-utils/index.js';

describe('All-In No Further Betting Bug', () => {
  let manager;
  let table;
  let events;

  beforeEach(() => {
    manager = null;
    table = null;
    events = null;
  });

  afterEach(() => {
    if (manager) {
      cleanupTables(manager);
    }
  });

  describe('2-Player Heads-Up Scenario', () => {
    it('should NOT request further actions from big stack after small stack all-in is called', async () => {
      // Create heads-up table with specific chip amounts
      const result = createChipStackTable('standard', [100, 1000], {
        dealerButton: 0,
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
      });
      manager = result.manager;
      table = result.table;
      events = setupEventCapture(table);

      // Create rigged deck where small stack gets decent hand, big stack gets better hand
      const riggedDeck = new DeckBuilder(2)
        .dealHoleCards([
          ['Kh', 'Kd'], // Player 0 (SB/Button) - Kings
          ['Ah', 'Ad'], // Player 1 (BB) - Aces
        ])
        .addCommunityCards(['2c', '7d', '9s', '3h', '4c']) // No help for either
        .build();

      table.setCustomDeck(riggedDeck);

      // Track all action requests to verify no post-all-in actions
      const actionRequests = [];
      const actionRequestsByPhase = {
        preflop: [],
        flop: [],
        turn: [],
        river: [],
      };
      let currentPhase = 'preflop';

      // Track phase changes
      table.on('round:flop', () => {
        currentPhase = 'flop';
      });
      table.on('round:turn', () => {
        currentPhase = 'turn';
      });
      table.on('round:river', () => {
        currentPhase = 'river';
      });

      // Create small stack player that goes all-in
      const smallStackPlayer = new StrategicPlayer({
        name: 'Small Stack',
        strategy: ({ myState, toCall }) => {
          // Track this action request
          const request = {
            playerId: smallStackPlayer.id,
            phase: currentPhase,
            chips: myState.chips,
            toCall,
          };
          actionRequests.push(request);
          actionRequestsByPhase[currentPhase].push(request);

          // Go all-in on any action
          if (myState.chips > 0) {
            return { action: Action.ALL_IN, amount: myState.chips };
          }
          return { action: Action.CHECK };
        },
      });

      // Create big stack player that calls the all-in
      const bigStackPlayer = new StrategicPlayer({
        name: 'Big Stack',
        strategy: ({ myState, toCall, gameState }) => {
          // Track this action request
          const request = {
            playerId: bigStackPlayer.id,
            phase: currentPhase,
            chips: myState.chips,
            toCall,
            pot: gameState.pot,
          };
          actionRequests.push(request);
          actionRequestsByPhase[currentPhase].push(request);

          // Call any bet/raise
          if (toCall > 0) {
            return { action: Action.CALL };
          }
          // This should never happen after calling the all-in
          return { action: Action.CHECK };
        },
      });

      // Add players (chips will be set by table factory)
      table.addPlayer(smallStackPlayer);
      table.addPlayer(bigStackPlayer);

      // Start game
      table.tryStartGame();

      // Wait for hand to complete
      await waitForHandEnd(events);

      // Verify the hand played out correctly
      const { winners, actions } = events;

      // Debug output
      console.log('Winners:', winners);
      console.log('Actions:', actions);
      console.log('Action requests by phase:', actionRequestsByPhase);
      console.log('Total action requests:', actionRequests.length);

      // Big stack (Aces) should win
      expect(winners).toHaveLength(1);
      expect(winners[0].playerId).toBe(bigStackPlayer.id);
      expect(winners[0].amount).toBe(200); // Small stack's 100 chips * 2

      // Verify action sequence
      // We should have exactly 2 preflop actions
      expect(actions).toHaveLength(2);
      expect(actions[0].action).toBe(Action.ALL_IN);
      expect(actions[0].playerId).toBe(smallStackPlayer.id);
      expect(actions[1].action).toBe(Action.CALL);
      expect(actions[1].playerId).toBe(bigStackPlayer.id);

      // Verify no action requests were made post-all-in
      expect(actionRequestsByPhase.flop).toHaveLength(0);
      expect(actionRequestsByPhase.turn).toHaveLength(0);
      expect(actionRequestsByPhase.river).toHaveLength(0);

      // Log for debugging
      console.log('Action requests by phase:', actionRequestsByPhase);
      console.log('Total action requests:', actionRequests.length);
    });
  });

  describe('3-Player Scenario', () => {
    it('should NOT request actions from remaining player after two players are all-in', async () => {
      // Create 3-player table
      const result = createTestTable('standard', {
        blinds: { small: 10, big: 20 },
        minPlayers: 3,
        dealerButton: 0,
      });
      manager = result.manager;
      table = result.table;
      events = setupEventCapture(table);

      // Create rigged deck
      const riggedDeck = new DeckBuilder(3)
        .dealHoleCards([
          ['Jh', 'Jd'], // Player 0 (Button) - Jacks
          ['Qh', 'Qd'], // Player 1 (SB) - Queens
          ['Kh', 'Kd'], // Player 2 (BB) - Kings
        ])
        .addCommunityCards(['2c', '7d', '9s', '3h', '4c'])
        .build();

      table.setCustomDeck(riggedDeck);

      // Track action requests
      const actionRequestsByPhase = {
        preflop: [],
        flop: [],
        turn: [],
        river: [],
      };
      let currentPhase = 'preflop';

      table.on('round:flop', () => {
        currentPhase = 'flop';
      });
      table.on('round:turn', () => {
        currentPhase = 'turn';
      });
      table.on('round:river', () => {
        currentPhase = 'river';
      });

      // Player 0 (Button) - Medium stack, goes all-in
      const buttonPlayer = new StrategicPlayer({
        name: 'Button',
        chips: 200,
        strategy: ({ myState }) => {
          actionRequestsByPhase[currentPhase].push({
            playerId: buttonPlayer.id,
            phase: currentPhase,
          });

          if (myState.chips > 0) {
            return { action: Action.ALL_IN, amount: myState.chips };
          }
          return { action: Action.CHECK };
        },
      });

      // Player 1 (SB) - Small stack, goes all-in
      const sbPlayer = new StrategicPlayer({
        name: 'Small Blind',
        chips: 150,
        strategy: ({ myState, toCall }) => {
          actionRequestsByPhase[currentPhase].push({
            playerId: sbPlayer.id,
            phase: currentPhase,
          });

          if (toCall > 0 && myState.chips > 0) {
            return { action: Action.ALL_IN, amount: myState.chips };
          }
          return { action: Action.CHECK };
        },
      });

      // Player 2 (BB) - Big stack, calls all-ins
      const bbPlayer = new StrategicPlayer({
        name: 'Big Blind',
        chips: 1000,
        strategy: ({ toCall }) => {
          actionRequestsByPhase[currentPhase].push({
            playerId: bbPlayer.id,
            phase: currentPhase,
          });

          if (toCall > 0) {
            return { action: Action.CALL };
          }
          return { action: Action.CHECK };
        },
      });

      // Add players
      table.addPlayer(buttonPlayer);
      table.addPlayer(sbPlayer);
      table.addPlayer(bbPlayer);

      // Start game
      table.tryStartGame();

      // Wait for hand to complete
      await waitForHandEnd(events);

      // Verify results
      const { winners, actions } = events;

      // BB (Kings) should win main pot and side pot
      expect(winners).toHaveLength(1);
      expect(winners[0].playerId).toBe(bbPlayer.id);

      // Verify we got preflop actions (all-ins and call)
      expect(actions.length).toBeGreaterThan(0);

      // Count all-in actions
      const allInActions = actions.filter((a) => a.action === Action.ALL_IN);
      expect(allInActions.length).toBeGreaterThanOrEqual(2); // At least 2 all-ins

      // Verify no action requests on later streets
      expect(actionRequestsByPhase.flop).toHaveLength(0);
      expect(actionRequestsByPhase.turn).toHaveLength(0);
      expect(actionRequestsByPhase.river).toHaveLength(0);

      console.log('3-player action requests by phase:', actionRequestsByPhase);
    });
  });

  describe('4-Player Complex Scenario', () => {
    it('should handle multiple all-ins with one player remaining with chips', async () => {
      // Create 4-player table
      const result = createTestTable('standard', {
        blinds: { small: 10, big: 20 },
        minPlayers: 4,
        dealerButton: 0,
      });
      manager = result.manager;
      table = result.table;
      events = setupEventCapture(table);

      // Create rigged deck
      const riggedDeck = new DeckBuilder(4)
        .dealHoleCards([
          ['9h', '9d'], // Player 0 (Button)
          ['Th', 'Td'], // Player 1 (SB)
          ['Jh', 'Jd'], // Player 2 (BB)
          ['Ah', 'Ad'], // Player 3 (UTG) - Best hand
        ])
        .addCommunityCards(['2c', '7d', '8s', '3h', '4c'])
        .build();

      table.setCustomDeck(riggedDeck);

      let postAllInActionRequests = 0;
      let allPlayersAllIn = false;

      // Track when all but one player are all-in
      let allInCount = 0;
      table.on('player:action', ({ action }) => {
        if (action.action === Action.ALL_IN) {
          allInCount++;
          // After 2+ all-ins, only one player should have chips
          if (allInCount >= 2) {
            allPlayersAllIn = true;
          }
        }
      });

      // Players with varying stacks
      const players = [
        new StrategicPlayer({
          name: 'Button',
          chips: 100,
          strategy: ({ myState }) => {
            if (allPlayersAllIn) {
              postAllInActionRequests++;
            }
            return myState.chips > 0
              ? { action: Action.ALL_IN, amount: myState.chips }
              : { action: Action.CHECK };
          },
        }),
        new StrategicPlayer({
          name: 'SB',
          chips: 150,
          strategy: ({ myState, toCall }) => {
            if (allPlayersAllIn) {
              postAllInActionRequests++;
            }
            return toCall > 0 && myState.chips > 0
              ? { action: Action.ALL_IN, amount: myState.chips }
              : { action: Action.FOLD };
          },
        }),
        new StrategicPlayer({
          name: 'BB',
          chips: 200,
          strategy: ({ myState, toCall }) => {
            if (allPlayersAllIn) {
              postAllInActionRequests++;
            }
            return toCall > 0 && myState.chips > 0
              ? { action: Action.ALL_IN, amount: myState.chips }
              : { action: Action.FOLD };
          },
        }),
        new StrategicPlayer({
          name: 'UTG',
          chips: 1000, // Big stack
          strategy: ({ toCall }) => {
            if (allPlayersAllIn) {
              postAllInActionRequests++;
            }
            return toCall > 0
              ? { action: Action.CALL }
              : { action: Action.CHECK };
          },
        }),
      ];

      // Add players
      players.forEach((p) => table.addPlayer(p));

      // Start game
      table.tryStartGame();

      // Wait for hand to complete
      await waitForHandEnd(events);

      // CRITICAL: After multiple all-ins with one player remaining,
      // no further actions should be requested
      expect(postAllInActionRequests).toBe(0);

      console.log('Post all-in action requests:', postAllInActionRequests);
    });
  });
});
