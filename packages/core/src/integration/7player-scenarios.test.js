/**
 * 7-Player Poker Scenarios
 * 
 * Tests poker dynamics with 7 players at the table, representing common
 * tournament situations after a few eliminations. With 7 players, we see:
 * - More complex positional dynamics than 6-handed
 * - Still not quite full ring, allowing for wider ranges
 * - Common online tournament table size
 * - Interesting dynamics with MP1 and MP2 positions
 * 
 * Positions (with dealerButton: 0):
 * - Index 0: Button
 * - Index 1: SB
 * - Index 2: BB
 * - Index 3: UTG
 * - Index 4: UTG+1 (MP1)
 * - Index 5: MP2
 * - Index 6: CO
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

describe('7-Player Poker Scenarios', () => {
  let manager;

  beforeEach(() => {
    manager = new PokerGameManager();
  });

  afterEach(() => {
    manager.tables.forEach(table => table.close());
  });

  it('should handle 7-way family pot limped to showdown', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 7,
      dealerButton: 0, // Deterministic positioning
    });

    let gameStarted = false;
    let handEnded = false;
    let winnerAmount = 0;
    let showdownReached = false;
    const actions = [];

    // Passive limping players
    class LimpingPlayer extends Player {
      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // Everyone limps preflop
        if (gameState.phase === 'PRE_FLOP' && toCall > 0 && toCall <= 20) {
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          };
        }

        // Check all streets
        return {
          playerId: this.id,
          action: Action.CHECK,
          timestamp: Date.now(),
        };
      }
    }

    // Event tracking
    table.on('game:started', () => {
      gameStarted = true;
    });

    table.on('player:action', ({ playerId, action, amount }) => {
      actions.push({ playerId, action, amount });
    });

    table.on('hand:ended', ({ winners }) => {
      if (!handEnded) {
        handEnded = true;
        winnerAmount = winners[0]?.amount || 0;
        showdownReached = winners[0]?.hand !== null && winners[0]?.hand !== undefined;
        setTimeout(() => table.close(), 10);
      }
    });

    // Create 7 passive players
    const players = Array.from({ length: 7 }, (_, i) => 
      new LimpingPlayer({ name: `Player ${i + 1}` }),
    );

    players.forEach(p => table.addPlayer(p));

    // Wait for game
    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Verify 7-way pot
    expect(winnerAmount).toBe(140); // 7 × 20 = 140
    expect(showdownReached).toBe(true);
    
    // Count limps (excluding BB check)
    const calls = actions.filter(a => a.action === Action.CALL);
    expect(calls.length).toBeGreaterThanOrEqual(5); // At least 5 limpers

    table.close();
  });

  it('should handle UTG vs MP1 vs CO 3-bet pot', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 7,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    const actions = [];

    // Position-aware aggressive players
    class PositionalPlayer extends Player {
      constructor(config) {
        super(config);
        this.position = config.position;
        this.hasRaised = false;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // UTG opens
        if (this.position === 'UTG' && gameState.currentBet === 20 && !this.hasRaised) {
          this.hasRaised = true;
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: 60,
            timestamp: Date.now(),
          };
        }

        // MP1 3-bets UTG
        if (this.position === 'MP1' && gameState.currentBet === 60 && !this.hasRaised) {
          this.hasRaised = true;
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: 180,
            timestamp: Date.now(),
          };
        }

        // CO cold 4-bets
        if (this.position === 'CO' && gameState.currentBet === 180 && !this.hasRaised) {
          this.hasRaised = true;
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: 450,
            timestamp: Date.now(),
          };
        }

        // Fold to big bets
        if (toCall > 100) {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
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

    table.on('player:action', ({ playerId, action, amount }) => {
      const player = players.find(p => p.id === playerId);
      actions.push({
        position: player?.position,
        action,
        amount,
      });
    });

    table.on('hand:ended', ({ winners: _winners }) => {
      if (!handEnded) {
        handEnded = true;
        setTimeout(() => table.close(), 10);
      }
    });

    // Create players with positions
    const positions = ['BUTTON', 'SB', 'BB', 'UTG', 'MP1', 'MP2', 'CO'];
    const players = positions.map((pos, idx) => 
      new PositionalPlayer({ 
        name: `Player ${idx + 1} (${pos})`,
        position: pos,
      }),
    );

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Verify action sequence
    const raises = actions.filter(a => a.action === Action.RAISE);
    expect(raises.length).toBe(3);
    expect(raises[0].position).toBe('UTG');
    expect(raises[1].position).toBe('MP1');
    expect(raises[2].position).toBe('CO');

    table.close();
  });

  it('should handle complex 7-player all-in festival with multiple side pots', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 100,
      maxBuyIn: 1000,
      minPlayers: 7,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    let sidePots = [];
    let totalPot = 0;
    const allActions = [];

    // Variable stack players
    class AllInPlayer extends Player {
      constructor(config) {
        super(config);
        this.targetChips = config.chips;
        this.position = config.position;
        this.hasActed = false;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;

        // Create an aggressive all-in festival
        // Small stacks shove immediately
        if (myState.chips <= 100 && toCall >= 0) {
          return {
            playerId: this.id,
            action: Action.ALL_IN,
            amount: myState.chips,
            timestamp: Date.now(),
          };
        }

        // Medium stacks (100-300) call any all-in
        if (myState.chips > 100 && myState.chips <= 300 && toCall > 0) {
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

        // Large stacks (300+) also get involved
        if (myState.chips > 300 && toCall > 0 && toCall <= 200) {
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          };
        }

        // Check if possible
        if (toCall === 0) {
          return {
            playerId: this.id,
            action: Action.CHECK,
            timestamp: Date.now(),
          };
        }

        return {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now(),
        };
      }
    }

    table.on('game:started', () => {
      gameStarted = true;
    });

    // Event tracking needs to be set up after players are created
    const setupEventTracking = () => {
      table.on('player:action', ({ playerId, action, amount }) => {
        const player = players.find(p => p.id === playerId);
        allActions.push({
          position: player?.position || 'unknown',
          action,
          amount,
        });
      });
    };

    table.on('hand:ended', () => {
      if (!handEnded) {
        handEnded = true;
        if (table.gameEngine?.potManager) {
          sidePots = table.gameEngine.potManager.pots;
          totalPot = sidePots.reduce((sum, pot) => sum + pot.amount, 0);
        }
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

    // Create 7 players with varying stacks
    const stackConfigs = [
      { position: 'BUTTON', chips: 1000 },  // Big stack aggressor
      { position: 'SB', chips: 50 },        // Micro stack
      { position: 'BB', chips: 120 },       // Short stack
      { position: 'UTG', chips: 200 },      // Medium-short
      { position: 'MP1', chips: 350 },      // Medium
      { position: 'MP2', chips: 150 },      // Short
      { position: 'CO', chips: 600 },       // Large stack
    ];

    const players = stackConfigs.map((config, idx) => 
      new AllInPlayer({ 
        name: `Player ${idx + 1} (${config.position})`,
        ...config,
      }),
    );

    // Set up event tracking now that players are created
    setupEventTracking();

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Debug logging
    console.log('=== 7-PLAYER ALL-IN FESTIVAL DEBUG ===');
    console.log('Actions taken:', allActions);
    console.log('Total actions:', allActions.length);
    console.log('All-ins:', allActions.filter(a => a.action === Action.ALL_IN).length);
    console.log('Side pots created:', sidePots.length);
    console.log('Side pots:', JSON.stringify(sidePots, null, 2));
    console.log('Total pot:', totalPot);
    
    // Check contributions
    if (sidePots.length > 0 && sidePots[0].contributions) {
      console.log('First pot contributions:');
      for (const [player, amount] of sidePots[0].contributions) {
        console.log(`  Player contributed: ${amount}`);
      }
    }
    console.log('Hand ended:', handEnded);
    console.log('Game engine exists:', !!table.gameEngine);
    console.log('Pot manager exists:', !!table.gameEngine?.potManager);
    
    // Check player states
    if (table.players) {
      console.log('Player chip counts:');
      table.players.forEach((player, id) => {
        console.log(`  ${player.name}: ${player.chips} chips`);
      });
    }
    
    expect(sidePots.length).toBeGreaterThanOrEqual(3); // Multiple side pots
    expect(totalPot).toBeGreaterThan(0);

    table.close();
  });

  it('should handle CO squeeze play after UTG raise and MP1 call', async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 7,
      dealerButton: 0,
    });

    let gameStarted = false;
    let handEnded = false;
    const actions = [];
    let squeezePlayed = false;

    class SqueezePlayer extends Player {
      constructor(config) {
        super(config);
        this.position = config.position;
        this.hasActed = false;
      }

      getAction(gameState) {
        const myState = gameState.players[this.id];
        const toCall = gameState.currentBet - myState.bet;
        const playerStates = Object.values(gameState.players);

        // UTG raises
        if (this.position === 'UTG' && gameState.currentBet === 20 && !this.hasActed) {
          this.hasActed = true;
          return {
            playerId: this.id,
            action: Action.RAISE,
            amount: 60,
            timestamp: Date.now(),
          };
        }

        // MP1 calls the raise
        if (this.position === 'MP1' && gameState.currentBet === 60 && !this.hasActed) {
          this.hasActed = true;
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          };
        }

        // CO executes squeeze play after seeing UTG raise and MP1 call
        if (this.position === 'CO' && !this.hasActed && gameState.currentBet > 20) {
          const raisers = playerStates.filter(p => p.lastAction === Action.RAISE);
          const callers = playerStates.filter(p => p.lastAction === Action.CALL);
          
          
          if (raisers.length === 1 && callers.length >= 1) {
            this.hasActed = true;
            squeezePlayed = true;
            return {
              playerId: this.id,
              action: Action.RAISE,
              amount: 220, // Large squeeze
              timestamp: Date.now(),
            };
          }
        }

        // Fold to squeeze
        if (toCall > 150) {
          return {
            playerId: this.id,
            action: Action.FOLD,
            timestamp: Date.now(),
          };
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

    table.on('player:action', ({ playerId, action, amount }) => {
      const player = players.find(p => p.id === playerId);
      actions.push({
        position: player?.position,
        action,
        amount,
      });
    });

    table.on('hand:ended', ({ winners: _winners }) => {
      if (!handEnded) {
        handEnded = true;
        setTimeout(() => table.close(), 10);
      }
    });

    // Create players
    const positions = ['BUTTON', 'SB', 'BB', 'UTG', 'MP1', 'MP2', 'CO'];
    const players = positions.map((pos, idx) => 
      new SqueezePlayer({ 
        name: `Player ${idx + 1} (${pos})`,
        position: pos,
      }),
    );

    players.forEach(p => table.addPlayer(p));

    await new Promise(resolve => setTimeout(resolve, 200));
    await vi.waitFor(() => gameStarted, { timeout: 2000 });
    await vi.waitFor(() => handEnded, { timeout: 5000 });

    // Verify squeeze sequence
    expect(squeezePlayed).toBe(true);
    
    const raises = actions.filter(a => a.action === Action.RAISE);
    expect(raises.length).toBeGreaterThanOrEqual(2); // UTG raise + CO squeeze
    
    const coRaise = raises.find(r => r.position === 'CO');
    expect(coRaise).toBeDefined();
    expect(coRaise.amount).toBeGreaterThan(180); // Large squeeze size

    table.close();
  });
});