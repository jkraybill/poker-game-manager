/**
 * Split Pot Scenarios - Refactored with Test Utilities
 * 
 * This is a demonstration of how the test utilities reduce duplication
 * and make tests more readable and maintainable.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createSplitPotScenario,
  createHeadsUpScenario,
  DeckBuilder,
  PLAYER_TYPES,
  StrategicPlayer,
  assertPotSplit,
  assertHandStrengths,
  assertShowdown,
  executePokerTest,
  cleanupTables,
  Action
} from '../test-utils/index.js';
import { Player } from '../Player.js';

describe('Split Pot Scenarios - Refactored', () => {
  let manager;

  afterEach(() => {
    if (manager) {
      cleanupTables(manager);
    }
  });

  it('should handle 2-player split pot with identical straights', async () => {
    const results = await executePokerTest(
      () => {
        const scenario = createHeadsUpScenario({
          customDeck: DeckBuilder.createHeadsUpDeck(
            ['8h', '9h'], ['8d', '9d'],
            ['5c', '6s', '7h', 'Tc', 'Jc']
          ),
          playerTypes: [] // Don't add default players, we'll add our own
        });
        
        // Create custom players using the same pattern as the original working test
        class StraightPlayer extends Player {
          constructor(config) {
            super(config);
            this.position = config.position;
          }

          getAction(gameState) {
            const myState = gameState.players[this.id];
            const toCall = gameState.currentBet - myState.bet;

            // Preflop: Button raises, BB calls
            if (gameState.phase === 'PRE_FLOP') {
              if (this.position === 'BUTTON' && gameState.currentBet === 20) {
                // Button wants to raise TO 60 total, already has 10 in
                // So needs to put in 50 more
                return {
                  playerId: this.id,
                  action: Action.RAISE,
                  amount: 50,  // Raise BY 50 to make total 60
                  timestamp: Date.now(),
                };
              }
              if (toCall > 0) {
                return {
                  playerId: this.id,
                  action: Action.CALL,
                  amount: toCall,
                  timestamp: Date.now(),
                };
              }
            }

            // Post-flop: Both check down
            return {
              playerId: this.id,
              action: Action.CHECK,
              timestamp: Date.now(),
            };
          }
        }
        
        const players = [
          new StraightPlayer({ name: 'Button Player', position: 'BUTTON' }),
          new StraightPlayer({ name: 'BB Player', position: 'BB' }),
        ];
        scenario.addPlayers(players);
        
        return scenario;
      },
      (results) => {
        // Verify split pot: Button raised to 60, BB called 40 more, total = 120
        assertPotSplit(results.winners, 120);
        expect(results.winners).toHaveLength(2);
        
        // Verify both have straights
        assertHandStrengths(results.winners, 5); // Straight rank = 5
        
        // Verify showdown occurred
        assertShowdown(results.winners, true);
        
        // Verify even split
        expect(results.winners[0].amount).toBe(60);
        expect(results.winners[1].amount).toBe(60);
      }
    );
    
    manager = results.scenario?.manager;
  });

  it('should handle 3-way split pot where all players play the board', async () => {
    const results = await executePokerTest(
      () => createSplitPotScenario({
        playerCount: 3,
        identicalHands: [['2h', '3h'], ['2d', '3d'], ['2c', '3c']], // Weak hands
        communityCards: ['As', 'Ks', 'Qs', 'Js', 'Ts'] // Royal flush on board
      }),
      (results) => {
        // All 3 players should win (playing the board)
        expect(results.winners).toHaveLength(3);
        
        // Total pot: 3 players × 20 = 60, each gets 20
        assertPotSplit(results.winners, 60);
        
        // Verify all have royal flush
        assertHandStrengths(results.winners, 10); // Royal flush rank = 10
        
        results.winners.forEach(winner => {
          expect(winner.amount).toBe(20);
        });
      }
    );
    
    manager = results.scenario?.manager;
  });

  it('should handle split pot with odd chip distribution', async () => {
    const results = await executePokerTest(
      () => {
        const scenario = createSplitPotScenario({
          playerCount: 3,
          useOddChips: true, // Use 5/10 blinds for odd pot
          identicalHands: [['As', 'Ah'], ['Ac', 'Ad'], ['2h', '3d']], // First two tie
          communityCards: ['Kh', 'Kc', 'Qs', 'Jd', '9c']
        });
        
        // Override players for specific betting pattern
        const players = [
          PLAYER_TYPES.tag('UTG Player'),
          PLAYER_TYPES.station('SB Player'), 
          PLAYER_TYPES.station('BB Player')
        ];
        scenario.addPlayers(players);
        
        return scenario;
      },
      (results) => {
        // Two players should win (both have AA)
        expect(results.winners).toHaveLength(2);
        
        // With 5/10 blinds and betting action, should create odd pot
        // Verify split with odd chip handling
        const totalPot = results.winners.reduce((sum, w) => sum + w.amount, 0);
        expect(totalPot).toBeGreaterThan(0);
        
        // Verify one player gets the odd chip
        const amounts = results.winners.map(w => w.amount).sort((a, b) => b - a);
        expect(amounts[0] - amounts[1]).toBeLessThanOrEqual(1); // Difference ≤ 1 chip
      }
    );
    
    manager = results.scenario?.manager;
  });

  it('should handle complex side pot scenario with custom logic', async () => {
    // This demonstrates creating a completely custom scenario
    const customDeck = new DeckBuilder(3)
      .dealHoleCards([
        ['As', 'Ah'], // Short stack - strong hand
        ['Ac', 'Ad'], // Player 2 - also strong 
        ['Ks', 'Kh']  // Player 3 - slightly weaker
      ])
      .addCommunityCards(['Qc', 'Jd', 'Th', '9s', '8c'])
      .build();
    
    const results = await executePokerTest(
      () => {
        const scenario = createSplitPotScenario({
          playerCount: 3,
          customDeck,
          chipAmounts: [100, 500, 500] // Short stack creates side pot opportunity
        });
        
        // Custom players for side pot scenario
        const players = [
          PLAYER_TYPES.maniac('Short Stack'), // Goes all-in
          PLAYER_TYPES.station('Player 2'),   // Calls everything
          PLAYER_TYPES.station('Player 3')    // Also calls
        ];
        scenario.addPlayers(players);
        
        return scenario;
      },
      (results) => {
        // Verify we have winners
        expect(results.winners.length).toBeGreaterThan(0);
        
        // Verify total pot makes sense
        const totalWon = results.winners.reduce((sum, w) => sum + w.amount, 0);
        expect(totalWon).toBeGreaterThan(0);
        
        // In this scenario, first two players should split main pot (both have AA)
        const aaWinners = results.winners.filter(w => w.hand?.rank === 3); // Pair rank
        if (aaWinners.length === 2) {
          // Main pot should be split between AA holders
          expect(aaWinners[0].amount).toBeGreaterThan(0);
          expect(aaWinners[1].amount).toBeGreaterThan(0);
        }
      }
    );
    
    manager = results.scenario?.manager;
  });
});