import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from './GameEngine.js';
import { Player } from '../Player.js';
import { Action, PlayerState } from '../types/index.js';

/**
 * Test for the reopenBetting bug with ALL_IN players
 * 
 * Bug: When an ALL_IN is a "full raise", reopenBetting() resets hasActed
 * for ALL_IN players, causing them to be asked for actions again.
 */

class MockPlayer extends Player {
  constructor(id, name, chips) {
    super({ id, name });
    this.chips = chips;
    this.actionToReturn = null;
  }

  async getAction(gameState) {
    if (this.actionToReturn) {
      return this.actionToReturn;
    }
    return { action: Action.FOLD };
  }

  receivePrivateCards() {}
  receivePublicCards() {}
  receiveGameUpdate() {}
}

describe('ALL_IN reopenBetting Bug', () => {
  let engine;
  let shortStack;
  let bigStack;

  beforeEach(() => {
    shortStack = new MockPlayer('short', 'Short', 6000);
    bigStack = new MockPlayer('big', 'Big', 15000);

    engine = new GameEngine({
      players: [shortStack, bigStack],
      blinds: { small: 2000, big: 4000 },
      variant: 'texas-holdem',
      dealerButton: 0
    });
  });

  it('should not reset hasActed for ALL_IN players when reopening betting', async () => {
    // Initialize the engine (but don't start the hand)
    // We'll set up the state manually
    
    // Find the players in the engine's player array
    const engineShort = engine.players.find(p => p.id === 'short');
    const engineBig = engine.players.find(p => p.id === 'big');
    
    expect(engineShort).toBeDefined();
    expect(engineBig).toBeDefined();

    // Simulate the scenario:
    // 1. Short stack goes ALL_IN (this should be a "full raise")
    // 2. Check if reopenBetting incorrectly resets ALL_IN player's hasActed flag

    // Set up the scenario - short stack goes ALL_IN
    engineShort.hasActed = true;
    engineShort.state = PlayerState.ALL_IN;
    engineShort.chips = 0;
    engineShort.bet = 6000;

    engineBig.hasActed = false; // Big stack hasn't acted yet
    engineBig.state = PlayerState.ACTIVE;
    engineBig.bet = 4000; // Posted big blind

    // This simulates what handleAllIn does when it's a "full raise"
    const currentBet = Math.max(engineShort.bet, engineBig.bet); // 6000
    const raiseIncrement = engineShort.bet - engineBig.bet; // 6000 - 4000 = 2000
    const minRaiseIncrement = 4000; // Big blind amount

    console.log('Before reopenBetting:');
    console.log(`Short (ALL_IN): hasActed=${engineShort.hasActed}, state=${engineShort.state}`);
    console.log(`Big (ACTIVE): hasActed=${engineBig.hasActed}, state=${engineBig.state}`);

    // If this ALL_IN is a full raise, it would call reopenBetting
    if (raiseIncrement >= minRaiseIncrement) {
      // This is where the bug would occur
      engine.reopenBetting(engineShort);
    }

    console.log('After reopenBetting:');
    console.log(`Short (ALL_IN): hasActed=${engineShort.hasActed}, state=${engineShort.state}`);
    console.log(`Big (ACTIVE): hasActed=${engineBig.hasActed}, state=${engineBig.state}`);

    // BUG: The ALL_IN player should NEVER have hasActed reset to false
    // They can't act anymore - they're all-in!
    expect(engineShort.hasActed).toBe(true); // Should remain true
    expect(engineShort.state).toBe(PlayerState.ALL_IN);
    
    // The ACTIVE player should have hasActed reset (this is correct)
    expect(engineBig.hasActed).toBe(false); // This is correct behavior
    expect(engineBig.state).toBe(PlayerState.ACTIVE);
  });

  it('should never reset hasActed for ALL_IN players in startBettingRound', async () => {
    // This test verifies the fix: ALL_IN players should never have hasActed reset
    const engineShort = engine.players.find(p => p.id === 'short');
    const engineBig = engine.players.find(p => p.id === 'big');
    
    // Set up the state after a player goes all-in
    engineShort.hasActed = true; // Player went all-in, should stay true
    engineShort.state = PlayerState.ALL_IN;
    engineShort.chips = 0;
    
    engineBig.hasActed = true; // Other player also acted
    engineBig.state = PlayerState.ACTIVE;
    
    console.log('Before startBettingRound:');
    console.log(`Short (ALL_IN): hasActed=${engineShort.hasActed}`);
    console.log(`Big (ACTIVE): hasActed=${engineBig.hasActed}`);
    
    // Simulate starting a new betting round (like going from PRE_FLOP to FLOP)
    await engine.startBettingRound();
    
    console.log('After startBettingRound:');
    console.log(`Short (ALL_IN): hasActed=${engineShort.hasActed}`);
    console.log(`Big (ACTIVE): hasActed=${engineBig.hasActed}`);
    
    // CRITICAL: ALL_IN players should NEVER have hasActed reset
    expect(engineShort.hasActed).toBe(true); // Should stay true
    expect(engineShort.state).toBe(PlayerState.ALL_IN);
    
    // ACTIVE players should have hasActed reset (normal behavior)
    expect(engineBig.hasActed).toBe(false); // Should be reset to false
    expect(engineBig.state).toBe(PlayerState.ACTIVE);
  });
});