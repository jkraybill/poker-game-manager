import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PokerGameManager } from '../PokerGameManager.js'
import { Player, Action } from '../index.js'

// Simple test player that folds/checks
class TestPlayer extends Player {
  getAction(gameState) {
    const myState = gameState.players[this.id]
    const toCall = gameState.currentBet - myState.bet

    // Always fold to bets, check when possible
    if (toCall > 0) {
      return {
        playerId: this.id,
        action: Action.FOLD,
        timestamp: Date.now(),
      }
    }

    return {
      playerId: this.id,
      action: Action.CHECK,
      timestamp: Date.now(),
    }
  }
}

describe('Dealer Button Rotation (Issue #36)', () => {
  let manager
  let table
  let players

  beforeEach(() => {
    manager = new PokerGameManager()
  })

  afterEach(() => {
    if (table) {
      table.close()
    }
  })

  it('should rotate dealer button clockwise after each hand', async () => {
    // Create table with explicit initial button position
    table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 3,
      dealerButton: 0,
    })

    // Create 3 players
    players = [
      new TestPlayer({ id: 'p1', name: 'Player 1' }),
      new TestPlayer({ id: 'p2', name: 'Player 2' }),
      new TestPlayer({ id: 'p3', name: 'Player 3' }),
    ]

    // Track button positions
    const buttonPositions = []

    table.on('hand:started', (data) => {
      buttonPositions.push(data.dealerButton)
    })

    // Add players
    players.forEach((p) => table.addPlayer(p))

    // Play 5 hands to verify rotation
    for (let i = 0; i < 5; i++) {
      const handEndPromise = new Promise((resolve) => {
        const handler = () => {
          table.off('hand:ended', handler)
          resolve()
        }
        table.on('hand:ended', handler)
      })

      table.tryStartGame()
      await handEndPromise
    }

    // Verify button rotated correctly
    expect(buttonPositions).toEqual([0, 1, 2, 0, 1])

    // Verify button wraps around correctly
    expect(buttonPositions[3]).toBe(0) // After position 2, goes back to 0
  })

  it('should skip eliminated players when rotating button', async () => {
    // Create table
    table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 100,
      maxBuyIn: 100,
      minPlayers: 3,
      dealerButton: 0,
    })

    // Create players with different chip amounts
    const shortStack = new TestPlayer({ id: 'short', name: 'Short Stack' })
    const mediumStack = new TestPlayer({ id: 'medium', name: 'Medium Stack' })
    const bigStack = new TestPlayer({ id: 'big', name: 'Big Stack' })

    // Override initial chips
    shortStack.chips = 30 // Will be eliminated quickly
    mediumStack.chips = 200
    bigStack.chips = 500

    players = [shortStack, mediumStack, bigStack]

    // Track button positions and eliminations
    const buttonPositions = []
    const eliminations = []

    table.on('hand:started', (data) => {
      buttonPositions.push({
        position: data.dealerButton,
        playerCount: data.players.length,
      })
    })

    table.on('player:eliminated', (data) => {
      eliminations.push(data.playerId)
    })

    // Add players
    players.forEach((p) => table.addPlayer(p))

    // Play hands until someone is eliminated
    let handsPlayed = 0
    while (eliminations.length === 0 && handsPlayed < 10) {
      const handEndPromise = new Promise((resolve) => {
        const handler = () => {
          table.off('hand:ended', handler)
          resolve()
        }
        table.on('hand:ended', handler)
      })

      table.tryStartGame()
      await handEndPromise
      handsPlayed++
    }

    // The button should have rotated even with eliminations
    expect(buttonPositions.length).toBeGreaterThanOrEqual(2)

    // Button positions should change between hands
    if (buttonPositions.length >= 2) {
      const uniquePositions = new Set(buttonPositions.map((bp) => bp.position))
      expect(uniquePositions.size).toBeGreaterThan(1)
    }
  })

  it('should handle heads-up button rules correctly', async () => {
    // Create table for heads-up play
    table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
      maxPlayers: 2,
      dealerButton: 0,
    })

    // Create 2 players
    players = [
      new TestPlayer({ id: 'p1', name: 'Player 1' }),
      new TestPlayer({ id: 'p2', name: 'Player 2' }),
    ]

    // Track button and blind positions
    const gameStates = []

    table.on('hand:started', (data) => {
      // In heads-up, button should be small blind
      gameStates.push({
        button: data.dealerButton,
        players: data.players.length,
        isHeadsUp: data.players.length === 2,
      })
    })

    // Add players
    players.forEach((p) => table.addPlayer(p))

    // Play 3 hands
    for (let i = 0; i < 3; i++) {
      const handEndPromise = new Promise((resolve) => {
        const handler = () => {
          table.off('hand:ended', handler)
          resolve()
        }
        table.on('hand:ended', handler)
      })

      table.tryStartGame()
      await handEndPromise
    }

    // Verify button rotated in heads-up
    expect(gameStates.length).toBe(3)
    expect(gameStates[0].button).toBe(0)
    expect(gameStates[1].button).toBe(1)
    expect(gameStates[2].button).toBe(0) // Wraps around
  })

  it('should maintain correct button position when players join between hands', async () => {
    // Create table
    table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
      dealerButton: 0,
    })

    // Start with 2 players
    const player1 = new TestPlayer({ id: 'p1', name: 'Player 1' })
    const player2 = new TestPlayer({ id: 'p2', name: 'Player 2' })

    table.addPlayer(player1)
    table.addPlayer(player2)

    // Track button positions
    const buttonPositions = []
    table.on('hand:started', (data) => {
      buttonPositions.push({
        button: data.dealerButton,
        playerCount: data.players.length,
      })
    })

    // Play first hand
    let handEndPromise = new Promise((resolve) => {
      const handler = () => {
        table.off('hand:ended', handler)
        resolve()
      }
      table.on('hand:ended', handler)
    })

    table.tryStartGame()
    await handEndPromise

    // Add third player between hands
    const player3 = new TestPlayer({ id: 'p3', name: 'Player 3' })
    table.addPlayer(player3)

    // Play second hand
    handEndPromise = new Promise((resolve) => {
      const handler = () => {
        table.off('hand:ended', handler)
        resolve()
      }
      table.on('hand:ended', handler)
    })

    table.tryStartGame()
    await handEndPromise

    // Button should still rotate even with new player
    expect(buttonPositions.length).toBe(2)
    expect(buttonPositions[0].button).toBe(0)
    expect(buttonPositions[1].button).toBe(1) // Button moved to next position
    expect(buttonPositions[1].playerCount).toBe(3) // Now 3 players
  })
})
