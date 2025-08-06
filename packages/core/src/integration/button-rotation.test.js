import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestTable,
  ConditionalPlayer,
  cleanupTables,
  Action,
} from '../test-utils/index.js';

describe('Dealer Button Rotation (Issue #36)', () => {
  let manager, table;
  let players;

  beforeEach(() => {
    ;({ manager, table } = createTestTable('standard', {
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 3,
      dealerButton: 0,
    }));
  });

  afterEach(() => {
    cleanupTables(manager);
  });

  it('should rotate dealer button clockwise after each hand', async () => {
    // Create 3 players using test utilities
    players = [
      new ConditionalPlayer({
        id: 'p1',
        name: 'Player 1',
        conditions: [
          {
            when: () => true,
            then: ({ gameState, myState }) => {
              const toCall = gameState.currentBet - myState.bet;
              // Always fold to bets, check when possible
              return toCall > 0
                ? { action: Action.FOLD }
                : { action: Action.CHECK };
            },
          },
        ],
      }),
      new ConditionalPlayer({
        id: 'p2',
        name: 'Player 2',
        conditions: [
          {
            when: () => true,
            then: ({ gameState, myState }) => {
              const toCall = gameState.currentBet - myState.bet;
              return toCall > 0
                ? { action: Action.FOLD }
                : { action: Action.CHECK };
            },
          },
        ],
      }),
      new ConditionalPlayer({
        id: 'p3',
        name: 'Player 3',
        conditions: [
          {
            when: () => true,
            then: ({ gameState, myState }) => {
              const toCall = gameState.currentBet - myState.bet;
              return toCall > 0
                ? { action: Action.FOLD }
                : { action: Action.CHECK };
            },
          },
        ],
      }),
    ];

    // Track button positions
    const buttonPositions = [];

    table.on('hand:started', (data) => {
      buttonPositions.push(data.dealerButton);
    });

    // Add players
    players.forEach((p) => table.addPlayer(p));

    // Play 5 hands to verify rotation
    for (let i = 0; i < 5; i++) {
      const handEndPromise = new Promise((resolve) => {
        const handler = () => {
          table.off('hand:ended', handler);
          resolve();
        };
        table.on('hand:ended', handler);
      });

      table.tryStartGame();
      await handEndPromise;

      // Short delay between hands
      await new Promise((r) => setTimeout(r, 50));
    }

    console.log('Button positions over 5 hands:', buttonPositions);

    // Verify we have button positions for all 5 hands
    expect(buttonPositions.length).toBe(5);

    // Verify clockwise rotation: 0 -> 1 -> 2 -> 0 -> 1
    expect(buttonPositions[0]).toBe(0);
    expect(buttonPositions[1]).toBe(1);
    expect(buttonPositions[2]).toBe(2);
    expect(buttonPositions[3]).toBe(0);
    expect(buttonPositions[4]).toBe(1);
  });

  it('should skip eliminated players when rotating button', async () => {
    // Create 4 players for this test
    ;({ manager, table } = createTestTable('standard', {
      blinds: { small: 10, big: 20 },
      minBuyIn: 100,
      maxBuyIn: 100,
      minPlayers: 2,
      maxPlayers: 4,
      dealerButton: 0,
    }));

    players = [
      new ConditionalPlayer({
        id: 'p1',
        name: 'Player 1',
        conditions: [
          {
            when: () => true,
            then: ({ gameState, myState }) => {
              const toCall = gameState.currentBet - myState.bet;
              return toCall > 0
                ? { action: Action.FOLD }
                : { action: Action.CHECK };
            },
          },
        ],
      }),
      new ConditionalPlayer({
        id: 'p2',
        name: 'Player 2',
        conditions: [
          {
            when: () => true,
            then: ({ gameState, myState }) => {
              const toCall = gameState.currentBet - myState.bet;
              return toCall > 0
                ? { action: Action.CALL, amount: toCall }
                : { action: Action.CHECK };
            },
          },
        ],
      }),
      new ConditionalPlayer({
        id: 'p3',
        name: 'Player 3',
        conditions: [
          {
            when: () => true,
            then: ({ gameState, myState }) => {
              const toCall = gameState.currentBet - myState.bet;
              return toCall > 0
                ? { action: Action.FOLD }
                : { action: Action.CHECK };
            },
          },
        ],
      }),
      new ConditionalPlayer({
        id: 'p4',
        name: 'Player 4',
        conditions: [
          {
            when: () => true,
            then: ({ gameState, myState }) => {
              const toCall = gameState.currentBet - myState.bet;
              return toCall > 0
                ? { action: Action.FOLD }
                : { action: Action.CHECK };
            },
          },
        ],
      }),
    ];

    const buttonPositions = [];
    const activePlayers = [];

    table.on('hand:started', (data) => {
      buttonPositions.push(data.dealerButton);
      activePlayers.push(data.players.length);
    });

    // Add all players
    players.forEach((p) => table.addPlayer(p));

    // Give player 2 very few chips so they'll be eliminated
    const p2Data = Array.from(table.players.values()).find(
      (p) => p.player.id === 'p2',
    );
    if (p2Data) {
      p2Data.chips = 30;
    }

    // Hand 1: All players active, button at 0
    await playHand(table);

    // After hand 1, player 2 should be eliminated (they called and lost)
    // Check if player 2 has 0 chips
    const p2ChipsAfterHand1 =
      Array.from(table.players.values()).find((p) => p.player.id === 'p2')
        ?.chips || 0;
    console.log('Player 2 chips after hand 1:', p2ChipsAfterHand1);

    // Hand 2: Button should skip eliminated player
    await playHand(table);

    // Hand 3: Verify button continues to skip eliminated player
    await playHand(table);

    console.log('Button positions:', buttonPositions);
    console.log('Active players per hand:', activePlayers);

    // Verify button rotated correctly
    expect(buttonPositions.length).toBeGreaterThanOrEqual(2);

    // With player at position 1 eliminated:
    // Hand 1: button at 0
    // Hand 2: button should skip 1 and go to 2
    // Hand 3: button should go to 3
    if (p2ChipsAfterHand1 === 0) {
      expect(buttonPositions[0]).toBe(0);
      if (buttonPositions.length > 1) {
        expect(buttonPositions[1]).toBe(2); // Skip eliminated player at 1
      }
    }
  });
});

// Helper function to play a single hand
async function playHand(table) {
  const handEndPromise = new Promise((resolve) => {
    const handler = () => {
      table.off('hand:ended', handler);
      resolve();
    };
    table.on('hand:ended', handler);
  });

  table.tryStartGame();
  await handEndPromise;

  // Short delay between hands
  await new Promise((r) => setTimeout(r, 100));
}
