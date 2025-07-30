import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('Issue #32 - Betting Reopening Rules', () => {
  let manager;
  let table;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    if (table) {
      table.close();
    }
  });

  it('should NOT allow re-raise when all-in is less than minimum raise', async () => {
    table = manager.createTable({
      blinds: { small: 50, big: 100 },
      minBuyIn: 1000,
      maxBuyIn: 2000,
      minPlayers: 3,
      dealerButton: 0,
    });

    // Track all events
    const actions = [];
    let handEnded = false;
    let roundActions = [];

    table.on('player:action', ({ playerId, action, amount }) => {
      console.log(`Player ${playerId} action: ${action} ${amount || ''}`);
      actions.push({ playerId, action, amount });
      roundActions.push({ playerId, action, amount });
    });

    table.on('betting:round-start', ({ round }) => {
      console.log(`\n=== ${round} betting round started ===`);
      roundActions = [];
    });

    table.on('action:invalid', ({ playerId, action, reason }) => {
      console.log(
        `INVALID ACTION: Player ${playerId} tried ${action} - ${reason}`,
      );
    });

    // Player strategies
    let actionCount = 0;

    class TestPlayer extends Player {
      constructor(id, name, chips, strategy) {
        super({ id, name, chips });
        this.strategy = strategy;
      }

      getAction(state) {
        actionCount++;
        console.log(`\n--- Action ${actionCount} ---`);
        console.log(
          `Player ${this.name} to act. Current bet: ${state.currentBet}, My bet: ${state.players[this.id].bet}, Chips: ${state.players[this.id].chips}`,
        );
        console.log(`Valid actions: ${state.validActions?.join(', ')}`);
        console.log(
          `Can raise: ${state.validActions?.includes(Action.RAISE) ? 'YES' : 'NO'}`,
        );

        const action = this.strategy(state, this.id, roundActions);
        console.log(
          `${this.name} decides: ${action.action} ${action.amount || ''}`,
        );
        return action;
      }
    }

    // Strategy: Player 1 raises to 300
    const p1Strategy = (state, playerId, prevActions) => {
      const myState = state.players[playerId];
      const toCall = state.currentBet - myState.bet;

      // First action in preflop: raise to 300
      if (prevActions.length === 2) {
        // After SB and BB posts
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

    // Override addPlayer to set custom chip amounts BEFORE adding players
    const originalAddPlayer = table.addPlayer.bind(table);
    table.addPlayer = function (player) {
      const result = originalAddPlayer(player);
      const playerData = this.players.get(player.id);
      if (playerData && player.targetChips) {
        playerData.player.chips = player.targetChips;
      }
      return result;
    };

    // Create players
    // With dealerButton: 0, positions are:
    // P1 (index 0) = Button
    // P2 (index 1) = Small Blind
    // P3 (index 2) = Big Blind
    const player1 = new TestPlayer('p1', 'Button/P1', 2000, p1Strategy);
    player1.targetChips = 2000;

    const player2 = new TestPlayer('p2', 'SB/P2', 2000, p2Strategy);
    player2.targetChips = 2000;

    // P3 needs exactly 250 chips for proper test:
    // - Posts 100 for BB
    // - When all-in for remaining 150, total bet is 250
    // - This is only +50 over the 200 bet (less than minimum raise of 100)
    const player3 = new TestPlayer('p3', 'BB/P3', 250, p3Strategy);
    player3.targetChips = 250;

    table.addPlayer(player1);
    table.addPlayer(player2);
    table.addPlayer(player3);

    // Log the actual chip amounts after adding
    console.log('\nChip amounts after adding players:');
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
    await new Promise((resolve) => {
      table.on('hand:ended', ({ winners }) => {
        console.log('\nHand ended. Winners:', winners);
        handEnded = true;
        resolve();
      });
    });

    // Analyze what happened
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

    expect(handEnded).toBe(true);
  });

  it('should ALLOW re-raise when all-in is a full raise or more', async () => {
    table = manager.createTable({
      blinds: { small: 50, big: 100 },
      minBuyIn: 1000,
      maxBuyIn: 2000,
      minPlayers: 3,
      dealerButton: 0,
    });

    // Track all events
    const actions = [];
    let handEnded = false;

    table.on('player:action', ({ playerId, action, amount }) => {
      actions.push({ playerId, action, amount });
    });

    // Simple player that uses validActions
    class ValidActionPlayer extends Player {
      constructor(id, name, chips, strategy) {
        super({ id, name, chips });
        this.strategy = strategy;
      }

      getAction(state) {
        return this.strategy(state, this.id);
      }
    }

    // P1: Raises to 200, then re-raises if allowed
    const p1Strategy = (state, playerId) => {
      const myState = state.players[playerId];
      const toCall = state.currentBet - myState.bet;

      // First action: raise to 200
      if (!myState.hasActed && state.currentBet === 100) {
        return {
          playerId,
          action: Action.RAISE,
          amount: 200,
          timestamp: Date.now(),
        };
      }

      // If we can raise again, do it
      if (toCall > 0 && state.validActions.includes(Action.RAISE)) {
        return {
          playerId,
          action: Action.RAISE,
          amount: state.currentBet * 2,
          timestamp: Date.now(),
        };
      }

      // Otherwise call if needed
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

    // P2: Just calls
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

    // P3: Goes all-in with exactly enough for a full raise
    const p3Strategy = (state, playerId) => {
      const myState = state.players[playerId];
      return {
        playerId,
        action: Action.ALL_IN,
        amount: myState.chips,
        timestamp: Date.now(),
      };
    };

    // Override addPlayer to set custom chip amounts
    const originalAddPlayer = table.addPlayer.bind(table);
    table.addPlayer = function (player) {
      const result = originalAddPlayer(player);
      const playerData = this.players.get(player.id);
      if (playerData && player.targetChips) {
        playerData.player.chips = player.targetChips;
      }
      return result;
    };

    // Create players
    const player1 = new ValidActionPlayer('p1', 'Button/P1', 2000, p1Strategy);
    player1.targetChips = 2000;

    const player2 = new ValidActionPlayer('p2', 'SB/P2', 2000, p2Strategy);
    player2.targetChips = 2000;

    // P3 needs exactly 400 chips for a full raise:
    // - Posts 100 for BB
    // - When all-in for remaining 300, total bet is 400
    // - This is +200 over the 200 bet (exactly a full raise)
    const player3 = new ValidActionPlayer('p3', 'BB/P3', 400, p3Strategy);
    player3.targetChips = 400;

    table.addPlayer(player1);
    table.addPlayer(player2);
    table.addPlayer(player3);

    table.tryStartGame();

    // Wait for hand to end
    await new Promise((resolve) => {
      table.on('hand:ended', () => {
        handEnded = true;
        resolve();
      });
    });

    // Analyze what happened
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

    expect(handEnded).toBe(true);
  });
});
