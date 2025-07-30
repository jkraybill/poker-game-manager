import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PokerGameManager } from '../PokerGameManager.js'
import { Player } from '../Player.js'
import { Action } from '../types/index.js'

/**
 * Advanced tests for dead button scenarios with player eliminations
 */

class TestPlayer extends Player {
  constructor(config) {
    super(config)
    this.shouldFold = false
    this.postedBlinds = [] // Track when this player posts blinds
  }

  getAction(gameState) {
    const myState = gameState.players[this.id]
    const toCall = gameState.currentBet - myState.bet

    if (this.shouldFold) {
      return {
        playerId: this.id,
        action: Action.FOLD,
        timestamp: Date.now(),
      }
    }

    if (toCall > 0) {
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
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

describe('Dead Button Advanced Scenarios', () => {
  let manager

  beforeEach(() => {
    manager = new PokerGameManager()
  })

  afterEach(() => {
    manager.tables.forEach((table) => table.close())
  })

  it('should ensure no player posts BB twice in a row when SB is eliminated', async () => {
    // This is the key test for dead button rule
    // Setup: 3 players A, B, C
    // Hand 1: A=Button, B=SB, C=BB
    // B gets eliminated
    // Hand 2: The critical question - who posts BB?

    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 100,
      maxBuyIn: 100,
      minPlayers: 2,
      dealerButton: 0,
    })

    const players = [
      new TestPlayer({ id: 'A', name: 'Player A' }),
      new TestPlayer({ id: 'B', name: 'Player B' }),
      new TestPlayer({ id: 'C', name: 'Player C' }),
    ]

    // Give B very few chips so they'll be eliminated
    players[1].chips = 30

    const blindPosts = {
      hand1: { sb: null, bb: null },
      hand2: { sb: null, bb: null },
    }

    let handCount = 0

    // Track blind posts
    table.on('pot:updated', ({ playerBet }) => {
      if (!playerBet) {
        return
      }

      const currentHand = handCount === 1 ? 'hand1' : 'hand2'

      if (playerBet.amount === 10 && !blindPosts[currentHand].sb) {
        blindPosts[currentHand].sb = playerBet.playerId
        const player = players.find((p) => p.id === playerBet.playerId)
        if (player) {
          player.postedBlinds.push({ hand: handCount, type: 'SB' })
        }
      } else if (playerBet.amount === 20 && !blindPosts[currentHand].bb) {
        blindPosts[currentHand].bb = playerBet.playerId
        const player = players.find((p) => p.id === playerBet.playerId)
        if (player) {
          player.postedBlinds.push({ hand: handCount, type: 'BB' })
        }
      }
    })

    table.on('hand:started', () => {
      handCount++
    })

    table.on('hand:ended', () => {
      if (handCount === 1) {
        // After hand 1, player B should be eliminated
        console.log('\nAfter Hand 1:')
        console.log(
          'Player chips:',
          players.map((p) => `${p.id}: $${p.chips}`)
        )
        console.log('Blinds posted:', blindPosts.hand1)

        // Start hand 2
        setTimeout(() => table.tryStartGame(), 100)
      } else if (handCount === 2) {
        console.log('\nAfter Hand 2:')
        console.log(
          'Player chips:',
          players.map((p) => `${p.id}: $${p.chips}`)
        )
        console.log('Blinds posted:', blindPosts.hand2)

        // Check blind posting history
        console.log('\nBlind posting history:')
        players.forEach((p) => {
          console.log(
            `${p.id}: ${p.postedBlinds.map((b) => `Hand ${b.hand} ${b.type}`).join(', ')}`
          )
        })
      }
    })

    // Add players
    for (const player of players) {
      table.addPlayer(player)
    }

    // Start game
    table.tryStartGame()

    // Wait for 2 hands
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (handCount >= 2) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 50)
      setTimeout(() => {
        clearInterval(checkInterval)
        resolve()
      }, 5000)
    })

    // Verify hand 1 blinds (standard)
    expect(blindPosts.hand1.sb).toBe('B')
    expect(blindPosts.hand1.bb).toBe('C')

    // The critical test: C should NOT post BB again in hand 2
    // With proper dead button implementation:
    // - Button would be "dead" on B's empty seat
    // - C would post SB
    // - A would post BB

    // Log what actually happened
    console.log('\n=== Dead Button Test Result ===')
    console.log('Hand 1 BB:', blindPosts.hand1.bb)
    console.log('Hand 2 BB:', blindPosts.hand2.bb)
    console.log(
      'Did anyone post BB twice?',
      blindPosts.hand1.bb === blindPosts.hand2.bb ? 'YES (BUG!)' : 'No'
    )

    // This assertion checks the key rule: no player posts BB twice in a row
    expect(blindPosts.hand2.bb).not.toBe(blindPosts.hand1.bb)
  })

  it('should handle button player elimination correctly', async () => {
    // When button is eliminated, next hand should have dead button
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      minBuyIn: 100,
      maxBuyIn: 100,
      minPlayers: 2,
      dealerButton: 0,
    })

    const players = [
      new TestPlayer({ id: 'A', name: 'Player A' }),
      new TestPlayer({ id: 'B', name: 'Player B' }),
      new TestPlayer({ id: 'C', name: 'Player C' }),
    ]

    // Give A (button) very few chips
    players[0].chips = 30

    const buttonPositions = []
    const activePlayers = []

    table.on('hand:started', (data) => {
      buttonPositions.push(data.dealerButton)
      activePlayers.push([...data.players])
    })

    let handCount = 0
    table.on('hand:ended', () => {
      handCount++
      if (handCount === 1) {
        setTimeout(() => table.tryStartGame(), 100)
      }
    })

    // Add players and start
    for (const player of players) {
      table.addPlayer(player)
    }
    table.tryStartGame()

    // Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 2000))

    console.log('\n=== Button Elimination Test ===')
    console.log('Hand 1 button position:', buttonPositions[0])
    console.log('Hand 1 active players:', activePlayers[0])
    console.log('Hand 2 button position:', buttonPositions[1])
    console.log('Hand 2 active players:', activePlayers[1])
  })
})
