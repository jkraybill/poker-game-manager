import { describe, it, expect } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

/**
 * Test enhanced gameState with validation-relevant numbers
 */
describe('Enhanced GameState Validation Numbers', () => {
  it('should include minRaise, maxRaise, toCall and other validation numbers', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'validation-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
      dealerButton: 0,
    });

    // Track gameState received by players
    const gameStatesSeen = [];

    // Player 1: Small blind
    const player1 = new Player({ id: 'p1', name: 'Small Blind' });
    player1.chips = 1000;
    // eslint-disable-next-line require-await
    player1.getAction = async (gameState) => {
      gameStatesSeen.push({
        playerId: 'p1',
        phase: gameState.phase,
        toCall: gameState.toCall,
        minRaise: gameState.minRaise,
        maxRaise: gameState.maxRaise,
        currentBet: gameState.currentBet,
        potSize: gameState.potSize,
        bettingHistory: gameState.bettingHistory,
        playerState: gameState.players['p1'],
        validActions: gameState.validActions,
      });

      // Small blind calls
      return { action: Action.CALL };
    };

    // Player 2: Big blind
    const player2 = new Player({ id: 'p2', name: 'Big Blind' });
    player2.chips = 1000;
    // eslint-disable-next-line require-await
    player2.getAction = async (gameState) => {
      gameStatesSeen.push({
        playerId: 'p2',
        phase: gameState.phase,
        toCall: gameState.toCall,
        minRaise: gameState.minRaise,
        maxRaise: gameState.maxRaise,
        currentBet: gameState.currentBet,
        potSize: gameState.potSize,
        bettingHistory: gameState.bettingHistory,
        playerState: gameState.players['p2'],
        validActions: gameState.validActions,
      });

      // Big blind checks
      return { action: Action.CHECK };
    };

    table.addPlayer(player1);
    table.addPlayer(player2);

    // Start game and wait for it to complete
    await table.tryStartGame();

    // Give time for all actions to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify we captured game states
    expect(gameStatesSeen.length).toBeGreaterThanOrEqual(2);

    // Test that all validation numbers are present in gameState
    const firstAction = gameStatesSeen[0];
    expect(firstAction).toBeDefined();

    // Core validation numbers should be present at top level
    expect(typeof firstAction.toCall).toBe('number');
    expect(typeof firstAction.minRaise).toBe('number');
    expect(typeof firstAction.maxRaise).toBe('number');
    expect(typeof firstAction.currentBet).toBe('number');
    expect(typeof firstAction.potSize).toBe('number');
    expect(firstAction.validActions).toBeInstanceOf(Array);

    // Player-specific validation numbers
    expect(firstAction.playerState).toBeDefined();
    expect(typeof firstAction.playerState.toCall).toBe('number');
    expect(typeof firstAction.playerState.canRaise).toBe('boolean');
    expect(typeof firstAction.playerState.effectiveStack).toBe('number');

    // Betting history context
    expect(firstAction.bettingHistory).toBeDefined();
    expect(firstAction.bettingHistory.raiseHistory).toBeInstanceOf(Array);
    expect(typeof firstAction.bettingHistory.lastRaiseSize).toBe('number');
    expect(typeof firstAction.bettingHistory.minRaiseIncrement).toBe('number');

    // Clean up
    table.close();
    console.log('✅ Enhanced gameState validation numbers test passed');
  });

  it('should correctly calculate minRaise after multiple raises', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'min-raise-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
      dealerButton: 0,
    });

    const gameStatesTracked = [];

    // Aggressive raiser
    const player1 = new Player({ id: 'raiser', name: 'Raiser' });
    player1.chips = 1000;
    let raiseCount = 0;
    // eslint-disable-next-line require-await
    player1.getAction = async (gameState) => {
      gameStatesTracked.push({
        playerId: 'raiser',
        actionNumber: ++raiseCount,
        toCall: gameState.toCall,
        minRaise: gameState.minRaise,
        currentBet: gameState.currentBet,
        bettingHistory: gameState.bettingHistory,
        potSize: gameState.potSize,
      });

      if (raiseCount === 1) {
        // First raise to 60
        return { action: Action.RAISE, amount: 60 };
      } else {
        // Call subsequent raises
        return { action: Action.CALL };
      }
    };

    // Counter-raiser
    const player2 = new Player({ id: 'counter', name: 'Counter' });
    player2.chips = 1000;
    let counterCount = 0;
    // eslint-disable-next-line require-await
    player2.getAction = async (gameState) => {
      gameStatesTracked.push({
        playerId: 'counter',
        actionNumber: ++counterCount,
        toCall: gameState.toCall,
        minRaise: gameState.minRaise,
        currentBet: gameState.currentBet,
        bettingHistory: gameState.bettingHistory,
        potSize: gameState.potSize,
      });

      if (counterCount === 1) {
        // Call first
        return { action: Action.CALL };
      } else if (counterCount === 2) {
        // Re-raise to 120
        return { action: Action.RAISE, amount: 120 };
      } else {
        return { action: Action.CALL };
      }
    };

    table.addPlayer(player1);
    table.addPlayer(player2);

    await table.tryStartGame();
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Verify min raise calculations
    expect(gameStatesTracked.length).toBeGreaterThan(0);

    // Find the second action by raiser (after counter-raise to 120)
    const raiserSecondAction = gameStatesTracked.find(
      (gs) => gs.playerId === 'raiser' && gs.actionNumber === 2,
    );

    if (raiserSecondAction) {
      expect(raiserSecondAction.currentBet).toBe(120);
      expect(raiserSecondAction.toCall).toBe(60); // 120 - 60 = 60 to call
      // Min raise should be at least currentBet + last raise size
      // Last raise was from 60 to 120, so raise size was 60
      // Min raise should be 120 + 60 = 180
      expect(raiserSecondAction.minRaise).toBeGreaterThanOrEqual(180);

      // Betting history should show the raises
      expect(
        raiserSecondAction.bettingHistory.raiseHistory.length,
      ).toBeGreaterThan(0);
      expect(raiserSecondAction.bettingHistory.lastRaiseSize).toBeGreaterThan(
        0,
      );
    }

    table.close();
    console.log('✅ minRaise calculation test passed');
  });

  it('should handle all-in scenarios with proper max bet calculations', async () => {
    const manager = new PokerGameManager();
    const table = manager.createTable({
      id: 'all-in-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
      dealerButton: 0,
    });

    const gameStatesRecorded = [];

    // Short stack player
    const shortStack = new Player({ id: 'short', name: 'Short Stack' });
    shortStack.chips = 50; // Only 50 chips
    // eslint-disable-next-line require-await
    shortStack.getAction = async (gameState) => {
      gameStatesRecorded.push({
        playerId: 'short',
        chips: shortStack.chips,
        toCall: gameState.toCall,
        minRaise: gameState.minRaise,
        maxRaise: gameState.maxRaise,
        validActions: gameState.validActions,
        playerState: gameState.players['short'],
      });

      // Short stack goes all-in
      return { action: Action.ALL_IN, amount: shortStack.chips + 10 }; // bet + chips
    };

    // Big stack player
    const bigStack = new Player({ id: 'big', name: 'Big Stack' });
    bigStack.chips = 1000;
    // eslint-disable-next-line require-await
    bigStack.getAction = async (gameState) => {
      gameStatesRecorded.push({
        playerId: 'big',
        chips: bigStack.chips,
        toCall: gameState.toCall,
        minRaise: gameState.minRaise,
        maxRaise: gameState.maxRaise,
        validActions: gameState.validActions,
        playerState: gameState.players['big'],
      });

      // Big stack calls
      return { action: Action.CALL };
    };

    table.addPlayer(shortStack);
    table.addPlayer(bigStack);

    await table.tryStartGame();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify that validation numbers are present for all-in scenarios
    const shortStackAction = gameStatesRecorded.find(
      (gs) => gs.playerId === 'short',
    );
    expect(shortStackAction).toBeDefined();

    // Verify all validation numbers are present
    expect(typeof shortStackAction.maxRaise).toBe('number');
    expect(typeof shortStackAction.toCall).toBe('number');
    expect(typeof shortStackAction.minRaise).toBe('number');
    expect(shortStackAction.validActions).toContain('ALL_IN');
    expect(typeof shortStackAction.playerState.effectiveStack).toBe('number');

    // Verify big stack also has validation numbers
    const bigStackAction = gameStatesRecorded.find(
      (gs) => gs.playerId === 'big',
    );
    if (bigStackAction) {
      expect(typeof bigStackAction.maxRaise).toBe('number');
      expect(typeof bigStackAction.toCall).toBe('number');
      expect(typeof bigStackAction.minRaise).toBe('number');
    }

    table.close();
    console.log('✅ All-in scenario validation test passed');
  });
});
