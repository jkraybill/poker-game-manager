/**
 * Event Capture Utility
 *
 * Provides standardized event handling and state tracking for poker tests.
 * Eliminates boilerplate event listener setup across test files.
 */

/**
 * Sets up comprehensive event capture for a poker table
 * @param {Table} table - The poker table to monitor
 * @param {Object} options - Configuration options
 * @returns {Object} State object with event data and helper methods
 */
export function setupEventCapture(table, options = {}) {
  const state = {
    // Basic game state
    gameStarted: false,
    handEnded: false,
    gameEnded: false,

    // Event collections
    actions: [],
    winners: [],
    events: [],
    potUpdates: [],
    sidePots: [],

    // Game flow tracking
    phases: [],
    currentPhase: null,

    // Convenience getters
    get isComplete() {
      return this.handEnded || this.gameEnded
    },

    get totalPot() {
      return this.potUpdates.length > 0
        ? this.potUpdates[this.potUpdates.length - 1].total
        : 0
    },

    get lastAction() {
      return this.actions[this.actions.length - 1]
    },

    get actionCount() {
      return this.actions.length
    },

    // Action filtering helpers
    getActionsByType(actionType) {
      return this.actions.filter((a) => a.action === actionType)
    },

    getActionsByPlayer(playerId) {
      return this.actions.filter((a) => a.playerId === playerId)
    },

    getActionsByPhase(phase) {
      return this.events
        .filter((e) => e.phase === phase && e.event === 'player:action')
        .map((e) => e.data)
    },

    // Reset method for test reuse
    reset() {
      this.gameStarted = false
      this.handEnded = false
      this.gameEnded = false
      this.actions.length = 0
      this.winners.length = 0
      this.events.length = 0
      this.potUpdates.length = 0
      this.sidePots.length = 0
      this.phases.length = 0
      this.currentPhase = null
    },
  }

  // Default events to capture
  const defaultEvents = [
    'game:started',
    'hand:started',
    'player:action',
    'hand:ended',
    'game:ended',
    'pot:updated',
    'cards:dealt',
    'cards:community',
    'round:ended',
    'chips:awarded',
    'side-pot:created',
  ]

  const eventsToCapture = options.events || defaultEvents
  const captureAll = options.captureAll || false

  // Set up event listeners
  eventsToCapture.forEach((eventName) => {
    table.on(eventName, (data) => {
      const eventData = {
        event: eventName,
        data,
        timestamp: Date.now(),
        phase: state.currentPhase,
      }

      // Store in general events array
      state.events.push(eventData)

      // Handle specific events
      switch (eventName) {
        case 'game:started':
          state.gameStarted = true
          break

        case 'hand:started':
          state.handEnded = false
          state.currentPhase = 'PRE_FLOP'
          if (!state.phases.includes('PRE_FLOP')) {
            state.phases.push('PRE_FLOP')
          }
          break

        case 'cards:community':
          if (data.phase && data.phase !== state.currentPhase) {
            state.currentPhase = data.phase
            if (!state.phases.includes(data.phase)) {
              state.phases.push(data.phase)
            }
          }
          break

        case 'player:action':
          state.actions.push({
            playerId: data.playerId,
            action: data.action,
            amount: data.amount,
            timestamp: data.timestamp || Date.now(),
            phase: state.currentPhase,
          })
          break

        case 'pot:updated':
          state.potUpdates.push({
            total: data.total,
            timestamp: Date.now(),
            phase: state.currentPhase,
          })
          break

        case 'hand:ended':
          state.handEnded = true
          state.winners = data.winners || []
          state.sidePots = data.sidePots || []
          state.currentPhase = 'COMPLETE'
          break

        case 'game:ended':
          state.gameEnded = true
          state.handEnded = true
          break

        case 'side-pot:created':
          state.sidePots.push({
            potId: data.potId,
            amount: data.amount,
            eligiblePlayers: data.eligiblePlayers,
            timestamp: Date.now(),
          })
          break
      }
    })
  })

  // Capture all events if requested (useful for debugging)
  if (captureAll) {
    const originalEmit = table.emit.bind(table)
    table.emit = function (eventName, ...args) {
      if (!eventsToCapture.includes(eventName)) {
        state.events.push({
          event: eventName,
          data: args[0],
          timestamp: Date.now(),
          phase: state.currentPhase,
          captured: 'all',
        })
      }
      return originalEmit(eventName, ...args)
    }
  }

  return state
}

/**
 * Wait for specific game conditions with timeout
 * @param {Object} eventState - State object from setupEventCapture
 * @param {Object} conditions - Conditions to wait for
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} Resolves when conditions are met
 */
export function waitForConditions(eventState, conditions, timeout = 5000) {
  const startTime = Date.now()

  return new Promise((resolve, reject) => {
    const checkConditions = () => {
      // Check timeout
      if (Date.now() - startTime > timeout) {
        reject(
          new Error(
            `Timeout waiting for conditions: ${JSON.stringify(conditions)}`
          )
        )
        return
      }

      // Check each condition
      let allMet = true
      for (const [key, value] of Object.entries(conditions)) {
        if (typeof value === 'function') {
          if (!value(eventState)) {
            allMet = false
            break
          }
        } else if (eventState[key] !== value) {
          allMet = false
          break
        }
      }

      if (allMet) {
        resolve(eventState)
      } else {
        setTimeout(checkConditions, 10)
      }
    }

    checkConditions()
  })
}

/**
 * Convenience function to wait for hand completion
 * @param {Object} eventState - State object from setupEventCapture
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} Resolves when hand ends
 */
export function waitForHandEnd(eventState, timeout = 5000) {
  return waitForConditions(eventState, { handEnded: true }, timeout)
}

/**
 * Convenience function to wait for game start
 * @param {Object} eventState - State object from setupEventCapture
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} Resolves when game starts
 */
export function waitForGameStart(eventState, timeout = 2000) {
  return waitForConditions(eventState, { gameStarted: true }, timeout)
}

/**
 * Create a simplified event capture for basic tests
 * @param {Table} table - The poker table to monitor
 * @returns {Object} Simplified state object
 */
export function setupSimpleCapture(table) {
  return setupEventCapture(table, {
    events: ['game:started', 'player:action', 'hand:ended'],
  })
}
