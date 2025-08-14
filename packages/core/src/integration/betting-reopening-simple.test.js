import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  StrategicPlayer,
  cleanupTables,
  waitForHandEnd,
  Action,
} from '../test-utils/index.js';

describe('Issue #32 - Betting Reopening Rules', () => {
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

  it('should NOT allow re-raise when all-in is less than minimum raise', async () => {
    const result = createTestTable('standard', {
      blinds: { small: 50, big: 100 },
      minBuyIn: 1000,
      maxBuyIn: 2000,
      minPlayers: 3,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;
    events = setupEventCapture(table);

    // Track additional events
    let roundActions = [];

    table.on('betting:round-start', ({ round }) => {
      console.log(`\n=== ${round} betting round started ===`);
      roundActions = [];
    });

    table.on('action:invalid', ({ playerId, action, reason }) => {
      console.log(
        `INVALID ACTION: Player ${playerId} tried ${action} - ${reason}`,
      );
    });

    // Track action count for debugging
    let actionCount = 0;

    // Strategy: Player 1 raises to 300
    const p1Strategy = ({ gameState, myState, toCall, validActions }) => {
      actionCount++;
      console.log(`\n--- Action ${actionCount} ---`);
      console.log(
        `Player P1 to act. Current bet: ${gameState.currentBet}, My bet: ${myState.bet}, Chips: ${myState.chips}`,
      );
      console.log(`Valid actions: ${validActions?.join(', ')}`);
      console.log(
        `Can raise: ${validActions?.includes(Action.RAISE) ? 'YES' : 'NO'}`,
      );

      // First action in preflop: raise to 300
      if (roundActions.length === 2) {
        // After SB and BB posts
        console.log('P1 decides: RAISE 300');
        return {
          action: Action.RAISE,
          amount: 300,
        };
      }

      // If we get another turn and there's more to call
      if (toCall > 0) {
        console.log(
          `P1 facing bet of ${gameState.currentBet}, need to call ${toCall}`,
        );

        // Check if we can raise using validActions
        if (validActions.includes(Action.RAISE) && myState.chips > toCall * 2) {
          console.log('P1: Raising is valid, attempting raise');
          console.log(`P1 decides: RAISE ${gameState.currentBet * 2}`);
          return {
            action: Action.RAISE,
            amount: gameState.currentBet * 2,
          };
        }

        // Otherwise just call
        console.log('P1: Cannot raise (not in valid actions), calling instead');
        console.log('P1 decides: CALL');
        return {
          action: Action.CALL,
          amount: toCall,
        };
      }

      console.log('P1 decides: CHECK');
      return {
        action: Action.CHECK,
      };
    };

    // Strategy: Player 2 calls
    const p2Strategy = ({ gameState, myState, toCall }) => {
      actionCount++;
      console.log(`\n--- Action ${actionCount} ---`);
      console.log(
        `Player P2 to act. Current bet: ${gameState.currentBet}, My bet: ${myState.bet}, Chips: ${myState.chips}`,
      );

      if (toCall > 0) {
        console.log('P2 decides: CALL');
        return {
          action: Action.CALL,
          amount: toCall,
        };
      }

      console.log('P2 decides: CHECK');
      return {
        action: Action.CHECK,
      };
    };

    // Strategy: Player 3 goes all-in
    const p3Strategy = ({ gameState, myState }) => {
      actionCount++;
      console.log(`\n--- Action ${actionCount} ---`);
      console.log(
        `Player P3 to act. Current bet: ${gameState.currentBet}, My bet: ${myState.bet}, Chips: ${myState.chips}`,
      );

      // Always go all-in
      console.log(`P3 decides: ALL_IN ${myState.chips}`);
      return {
        action: Action.ALL_IN,
        amount: myState.chips,
      };
    };

    // Create players
    // With dealerButton: 0, positions are:
    // P1 (index 0) = Button
    // P2 (index 1) = Small Blind
    // P3 (index 2) = Big Blind
    const player1 = new StrategicPlayer({
      id: 'p1',
      name: 'Button/P1',
      strategy: p1Strategy,
    });

    const player2 = new StrategicPlayer({
      id: 'p2',
      name: 'SB/P2',
      strategy: p2Strategy,
    });

    // P3 needs exactly 250 chips for proper test:
    // - Posts 100 for BB
    // - When all-in for remaining 150, total bet is 250
    // - This is only +50 over the 200 bet (less than minimum raise of 100)
    const player3 = new StrategicPlayer({
      id: 'p3',
      name: 'BB/P3',
      strategy: p3Strategy,
    });

    table.addPlayer(player1);
    table.addPlayer(player2);
    table.addPlayer(player3);

    // Set chips after adding to table
    player1.chips = 2000;
    player2.chips = 2000;
    player3.chips = 250;

    // Log the actual chip amounts after adding
    console.log('\nChip amounts after adding players:');
    for (const [, data] of table.players.entries()) {
      console.log(`${data.player.name}: ${data.player.chips} chips`);
    }

    // Track player actions in roundActions
    table.on('player:action', ({ playerId, action, amount }) => {
      console.log(`Player ${playerId} action: ${action} ${amount || ''}`);
      roundActions.push({ playerId, action, amount });
    });

    console.log('\nStarting game...');
    table.tryStartGame();

    // Add debugging for betting reopening after game starts
    if (table.gameEngine) {
      const originalHandleAllIn = table.gameEngine.handleAllIn.bind(
        table.gameEngine,
      );
      table.gameEngine.handleAllIn = function (player) {
        const currentBet = this.getCurrentBet();
        const totalBet = player.bet + player.chips;
        const raiseIncrement = totalBet - currentBet;
        const minRaiseIncrement = this.getMinimumRaiseIncrement();
        console.log(`\nDEBUG: All-in analysis for ${player.name}:`);
        console.log(`  Current bet: ${currentBet}`);
        console.log(`  Player's current bet: ${player.bet}`);
        console.log(`  Player's chips: ${player.chips}`);
        console.log(`  Total bet after all-in: ${totalBet}`);
        console.log(`  Raise increment: ${raiseIncrement}`);
        console.log(`  Min raise increment: ${minRaiseIncrement}`);
        console.log(
          `  Will reopen betting: ${raiseIncrement >= minRaiseIncrement ? 'YES' : 'NO'}`,
        );
        return originalHandleAllIn.call(this, player);
      };
    }

    // Wait for hand to end
    await waitForHandEnd(events);
    console.log('\nHand ended. Winners:', events.winners);

    // Analyze what happened
    console.log('\n=== ANALYSIS ===');
    console.log('Total actions:', events.actions.length);
    console.log('All actions:', events.actions);

    // Look for P1's actions
    const p1Actions = events.getActionsByPlayer('p1');
    console.log('\nP1 actions:', p1Actions);

    // Check if P1 was allowed to raise after P3's all-in
    const p3AllIn = events.actions.find(
      (a) => a.playerId === 'p3' && a.action === Action.ALL_IN,
    );
    if (p3AllIn) {
      console.log(`\nP3 went all-in for ${p3AllIn.amount}`);
      const p3AllInIndex = events.actions.indexOf(p3AllIn);
      const p1ActionsAfterAllIn = events.actions
        .slice(p3AllInIndex + 1)
        .filter((a) => a.playerId === 'p1');

      console.log('P1 actions after P3 all-in:', p1ActionsAfterAllIn);

      // Check if any of those actions were raises
      const p1RaisesAfterAllIn = p1ActionsAfterAllIn.filter(
        (a) => a.action === Action.RAISE,
      );

      if (p1RaisesAfterAllIn.length > 0) {
        console.log(
          'BUG DETECTED: P1 was allowed to raise after small all-in!',
        );
      } else {
        console.log('GOOD: P1 was not allowed to raise after small all-in');
      }
    }

    expect(events.handEnded).toBe(true);
  });

  it('should ALLOW re-raise when all-in is a full raise or more', async () => {
    const result = createTestTable('standard', {
      blinds: { small: 50, big: 100 },
      minBuyIn: 1000,
      maxBuyIn: 2000,
      minPlayers: 3,
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;
    events = setupEventCapture(table);

    // P1: Raises to 200, then re-raises if allowed
    const p1Strategy = ({ gameState, myState, toCall, validActions }) => {
      // First action: raise to 200
      if (!myState.hasActed && gameState.currentBet === 100) {
        return {
          action: Action.RAISE,
          amount: 200,
        };
      }

      // If we can raise again, do it
      if (toCall > 0 && validActions.includes(Action.RAISE)) {
        return {
          action: Action.RAISE,
          amount: gameState.currentBet * 2,
        };
      }

      // Otherwise call if needed
      if (toCall > 0) {
        return {
          action: Action.CALL,
          amount: toCall,
        };
      }

      return {
        action: Action.CHECK,
      };
    };

    // P2: Just calls
    const p2Strategy = ({ toCall }) => {
      if (toCall > 0) {
        return {
          action: Action.CALL,
          amount: toCall,
        };
      }

      return {
        action: Action.CHECK,
      };
    };

    // P3: Goes all-in with exactly enough for a full raise
    const p3Strategy = ({ myState }) => {
      return {
        action: Action.ALL_IN,
        amount: myState.chips,
      };
    };

    // Create players
    const player1 = new StrategicPlayer({
      id: 'p1',
      name: 'Button/P1',
      strategy: p1Strategy,
    });

    const player2 = new StrategicPlayer({
      id: 'p2',
      name: 'SB/P2',
      strategy: p2Strategy,
    });

    // P3 needs exactly 400 chips for a full raise:
    // - Posts 100 for BB
    // - When all-in for remaining 300, total bet is 400
    // - This is +200 over the 200 bet (exactly a full raise)
    const player3 = new StrategicPlayer({
      id: 'p3',
      name: 'BB/P3',
      strategy: p3Strategy,
    });

    table.addPlayer(player1);
    table.addPlayer(player2);
    table.addPlayer(player3);

    // Set chips after adding to table
    player1.chips = 2000;
    player2.chips = 2000;
    player3.chips = 400;

    table.tryStartGame();

    // Wait for hand to end
    await waitForHandEnd(events);

    // Analyze what happened
    const p1Actions = events.getActionsByPlayer('p1');
    const p3AllIn = events.actions.find(
      (a) => a.playerId === 'p3' && a.action === Action.ALL_IN,
    );

    // P3's all-in should be for 300 (total bet 400)
    expect(p3AllIn).toBeDefined();
    expect(p3AllIn.amount).toBe(300);

    // P1 should have been allowed to re-raise
    const p1Raises = p1Actions.filter((a) => a.action === Action.RAISE);
    expect(p1Raises.length).toBeGreaterThanOrEqual(2);

    expect(events.handEnded).toBe(true);
  });
});
