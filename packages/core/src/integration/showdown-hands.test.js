/**
 * Tests for showdownHands array in hand:ended event (#49)
 * This provides a simplified view of all hands revealed at showdown
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';
import { setupEventCapture, waitForHandEnd } from '../test-utils/index.js';
import { RiggedDeck } from '../game/RiggedDeck.js';

// Helper function to create proper rigged deck with enough cards
function createShowdownDeck(playerCards, communityCards) {
  const cards = [
    ...playerCards, // Hole cards for all players
    'Jh', // Burn before flop
    ...communityCards.slice(0, 3), // Flop (3 cards)
    'Jc', // Burn before turn
    communityCards[3] || '9c', // Turn (1 card)
    'Jd', // Burn before river
    communityCards[4] || 'Ts', // River (1 card)
  ];
  return new RiggedDeck({ cards, dealAlternating: false });
}

// Test player that always calls to reach showdown
class CallPlayer extends Player {
  constructor(id) {
    super({ id, name: id });
  }

  getAction(gameState) {
    if (gameState.toCall > 0) {
      return { action: Action.CALL };
    }
    return { action: Action.CHECK };
  }
}

// Test player that folds to any bet
class FoldPlayer extends Player {
  constructor(id) {
    super({ id, name: id });
  }

  getAction(gameState) {
    if (gameState.toCall > 0) {
      return { action: Action.FOLD };
    }
    return { action: Action.CHECK };
  }
}

describe('showdownHands Array in hand:ended Event (#49)', () => {
  let manager;
  let table;
  let eventCapture;

  beforeEach(() => {
    manager = new PokerGameManager();
    table = manager.createTable({
      id: 'test-showdown-hands',
      blinds: { small: 10, big: 20 },
      minPlayers: 2,
      simulationMode: true,
      dealerButton: 0,
    });
    eventCapture = setupEventCapture(table);
  });

  describe('Basic functionality', () => {
    it('should include showdownHands array in hand:ended event', async () => {
      const riggedDeck = createShowdownDeck(
        ['As', 'Ad', 'Kh', 'Qc'], // P1 gets AA, P2 gets KQ
        ['2s', '3d', '8h', '9c', 'Ts'], // Community cards
      );
      table.setDeck(riggedDeck);

      const player1 = new CallPlayer('player1');
      const player2 = new CallPlayer('player2');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      // Should have showdownHands array
      expect(eventCapture).toHaveProperty('showdownHands');
      expect(Array.isArray(eventCapture.showdownHands)).toBe(true);
    });

    it('should contain simplified hand info for all showdown participants', async () => {
      const riggedDeck = createShowdownDeck(
        ['As', 'Ad', 'Kh', 'Qc'], // P1 gets AA, P2 gets KQ
        ['2s', '3d', '8h', '9c', 'Ts'], // Community cards
      );
      table.setDeck(riggedDeck);

      const player1 = new CallPlayer('player1');
      const player2 = new CallPlayer('player2');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      // Both players should be in showdownHands
      expect(eventCapture.showdownHands).toHaveLength(2);

      // Each entry should have simplified structure
      eventCapture.showdownHands.forEach((handInfo) => {
        expect(handInfo).toHaveProperty('playerId');
        expect(handInfo).toHaveProperty('cards'); // 2 hole cards
        expect(handInfo).toHaveProperty('hand'); // 5-card best hand
        expect(handInfo).toHaveProperty('handDescription');

        // Verify data types
        expect(typeof handInfo.playerId).toBe('string');
        expect(Array.isArray(handInfo.cards)).toBe(true);
        expect(handInfo.cards).toHaveLength(2); // Hole cards
        expect(Array.isArray(handInfo.hand)).toBe(true);
        expect(handInfo.hand).toHaveLength(5); // Best 5-card hand
        expect(typeof handInfo.handDescription).toBe('string');
      });
    });

    it('should be empty when hand ends by folding', async () => {
      const player1 = new FoldPlayer('player1'); // Will fold
      const player2 = new CallPlayer('player2'); // Will win by fold
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      // showdownHands should be empty (no showdown occurred)
      expect(eventCapture.showdownHands).toEqual([]);
    });
  });

  describe('Multi-player scenarios', () => {
    it('should include all players who reached showdown', async () => {
      const riggedDeck = createShowdownDeck(
        ['As', 'Ad', 'Kh', 'Qc', '8s', '8d'], // P1: AA, P2: KQ, P3: 88
        ['2s', '3h', '7c', '9d', 'Ts'], // Community cards
      );
      table.setDeck(riggedDeck);

      const player1 = new CallPlayer('player1');
      const player2 = new CallPlayer('player2');
      const player3 = new CallPlayer('player3');
      player1.chips = 1000;
      player2.chips = 1000;
      player3.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);
      table.addPlayer(player3);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      // All 3 players should be in showdownHands
      expect(eventCapture.showdownHands).toHaveLength(3);

      // Verify player IDs
      const playerIds = eventCapture.showdownHands.map((h) => h.playerId);
      expect(playerIds).toContain('player1');
      expect(playerIds).toContain('player2');
      expect(playerIds).toContain('player3');
    });

    it('should exclude folded players from showdownHands', async () => {
      const riggedDeck = createShowdownDeck(
        ['As', 'Ad', 'Kh', 'Qc', '8s', '8d'], // P1: AA, P2: KQ, P3: 88
        ['2s', '3h', '7c', '9d', 'Ts'], // Community cards
      );
      table.setDeck(riggedDeck);

      const player1 = new CallPlayer('player1');
      const player2 = new FoldPlayer('player2'); // Will fold
      const player3 = new CallPlayer('player3');
      player1.chips = 1000;
      player2.chips = 1000;
      player3.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);
      table.addPlayer(player3);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      // Only 2 players should be in showdownHands (P2 folded)
      expect(eventCapture.showdownHands).toHaveLength(2);

      // Verify P2 is not included
      const playerIds = eventCapture.showdownHands.map((h) => h.playerId);
      expect(playerIds).toContain('player1');
      expect(playerIds).not.toContain('player2'); // Folded
      expect(playerIds).toContain('player3');
    });
  });

  describe('Hand descriptions', () => {
    it('should include accurate hand descriptions', async () => {
      const riggedDeck = createShowdownDeck(
        ['As', 'Ad', 'Kh', 'Qc'], // P1: AA (pair), P2: KQ (high card)
        ['2s', '3d', '8h', '9c', 'Ts'], // Community cards
      );
      table.setDeck(riggedDeck);

      const player1 = new CallPlayer('player1');
      const player2 = new CallPlayer('player2');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      // Find each player's hand info
      const p1Hand = eventCapture.showdownHands.find(
        (h) => h.playerId === 'player1',
      );
      const p2Hand = eventCapture.showdownHands.find(
        (h) => h.playerId === 'player2',
      );

      // P1 should have pair of aces
      expect(p1Hand.handDescription.toLowerCase()).toContain('pair');
      expect(p1Hand.cards).toMatchObject([
        { rank: 'A', suit: 's' },
        { rank: 'A', suit: 'd' },
      ]);

      // P2 should have high card
      expect(p2Hand.handDescription.toLowerCase()).toContain('high');
      expect(p2Hand.cards).toMatchObject([
        { rank: 'K', suit: 'h' },
        { rank: 'Q', suit: 'c' },
      ]);
    });

    it('should show correct best 5-card hands', async () => {
      const riggedDeck = createShowdownDeck(
        ['As', '5s', 'Kh', '7c'], // P1: A5 spades, P2: K7 off-suit
        ['2s', '8s', '9s', 'Jc', 'Td'], // Community: flush possible for P1
      );
      table.setDeck(riggedDeck);

      const player1 = new CallPlayer('player1');
      const player2 = new CallPlayer('player2');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const p1Hand = eventCapture.showdownHands.find(
        (h) => h.playerId === 'player1',
      );

      // P1 should have flush (5 spades)
      expect(p1Hand.handDescription.toLowerCase()).toContain('flush');
      expect(p1Hand.hand).toHaveLength(5);

      // All 5 cards in best hand should be spades
      const suits = p1Hand.hand.map((card) => card.suit);
      expect(suits.filter((s) => s === 's')).toHaveLength(5);
    });
  });

  describe('Compatibility with existing event structure', () => {
    it('should coexist with winners and showdownParticipants arrays', async () => {
      const riggedDeck = createShowdownDeck(
        ['As', 'Ad', 'Kh', 'Qc'], // P1: AA, P2: KQ
        ['2s', '3d', '8h', '9c', 'Ts'], // Community cards
      );
      table.setDeck(riggedDeck);

      const player1 = new CallPlayer('player1');
      const player2 = new CallPlayer('player2');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      // All three arrays should exist
      expect(eventCapture).toHaveProperty('winners');
      expect(eventCapture).toHaveProperty('showdownParticipants');
      expect(eventCapture).toHaveProperty('showdownHands');

      // showdownHands should have same number of entries as showdownParticipants
      expect(eventCapture.showdownHands.length).toBe(
        eventCapture.showdownParticipants.length,
      );

      // Winners should be a subset
      expect(eventCapture.winners.length).toBeLessThanOrEqual(
        eventCapture.showdownHands.length,
      );
    });

    it('should provide simpler structure than showdownParticipants', async () => {
      const riggedDeck = createShowdownDeck(
        ['As', 'Ad', 'Kh', 'Qc'], // P1: AA, P2: KQ
        ['2s', '3d', '8h', '9c', 'Ts'], // Community cards
      );
      table.setDeck(riggedDeck);

      const player1 = new CallPlayer('player1');
      const player2 = new CallPlayer('player2');
      player1.chips = 1000;
      player2.chips = 1000;

      table.addPlayer(player1);
      table.addPlayer(player2);

      table.tryStartGame();
      await waitForHandEnd(eventCapture);

      const showdownHand = eventCapture.showdownHands[0];
      const showdownParticipant = eventCapture.showdownParticipants[0];

      // showdownHands should have fewer properties (simplified)
      const handKeys = Object.keys(showdownHand);
      const participantKeys = Object.keys(showdownParticipant);

      // showdownHands should only have the essential properties
      expect(handKeys).toEqual([
        'playerId',
        'cards',
        'hand',
        'handDescription',
      ]);

      // showdownParticipants has additional properties like amount, wonAmount, handRank, etc.
      expect(participantKeys.length).toBeGreaterThan(handKeys.length);
    });
  });
});
