/**
 * HandEvaluator Split Pot Tests
 * 
 * Tests specifically for split pot scenarios where multiple players
 * have identical hand strengths.
 */

import { describe, it, expect } from 'vitest';
import { HandEvaluator } from './HandEvaluator.js';

describe('HandEvaluator Split Pot Scenarios', () => {
  
  it('should find multiple winners with identical straights', () => {
    const playerHands = [
      {
        playerData: { player: { id: 'player1' }, chips: 1000 },
        hand: {
          rank: 5, // Straight
          kickers: [9, 8, 7, 6, 5],
          cards: [],
          description: 'Straight, Nine High',
        },
        cards: [],
      },
      {
        playerData: { player: { id: 'player2' }, chips: 1000 },
        hand: {
          rank: 5, // Straight
          kickers: [9, 8, 7, 6, 5], // Identical kickers
          cards: [],
          description: 'Straight, Nine High',
        },
        cards: [],
      },
      {
        playerData: { player: { id: 'player3' }, chips: 1000 },
        hand: {
          rank: 2, // Pair
          kickers: [14, 14, 13, 12, 11],
          cards: [],
          description: 'Pair of Aces',
        },
        cards: [],
      },
    ];

    const winners = HandEvaluator.findWinners(playerHands);
    
    expect(winners).toHaveLength(2);
    expect(winners.map(w => w.playerData.player.id)).toContain('player1');
    expect(winners.map(w => w.playerData.player.id)).toContain('player2');
    expect(winners.map(w => w.playerData.player.id)).not.toContain('player3');
  });

  it('should find all winners when everyone has identical hands', () => {
    const playerHands = [
      {
        playerData: { player: { id: 'p1' } },
        hand: {
          rank: 10, // Royal flush
          kickers: [14, 13, 12, 11, 10],
          cards: [],
          description: 'Royal Flush',
        },
        cards: [],
      },
      {
        playerData: { player: { id: 'p2' } },
        hand: {
          rank: 10, // Royal flush
          kickers: [14, 13, 12, 11, 10],
          cards: [],
          description: 'Royal Flush',
        },
        cards: [],
      },
      {
        playerData: { player: { id: 'p3' } },
        hand: {
          rank: 10, // Royal flush
          kickers: [14, 13, 12, 11, 10],
          cards: [],
          description: 'Royal Flush',
        },
        cards: [],
      },
    ];

    const winners = HandEvaluator.findWinners(playerHands);
    
    expect(winners).toHaveLength(3);
    expect(winners.map(w => w.playerData.player.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('should handle split pot with different suits but same rank', () => {
    const playerHands = [
      {
        playerData: { player: { id: 'hearts' } },
        hand: {
          rank: 6, // Flush
          kickers: [14, 13, 12, 11, 9], // A-high flush
          cards: [],
          description: 'Flush, Ace High',
        },
        cards: [],
      },
      {
        playerData: { player: { id: 'diamonds' } },
        hand: {
          rank: 6, // Flush
          kickers: [14, 13, 12, 11, 9], // Same A-high flush
          cards: [],
          description: 'Flush, Ace High',
        },
        cards: [],
      },
    ];

    const winners = HandEvaluator.findWinners(playerHands);
    
    expect(winners).toHaveLength(2);
    expect(winners.every(w => w.hand.rank === 6)).toBe(true);
  });

  it('should not split pot when kickers differ', () => {
    const playerHands = [
      {
        playerData: { player: { id: 'player1' } },
        hand: {
          rank: 2, // Pair
          kickers: [14, 14, 13, 12, 11], // AA with KQJ kickers
          cards: [],
          description: 'Pair of Aces',
        },
        cards: [],
      },
      {
        playerData: { player: { id: 'player2' } },
        hand: {
          rank: 2, // Pair
          kickers: [14, 14, 13, 12, 10], // AA with KQT kickers (lower)
          cards: [],
          description: 'Pair of Aces',
        },
        cards: [],
      },
    ];

    const winners = HandEvaluator.findWinners(playerHands);
    
    expect(winners).toHaveLength(1);
    expect(winners[0].playerData.player.id).toBe('player1');
  });

  it('should handle complex split with multiple tied hands', () => {
    const playerHands = [
      {
        playerData: { player: { id: 'p1' } },
        hand: {
          rank: 3, // Two pair
          kickers: [13, 13, 12, 12, 11], // KK QQ J
          cards: [],
          description: 'Two Pair, Kings and Queens',
        },
        cards: [],
      },
      {
        playerData: { player: { id: 'p2' } },
        hand: {
          rank: 3, // Two pair
          kickers: [13, 13, 12, 12, 11], // Same: KK QQ J
          cards: [],
          description: 'Two Pair, Kings and Queens',
        },
        cards: [],
      },
      {
        playerData: { player: { id: 'p3' } },
        hand: {
          rank: 3, // Two pair
          kickers: [13, 13, 12, 12, 10], // KK QQ T (loses on kicker)
          cards: [],
          description: 'Two Pair, Kings and Queens',
        },
        cards: [],
      },
      {
        playerData: { player: { id: 'p4' } },
        hand: {
          rank: 3, // Two pair
          kickers: [13, 13, 12, 12, 11], // Same: KK QQ J
          cards: [],
          description: 'Two Pair, Kings and Queens',
        },
        cards: [],
      },
    ];

    const winners = HandEvaluator.findWinners(playerHands);
    
    expect(winners).toHaveLength(3);
    expect(winners.map(w => w.playerData.player.id).sort()).toEqual(['p1', 'p2', 'p4']);
  });

  it('should handle single winner when no ties exist', () => {
    const playerHands = [
      {
        playerData: { player: { id: 'winner' } },
        hand: {
          rank: 7, // Full house
          kickers: [14, 14, 14, 13, 13],
          cards: [],
          description: 'Full House, Aces over Kings',
        },
        cards: [],
      },
      {
        playerData: { player: { id: 'loser1' } },
        hand: {
          rank: 6, // Flush
          kickers: [14, 13, 12, 11, 9],
          cards: [],
          description: 'Flush, Ace High',
        },
        cards: [],
      },
      {
        playerData: { player: { id: 'loser2' } },
        hand: {
          rank: 5, // Straight
          kickers: [14, 13, 12, 11, 10],
          cards: [],
          description: 'Straight, Ace High',
        },
        cards: [],
      },
    ];

    const winners = HandEvaluator.findWinners(playerHands);
    
    expect(winners).toHaveLength(1);
    expect(winners[0].playerData.player.id).toBe('winner');
  });
});