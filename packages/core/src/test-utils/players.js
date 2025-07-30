/**
 * WSOP-Level Test Player Implementations
 *
 * Professional-grade player strategies for comprehensive poker testing.
 * Supports position-aware play, complex betting patterns, and tournament dynamics.
 */

import { Player } from '../Player.js'
import { Action } from '../types/index.js'

/**
 * Base class for strategic test players with position awareness
 */
export class StrategicPlayer extends Player {
  constructor(config) {
    super(config)
    this.position = null
    this.strategy = config.strategy || (() => this.defaultStrategy())
    this.hasActed = false
    this.actionCount = 0
    this.style = config.style || 'balanced'
    this.debug = config.debug || false
  }

  getAction(gameState) {
    const myState = gameState.players[this.id]
    const toCall = gameState.currentBet - myState.bet

    // Debug logging available but disabled for tests
    // if (this.debug) {
    //   console.log(`[${this.name}] Position: ${this.position}, Chips: ${myState.chips}, To Call: ${toCall}, Phase: ${gameState.phase}`);
    // }

    // Always include required fields
    const baseAction = {
      playerId: this.id,
      timestamp: Date.now(),
    }

    // Execute strategy
    const strategicAction = this.strategy({
      player: this,
      gameState,
      myState,
      toCall,
      position: this.position,
      actionCount: this.actionCount++,
    })

    return { ...baseAction, ...strategicAction }
  }

  defaultStrategy() {
    return {
      action: Action.CHECK,
    }
  }
}

/**
 * Pre-built player strategies for common test scenarios
 */
export const STRATEGIES = {
  // Basic strategies
  alwaysFold: () => ({ action: Action.FOLD }),
  alwaysCheck: () => ({ action: Action.CHECK }),
  alwaysCall: ({ toCall }) =>
    toCall > 0
      ? { action: Action.CALL, amount: toCall }
      : { action: Action.CHECK },

  // Position-based strategies
  buttonSteal: ({ position, gameState, toCall }) => {
    if (position === 'button' && gameState.currentBet <= gameState.blinds.big) {
      return { action: Action.RAISE, amount: gameState.blinds.big * 3 }
    }
    if (toCall > 0) {
      return { action: Action.FOLD }
    }
    return { action: Action.CHECK }
  },

  blindDefense: ({ position, gameState, toCall }) => {
    const isBigBlind = position === 'bb'
    const isSmallBlind = position === 'sb'
    const potOdds = toCall / (gameState.pot + toCall)

    if (isBigBlind && toCall <= gameState.blinds.big * 2 && potOdds < 0.33) {
      return { action: Action.CALL, amount: toCall }
    }
    if (isSmallBlind && toCall <= gameState.blinds.big && potOdds < 0.25) {
      return { action: Action.CALL, amount: toCall }
    }
    if (toCall > 0) {
      return { action: Action.FOLD }
    }
    return { action: Action.CHECK }
  },

  // Aggressive strategies
  threeBet: ({ gameState, myState, toCall }) => {
    const hasRaiser = Object.values(gameState.players).some(
      (p) => p.lastAction === Action.RAISE
    )

    if (hasRaiser && !myState.hasActed && toCall > 0) {
      return { action: Action.RAISE, amount: toCall * 3 }
    }
    if (toCall > 0) {
      return { action: Action.CALL, amount: toCall }
    }
    return { action: Action.CHECK }
  },

  squeezePlay: ({ position, gameState, toCall }) => {
    const players = Object.values(gameState.players)
    const hasRaiser = players.some((p) => p.lastAction === Action.RAISE)
    const hasCaller = players.some((p) => p.lastAction === Action.CALL)

    if (hasRaiser && hasCaller && ['sb', 'bb'].includes(position)) {
      return { action: Action.RAISE, amount: gameState.currentBet * 4 }
    }
    if (toCall > 0) {
      return { action: Action.FOLD }
    }
    return { action: Action.CHECK }
  },

  // All-in strategies
  pushOrFold: ({ myState, toCall }) => {
    if (myState.chips <= myState.bet * 10) {
      return { action: Action.ALL_IN, amount: myState.chips }
    }
    if (toCall > 0) {
      return { action: Action.FOLD }
    }
    return { action: Action.CHECK }
  },

  shortStackShove: ({ myState, gameState }) => {
    const bigBlind = gameState.blinds.big
    if (myState.chips <= bigBlind * 15) {
      return { action: Action.ALL_IN, amount: myState.chips }
    }
    if (gameState.currentBet > 0) {
      return { action: Action.FOLD }
    }
    return { action: Action.CHECK }
  },

  // Tournament-specific strategies
  bubblePlay: ({ myState, gameState, toCall }) => {
    // Ultra-tight on the bubble
    const stackSizeInBB = myState.chips / gameState.blinds.big

    if (stackSizeInBB < 10 && toCall === 0) {
      return { action: Action.ALL_IN, amount: myState.chips }
    }
    if (toCall > gameState.blinds.big * 2) {
      return { action: Action.FOLD }
    }
    if (toCall > 0) {
      return { action: Action.CALL, amount: toCall }
    }
    return { action: Action.CHECK }
  },

  // Complex multi-street strategies
  floatAndBluff: ({ gameState, myState, player }) => {
    // Call flop, bet turn if checked to
    if (gameState.phase === 'flop' && gameState.currentBet > 0) {
      return { action: Action.CALL, amount: gameState.currentBet - myState.bet }
    }
    if (
      gameState.phase === 'turn' &&
      gameState.currentBet === 0 &&
      !player.hasBetTurn
    ) {
      player.hasBetTurn = true
      return { action: Action.BET, amount: gameState.pot * 0.75 }
    }
    if (gameState.currentBet > 0) {
      return { action: Action.FOLD }
    }
    return { action: Action.CHECK }
  },

  // GTO-inspired mixed strategies
  mixedStrategy: ({ gameState, toCall }) => {
    const random = Math.random()

    if (toCall > 0) {
      if (random < 0.7) {
        return { action: Action.CALL, amount: toCall }
      }
      if (random < 0.9) {
        return { action: Action.RAISE, amount: toCall * 2.5 }
      }
      return { action: Action.FOLD }
    }

    if (random < 0.75) {
      return { action: Action.CHECK }
    }
    return { action: Action.BET, amount: gameState.pot * 0.66 }
  },
}

