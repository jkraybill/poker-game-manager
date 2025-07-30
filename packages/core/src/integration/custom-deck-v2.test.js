/**
 * Custom Deck Tests (Using Test Utilities)
 *
 * Tests that the custom deck functionality works correctly, ensuring
 * cards are dealt in the expected order to players and community cards.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createTestTable,
  createHeadsUpTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  Action,
  cleanupTables,
} from '../test-utils/index.js'

describe('Custom Deck Tests (v2)', () => {
  let manager
  let table
  let events

  beforeEach(() => {
    // Initialize but don't create yet
    manager = null
    table = null
    events = null
  })

  afterEach(() => {
    // Clean up if created
    if (manager) {
      cleanupTables(manager)
    }
  })

  it('should deal cards in correct order from custom deck', async () => {
    // Create 4-player table
    const result = createTestTable('standard', {
      minPlayers: 4,
      dealerButton: 0,
    })
    manager = result.manager
    table = result.table

    const playerHands = new Map()
    let communityCards = []

    // Set up custom deck following real poker dealing order
    // deck.draw() uses shift() (takes from beginning)
    // Deal order: 1 card to each player, then 1 more to each player
    // Then burn + flop, burn + turn, burn + river
    const customDeck = [
      // First card to each player
      {
        rank: 'A',
        suit: 's',
        toString() {
          return 'As'
        },
      }, // P1 first card
      {
        rank: 'K',
        suit: 's',
        toString() {
          return 'Ks'
        },
      }, // P2 first card
      {
        rank: 'Q',
        suit: 's',
        toString() {
          return 'Qs'
        },
      }, // P3 first card
      {
        rank: '2',
        suit: 'c',
        toString() {
          return '2c'
        },
      }, // P4 first card
      // Second card to each player
      {
        rank: 'A',
        suit: 'h',
        toString() {
          return 'Ah'
        },
      }, // P1 second card
      {
        rank: 'K',
        suit: 'h',
        toString() {
          return 'Kh'
        },
      }, // P2 second card
      {
        rank: 'Q',
        suit: 'h',
        toString() {
          return 'Qh'
        },
      }, // P3 second card
      {
        rank: '3',
        suit: 'c',
        toString() {
          return '3c'
        },
      }, // P4 second card
      // Burn card before flop
      {
        rank: '8',
        suit: 'd',
        toString() {
          return '8d'
        },
      }, // Burn
      // Flop (3 cards)
      {
        rank: '4',
        suit: 'c',
        toString() {
          return '4c'
        },
      }, // Flop card 1
      {
        rank: '5',
        suit: 'c',
        toString() {
          return '5c'
        },
      }, // Flop card 2
      {
        rank: '6',
        suit: 'c',
        toString() {
          return '6c'
        },
      }, // Flop card 3
      // Burn card before turn
      {
        rank: '8',
        suit: 'h',
        toString() {
          return '8h'
        },
      }, // Burn
      // Turn
      {
        rank: '7',
        suit: 'c',
        toString() {
          return '7c'
        },
      }, // Turn
      // Burn card before river
      {
        rank: '8',
        suit: 's',
        toString() {
          return '8s'
        },
      }, // Burn
      // River
      {
        rank: '9',
        suit: 'c',
        toString() {
          return '9c'
        },
      }, // River
    ]

    table.setCustomDeck(customDeck)

    // Track community cards
    table.on('cards:community', ({ cards }) => {
      communityCards = cards
    })

    // Set up event capture
    events = setupEventCapture(table)

    // Simple check/call strategy
    const simpleStrategy = ({ toCall, myState }) => {
      // Simple strategy: check if possible, call if needed
      if (toCall === 0) {
        return { action: Action.CHECK }
      }

      if (toCall > 0 && toCall <= myState.chips) {
        return { action: Action.CALL, amount: toCall }
      }

      return { action: Action.FOLD }
    }

    // Create 4 players with tracking for their cards
    const players = []
    for (let i = 1; i <= 4; i++) {
      const player = new StrategicPlayer({
        name: `Player ${i}`,
        strategy: simpleStrategy,
      })
      player.seatNumber = i

      // Override receivePrivateCards to track hands
      const originalReceivePrivateCards =
        player.receivePrivateCards.bind(player)
      player.receivePrivateCards = function (cards) {
        playerHands.set(this.seatNumber, cards)
        return originalReceivePrivateCards(cards)
      }

      players.push(player)
    }

    players.forEach((p) => table.addPlayer(p))
    table.tryStartGame()

    // Wait for game to complete
    await waitForHandEnd(events)

    // Verify hole cards were dealt correctly
    const p1Cards = playerHands.get(1)
    expect(p1Cards).toBeDefined()
    expect(p1Cards[0].toString()).toBe('As')
    expect(p1Cards[1].toString()).toBe('Ah')

    const p2Cards = playerHands.get(2)
    expect(p2Cards).toBeDefined()
    expect(p2Cards[0].toString()).toBe('Ks')
    expect(p2Cards[1].toString()).toBe('Kh')

    const p3Cards = playerHands.get(3)
    expect(p3Cards).toBeDefined()
    expect(p3Cards[0].toString()).toBe('Qs')
    expect(p3Cards[1].toString()).toBe('Qh')

    const p4Cards = playerHands.get(4)
    expect(p4Cards).toBeDefined()
    expect(p4Cards[0].toString()).toBe('2c')
    expect(p4Cards[1].toString()).toBe('3c')

    // Verify community cards
    expect(communityCards).toHaveLength(5)
    expect(communityCards[0].toString()).toBe('4c')
    expect(communityCards[1].toString()).toBe('5c')
    expect(communityCards[2].toString()).toBe('6c')
    expect(communityCards[3].toString()).toBe('7c')
    expect(communityCards[4].toString()).toBe('9c')

    // Verify winner
    const { winners } = events
    expect(winners.length).toBeGreaterThan(0)
    const winner = winners[0]
    // Player 4 should win with a straight flush (2-3-4-5-6 of clubs)
    expect(winner.playerId).toBe(players[3].id) // Player 4 is at index 3
    expect(winner.hand.rank).toBe(9) // Straight flush rank
    expect(winner.hand.description).toContain('Straight Flush')
  })

  it('should handle custom deck with exact card count', async () => {
    // Create heads-up table
    const result = createHeadsUpTable({
      dealerButton: 0,
    })
    manager = result.manager
    table = result.table

    // Minimal deck with just enough cards for 2 players
    const customDeck = [
      // First card to each player
      {
        rank: 'A',
        suit: 's',
        toString() {
          return 'As'
        },
      },
      {
        rank: 'K',
        suit: 's',
        toString() {
          return 'Ks'
        },
      },
      // Second card to each player
      {
        rank: 'A',
        suit: 'h',
        toString() {
          return 'Ah'
        },
      },
      {
        rank: 'K',
        suit: 'h',
        toString() {
          return 'Kh'
        },
      },
      // Burn + Flop
      {
        rank: '2',
        suit: 'd',
        toString() {
          return '2d'
        },
      }, // Burn
      {
        rank: 'Q',
        suit: 'c',
        toString() {
          return 'Qc'
        },
      },
      {
        rank: 'J',
        suit: 'c',
        toString() {
          return 'Jc'
        },
      },
      {
        rank: 'T',
        suit: 'c',
        toString() {
          return 'Tc'
        },
      },
      // Burn + Turn
      {
        rank: '3',
        suit: 'd',
        toString() {
          return '3d'
        },
      }, // Burn
      {
        rank: '9',
        suit: 'c',
        toString() {
          return '9c'
        },
      },
      // Burn + River
      {
        rank: '4',
        suit: 'd',
        toString() {
          return '4d'
        },
      }, // Burn
      {
        rank: '8',
        suit: 'c',
        toString() {
          return '8c'
        },
      },
    ]

    table.setCustomDeck(customDeck)

    // Set up event capture
    events = setupEventCapture(table)

    // Track errors
    let gameError = null
    table.on('game:error', (error) => {
      gameError = error
      console.error('Game error:', error)
    })

    // Simple check/call strategy
    const simpleStrategy = ({ player, gameState, myState, toCall }) => {
      console.log(
        `SimplePlayer ${player.name} getAction called, phase: ${gameState.phase}, currentBet: ${gameState.currentBet}`
      )
      console.log(`My state - bet: ${myState.bet}, chips: ${myState.chips}`)

      if (toCall === 0) {
        console.log(`${player.name} checking`)
        return { action: Action.CHECK }
      }

      if (toCall > 0 && toCall <= myState.chips) {
        console.log(`${player.name} calling ${toCall}`)
        return { action: Action.CALL, amount: toCall }
      }

      console.log(`${player.name} folding`)
      return { action: Action.FOLD }
    }

    const player1 = new StrategicPlayer({
      name: 'Player 1',
      strategy: simpleStrategy,
    })

    const player2 = new StrategicPlayer({
      name: 'Player 2',
      strategy: simpleStrategy,
    })

    console.log('Custom deck length:', customDeck.length)
    table.addPlayer(player1)
    table.addPlayer(player2)
    console.log('Starting game...')
    table.tryStartGame()

    // Wait for game to complete
    await waitForHandEnd(events)

    // Test passes if game completes without error
    expect(events.handEnded).toBe(true)
    expect(gameError).toBeNull()
  })
})
