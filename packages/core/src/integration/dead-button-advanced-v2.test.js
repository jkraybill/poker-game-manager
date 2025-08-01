import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  setupEventCapture,
  StrategicPlayer,
  STRATEGIES,
  cleanupTables,
  waitForHandEnd,
} from '../test-utils/index.js';

/**
 * Advanced tests for dead button scenarios with player eliminations
 */

describe('Dead Button Advanced Scenarios (v2)', () => {
  let manager, table, events;

  beforeEach(() => {
    // Use test utilities for table creation
    ;({ manager, table } = createTestTable('standard', {
      minPlayers: 2,
      minBuyIn: 100,
      maxBuyIn: 100,
      dealerButton: 0,
    }));

    // Set up event capture
    events = setupEventCapture(table, {
      events: [
        'hand:started',
        'pot:updated',
        'hand:ended',
        'player:eliminated',
      ],
    });
  });

  afterEach(() => {
    cleanupTables(manager);
  });

  it('should ensure no player posts BB twice in a row when SB is eliminated', async () => {
    // This is the key test for dead button rule
    // Setup: 3 players A, B, C
    // Hand 1: A=Button, B=SB, C=BB
    // B gets eliminated
    // Hand 2: The critical question - who posts BB?

    // Create players with custom blind posting tracking
    const players = [
      new StrategicPlayer({
        id: 'A',
        name: 'Player A',
        strategy: STRATEGIES.alwaysCall,
      }),
      new StrategicPlayer({
        id: 'B',
        name: 'Player B',
        strategy: STRATEGIES.alwaysCall,
      }),
      new StrategicPlayer({
        id: 'C',
        name: 'Player C',
        strategy: STRATEGIES.alwaysCall,
      }),
    ];

    // Add blind posting tracking to players
    players.forEach((player) => {
      player.postedBlinds = [];
    });

    const blindPosts = {
      hand1: { sb: null, bb: null },
      hand2: { sb: null, bb: null },
    };

    let handCount = 0;

    // Track blind posts
    table.on('pot:updated', ({ playerBet }) => {
      if (!playerBet) {
        return;
      }

      const currentHand = handCount === 1 ? 'hand1' : 'hand2';

      if (playerBet.amount === 10 && !blindPosts[currentHand].sb) {
        blindPosts[currentHand].sb = playerBet.playerId;
        const player = players.find((p) => p.id === playerBet.playerId);
        if (player) {
          player.postedBlinds.push({ hand: handCount, type: 'SB' });
        }
      } else if (playerBet.amount === 20 && !blindPosts[currentHand].bb) {
        blindPosts[currentHand].bb = playerBet.playerId;
        const player = players.find((p) => p.id === playerBet.playerId);
        if (player) {
          player.postedBlinds.push({ hand: handCount, type: 'BB' });
        }
      }
    });

    table.on('hand:started', () => {
      handCount++;
    });

    // Add players to table
    players.forEach((player) => table.addPlayer(player));

    // Give B very few chips so they'll be eliminated
    const playerBData = Array.from(table.players.values()).find(
      (p) => p.player.id === 'B',
    );
    if (playerBData) {
      playerBData.chips = 30;
    }

    // Start first hand
    table.tryStartGame();

    // Wait for first hand to complete
    await waitForHandEnd(events);

    console.log('\nAfter Hand 1:');
    console.log(
      'Player chips:',
      players.map((p) => {
        const playerData = Array.from(table.players.values()).find(
          (pd) => pd.player.id === p.id,
        );
        return `${p.id}: $${playerData?.chips || 0}`;
      }),
    );
    console.log('Blinds posted:', blindPosts.hand1);

    // Start second hand
    table.tryStartGame();

    // Wait for second hand
    await waitForHandEnd(events);

    console.log('\nAfter Hand 2:');
    console.log(
      'Player chips:',
      players.map((p) => {
        const playerData = Array.from(table.players.values()).find(
          (pd) => pd.player.id === p.id,
        );
        return `${p.id}: $${playerData?.chips || 0}`;
      }),
    );
    console.log('Blinds posted:', blindPosts.hand2);

    // Check blind posting history
    console.log('\nBlind posting history:');
    players.forEach((p) => {
      console.log(
        `${p.id}: ${p.postedBlinds.map((b) => `Hand ${b.hand} ${b.type}`).join(', ')}`,
      );
    });

    // Verify hand 1 blinds (standard)
    expect(blindPosts.hand1.sb).toBe('B');
    expect(blindPosts.hand1.bb).toBe('C');

    // The critical test: C should NOT post BB again in hand 2
    // With proper dead button implementation:
    // - Button would be "dead" on B's empty seat
    // - C would post SB
    // - A would post BB

    // Log what actually happened
    console.log('\n=== Dead Button Test Result ===');
    console.log('Hand 1 BB:', blindPosts.hand1.bb);
    console.log('Hand 2 BB:', blindPosts.hand2.bb);
    console.log(
      'Did anyone post BB twice?',
      blindPosts.hand1.bb === blindPosts.hand2.bb ? 'YES (BUG!)' : 'No',
    );

    // This assertion checks the key rule: no player posts BB twice in a row
    expect(blindPosts.hand2.bb).not.toBe(blindPosts.hand1.bb);
  });

  it('should handle button player elimination correctly', async () => {
    // When button is eliminated, next hand should have dead button

    const players = [
      new StrategicPlayer({
        id: 'A',
        name: 'Player A',
        strategy: STRATEGIES.alwaysCall,
      }),
      new StrategicPlayer({
        id: 'B',
        name: 'Player B',
        strategy: STRATEGIES.alwaysCall,
      }),
      new StrategicPlayer({
        id: 'C',
        name: 'Player C',
        strategy: STRATEGIES.alwaysCall,
      }),
    ];

    const buttonPositions = [];
    const activePlayers = [];

    table.on('hand:started', (data) => {
      buttonPositions.push(data.dealerButton);
      activePlayers.push([...data.players]);
    });

    // Add players
    players.forEach((player) => table.addPlayer(player));

    // Give A (button) very few chips
    const playerAData = Array.from(table.players.values()).find(
      (p) => p.player.id === 'A',
    );
    if (playerAData) {
      playerAData.chips = 30;
    }

    // Start first hand
    table.tryStartGame();

    // Wait for first hand
    await waitForHandEnd(events);

    // Start second hand
    table.tryStartGame();

    // Wait for second hand
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log('\n=== Button Elimination Test ===');
    console.log('Hand 1 button position:', buttonPositions[0]);
    console.log('Hand 1 active players:', activePlayers[0]);
    console.log('Hand 2 button position:', buttonPositions[1]);
    console.log('Hand 2 active players:', activePlayers[1]);
  });
});
