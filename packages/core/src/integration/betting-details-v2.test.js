/**
 * Test for Issue #19: Add betting details to action:requested event (Using Test Utilities)
 *
 * This test verifies that the action:requested event includes comprehensive
 * betting information including toCall, minRaise, maxRaise, potSize, and validActions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createTestTable,
  createHeadsUpTable,
  setupEventCapture,
  StrategicPlayer,
  Action,
} from '../test-utils/index.js'

describe('Betting Details in action:requested Event (v2)', () => {
  let manager
  let table

  beforeEach(() => {
    // Initialize but don't create yet
    manager = null
    table = null
  })

  afterEach(() => {
    console.log('=== afterEach: Cleaning up ===')
    // Clean up if created
    if (manager) {
      // cleanupTables(manager);  // This might be calling non-existent methods
      // Instead, just clear references
      manager.tables.forEach((table) => {
        if (table.gameEngine) {
          table.gameEngine.removeAllListeners()
        }
        table.removeAllListeners()
      })
      manager = null
      table = null
    }
    console.log('=== afterEach: Done ===')
  })

  it('should include betting details in action:requested event', async () => {
    console.log('=== TEST 1: Starting betting details test ===')
    // Create 3-player table
    const result = createTestTable('standard', {
      minPlayers: 3,
      dealerButton: 0,
    })
    manager = result.manager
    table = result.table

    // Set up event capture
    setupEventCapture(table)

    const actionRequests = []

    // Capture all action:requested events
    table.on('action:requested', (event) => {
      actionRequests.push({
        playerId: event.playerId,
        phase: event.gameState.phase,
        bettingDetails: event.bettingDetails,
      })
    })

    // Simple test strategy
    const testStrategy = ({ player, gameState, toCall }) => {
      console.log(
        `[${player.name}] strategyType=${player.strategyType}, toCall=${toCall}, phase=${gameState.phase}`
      )

      // First player raises in first betting round
      if (
        player.strategyType === 'raise' &&
        toCall === 20 &&
        gameState.phase === 'PRE_FLOP'
      ) {
        console.log(`[${player.name}] Betting 50`)
        return { action: Action.RAISE, amount: 50 }
      }

      // Second player calls any bet
      if (player.strategyType === 'call' && toCall > 0) {
        console.log(`[${player.name}] Calling ${toCall}`)
        return { action: Action.CALL, amount: toCall }
      }

      // Default check/fold
      if (toCall > 0) {
        console.log(`[${player.name}] Folding`)
        return { action: Action.FOLD }
      }

      console.log(`[${player.name}] Checking`)
      return { action: Action.CHECK }
    }

    const p1 = new StrategicPlayer({
      id: 'p1',
      name: 'Player 1',
      strategy: testStrategy,
    })
    p1.strategyType = 'raise'

    const p2 = new StrategicPlayer({
      id: 'p2',
      name: 'Player 2',
      strategy: testStrategy,
    })
    p2.strategyType = 'call'

    const p3 = new StrategicPlayer({
      id: 'p3',
      name: 'Player 3',
      strategy: testStrategy,
    })
    p3.strategyType = 'check'

    table.addPlayer(p1)
    table.addPlayer(p2)
    table.addPlayer(p3)

    table.tryStartGame()

    // Wait for some actions (don't wait for hand end - we're testing action requests)
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(actionRequests.length).toBeGreaterThan(0)

    // Check first action request (UTG player)
    const firstRequest = actionRequests[0]
    expect(firstRequest.playerId).toBe('p1')
    expect(firstRequest.phase).toBe('PRE_FLOP')
    expect(firstRequest.bettingDetails).toBeDefined()

    const details = firstRequest.bettingDetails
    expect(details.currentBet).toBe(20) // Big blind
    expect(details.toCall).toBe(20) // UTG needs to call BB
    expect(details.potSize).toBe(30) // SB + BB
    expect(details.minRaise).toBe(40) // BB * 2
    expect(details.maxRaise).toBe(1000) // Player's stack
    expect(details.validActions).toContain(Action.FOLD)
    expect(details.validActions).toContain(Action.CALL)
    expect(details.validActions).toContain(Action.RAISE)

    // Find the action request after a raise
    const postRaiseRequest = actionRequests.find(
      (req) =>
        req.playerId === 'p2' &&
        req.bettingDetails &&
        req.bettingDetails.currentBet > 20
    )

    if (postRaiseRequest) {
      const raiseDetails = postRaiseRequest.bettingDetails
      expect(raiseDetails.currentBet).toBe(50) // After raise
      expect(raiseDetails.toCall).toBeGreaterThan(0)
      expect(raiseDetails.validActions).toContain(Action.FOLD)
      expect(raiseDetails.validActions).toContain(Action.CALL)
    }

    console.log('=== TEST 1: Completed successfully ===')
  })

  it('should correctly calculate betting details for all-in scenarios', async () => {
    console.log('=== Starting all-in scenarios test ===')
    // Create heads-up table
    const result = createHeadsUpTable({
      blinds: { small: 5, big: 10 },
      dealerButton: 0,
    })
    manager = result.manager
    table = result.table

    // Set up event capture
    setupEventCapture(table)

    let capturedRequest = null

    table.on('action:requested', (event) => {
      if (event.playerId === 'short' && event.gameState.phase === 'PRE_FLOP') {
        capturedRequest = event
      }
    })

    // Short stack strategy
    const shortStackStrategy = ({ player, myState }) => {
      // Will go all-in
      console.log(`[${player.name}] Going all-in with ${myState.chips} chips`)
      return { action: Action.ALL_IN, amount: myState.chips }
    }

    // Big stack strategy
    const bigStackStrategy = ({ player, toCall }) => {
      console.log(`[${player.name}] Big stack: toCall=${toCall}`)
      if (toCall > 0) {
        console.log(`[${player.name}] Calling ${toCall}`)
        return { action: Action.CALL, amount: toCall }
      }
      console.log(`[${player.name}] Checking`)
      return { action: Action.CHECK }
    }

    const shortStack = new StrategicPlayer({
      id: 'short',
      name: 'Short Stack',
      strategy: shortStackStrategy,
    })

    const bigStack = new StrategicPlayer({
      id: 'big',
      name: 'Big Stack',
      strategy: bigStackStrategy,
    })

    table.addPlayer(shortStack)
    table.addPlayer(bigStack)

    // Override chip amounts after adding
    shortStack.chips = 25
    bigStack.chips = 200

    console.log('Starting game...')
    table.tryStartGame()

    // Wait for action (don't wait for hand end)
    console.log('Waiting for actions...')
    await new Promise((resolve) => setTimeout(resolve, 200))

    console.log('Checking captured request...')
    expect(capturedRequest).toBeDefined()

    const details = capturedRequest.bettingDetails
    expect(details.currentBet).toBe(10) // Big blind
    expect(details.toCall).toBe(5) // SB already posted 5, needs 5 more
    expect(details.potSize).toBe(15) // SB + BB

    // With 25 chips, after calling 5, player has 20 left
    // They can call or raise (but raising would put them all-in)
    expect(details.validActions).toContain(Action.CALL)
    expect(details.validActions).toContain(Action.RAISE)
    expect(details.maxRaise).toBe(25) // All chips

    // Min raise would be 20 (BB * 2) but player only has 25 total
    expect(details.minRaise).toBe(20) // Double the BB
  })

  it('should show correct valid actions based on game state', async () => {
    console.log('=== Starting valid actions test ===')
    // Create heads-up table
    const result = createHeadsUpTable({
      dealerButton: 0,
    })
    manager = result.manager
    table = result.table

    // Set up event capture
    setupEventCapture(table)

    const actionRequests = []

    table.on('action:requested', (event) => {
      actionRequests.push({
        playerId: event.playerId,
        phase: event.gameState.phase,
        toCall: event.bettingDetails.toCall,
        validActions: event.bettingDetails.validActions,
      })
    })

    // Versatile strategy
    const versatileStrategy = ({ player, toCall }) => {
      console.log(
        `[${player.name}] Versatile strategy called: toCall=${toCall}, actionCount=${player.actionCount || 0}`
      )
      player.actionCount = (player.actionCount || 0) + 1

      // If we need to call, we must call or fold - can't check
      if (toCall > 0) {
        // First action - call
        console.log(`[${player.name}] Calling ${toCall}`)
        return { action: Action.CALL, amount: toCall }
      }

      // Default check when no money owed
      console.log(`[${player.name}] Checking`)
      return { action: Action.CHECK }
    }

    const p1 = new StrategicPlayer({
      id: 'p1',
      name: 'Player 1',
      strategy: versatileStrategy,
    })

    const p2 = new StrategicPlayer({
      id: 'p2',
      name: 'Player 2',
      strategy: versatileStrategy,
    })

    console.log('Adding players...')
    table.addPlayer(p1)
    table.addPlayer(p2)

    console.log('Starting game...')
    table.tryStartGame()

    console.log('Waiting for several actions...')
    // Wait for several actions
    await new Promise((resolve) => setTimeout(resolve, 300))

    console.log('Done waiting, checking results...')

    // Check various scenarios
    const checkScenario = actionRequests.find(
      (req) => req.toCall === 0 && req.phase === 'FLOP'
    )
    if (checkScenario) {
      expect(checkScenario.validActions).toContain(Action.CHECK)
      // If it's a new betting round (currentBet = 0), we can BET
      // If currentBet > 0 but toCall = 0 (like BB option), we can RAISE
      const canBet = checkScenario.validActions.includes(Action.BET)
      const canRaise = checkScenario.validActions.includes(Action.RAISE)
      expect(canBet || canRaise).toBe(true) // Should be able to bet or raise
      expect(checkScenario.validActions).not.toContain(Action.CALL)
    }

    const callScenario = actionRequests.find((req) => req.toCall > 0)
    if (callScenario) {
      expect(callScenario.validActions).toContain(Action.FOLD)
      expect(callScenario.validActions).toContain(Action.CALL)
      expect(callScenario.validActions).not.toContain(Action.CHECK)
      expect(callScenario.validActions).not.toContain(Action.BET)
    }
  })
})
