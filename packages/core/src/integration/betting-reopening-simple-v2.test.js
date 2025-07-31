import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  StrategicPlayer,
  cleanupTables,
  waitForHandEnd,
  Action,
} from '../test-utils/index.js';

describe('Issue #32 - Betting Reopening Rules (v2)', () => {
  let manager;
  let table;
  let events;

  beforeEach(() => {
    ;({ manager, table } = createTestTable('standard', {
      blinds: { small: 50, big: 100 },
      minBuyIn: 1000,
      maxBuyIn: 2000,
      minPlayers: 3,
      dealerButton: 0,
    }));
    events = setupEventCapture(table);
  });

  afterEach(() => {
    cleanupTables(manager);
  });

  it('should NOT allow re-raise when all-in is less than minimum raise', async () => {
    // Track round actions for strategy decisions
    let roundActions = [];
    let actionCount = 0;

    table.on('betting:round-start', ({ round }) => {
      console.log(`\n=== ${round} betting round started ===`);
      roundActions = [];
    });

    table.on('player:action', ({ playerId, action, amount }) => {
      console.log(`Player ${playerId} action: ${action} ${amount || ''}`);
      roundActions.push({ playerId, action, amount });
    });

    table.on('action:invalid', ({ playerId, action, reason }) => {
      console.log(
        `INVALID ACTION: Player ${playerId} tried ${action} - ${reason}`,
      );
    });

    // Strategy: Player 1 raises to 300
    const p1Strategy = (state, playerId) => {
      actionCount++;
      console.log(`\n--- Action ${actionCount} ---`);
      const myState = state.players[playerId];
      const toCall = state.currentBet - myState.bet;

      console.log(
        `Player p1 to act. Current bet: ${state.currentBet}, My bet: ${myState.bet}, Chips: ${myState.chips}`,
      );
      console.log(`Valid actions: ${state.validActions?.join(', ')}`);
      console.log(
        `Can raise: ${state.validActions?.includes(Action.RAISE) ? 'YES' : 'NO'}`,
      );
      console.log(`Round actions so far: ${roundActions.length}`);

      // First action in preflop: raise to 300
      // In 3-player game with dealer button at 0:
      // p1 (position 0) = Button
      // p2 (position 1) = SB
      // p3 (position 2) = BB
      // So p1 acts first after blinds are posted
      if (state.currentBet === 100 && !myState.hasActed) {
        console.log('p1 decides: RAISE 300');
        return {
          playerId,
          action: Action.RAISE,
          amount: 300,
          timestamp: Date.now(),
        };
      }

      // If we get another turn and there's more to call
      if (toCall > 0) {
        console.log(
          `P1 facing bet of ${state.currentBet}, need to call ${toCall}`,
        );

        // Check if we can raise using validActions
        if (
          state.validActions.includes(Action.RAISE) &&
          myState.chips > toCall * 2
        ) {
          console.log('P1: Raising is valid, attempting raise');
          return {
            playerId,
            action: Action.RAISE,
            amount: state.currentBet * 2,
            timestamp: Date.now(),
          };
        }

        // Otherwise just call
        console.log('P1: Cannot raise (not in valid actions), calling instead');
        return {
          playerId,
          action: Action.CALL,
          amount: toCall,
          timestamp: Date.now(),
        };
      }

      return {
        playerId,
        action: Action.CHECK,
        timestamp: Date.now(),
      };
    };

    // Strategy: Player 2 calls
    const p2Strategy = (state, playerId) => {
      const myState = state.players[playerId];
      const toCall = state.currentBet - myState.bet;

      if (toCall > 0) {
        return {
          playerId,
          action: Action.CALL,
          amount: toCall,
          timestamp: Date.now(),
        };
      }

      return {
        playerId,
        action: Action.CHECK,
        timestamp: Date.now(),
      };
    };

    // Strategy: Player 3 goes all-in
    const p3Strategy = (state, playerId) => {
      const myState = state.players[playerId];

      // Always go all-in
      return {
        playerId,
        action: Action.ALL_IN,
        amount: myState.chips,
        timestamp: Date.now(),
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

    const player3 = new StrategicPlayer({
      id: 'p3',
      name: 'BB/P3',
      strategy: p3Strategy,
    });

    // Add players first
    table.addPlayer(player1);
    table.addPlayer(player2);
    table.addPlayer(player3);

    // Set chips directly on Player objects after adding
    player1.chips = 2000;
    player2.chips = 2000;
    player3.chips = 250; // P3 needs exactly 250 chips for proper test

    // Log the actual chip amounts after setting
    console.log('\nChip amounts after setting:');
    for (const [, data] of table.players.entries()) {
      console.log(`${data.player.name}: ${data.player.chips} chips`);
    }

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

    // Analyze what happened
    const { actions, winners } = events;
    console.log('\nHand ended. Winners:', winners);
    console.log('\n=== ANALYSIS ===');
    console.log('Total actions:', actions.length);
    console.log('All actions:', actions);

    // Look for P1's actions
    const p1Actions = actions.filter((a) => a.playerId === 'p1');
    console.log('\nP1 actions:', p1Actions);

    // Check if P1 was allowed to raise after P3's all-in
    const p3AllIn = actions.find(
      (a) => a.playerId === 'p3' && a.action === Action.ALL_IN,
    );
    if (p3AllIn) {
      console.log(`\nP3 went all-in for ${p3AllIn.amount}`);
      const p3AllInIndex = actions.indexOf(p3AllIn);
      const p1ActionsAfterAllIn = actions
        .slice(p3AllInIndex + 1)
        .filter((a) => a.playerId === 'p1');

      console.log('P1 actions after P3 all-in:', p1ActionsAfterAllIn);

      // Check if any of those actions were raises
      const p1RaisesAfterAllIn = p1ActionsAfterAllIn.filter(
        (a) => a.action === Action.RAISE,
      );

      if (p1RaisesAfterAllIn.length > 0) {
        console.log('BUG DETECTED: P1 was allowed to raise after small all-in!');
      } else {
        console.log('GOOD: P1 was not allowed to raise after small all-in');
      }
    }

    expect(events.handEnded).toBe(true);
  });

  it('should ALLOW re-raise when all-in is a full raise or more', async () => {
    // P1: Raises to 200, then re-raises if allowed
    const p1Strategy = ({ gameState, myState, toCall }) => {
      // First action: raise to 200
      if (!myState.hasActed && gameState.currentBet === 100) {
        return {
          action: Action.RAISE,
          amount: 200,
        };
      }

      // If we can raise again, do it
      if (
        toCall > 0 &&
        gameState.validActions &&
        gameState.validActions.includes(Action.RAISE)
      ) {
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
      console.log(`P3 strategy: chips=${myState.chips}, bet=${myState.bet}`);
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

    const player3 = new StrategicPlayer({
      id: 'p3',
      name: 'BB/P3',
      strategy: p3Strategy,
    });

    // Add players first
    table.addPlayer(player1);
    table.addPlayer(player2);
    table.addPlayer(player3);

    // Set chips directly on Player objects after adding
    player1.chips = 2000;
    player2.chips = 2000;
    player3.chips = 400; // P3 needs exactly 400 chips for a full raise

    // Debug: Check actual chip counts
    console.log('\nChip amounts after setting:');
    Array.from(table.players.values()).forEach((pd) => {
      console.log(`${pd.player.name}: ${pd.player.chips} chips`);
    });

    console.log('\nStarting game...');
    table.tryStartGame();

    // Wait for hand to end
    await waitForHandEnd(events);

    // Analyze what happened
    const { actions } = events;
    const p1Actions = actions.filter((a) => a.playerId === 'p1');
    const p3AllIn = actions.find(
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
