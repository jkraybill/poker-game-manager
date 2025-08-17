import { describe, it, expect, beforeEach } from 'vitest';
import { Table } from '../../packages/core/src/Table.js';
import { Player } from '../../packages/core/src/Player.js';
import { Action } from '../../packages/core/src/types/index.js';

describe('Showdown Participants Feature', () => {
  
  // Test player that always calls to ensure showdown
  class ShowdownPlayer extends Player {
    constructor(config) {
      super(config);
      this.chips = config.chips;
      this.strategy = config.strategy || 'call'; // call, check, or fold
    }
    
    async getAction(gameState) {
      if (this.strategy === 'fold' && gameState.toCall > 0) {
        return { action: Action.FOLD, amount: 0, timestamp: Date.now() };
      }
      
      if (gameState.validActions.includes(Action.CHECK)) {
        return { action: Action.CHECK, amount: 0, timestamp: Date.now() };
      }
      
      if (gameState.validActions.includes(Action.CALL) && gameState.toCall > 0) {
        return { action: Action.CALL, amount: gameState.toCall, timestamp: Date.now() };
      }
      
      return { action: Action.CHECK, amount: 0, timestamp: Date.now() };
    }
  }

  it('should include all showdown participants in hand:ended event', async () => {
    const table = new Table({
      id: 'showdown-test',
      maxPlayers: 3,
      minPlayers: 3,
      blinds: { small: 100, big: 200 },
      dealerButton: 0
    });

    const players = [];
    for (let i = 0; i < 3; i++) {
      const player = new ShowdownPlayer({ 
        id: i + 1, 
        name: `Player${i + 1}`, 
        chips: 10000,
        strategy: 'call'  // All players call to reach showdown
      });
      players.push(player);
      await table.addPlayer(player, i);
    }

    let handEndedData = null;
    const handEndedPromise = new Promise(resolve => {
      table.once('hand:ended', (data) => {
        handEndedData = data;
        resolve();
      });
    });
    
    await table.tryStartGame();
    await handEndedPromise;

    // CRITICAL ASSERTION: showdownParticipants should include ALL players who reached showdown
    expect(handEndedData).toHaveProperty('showdownParticipants');
    expect(Array.isArray(handEndedData.showdownParticipants)).toBe(true);
    expect(handEndedData.showdownParticipants).toHaveLength(3); // All 3 players should be included

    // Each participant should have the required properties
    for (const participant of handEndedData.showdownParticipants) {
      expect(participant).toHaveProperty('playerId');
      expect(participant).toHaveProperty('cards');
      expect(participant).toHaveProperty('hand');
      expect(participant).toHaveProperty('amount');
      expect(typeof participant.amount).toBe('number');
      expect(participant.amount).toBeGreaterThanOrEqual(0);
      
      // Cards should be an array of 2 hole cards
      expect(Array.isArray(participant.cards)).toBe(true);
      expect(participant.cards).toHaveLength(2);
      
      // Hand should have evaluation properties
      expect(participant.hand).toHaveProperty('rank');
      expect(participant.hand).toHaveProperty('description');
    }

    // Winners should still be included but only those with amount > 0
    expect(handEndedData).toHaveProperty('winners');
    const winnerIds = handEndedData.winners.map(w => w.playerId);
    const participantIds = handEndedData.showdownParticipants.map(p => p.playerId);
    
    // All winners should also be in showdownParticipants
    for (const winnerId of winnerIds) {
      expect(participantIds).toContain(winnerId);
    }

    // At least one participant should have amount > 0 (the winner)
    const winnersInParticipants = handEndedData.showdownParticipants.filter(p => p.amount > 0);
    expect(winnersInParticipants.length).toBeGreaterThan(0);
    
    // Losers should have amount = 0
    const losersInParticipants = handEndedData.showdownParticipants.filter(p => p.amount === 0);
    expect(losersInParticipants.length).toBeGreaterThanOrEqual(0); // May have 0-2 losers depending on split pots
  });

  it('should not include folded players in showdownParticipants', async () => {
    const table = new Table({
      id: 'fold-test',
      maxPlayers: 3,
      minPlayers: 3,
      blinds: { small: 100, big: 200 },
      dealerButton: 0
    });

    // Player 1 will fold, Players 2 & 3 will reach showdown
    const strategies = ['fold', 'call', 'call'];
    const players = [];
    
    for (let i = 0; i < 3; i++) {
      const player = new ShowdownPlayer({ 
        id: i + 1, 
        name: `Player${i + 1}`, 
        chips: 10000,
        strategy: strategies[i]
      });
      players.push(player);
      await table.addPlayer(player, i);
    }

    let handEndedData = null;
    const handEndedPromise = new Promise(resolve => {
      table.once('hand:ended', (data) => {
        handEndedData = data;
        resolve();
      });
    });
    
    await table.tryStartGame();
    await handEndedPromise;

    // Only 2 players should be in showdownParticipants (folded player excluded)
    expect(handEndedData.showdownParticipants).toHaveLength(2);
    
    // Player 1 (who folded) should NOT be in showdownParticipants
    const participantIds = handEndedData.showdownParticipants.map(p => p.playerId);
    expect(participantIds).not.toContain(1); // Player 1 folded
    expect(participantIds).toContain(2);     // Player 2 reached showdown
    expect(participantIds).toContain(3);     // Player 3 reached showdown
  });

  it('should handle split pots correctly in showdownParticipants', async () => {
    const table = new Table({
      id: 'split-test',
      maxPlayers: 2,
      minPlayers: 2,
      blinds: { small: 100, big: 200 },
      dealerButton: 0
    });

    const players = [];
    for (let i = 0; i < 2; i++) {
      const player = new ShowdownPlayer({ 
        id: i + 1, 
        name: `Player${i + 1}`, 
        chips: 10000,
        strategy: 'call'
      });
      players.push(player);
      await table.addPlayer(player, i);
    }

    let handEndedData = null;
    const handEndedPromise = new Promise(resolve => {
      table.once('hand:ended', (data) => {
        handEndedData = data;
        resolve();
      });
    });
    
    await table.tryStartGame();
    await handEndedPromise;

    // Both players should be in showdownParticipants
    expect(handEndedData.showdownParticipants).toHaveLength(2);
    
    // At least one should have amount > 0 (winner), even if not split
    const participantAmounts = handEndedData.showdownParticipants.map(p => p.amount);
    const totalWinnings = participantAmounts.reduce((sum, amount) => sum + amount, 0);
    expect(totalWinnings).toBeGreaterThan(0);
    
    // Should have exactly one winner or split (multiple winners)
    const winnersCount = participantAmounts.filter(amount => amount > 0).length;
    expect(winnersCount).toBeGreaterThanOrEqual(1);
  });

  it('should include showdownParticipants even when only one player remains (all-in scenario)', async () => {
    const table = new Table({
      id: 'allin-test',
      maxPlayers: 2,
      minPlayers: 2,
      blinds: { small: 100, big: 200 },
      dealerButton: 0
    });

    // Player that goes all-in immediately
    class AllInPlayer extends Player {
      constructor(config) {
        super(config);
        this.chips = config.chips;
        this.hasGoneAllIn = false;
      }
      
      async getAction(gameState) {
        if (!this.hasGoneAllIn && gameState.phase === 'PRE_FLOP') {
          this.hasGoneAllIn = true;
          return { action: Action.ALL_IN, amount: this.chips, timestamp: Date.now() };
        }
        
        if (gameState.validActions.includes(Action.CALL)) {
          return { action: Action.CALL, amount: gameState.toCall, timestamp: Date.now() };
        }
        
        return { action: Action.CHECK, amount: 0, timestamp: Date.now() };
      }
    }

    const p1 = new AllInPlayer({ id: 1, name: 'AllIn', chips: 1000 });
    const p2 = new ShowdownPlayer({ id: 2, name: 'Caller', chips: 10000, strategy: 'call' });

    await table.addPlayer(p1, 0);
    await table.addPlayer(p2, 1);

    let handEndedData = null;
    const handEndedPromise = new Promise(resolve => {
      table.once('hand:ended', (data) => {
        handEndedData = data;
        resolve();
      });
    });
    
    await table.tryStartGame();
    await handEndedData;

    // Both players should be in showdownParticipants (all-in forces showdown)
    expect(handEndedData.showdownParticipants).toHaveLength(2);
    
    // One should be winner, one should be loser (unless split pot)
    const winners = handEndedData.showdownParticipants.filter(p => p.amount > 0);
    const losers = handEndedData.showdownParticipants.filter(p => p.amount === 0);
    
    // Check if it's a split pot (both players won money)
    const isSplitPot = winners.length === 2;
    
    if (isSplitPot) {
      // In a split pot, both players should win equal amounts
      expect(winners.length).toBe(2);
      expect(losers.length).toBe(0);
      // Verify they have the same hand rank (true split pot)
      expect(winners[0].hand.rank).toBe(winners[1].hand.rank);
      expect(winners[0].amount).toBe(winners[1].amount);
    } else {
      // Normal case: one winner, one loser
      expect(winners.length).toBe(1);
      expect(losers.length).toBe(1);
    }
  });

  it('should maintain backward compatibility with existing winners array', async () => {
    const table = new Table({
      id: 'compat-test',
      maxPlayers: 2,
      minPlayers: 2,
      blinds: { small: 100, big: 200 },
      dealerButton: 0
    });

    const players = [];
    for (let i = 0; i < 2; i++) {
      const player = new ShowdownPlayer({ 
        id: i + 1, 
        name: `Player${i + 1}`, 
        chips: 10000,
        strategy: 'call'
      });
      players.push(player);
      await table.addPlayer(player, i);
    }

    let handEndedData = null;
    const handEndedPromise = new Promise(resolve => {
      table.once('hand:ended', (data) => {
        handEndedData = data;
        resolve();
      });
    });
    
    await table.tryStartGame();
    await handEndedPromise;

    // Existing winners array should still exist and function as before
    expect(handEndedData).toHaveProperty('winners');
    expect(Array.isArray(handEndedData.winners)).toBe(true);
    expect(handEndedData.winners.length).toBeGreaterThan(0);
    
    // Winners should have the expected structure
    for (const winner of handEndedData.winners) {
      expect(winner).toHaveProperty('playerId');
      expect(winner).toHaveProperty('amount');
      expect(winner.amount).toBeGreaterThan(0);
    }

    // New showdownParticipants should also exist
    expect(handEndedData).toHaveProperty('showdownParticipants');
    
    // Winners should be a subset of showdownParticipants
    const winnerIds = handEndedData.winners.map(w => w.playerId);
    const participantIds = handEndedData.showdownParticipants.map(p => p.playerId);
    
    for (const winnerId of winnerIds) {
      expect(participantIds).toContain(winnerId);
    }
  });
});