/**
 * Regression Test: player:action Event Must Include potSize (Issue from pokersim team)
 * 
 * This test ensures that the player:action event includes potSize for tournament logging.
 * The pokersim team reported this was missing in v4.5.0 breaking their tournament systems.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PokerGameManager } from '../../packages/core/src/PokerGameManager.js';
import { Player } from '../../packages/core/src/Player.js';
import { Action } from '../../packages/core/src/types/index.js';

describe('player:action Event - potSize Regression Test', () => {
  let manager;
  let table;

  beforeEach(() => {
    manager = new PokerGameManager();
    table = manager.createTable({
      id: 'potsize-test',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
      maxPlayers: 6,
      dealerButton: 0
    });
  });

  class TestPlayer extends Player {
    constructor(config) {
      super(config);
      this.actionCount = 0;
    }

    async getAction(gameState) {
      this.actionCount++;
      const myState = gameState.players[this.id];
      const toCall = gameState.currentBet - myState.bet;
      
      // Simple strategy for testing
      if (toCall > 0) {
        if (toCall <= 50) {
          return { action: Action.CALL, timestamp: Date.now() };
        }
        return { action: Action.FOLD, timestamp: Date.now() };
      }
      
      // First action: bet to build pot
      if (this.actionCount === 1 && gameState.currentBet === 20) {
        return { action: Action.RAISE, amount: 60, timestamp: Date.now() }; // Total bet of 60
      }
      
      return { action: Action.CHECK, timestamp: Date.now() };
    }
  }

  it('should include potSize in player:action events for tournament logging', async () => {
    const player1 = new TestPlayer({ id: 'player1', name: 'Player 1' });
    const player2 = new TestPlayer({ id: 'player2', name: 'Player 2' });
    
    player1.chips = 1000;
    player2.chips = 1000;
    
    await table.addPlayer(player1);
    await table.addPlayer(player2);

    const actionEvents = [];
    
    // Capture all player:action events
    table.on('player:action', (data) => {
      actionEvents.push({
        playerId: data.playerId,
        action: data.action,
        amount: data.amount,
        potSize: data.potSize,
        tableId: data.tableId,
        gameNumber: data.gameNumber,
        properties: Object.keys(data)
      });
    });

    // Wait for hand to complete
    const handEndedPromise = new Promise(resolve => {
      table.once('hand:ended', () => {
        setTimeout(resolve, 100);
      });
    });

    await table.tryStartGame();
    await handEndedPromise;

    // Verify we captured some actions
    expect(actionEvents.length).toBeGreaterThan(0);
    
    // Verify EVERY action event includes the required fields
    actionEvents.forEach((actionEvent, index) => {
      console.log(`Action ${index + 1}:`, actionEvent);
      
      // Check all required properties exist
      expect(actionEvent.properties).toContain('playerId');
      expect(actionEvent.properties).toContain('action');
      expect(actionEvent.properties).toContain('amount');
      expect(actionEvent.properties).toContain('potSize'); // ← This was missing!
      expect(actionEvent.properties).toContain('tableId');
      expect(actionEvent.properties).toContain('gameNumber');
      
      // Verify potSize is a valid number
      expect(typeof actionEvent.potSize).toBe('number');
      expect(actionEvent.potSize).toBeGreaterThanOrEqual(0);
    });

    // Specific test case from pokersim bug report
    const firstAction = actionEvents[0];
    console.log('First action data:', firstAction);
    
    // Should have initial pot size (SB + BB = 30)
    expect(firstAction.potSize).toBe(30);
    
    // Check that pot size increases with betting
    if (actionEvents.length > 1) {
      const raiseAction = actionEvents.find(a => a.action === 'RAISE');
      if (raiseAction) {
        expect(raiseAction.potSize).toBeGreaterThan(30); // Pot should grow with raises
      }
    }
  });

  it('should show accurate pot sizes throughout betting rounds', async () => {
    const player1 = new TestPlayer({ id: 'player1', name: 'Aggressive Player' });
    const player2 = new TestPlayer({ id: 'player2', name: 'Calling Player' });
    
    player1.chips = 1000;
    player2.chips = 1000;
    
    await table.addPlayer(player1);
    await table.addPlayer(player2);

    const potSizeProgression = [];
    
    table.on('player:action', (data) => {
      potSizeProgression.push({
        action: `${data.playerId}: ${data.action}${data.amount ? ` ${data.amount}` : ''}`,
        potSize: data.potSize
      });
    });

    const handEndedPromise = new Promise(resolve => {
      table.once('hand:ended', () => {
        setTimeout(resolve, 100);
      });
    });

    await table.tryStartGame();
    await handEndedPromise;

    console.log('\nPot size progression:');
    potSizeProgression.forEach((step, index) => {
      console.log(`${index + 1}. ${step.action} (pot: ${step.potSize})`);
    });

    // Verify pot sizes make sense
    expect(potSizeProgression.length).toBeGreaterThan(0);
    
    // First action should show initial pot (SB + BB)
    expect(potSizeProgression[0].potSize).toBe(30);
    
    // Pot sizes should never decrease during a hand
    for (let i = 1; i < potSizeProgression.length; i++) {
      expect(potSizeProgression[i].potSize).toBeGreaterThanOrEqual(potSizeProgression[i-1].potSize);
    }
  });

  it('should match the exact format expected by pokersim team', async () => {
    const player1 = new TestPlayer({ id: 'hero', name: 'Hero' });
    const player2 = new TestPlayer({ id: 'villain', name: 'Villain' });
    
    player1.chips = 1000;
    player2.chips = 1000;
    
    await table.addPlayer(player1);
    await table.addPlayer(player2);

    let betEvent = null;
    
    table.on('player:action', (data) => {
      if (data.action === 'RAISE' && !betEvent) {
        betEvent = data;
      }
    });

    const handEndedPromise = new Promise(resolve => {
      table.once('hand:ended', () => {
        setTimeout(resolve, 100);
      });
    });

    await table.tryStartGame();
    await handEndedPromise;

    // Verify we captured a bet/raise
    expect(betEvent).toBeTruthy();
    
    // Verify exact format pokersim team expects
    expect(betEvent).toMatchObject({
      playerId: expect.any(String),
      action: 'RAISE', 
      amount: expect.any(Number),
      potSize: expect.any(Number), // ← Critical field for tournament logging
      tableId: 'potsize-test',
      gameNumber: expect.any(Number)
    });

    // Should enable logging like: "Hero bets 858 (pot: 1200)"
    const logMessage = `${betEvent.playerId} bets ${betEvent.amount} (pot: ${betEvent.potSize})`;
    console.log('Tournament log format:', logMessage);
    
    expect(logMessage).toMatch(/\w+ bets \d+ \(pot: \d+\)/);
  });
});