/**
 * Pre-configured player archetypes for quick test setup
 */
export const PLAYER_TYPES = {
  nit: (name) =>
    new StrategicPlayer({
      name,
      strategy: ({ toCall }) =>
        toCall > 0 ? { action: Action.FOLD } : { action: Action.CHECK },
      style: 'tight-passive',
    }),

  maniac: (name) =>
    new StrategicPlayer({
      name,
      strategy: ({ myState, gameState }) => ({
        action: Action.RAISE,
        amount: Math.min(gameState.pot * 2, myState.chips),
      }),
      style: 'loose-aggressive',
    }),

  tag: (name) =>
    new StrategicPlayer({
      name,
      strategy: STRATEGIES.buttonSteal,
      style: 'tight-aggressive',
    }),

  lag: (name) =>
    new StrategicPlayer({
      name,
      strategy: STRATEGIES.threeBet,
      style: 'loose-aggressive',
    }),

  rock: (name) =>
    new StrategicPlayer({
      name,
      strategy: ({ toCall, gameState }) => {
        if (toCall > gameState.blinds.big * 4) {
          return { action: Action.FOLD }
        }
        if (toCall > 0) {
          return { action: Action.CALL, amount: toCall }
        }
        return { action: Action.CHECK }
      },
      style: 'tight-passive',
    }),

  station: (name) =>
    new StrategicPlayer({
      name,
      strategy: STRATEGIES.alwaysCall,
      style: 'loose-passive',
    }),
}

/**
 * Position assignment helper
 */
export function assignPositions(players, dealerButton, tableSize) {
  const positions = getPositionNames(tableSize)

  players.forEach((player, index) => {
    const positionIndex = (index - dealerButton + tableSize) % tableSize
    if (player.position !== undefined) {
      player.position = positions[positionIndex]
    }
  })
}

/**
 * Get position names based on table size
 */
function getPositionNames(tableSize) {
  switch (tableSize) {
    case 2:
      return ['button/sb', 'bb']
    case 3:
      return ['button', 'sb', 'bb']
    case 4:
      return ['button', 'sb', 'bb', 'utg']
    case 5:
      return ['button', 'sb', 'bb', 'utg', 'mp']
    case 6:
      return ['button', 'sb', 'bb', 'utg', 'mp', 'co']
    case 7:
      return ['button', 'sb', 'bb', 'utg', 'utg+1', 'mp', 'co']
    case 8:
      return ['button', 'sb', 'bb', 'utg', 'utg+1', 'mp', 'mp+1', 'co']
    case 9:
      return ['button', 'sb', 'bb', 'utg', 'utg+1', 'utg+2', 'mp', 'mp+1', 'co']
    default:
      throw new Error(`Unsupported table size: ${tableSize}`)
  }
}

/**
 * Create a player with custom behavior for specific game phases
 */
export class PhaseAwarePlayer extends StrategicPlayer {
  constructor(config) {
    super(config)
    this.phaseStrategies = config.phaseStrategies || {}
  }

  getAction(gameState) {
    const phase = gameState.phase
    if (this.phaseStrategies[phase]) {
      this.strategy = this.phaseStrategies[phase]
    }
    return super.getAction(gameState)
  }
}

/**
 * Create players that respond to specific game conditions
 */
export class ConditionalPlayer extends StrategicPlayer {
  constructor(config) {
    super(config)
    this.conditions = config.conditions || []
  }

  getAction(gameState) {
    // Check conditions in order
    for (const condition of this.conditions) {
      if (condition.when(gameState, this)) {
        this.strategy = condition.then
        break
      }
    }
    return super.getAction(gameState)
  }
}

/**
 * Tournament-specific player with ICM awareness
 */
export class TournamentPlayer extends StrategicPlayer {
  constructor(config) {
    super(config)
    this.tournamentStage = config.tournamentStage || 'early'
    this.playersRemaining = config.playersRemaining || 100
    this.avgStack = config.avgStack || 10000
  }

  getAction(gameState) {
    const myState = gameState.players[this.id]
    const stackRatio = myState.chips / this.avgStack

    // Adjust strategy based on tournament dynamics
    if (this.tournamentStage === 'bubble' && stackRatio < 1) {
      this.strategy = STRATEGIES.bubblePlay
    } else if (stackRatio < 0.5) {
      this.strategy = STRATEGIES.pushOrFold
    }

    return super.getAction(gameState)
  }
}
