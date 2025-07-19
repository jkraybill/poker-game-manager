/**
 * Core type definitions for the poker game manager
 */

export const TableState = {
  WAITING: 'WAITING',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  CLOSED: 'CLOSED',
};

export const PlayerState = {
  WAITING: 'WAITING',
  ACTIVE: 'ACTIVE',
  FOLDED: 'FOLDED',
  ALL_IN: 'ALL_IN',
  SITTING_OUT: 'SITTING_OUT',
  DISCONNECTED: 'DISCONNECTED',
};

export const GamePhase = {
  WAITING: 'WAITING',
  PRE_FLOP: 'PRE_FLOP',
  FLOP: 'FLOP',
  TURN: 'TURN',
  RIVER: 'RIVER',
  SHOWDOWN: 'SHOWDOWN',
  ENDED: 'ENDED',
};

export const Action = {
  CHECK: 'CHECK',
  BET: 'BET',
  CALL: 'CALL',
  RAISE: 'RAISE',
  FOLD: 'FOLD',
  ALL_IN: 'ALL_IN',
};

export const HandRank = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10,
};

/**
 * @typedef {Object} PlayerAction
 * @property {string} playerId - The player making the action
 * @property {Action} action - The action type
 * @property {number} [amount] - The amount (for bet/raise)
 * @property {number} timestamp - When the action was made
 */

/**
 * @typedef {Object} GameState
 * @property {string} tableId - The table ID
 * @property {GamePhase} phase - Current game phase
 * @property {string[]} communityCards - Cards on the board
 * @property {number} pot - Current pot size
 * @property {number} currentBet - Current bet to match
 * @property {string} currentPlayer - ID of player to act
 * @property {Object.<string, PlayerGameState>} players - Player states
 * @property {PlayerAction[]} actionHistory - History of actions
 */

/**
 * @typedef {Object} PlayerGameState
 * @property {string} id - Player ID
 * @property {string[]} holeCards - Player's private cards
 * @property {number} chips - Current chip count
 * @property {number} bet - Current bet in this round
 * @property {PlayerState} state - Player's state
 * @property {boolean} hasActed - Whether player has acted this round
 */

/**
 * @typedef {Object} TableConfig
 * @property {string} [id] - Table ID
 * @property {string} [variant='texas-holdem'] - Poker variant
 * @property {number} [maxPlayers=9] - Maximum players
 * @property {number} [minPlayers=2] - Minimum players to start
 * @property {Object} [blinds] - Blind structure
 * @property {number} [blinds.small=10] - Small blind
 * @property {number} [blinds.big=20] - Big blind
 * @property {number} [minBuyIn=1000] - Minimum buy-in
 * @property {number} [maxBuyIn=10000] - Maximum buy-in
 * @property {number} [timeout=30000] - Action timeout in ms
 */

/**
 * @typedef {Object} GameResult
 * @property {string[]} winners - Array of winner IDs
 * @property {Object.<string, number>} payouts - Payout amounts by player ID
 * @property {Object.<string, number>} finalChips - Final chip counts
 * @property {Object.<string, string[]>} showdownHands - Revealed hands
 * @property {string} [handDescription] - Description of winning hand
 */