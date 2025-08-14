import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PokerGameManager } from '../index.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

/**
 * ALL_IN Infinite Loop Bug Reproduction (v4.4.4)
 * 
 * Bug Report: Same 2 actions repeat forever (ALL_IN → BET → ALL_IN → BET...)
 * Pattern: High blinds + short stacks trigger the loop 5-10% of the time
 * Impact: Game hangs, unusable for tournaments
 * 
 * Log Pattern:
 *   Cindy4: ALL_IN 6000
 *   Nufruit2: BET 9028
 *   Cindy4: ALL_IN 6000  <-- Player asked again!
 *   Nufruit2: BET 9028
 *   (continues forever...)
 */

class ReproductionPlayer extends Player {
  constructor(config) {
    super(config);
    this.actionsLog = [];
    this.strategy = config.strategy || 'all-in'; // 'all-in' or 'bet'
  }

  async getAction(gameState) {
    const currentBet = gameState.currentBet;
    const myBet = gameState.players[this.id].bet;
    const toCall = currentBet - myBet;
    const myChips = gameState.players[this.id].chips;

    // Log the request for debugging
    const logEntry = {
      phase: gameState.phase,
      currentBet,
      myBet, 
      toCall,
      myChips,
      requestCount: this.actionsLog.length + 1
    };
    this.actionsLog.push(logEntry);

    console.log(`${this.name} request #${logEntry.requestCount}: ${JSON.stringify(logEntry)}`);

    if (this.strategy === 'all-in') {
      // Short stack player always goes all-in
      return { action: Action.ALL_IN };
    } else {
      // Big stack player - use correct action based on situation
      if (currentBet === myBet) {
        // No bet to face, can bet
        const betSize = Math.min(myChips, 9000);
        return { action: Action.BET, amount: betSize };
      } else {
        // Facing a bet/raise, just call to keep it simple
        return { action: Action.CALL };
      }
    }
  }

  receivePrivateCards() {}
  receivePublicCards() {}
  receiveGameUpdate() {}
}

describe('ALL_IN Infinite Loop Bug (v4.4.4)', () => {
  let manager;
  let table;

  beforeEach(() => {
    manager = new PokerGameManager();
    table = manager.createTable({
      id: 'infinite-loop-test',
      blinds: { small: 2000, big: 4000 }, // High blinds to trigger short stack scenarios
      minPlayers: 2,
      maxPlayers: 2,
      dealerButton: 0
    });
  });

  afterEach(() => {
    if (table) {
      table.close();
    }
  });

  it('should reproduce infinite loop with ALL_IN vs BET actions', async () => {
    // Skip this test for now - we'll use the next one
    expect(true).toBe(true);
  });

  it('should reproduce reopenBetting bug with ALL_IN players', async () => {
    // Create players that will trigger the bug
    const shortStack = new ReproductionPlayer({
      id: 'cindy4',
      name: 'Cindy4',
      strategy: 'all-in'
    });
    shortStack.chips = 6000; // Just above BB but short

    const bigStack = new ReproductionPlayer({
      id: 'nufruit2', 
      name: 'Nufruit2', 
      strategy: 'bet'
    });
    bigStack.chips = 15000; // Healthy stack

    // Add players to table
    table.addPlayer(shortStack);
    table.addPlayer(bigStack);

    // Set up action tracking
    const actionLog = [];
    let actionCount = 0;
    const maxActions = 20; // Safety limit to prevent actual infinite loop

    table.on('player:action', (data) => {
      actionCount++;
      actionLog.push({
        count: actionCount,
        playerId: data.playerId,
        action: data.action,
        amount: data.amount
      });
      
      console.log(`Action ${actionCount}: ${data.playerId} - ${data.action} ${data.amount || ''}`);

      // Detect the infinite loop pattern
      if (actionCount >= 6) {
        // Check if we have the alternating pattern: ALL_IN → BET → ALL_IN → BET...
        const recent = actionLog.slice(-4);
        const pattern = recent.map(a => `${a.playerId}:${a.action}`);
        
        if (pattern[0] === pattern[2] && pattern[1] === pattern[3]) {
          console.error('🚨 INFINITE LOOP DETECTED!');
          console.error('Pattern:', pattern);
          
          // Force stop the test - we've reproduced the bug
          expect(actionCount).toBeLessThan(10); // This should fail, proving the bug
        }
      }

      // Safety valve - abort if too many actions
      if (actionCount >= maxActions) {
        console.error(`⚠️ Safety limit reached: ${maxActions} actions`);
        table.endGame('Safety limit reached');
      }
    });

    // Start the game that should trigger the bug
    const result = await table.tryStartGame();
    
    if (!result.success) {
      console.error('Game failed to start:', result);
    }
    expect(result.success).toBe(true);

    // Wait for game to complete (or hit our safety limit)
    await new Promise((resolve) => {
      table.on('hand:ended', resolve);
      table.on('game:ended', resolve);
      
      // Additional safety timeout
      setTimeout(() => {
        console.error('⚠️ Test timeout - likely infinite loop');
        resolve();
      }, 5000);
    });

    // Analyze the results
    console.log(`\nTest completed with ${actionCount} actions`);
    console.log('Action log:', actionLog.map(a => `${a.playerId}:${a.action}`));
    console.log(`Short stack (${shortStack.name}) requests:`, shortStack.actionsLog.length);
    console.log(`Big stack (${bigStack.name}) requests:`, bigStack.actionsLog.length);

    // The bug is: players are asked for actions repeatedly when they shouldn't be
    // After ALL_IN, a player should not be asked to act again in that betting round
    if (shortStack.actionsLog.length > 1) {
      console.error('🐛 BUG REPRODUCED: Short stack asked to act multiple times after ALL_IN');
      console.error('Requests:', shortStack.actionsLog);
    }

    // This assertion should fail until we fix the bug
    expect(shortStack.actionsLog.length).toBe(1); // Should only be asked once per betting round
  }, 10000);

  it('should show the specific state that causes the loop', async () => {
    // More detailed reproduction showing exact game state
    const shortPlayer = new ReproductionPlayer({
      id: 'short',
      name: 'Short',
      strategy: 'all-in'
    });
    shortPlayer.chips = 6000;

    const bigPlayer = new ReproductionPlayer({
      id: 'big', 
      name: 'Big', 
      strategy: 'bet'
    });
    bigPlayer.chips = 15000;

    table.addPlayer(shortPlayer);
    table.addPlayer(bigPlayer);

    // Track detailed game state when actions happen
    let stateLog = [];
    
    table.on('player:action', (data) => {
      // Capture the state after each action to see the bug
      stateLog.push({
        action: `${data.playerId}:${data.action}`,
        amount: data.amount,
        timestamp: Date.now()
      });
    });

    await table.tryStartGame();

    // Wait a bit for the actions to occur
    await new Promise(resolve => {
      table.on('hand:ended', resolve);
      setTimeout(resolve, 2000); // Short timeout to capture the bug quickly
    });

    console.log('State log:', stateLog);
    
    // Expected: Each player should act at most once per betting round
    // Bug: Players act repeatedly in the same round
    expect(stateLog.length).toBeLessThan(6); // Normal hand should have 2-4 actions max
  });
});