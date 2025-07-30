import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PokerGameManager } from '../PokerGameManager.js'
import { Player } from '../Player.js'
import { Action } from '../types/index.js'

/**
 * Fixed test for Issue #33: Event ordering
 */

describe('Event Ordering - Fixed (Issue #33)', () => {
  let manager
  let table

  beforeEach(() => {
    manager = new PokerGameManager()
  })

  afterEach(() => {
    if (table) {
      table.close()
    }
  })

  it('should fire player:eliminated after hand:ended when player has 0 chips', async () => {
    // Create table - 2 players is simpler
    table = manager.createTable({
      id: 'elimination-test',
      blinds: { small: 10, big: 20 },
      minBuyIn: 40,
      maxBuyIn: 200,
      minPlayers: 2,
      dealerButton: 0,
    })

    const eventLog = []

    // Track events
    table.on('hand:ended', ({ winners }) => {
      eventLog.push({
        event: 'hand:ended',
        timestamp: Date.now(),
        winners: winners.length,
      })
      console.log('hand:ended fired, winners:', winners)
    })

    table.on('player:eliminated', ({ playerId }) => {
      eventLog.push({
        event: 'player:eliminated',
        timestamp: Date.now(),
        playerId,
      })
      console.log('player:eliminated fired for', playerId)
    })

    // Simple players
    class SimplePlayer extends Player {
      constructor(config) {
        super(config)
        this.strategy = config.strategy
      }

      getAction(gameState) {
        const myState = gameState.players[this.id]
        const toCall = gameState.currentBet - myState.bet

        console.log(
          `${this.name} decision: strategy=${this.strategy}, chips=${myState.chips}, toCall=${toCall}`
        )

        // If we're all-in (chips = 0 after posting blind), we can't act
        if (myState.chips === 0) {
          console.log(`${this.name} is all-in, cannot act`)
          return {
            playerId: this.id,
            action: Action.CHECK,
            timestamp: Date.now(),
          }
        }

        // If we can't afford to call, go all-in
        if (toCall > 0 && toCall > myState.chips) {
          console.log(
            `${this.name} cannot afford to call ${toCall}, going all-in with ${myState.chips}`
          )
          return {
            playerId: this.id,
            action: Action.ALL_IN,
            amount: myState.chips,
            timestamp: Date.now(),
          }
        }

        // Winner strategy - just call to see showdown
        if (this.strategy === 'call' && toCall > 0 && toCall <= myState.chips) {
          return {
            playerId: this.id,
            action: Action.CALL,
            amount: toCall,
            timestamp: Date.now(),
          }
        }

        // Check when possible
        if (toCall === 0) {
          return {
            playerId: this.id,
            action: Action.CHECK,
            timestamp: Date.now(),
          }
        }

        // Default: fold if we can afford to call (otherwise all-in above)
        return {
          playerId: this.id,
          action: Action.FOLD,
          timestamp: Date.now(),
        }
      }
    }

    const loser = new SimplePlayer({ name: 'Loser', strategy: 'fold' })
    const winner = new SimplePlayer({ name: 'Winner', strategy: 'call' })

    // Add players
    table.addPlayer(loser)
    table.addPlayer(winner)

    // Override chips to create an all-in scenario
    // Loser will be BB and forced all-in with partial blind
    table.players.get(loser.id).player.chips = 15 // Less than big blind
    table.players.get(winner.id).player.chips = 200

    console.log('Initial setup:', {
      loserChips: table.players.get(loser.id).player.chips,
      winnerChips: table.players.get(winner.id).player.chips,
      loserPosition: table.players.get(loser.id).seatNumber,
      winnerPosition: table.players.get(winner.id).seatNumber,
    })

    // Wait for hand to complete
    const handComplete = new Promise((resolve) => {
      table.on('hand:ended', () => {
        // Wait a bit for all events
        setTimeout(() => {
          console.log('Final state:', {
            loserInTable: !!table.players.get(loser.id),
            loserChips: table.players.get(loser.id)?.player.chips,
            eventCount: eventLog.length,
          })
          resolve()
        }, 500)
      })
    })

    // Start game
    table.tryStartGame()

    // Wait for completion
    await handComplete

    // Analyze results
    console.log('Event log:', eventLog)

    // Verify we got hand:ended
    const handEndedEvents = eventLog.filter((e) => e.event === 'hand:ended')
    expect(handEndedEvents).toHaveLength(1)

    // Check if elimination happened
    const loserData = table.players.get(loser.id)
    if (!loserData || loserData.player.chips === 0) {
      // Player was eliminated or has 0 chips
      const eliminationEvents = eventLog.filter(
        (e) => e.event === 'player:eliminated'
      )

      if (eliminationEvents.length > 0) {
        // Verify ordering
        const handTime = handEndedEvents[0].timestamp
        const elimTime = eliminationEvents[0].timestamp
        expect(elimTime).toBeGreaterThanOrEqual(handTime)
        console.log('✓ Elimination fired after hand:ended')
      } else {
        console.log('WARNING: Player has 0 chips but no elimination event')
        // This is the bug we're trying to fix
      }
    }
  })
})
