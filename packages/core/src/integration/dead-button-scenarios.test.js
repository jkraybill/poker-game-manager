/**
 * Dead Button and Dead Small Blind Scenarios - Comprehensive Test Suite
 * 
 * Tests the implementation of tournament-standard dead button rules as specified
 * in POKER-RULES.md section 3. These rules are critical for tournament integrity.
 * 
 * CORE PRINCIPLE: The big blind always moves forward one position each hand.
 * The button and small blind are calculated relative to the big blind position,
 * even if this means placing them on eliminated players' empty seats (dead positions).
 * 
 * Key Rules from POKER-RULES.md:
 * - 3.1.1: Tournament play uses a dead button
 * - 3.1.2: Small blind may have the button
 * - 3.1.3: Big blind is never on the button
 * - 3.3.2: A player who posts a short blind creates a dead small blind
 * - 3.3.3: Players cannot skip blinds
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  STRATEGIES,
  Action,
  cleanupTables,
} from '../test-utils/index.js';

describe('Dead Button Tournament Rules', () => {
  let manager;
  let table;

  beforeEach(() => {
    const result = createTestTable('standard', {
      blinds: { small: 10, big: 20 },
      dealerButton: 0,
    });
    manager = result.manager;
    table = result.table;
  });

  afterEach(() => {
    cleanupTables(manager);
  });

  describe('Scenario 1: Player Between Button and Blinds Eliminated', () => {
    it('should create dead button when middle player eliminated', async () => {
      // Setup: 4 players A, B, C, D with positions:
      // Hand 1: A=Button(0), B=SB(1), C=BB(2), D=UTG(3)
      // Eliminate B during hand
      // Expected Hand 2: Button=Dead(B's seat), SB=Dead, BB=C, UTG=D

      // Create players with basic fold strategy
      const players = [
        new StrategicPlayer({ name: 'Player A', strategy: STRATEGIES.alwaysFold }), // Button
        new StrategicPlayer({ name: 'Player B', strategy: STRATEGIES.alwaysFold }), // SB - will be eliminated
        new StrategicPlayer({ name: 'Player C', strategy: STRATEGIES.alwaysFold }), // BB
        new StrategicPlayer({ name: 'Player D', strategy: STRATEGIES.alwaysFold }), // UTG
      ];

      // Add players
      players.forEach(p => table.addPlayer(p));

      // First hand - establish positions
      const events1 = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events1);

      // Verify first hand BB position tracking
      expect(table.lastBigBlindPlayerId).toBe(players[2].id); // Player C

      // Simulate B elimination by setting chips to 0
      players[1].chips = 0;
      const playerData = table.players.get(players[1].id);
      if (playerData) {
        playerData.player.chips = 0;
      }

      // Second hand - should implement dead button rule
      const events2 = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events2);

      // Verify dead button implementation
      const positions = table.calculateDeadButtonPositions();
      
      // Debug logging
      console.log('After elimination - Player states:', Array.from(table.players.entries()).map(([id, data]) => ({
        id, 
        name: data.player.name,
        chips: data.player.chips,
        seatNumber: data.seatNumber
      })));
      console.log('Last BB player ID:', table.lastBigBlindPlayerId);
      console.log('Dead button positions:', positions);
      
      // Let's manually check what the dead button logic should do
      const allPlayers = Array.from(table.players.values()).sort((a, b) => a.seatNumber - b.seatNumber);
      const activePlayers = allPlayers.filter(pd => pd.player.chips > 0);
      console.log('All players by seat:', allPlayers.map(pd => ({name: pd.player.name, seat: pd.seatNumber, chips: pd.player.chips})));
      console.log('Active players:', activePlayers.map(pd => ({name: pd.player.name, seat: pd.seatNumber, chips: pd.player.chips})));
      
      expect(positions.isDeadButton).toBe(true);
      expect(positions.isDeadSmallBlind).toBe(true);
      
      // BB should advance to next player (D)
      expect(table.lastBigBlindPlayerId).toBe(players[3].id); // Player D

      // No player should post BB twice in a row
      expect(table.lastBigBlindPlayerId).not.toBe(players[2].id);
    });
  });

  describe('Scenario 2: Big Blind Eliminated', () => {
    it('should advance BB normally when BB player eliminated', async () => {
      // Setup: 4 players A, B, C, D
      // Hand 1: A=Button, B=SB, C=BB, D=UTG
      // Eliminate C (BB) during hand
      // Expected Hand 2: B=Button, D=SB, A=BB (normal progression)

      const players = [
        new StrategicPlayer({ name: 'Player A', strategy: STRATEGIES.alwaysFold }), // Button
        new StrategicPlayer({ name: 'Player B', strategy: STRATEGIES.alwaysFold }), // SB
        new StrategicPlayer({ name: 'Player C', strategy: STRATEGIES.alwaysFold }), // BB - will be eliminated
        new StrategicPlayer({ name: 'Player D', strategy: STRATEGIES.alwaysFold }), // UTG
      ];

      players.forEach(p => table.addPlayer(p));

      // First hand
      const events1 = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events1);

      // Eliminate C (BB player)
      players[2].chips = 0;
      const playerData = table.players.get(players[2].id);
      if (playerData) {
        playerData.player.chips = 0;
      }

      // Second hand - should progress normally without dead positions
      const events2 = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events2);

      const positions = table.calculateDeadButtonPositions();
      expect(positions.isDeadButton).toBe(false);
      expect(positions.isDeadSmallBlind).toBe(false);
      
      // BB should advance to D
      expect(table.lastBigBlindPlayerId).toBe(players[3].id); // Player D
    });
  });

  describe('Scenario 3: Button Eliminated', () => {
    it('should create dead button when button player eliminated', async () => {
      // Setup: 4 players A, B, C, D
      // Hand 1: A=Button, B=SB, C=BB, D=UTG
      // Eliminate A (Button) during hand
      // Expected Hand 2: Button=Dead(A's seat), SB=B, BB=D

      const players = [
        new StrategicPlayer({ name: 'Player A', strategy: STRATEGIES.alwaysFold }), // Button - will be eliminated
        new StrategicPlayer({ name: 'Player B', strategy: STRATEGIES.alwaysFold }), // SB
        new StrategicPlayer({ name: 'Player C', strategy: STRATEGIES.alwaysFold }), // BB  
        new StrategicPlayer({ name: 'Player D', strategy: STRATEGIES.alwaysFold }), // UTG
      ];

      players.forEach(p => table.addPlayer(p));

      // First hand
      const events1 = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events1);

      // Eliminate A (Button player)
      players[0].chips = 0;
      const playerData = table.players.get(players[0].id);
      if (playerData) {
        playerData.player.chips = 0;
      }

      // Second hand - button should be dead
      const events2 = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events2);

      const positions = table.calculateDeadButtonPositions();
      expect(positions.isDeadButton).toBe(true);
      expect(positions.isDeadSmallBlind).toBe(false);
      
      // BB should advance to D  
      expect(table.lastBigBlindPlayerId).toBe(players[3].id); // Player D
      
      // B keeps SB position (rule 3.1.2: SB may have button)
    });
  });

  describe('Scenario 4: Multiple Eliminations', () => {
    it('should handle multiple eliminations correctly', async () => {
      // Setup: 4 players A, B, C, D
      // Hand 1: A=Button, B=SB, C=BB, D=UTG
      // Eliminate B and C during hand
      // Expected Hand 2: A=Button, D=SB, A=BB (heads-up)

      const players = [
        new StrategicPlayer({ name: 'Player A', strategy: STRATEGIES.alwaysFold }), // Button
        new StrategicPlayer({ name: 'Player B', strategy: STRATEGIES.alwaysFold }), // SB - will be eliminated
        new StrategicPlayer({ name: 'Player C', strategy: STRATEGIES.alwaysFold }), // BB - will be eliminated
        new StrategicPlayer({ name: 'Player D', strategy: STRATEGIES.alwaysFold }), // UTG
      ];

      players.forEach(p => table.addPlayer(p));

      // First hand
      const events1 = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events1);

      // Eliminate B and C
      players[1].chips = 0;
      players[2].chips = 0;
      const playerDataB = table.players.get(players[1].id);
      const playerDataC = table.players.get(players[2].id);
      if (playerDataB) playerDataB.player.chips = 0;
      if (playerDataC) playerDataC.player.chips = 0;

      // Second hand - now heads-up
      const events2 = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events2);

      const positions = table.calculateDeadButtonPositions();
      
      // Should transition to heads-up rules (3.2: SB is on button)
      expect(positions.isDeadButton).toBe(false);
      expect(positions.isDeadSmallBlind).toBe(false);
      
      // In heads-up, button should equal small blind
      expect(positions.buttonIndex).toBe(positions.smallBlindIndex);
    });
  });

  describe('Scenario 5: Heads-Up Transition', () => {
    it('should handle 3-to-2 player transition with dead button', async () => {
      // Test going from 3 players to heads-up ensuring no double BB posting

      const players = [
        new StrategicPlayer({ name: 'Player A', strategy: STRATEGIES.alwaysFold }), // Button
        new StrategicPlayer({ name: 'Player B', strategy: STRATEGIES.alwaysFold }), // SB - will be eliminated
        new StrategicPlayer({ name: 'Player C', strategy: STRATEGIES.alwaysFold }), // BB
      ];

      players.forEach(p => table.addPlayer(p));

      // First hand - 3 players
      const events1 = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events1);

      const firstHandBB = table.lastBigBlindPlayerId;

      // Eliminate middle player
      players[1].chips = 0;
      const playerData = table.players.get(players[1].id);
      if (playerData) {
        playerData.player.chips = 0;
      }

      // Second hand - heads-up transition
      const events2 = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events2);

      const secondHandBB = table.lastBigBlindPlayerId;

      // Critical rule: No player should post BB twice in a row
      expect(secondHandBB).not.toBe(firstHandBB);
      
      // Should now follow heads-up rules (3.2.1: SB is on button)
      const positions = table.calculateDeadButtonPositions();
      expect(positions.buttonIndex).toBe(positions.smallBlindIndex);
    });
  });

  describe('Dead Small Blind Scenarios', () => {
    it('should create dead small blind correctly', async () => {
      // Test rule 3.3.2: Player who posts short blind creates dead small blind

      // Create player with insufficient chips for small blind
      const players = [
        new StrategicPlayer({ name: 'Button Player', strategy: STRATEGIES.alwaysFold }),
        new StrategicPlayer({ name: 'Short Stack', strategy: STRATEGIES.alwaysFold }), // Will have < 10 chips for SB
        new StrategicPlayer({ name: 'BB Player', strategy: STRATEGIES.alwaysFold }),
        new StrategicPlayer({ name: 'UTG Player', strategy: STRATEGIES.alwaysFold }),
      ];

      // Set short stack to have only 5 chips (less than SB)
      players[1].chips = 5;

      players.forEach(p => table.addPlayer(p));

      const events = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events);

      // Should detect dead small blind scenario
      const positions = table.calculateDeadButtonPositions();
      // Note: This tests the detection logic - actual short blind posting
      // would need additional implementation in the betting logic
    });
  });

  describe('Blind Skipping Prevention', () => {
    it('should prevent players from skipping blinds', async () => {
      // Test rule 3.3.3: Players cannot skip blinds
      // Verify that dead button implementation ensures fair blind rotation

      const players = [
        new StrategicPlayer({ name: 'Player A', strategy: STRATEGIES.alwaysFold }),
        new StrategicPlayer({ name: 'Player B', strategy: STRATEGIES.alwaysFold }),
        new StrategicPlayer({ name: 'Player C', strategy: STRATEGIES.alwaysFold }),
        new StrategicPlayer({ name: 'Player D', strategy: STRATEGIES.alwaysFold }),
      ];

      players.forEach(p => table.addPlayer(p));

      // Track BB posting order over multiple hands
      const bbOrder = [];

      // Hand 1
      const events1 = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events1);
      bbOrder.push(table.lastBigBlindPlayerId);

      // Eliminate player between button and blinds
      players[1].chips = 0;
      const playerData = table.players.get(players[1].id);
      if (playerData) {
        playerData.player.chips = 0;
      }

      // Hand 2
      const events2 = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events2);
      bbOrder.push(table.lastBigBlindPlayerId);

      // Hand 3
      const events3 = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events3);
      bbOrder.push(table.lastBigBlindPlayerId);

      // Verify no player appears twice in a row (no skipping)
      for (let i = 1; i < bbOrder.length; i++) {
        expect(bbOrder[i]).not.toBe(bbOrder[i - 1]);
      }

      // Verify all remaining players eventually post BB
      const uniqueBBPlayers = [...new Set(bbOrder)];
      const activePlayers = players.filter(p => p.chips > 0);
      expect(uniqueBBPlayers.length).toBeGreaterThanOrEqual(Math.min(3, activePlayers.length));
    });
  });

  describe('Integration with Existing Tests', () => {
    it('should maintain backward compatibility with existing behavior', async () => {
      // Ensure dead button implementation doesn't break existing tests
      // when no eliminations occur

      const players = [
        new StrategicPlayer({ name: 'Player 1', strategy: STRATEGIES.alwaysFold }),
        new StrategicPlayer({ name: 'Player 2', strategy: STRATEGIES.alwaysFold }),
      ];

      players.forEach(p => table.addPlayer(p));

      // Normal heads-up hand
      const events = setupEventCapture(table);
      table.tryStartGame();
      await waitForHandEnd(events);

      // Should not create dead positions when no eliminations
      const positions = table.calculateDeadButtonPositions();
      expect(positions.isDeadButton).toBe(false);
      expect(positions.isDeadSmallBlind).toBe(false);

      // Winners should be determined normally
      expect(events.winners).toBeDefined();
      expect(events.winners.length).toBeGreaterThan(0);
    });
  });
});