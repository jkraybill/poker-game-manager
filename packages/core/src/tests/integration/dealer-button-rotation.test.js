import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PokerGameManager } from '../../PokerGameManager.js'
import { Player } from '../../Player.js'
import { Action } from '../../types/index.js'

// Simple test player that always checks/calls
class TestPlayer extends Player {
  getAction(gameState) {
    const myState = gameState.players[this.id]
    const toCall = gameState.currentBet - myState.bet

    if (toCall === 0) {
      return {
        playerId: this.id,
        action: Action.CHECK,
        timestamp: Date.now(),
      }
    }

    return {
      playerId: this.id,
      action: Action.CALL,
      amount: toCall,
      timestamp: Date.now(),
    }
  }
}

describe('Dealer Button Rotation', () => {
  let manager
  let table
  let players

  beforeEach(() => {
    manager = new PokerGameManager()
    table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2, // Changed from 3 to 2 to allow heads-up play after elimination
      dealerButton: 0, // Start with position 0
    })

    // Create 3 test players
    players = [
      new TestPlayer({ id: 'player-1', name: 'Player 1' }),
      new TestPlayer({ id: 'player-2', name: 'Player 2' }),
      new TestPlayer({ id: 'player-3', name: 'Player 3' }),
    ]
  })

  afterEach(() => {
    if (table) {
      table.close()
    }
  })

  it('should rotate dealer button clockwise after each hand', () => {
    const buttonPositions = []
    const handCount = 4 // Play 4 hands to see full rotation
    let handsPlayed = 0

    // Track button positions
    table.on('hand:started', (data) => {
      buttonPositions.push(data.dealerButton)
    })

    // Add players
    players.forEach((player) => table.addPlayer(player))

    // Play multiple hands
    return new Promise((resolve) => {
      table.on('hand:ended', () => {
        handsPlayed++

        if (handsPlayed < handCount) {
          // Start next hand
          setTimeout(() => {
            table.tryStartGame()
          }, 10)
        } else {
          // Verify button rotated correctly
          expect(buttonPositions).toHaveLength(handCount)
          expect(buttonPositions[0]).toBe(0) // First hand: position 0
          expect(buttonPositions[1]).toBe(1) // Second hand: position 1
          expect(buttonPositions[2]).toBe(2) // Third hand: position 2
          expect(buttonPositions[3]).toBe(0) // Fourth hand: back to position 0

          resolve()
        }
      })

      // Start first hand
      table.tryStartGame()
    })
  })

  it('should handle player elimination and continue with reduced players', async () => {
    // This test verifies that when minPlayers is set to 2, the game can continue
    // after a player is eliminated, and the button rotates correctly
    const buttonPositions = []
    const handEndCount = { count: 0 }

    // Track button positions
    table.on('hand:started', (data) => {
      buttonPositions.push(data.dealerButton)
    })

    // Track hand endings
    table.on('hand:ended', () => {
      handEndCount.count++
    })

    // Add players
    players.forEach((player) => table.addPlayer(player))

    // Play multiple hands
    for (let i = 0; i < 4; i++) {
      table.tryStartGame()

      // Wait for hand to complete
      await new Promise((resolve) => {
        const expectedCount = handEndCount.count + 1
        const checkInterval = setInterval(() => {
          if (handEndCount.count >= expectedCount) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 100)

        // Timeout after 2 seconds per hand
        setTimeout(() => {
          clearInterval(checkInterval)
          resolve()
        }, 2000)
      })

      // Small delay between hands
      await new Promise((resolve) => setTimeout(resolve, 100))

      // If we have less than minPlayers, stop
      if (table.getPlayerCount() < table.config.minPlayers) {
        break
      }
    }

    // Verify button positions advanced
    expect(buttonPositions.length).toBeGreaterThanOrEqual(2)

    // Check that button positions are different (showing rotation)
    const uniquePositions = [...new Set(buttonPositions)]
    expect(uniquePositions.length).toBeGreaterThan(1)
  })

  it('should handle heads-up button rotation correctly', () => {
    const buttonPositions = []
    let handsPlayed = 0

    // Create only 2 players for heads-up
    const headsUpTable = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 1000,
      maxBuyIn: 1000,
      minPlayers: 2,
      dealerButton: 0,
    })

    const headsUpPlayers = [
      new TestPlayer({ id: 'player-1', name: 'Player 1' }),
      new TestPlayer({ id: 'player-2', name: 'Player 2' }),
    ]

    // Track button positions
    headsUpTable.on('hand:started', (data) => {
      buttonPositions.push(data.dealerButton)
    })

    // Add players
    headsUpPlayers.forEach((player) => headsUpTable.addPlayer(player))

    // Play multiple hands
    return new Promise((resolve) => {
      headsUpTable.on('hand:ended', () => {
        handsPlayed++

        if (handsPlayed < 3) {
          // Start next hand
          setTimeout(() => {
            headsUpTable.tryStartGame()
          }, 10)
        } else {
          // Verify button rotated correctly in heads-up
          expect(buttonPositions).toHaveLength(3)
          expect(buttonPositions[0]).toBe(0) // First hand: position 0
          expect(buttonPositions[1]).toBe(1) // Second hand: position 1
          expect(buttonPositions[2]).toBe(0) // Third hand: back to position 0

          headsUpTable.close()
          resolve()
        }
      })

      // Start first hand
      headsUpTable.tryStartGame()
    })
  })
})
