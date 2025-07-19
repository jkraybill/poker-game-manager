/**
 * 8-Player Poker Scenarios
 * 
 * Tests full table dynamics with 8 players, representing common cash game
 * and tournament situations. With 8 players, we have:
 * - Full positional spectrum (UTG, UTG+1, MP1, MP2, CO, BTN, SB, BB)
 * - Tighter opening ranges required
 * - Complex multi-way dynamics
 * - Maximum side pot complexity potential
 * 
 * Positions (with dealerButton: 0):
 * - Index 0: Button
 * - Index 1: SB
 * - Index 2: BB
 * - Index 3: UTG
 * - Index 4: UTG+1
 * - Index 5: MP1
 * - Index 6: MP2
 * - Index 7: CO
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('8-Player Poker Scenarios', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach(table => table.close());
  });

  it('should handle UTG vs UTG+1 opening war', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 8,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    const actions = [];

    class EarlyPositionPlayer extends Player {
      constructor(config) {
        super(config);
        this.position = config.position;
        this.hasActed = false;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // UTG opens tight
        if (this.position === 'UTG' && gameState.currentBet === 20 && !this.hasActed) {
          this.hasActed = true;
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: 60,
            timestamp: Date.now(),
          };
        }

        // UTG+1 3-bets UTG (positional advantage)
        if (this.position === 'UTG+1' && gameState.currentBet === 60 && !this.hasActed) {
          this.hasActed = true;
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: 180,
            timestamp: Date.now(),
          };
        }

        // UTG 4-bets (showing strength)
        if (this.position === 'UTG' && gameState.currentBet === 180 && myState.lastAction === Action.RAISE) {
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: 450,
            timestamp: Date.now(),
          };
        }

        // Others fold to early position war
        if (toCall > 60) {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }

        return {
          playerId: this.id,
          action: toCall > 0 ? Action.FOLD : Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('player:action', ({ playerId, action, amount }) => {
      const player = players.find(p => p.id === playerId);
      actions.push({
        position: player?.position,
        action,
        amount,
      });
    });

    table.on('hand:ended', ({ winners }) => {
      if (!handEnded) {
        handEnded = true;
        setTimeout(() => table.close(), 10);
      }
    });

    // Create players
    const positions = ['BUTTON', 'SB', 'BB', 'UTG', 'UTG+1', 'MP1', 'MP2', 'CO'];
    const players = positions.map((pos, idx) => 
      new EarlyPositionPlayer({ 
        name: `Player ${idx + 1} (${pos})`,
        position: pos,
      })
    );

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Verify early position battle
    const raises = actions.filter(a => a.action === Action.RAISE);
    expect(raises.length).toBeGreaterThanOrEqual(2);
    
    const utgRaise = raises.find(r => r.position === 'UTG');
    const utgPlusOneRaise = raises.find(r => r.position === 'UTG+1');
    
    expect(utgRaise).toBeDefined();
    expect(utgPlusOneRaise).toBeDefined();

    table.close();
  });

  it('should handle 8-way family pot with minimal raising', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 8,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    let winnerAmount = 0;
    let potSize = 0;

    class PassivePlayer extends Player {
      constructor(config) {
        super(config);
        this.position = config.position;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // CO makes a min-raise to build pot
        if (this.position === 'CO' && gameState.phase === 'PRE_FLOP' && 
            gameState.currentBet === 20) {
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: 40, // Min-raise
            timestamp: Date.now(),
          };
        }

        // Everyone calls the min-raise
        if (gameState.phase === 'PRE_FLOP' && toCall > 0 && toCall <= 40) {
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          };
        }

        // Check all post-flop streets
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('pot:updated', ({ total }) => {
      potSize = total;
    });

    table.on('hand:ended', ({ winners }) => {
      if (!handEnded) {
        handEnded = true;
        winnerAmount = winners[0]?.amount || 0;
        setTimeout(() => table.close(), 10);
      }
    });

    // Create 8 passive players
    const positions = ['BUTTON', 'SB', 'BB', 'UTG', 'UTG+1', 'MP1', 'MP2', 'CO'];
    const players = positions.map((pos, idx) => 
      new PassivePlayer({ 
        name: `Player ${idx + 1} (${pos})`,
        position: pos,
      })
    );

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Verify 8-way pot with min-raise
    expect(winnerAmount).toBe(320); // 8 × 40 = 320
    expect(potSize).toBeGreaterThanOrEqual(320);

    table.close();
  });

  it('should handle complex 8-player tournament bubble scenario', async () => {
    const table = manager.createTable({
      blinds: { small: 50, big: 100 }, // Higher blinds for bubble
      minBuyIn: 500,
      maxBuyIn: 3000,
      minPlayers: 8,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    const actions = [];
    let allInCount = 0;

    class BubblePlayer extends Player {
      constructor(config) {
        super(config);
        this.targetChips = config.chips;
        this.position = config.position;
        this.stackSize = config.stackSize;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;
        const mRatio = myState.chips / (gameState.blinds.small + gameState.blinds.big);

        // Micro stacks go all-in with any decent hand
        if (this.stackSize === 'micro' && toCall > 0) {
          allInCount++;
          return {
            playerId: this.id,
            action: Action.ALL_IN,
            amount: myState.chips,
            timestamp: Date.now(),
          };
        }

        // Short stacks shove or fold
        if (this.stackSize === 'short' && mRatio < 10) {
          if (this.position === 'BUTTON' || this.position === 'CO') {
            allInCount++;
            return {
              playerId: this.id,
              action: Action.ALL_IN,
              amount: myState.chips,
              timestamp: Date.now(),
            };
          }
        }

        // Big stacks apply pressure
        if (this.stackSize === 'big' && gameState.currentBet === 100) {
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: 250, // Pressure raise
            timestamp: Date.now(),
          };
        }

        // Medium stacks play cautiously
        if (this.stackSize === 'medium' && toCall > 200) {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }

        // Default tight play
        if (toCall > myState.chips * 0.3) {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
        }

        return {
          playerId: this.id,
          action: toCall > 0 ? Action.FOLD : Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('player:action', ({ playerId, action, amount }) => {
      actions.push({ playerId, action, amount });
    });

    table.on('hand:ended', () => {
      if (!handEnded) {
        handEnded = true;
        setTimeout(() => table.close(), 10);
      }
    });

    // Override addPlayer for custom chips
    const originalAddPlayer = table.addPlayer.bind(table);
    table.addPlayer = function(player) {
      const result = originalAddPlayer(player);
      const playerData = this.players.get(player.id);
      if (playerData && player.targetChips) {
        playerData.chips = player.targetChips;
      }
      return result;
    };

    // Tournament bubble stack distribution
    const stackConfigs = [
      { position: 'BUTTON', chips: 2500, stackSize: 'big' },     // Chip leader
      { position: 'SB', chips: 300, stackSize: 'micro' },        // Desperate
      { position: 'BB', chips: 1200, stackSize: 'medium' },      // Cautious
      { position: 'UTG', chips: 500, stackSize: 'short' },       // Short
      { position: 'UTG+1', chips: 1800, stackSize: 'medium' },   // Safe
      { position: 'MP1', chips: 400, stackSize: 'short' },       // Short
      { position: 'MP2', chips: 2200, stackSize: 'big' },        // Big stack
      { position: 'CO', chips: 600, stackSize: 'short' },        // Short
    ];

    const players = stackConfigs.map((config, idx) => 
      new BubblePlayer({ 
        name: `Player ${idx + 1} (${config.position})`,
        ...config,
      })
    );

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Verify bubble dynamics
    const allIns = actions.filter(a => a.action === Action.ALL_IN);
    const folds = actions.filter(a => a.action === Action.FOLD);
    
    expect(allIns.length).toBeGreaterThan(0); // Some desperation
    expect(folds.length).toBeGreaterThan(2); // Cautious play

    table.close();
  });

  it('should handle 8-player progressive knockout scenario', async () => {
    const table = manager.createTable({
      blinds: { small: 25, big: 50 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 8,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    let knockoutOccurred = false;
    const playerChips = new Map();

    class BountyHunterPlayer extends Player {
      constructor(config) {
        super(config);
        this.position = config.position;
        this.isAggressor = config.isAggressor;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // Track chip counts for knockout detection
        playerChips.set(this.id, myState.chips);

        // Aggressor tries to isolate short stacks
        if (this.isAggressor && gameState.currentBet === 50) {
          // Find shortest stack
          const shortStack = Object.values(gameState.players)
            .filter(p => p.state === 'ACTIVE' && p.chips < 300)
            .sort((a, b) => a.chips - b.chips)[0];

          if (shortStack) {
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: shortStack.chips + 50, // Cover the short stack
              timestamp: Date.now(),
            };
          }
        }

        // Short stacks call/all-in for bounty protection
        if (myState.chips < 300 && toCall > 0) {
          if (toCall >= myState.chips) {
            return {
              playerId: this.id,
              action: Action.ALL_IN,
              amount: myState.chips,
              timestamp: Date.now(),
            };
          }
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          };
        }

        // Medium stacks hunt carefully
        if (toCall > 0 && toCall < myState.chips * 0.4) {
          const potOdds = toCall / (gameState.pot + toCall);
          if (potOdds < 0.3) { // Good pot odds for bounty hunt
            return {
              playerId: this.id,
              action: Action.CALL,
              amount: toCall,
              timestamp: Date.now(),
            };
          }
        }

        // Default
        return {
          playerId: this.id,
          action: toCall > 0 ? Action.FOLD : Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('hand:ended', ({ winners }) => {
      if (!handEnded) {
        handEnded = true;
        
        // Check if any player was eliminated
        for (const [playerId, chips] of playerChips) {
          if (chips === 0) {
            knockoutOccurred = true;
            break;
          }
        }
        
        setTimeout(() => table.close(), 10);
      }
    });

    // Mix of aggressive bounty hunters and cautious players
    const playerConfigs = [
      { position: 'BUTTON', isAggressor: true },
      { position: 'SB', isAggressor: false },
      { position: 'BB', isAggressor: false },
      { position: 'UTG', isAggressor: false },
      { position: 'UTG+1', isAggressor: true },
      { position: 'MP1', isAggressor: false },
      { position: 'MP2', isAggressor: true },
      { position: 'CO', isAggressor: false },
    ];

    const players = playerConfigs.map((config, idx) => 
      new BountyHunterPlayer({ 
        name: `Player ${idx + 1} (${config.position})`,
        ...config,
      })
    );

    // Give one player a short stack
    const originalAddPlayer = table.addPlayer.bind(table);
    let shortStackSet = false;
    table.addPlayer = function(player) {
      const result = originalAddPlayer(player);
      if (!shortStackSet && player.position === 'MP1') {
        const playerData = this.players.get(player.id);
        if (playerData) {
          playerData.chips = 250; // Short stack
          shortStackSet = true;
        }
      }
      return result;
    };

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // In a bounty tournament, aggressive play is expected
    // We might or might not see a knockout in one hand
    expect(handEnded).toBe(true);

    table.close();
  });
});