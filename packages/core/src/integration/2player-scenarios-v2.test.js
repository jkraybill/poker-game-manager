/**
 * 2-Player (Heads-Up) Poker Scenarios (Using Test Utilities)
 *
 * Tests specific to heads-up play where one player is SB/Button and the other is BB.
 * These scenarios test the fundamental mechanics of poker betting in the simplest format.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createHeadsUpTable,
  setupEventCapture,
  waitForHandEnd,
  StrategicPlayer,
  STRATEGIES,
  Action,
  cleanupTables,
} from '../test-utils/index.js'

describe('2-Player (Heads-Up) Scenarios (v2)', () => {
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

  describe('Basic heads-up mechanics', () => {
    it('should handle SB/Button folding to BB', async () => {
      // Create heads-up table with test utilities
      const result = createHeadsUpTable({
        dealerButton: 0,
      })
      manager = result.manager
      table = result.table

      // Set up event capture
      events = setupEventCapture(table)

      // Create players using built-in fold strategy
      const sbPlayer = new StrategicPlayer({
        name: 'SB/Button',
        strategy: STRATEGIES.alwaysFold,
      })
      const bbPlayer = new StrategicPlayer({
        name: 'Big Blind',
        strategy: STRATEGIES.alwaysFold,
      })

      // Track dealer button position
      let dealerButtonPos = -1
      table.on('hand:started', ({ dealerButton }) => {
        dealerButtonPos = dealerButton
      })

      // Add players
      table.addPlayer(sbPlayer)
      table.addPlayer(bbPlayer)

      // Start game
      table.tryStartGame()

      // Wait for hand to complete
      await waitForHandEnd(events)

      // Extract results
      const { winners, actions } = events

      // In heads-up, if dealerButton is 0, then player at position 0 is SB/Button
      // and player at position 1 is BB
      const expectedWinner = dealerButtonPos === 0 ? bbPlayer : sbPlayer

      // Verify results
      expect(winners).toHaveLength(1)
      expect(winners[0].playerId).toBe(expectedWinner.id)
      expect(winners[0].amount).toBe(30) // SB $10 + BB $20

      expect(actions).toHaveLength(1)
      expect(actions[0].action).toBe(Action.FOLD)

      // In heads-up, the SB/Button should fold
      const actualSbPlayer = dealerButtonPos === 0 ? sbPlayer : bbPlayer
      expect(actions[0].playerId).toBe(actualSbPlayer.id)
    })
  })
})
