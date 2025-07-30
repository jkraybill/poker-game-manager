/**
 * Utility functions for player status and standings
 */

/**
 * Separate active and eliminated players
 * @param {Map<string, Object>} playersMap - Table players map
 * @returns {Object} Object with active and eliminated player arrays
 */
export function categorizePlayersByStatus(playersMap) {
  const players = Array.from(playersMap.values())

  const active = players
    .filter((p) => p.player.chips > 0)
    .sort((a, b) => b.player.chips - a.player.chips) // Sort by chips descending
    .map((p, index) => ({
      rank: index + 1,
      id: p.player.id,
      name: p.player.name,
      chips: p.player.chips,
      seatNumber: p.seatNumber,
      status: 'active',
    }))

  const eliminated = players
    .filter((p) => p.player.chips === 0)
    .map((p) => ({
      id: p.player.id,
      name: p.player.name,
      chips: 0,
      seatNumber: p.seatNumber,
      status: 'eliminated',
      eliminationOrder: 0, // Would need to track this separately
    }))

  return {
    active,
    eliminated,
    totalPlayers: players.length,
    activePlayers: active.length,
    eliminatedPlayers: eliminated.length,
  }
}

/**
 * Format standings for display
 * @param {Map<string, Object>} playersMap - Table players map
 * @param {Array} externalEliminated - Optional array of eliminated player data
 * @returns {Object} Formatted standings object
 */
export function getFormattedStandings(playersMap, externalEliminated = []) {
  const { active, eliminated } = categorizePlayersByStatus(playersMap)

  // Combine eliminated players from table and external tracking
  const allEliminated = [...eliminated, ...externalEliminated]

  return {
    standings: active,
    eliminated: allEliminated,
    summary: {
      playersRemaining: active.length,
      totalChipsInPlay: active.reduce((sum, p) => sum + p.chips, 0),
      averageStack:
        active.length > 0
          ? Math.floor(
              active.reduce((sum, p) => sum + p.chips, 0) / active.length
            )
          : 0,
    },
  }
}

/**
 * Get player status
 * @param {Object} player - Player object
 * @returns {string} Player status
 */
export function getPlayerStatus(player) {
  if (!player) {
    return 'unknown'
  }
  if (player.chips === 0) {
    return 'eliminated'
  }
  if (player.chips > 0) {
    return 'active'
  }
  return 'unknown'
}

/**
 * Check if player is still active
 * @param {Object} player - Player object
 * @returns {boolean} True if active
 */
export function isPlayerActive(player) {
  return player && player.chips > 0
}
