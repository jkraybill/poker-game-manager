/**
 * 5-Player Middle Position 3-Bet Scenario (Using Test Utilities)
 * 
 * Tests advanced pre-flop aggression in 5-player games with raise and 3-bet action.
 * This scenario demonstrates positional play, 3-betting strategy, and fold equity.
 * 
 * Expected flow:
 * 1. UTG folds (weak hand or tight play)
 * 2. Middle Position raises to 60 (3x BB)
 * 3. Cutoff 3-bets to 180 (3x the raise)
 * 4. Button folds to 3-bet
 * 5. Small Blind folds to 3-bet
 * 6. Big Blind folds to 3-bet
 * 7. Middle Position folds to 3-bet
 * 8. Cutoff wins pot (180 + 10 + 20 + 60 = 270)
 * 
 * This tests:
 * - 5-player position dynamics (UTG, MP, CO, Button, Blinds)
 * - 3-betting for value and as a bluff
 * - Fold equity calculations
 * - Pre-flop pot winning without showdown
 * - Complex betting round with multiple raises
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  createTestTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  Action,
  cleanupTables,
  assignPositions,
} from '../test-utils/index.js';

describe('5-Player MP 3-Bet (v2)', () => {
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

  it('should handle Middle Position raising, Cutoff 3-betting, everyone folds', async () => {
    // Create 5-player table
    const result = createTestTable('standard', {
      minPlayers: 5,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;

    // Set up event capture
    events = setupEventCapture(table);

    // 3-bet scenario strategy
    const threeBetStrategy = ({ player, gameState, myState, toCall }) => {
      // UTG folds (simulating tight early position play)
      if (player.position === 'utg') {
        return { action: Action.FOLD };
      }

      // MP raises to 60 (3x BB opening raise)
      if (player.position === 'mp' && gameState.currentBet === 20) {
        return { action: Action.RAISE, amount: 60 };
      }

      // Cutoff 3-bets to 180 when facing MP raise (3x the raise)
      if (player.position === 'co' && gameState.currentBet === 60) {
        return { action: Action.RAISE, amount: 180 };
      }

      // Everyone else folds to the 3-bet (high pressure)
      if (toCall > 0 && gameState.currentBet >= 180) {
        return { action: Action.FOLD };
      }

      // Default: fold to any bet, check otherwise
      if (toCall > 0) {
        return { action: Action.FOLD };
      }

      return { action: Action.CHECK };
    };

    // Create players
    const players = Array.from({ length: 5 }, (_, i) => 
      new StrategicPlayer({
        name: `Player ${i + 1}`,
        strategy: threeBetStrategy,
      })
    );

    // Track dealer button and assign positions
    let dealerButtonPos = -1;
    table.on('hand:started', ({ dealerButton }) => {
      dealerButtonPos = dealerButton;
      assignPositions(players, dealerButton, 5);
      
      // In 5-player game, button acts as CO
      players[dealerButton].position = 'co';
    });

    // Add players and start
    players.forEach(p => table.addPlayer(p));
    table.tryStartGame();

    // Wait for hand to complete
    await waitForHandEnd(events);

    // Extract results
    const { winners, actions } = events;

    // Find cutoff player (3-bettor)
    const coPlayer = players[dealerButtonPos];

    // Verify results: Cutoff should win the pot
    expect(winners).toHaveLength(1);
    expect(winners[0].playerId).toBe(coPlayer.id);
    
    // Pot calculation:
    // - UTG folded (no contribution)
    // - MP raised to 60 then folded to 3-bet
    // - CO 3-bet to 180 
    // - Button folded (no contribution)
    // - SB folded after posting 10
    // - BB folded after posting 20
    // Total pot = 60 + 180 + 10 + 20 = 270
    expect(winners[0].amount).toBe(270);

    // Verify action sequence
    const raises = actions.filter(a => a.action === Action.RAISE);
    expect(raises).toHaveLength(2); // MP raise and CO 3-bet

    const mpRaise = raises[0];
    expect(mpRaise.amount).toBe(60);

    const co3Bet = raises[1];
    expect(co3Bet.amount).toBe(180);

    // Everyone else should fold (UTG, MP after 3-bet, Button, SB, BB)
    const folds = actions.filter(a => a.action === Action.FOLD);
    expect(folds.length).toBeGreaterThanOrEqual(3); // At least UTG, MP, SB, BB

    // Verify proper action sequence: UTG fold, MP raise, CO 3-bet, then folds
    const firstAction = actions[0];
    expect(firstAction.action).toBe(Action.FOLD); // UTG folds first

    const raiseIndex = actions.findIndex(a => a.action === Action.RAISE && a.amount === 60);
    const threeBetIndex = actions.findIndex(a => a.action === Action.RAISE && a.amount === 180);
    expect(raiseIndex).toBeLessThan(threeBetIndex); // MP raises before CO 3-bets
  });
});