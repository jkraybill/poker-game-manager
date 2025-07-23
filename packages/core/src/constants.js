/**
 * Constants used throughout the poker game manager
 */

// Default configuration values
export const DEFAULT_CONFIG = {
  MAX_TABLES: 1000,
  MAX_PLAYERS_PER_TABLE: 9,
  MIN_PLAYERS_PER_TABLE: 2,
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  DEFAULT_SMALL_BLIND: 10,
  DEFAULT_BIG_BLIND: 20,
  DEFAULT_MIN_BUY_IN: 1000,
  DEFAULT_MAX_BUY_IN: 10000,
  TIME_BETWEEN_HANDS: 5000, // 5 seconds
};

// Poker variants
export const Variants = {
  TEXAS_HOLDEM: 'texas-holdem',
  OMAHA: 'omaha',
  SEVEN_CARD_STUD: 'seven-card-stud',
};

// Card suits
export const Suits = {
  HEARTS: 'hearts',
  DIAMONDS: 'diamonds',
  CLUBS: 'clubs',
  SPADES: 'spades',
};

// Card ranks
export const Ranks = {
  TWO: '2',
  THREE: '3',
  FOUR: '4',
  FIVE: '5',
  SIX: '6',
  SEVEN: '7',
  EIGHT: '8',
  NINE: '9',
  TEN: '10',
  JACK: 'J',
  QUEEN: 'Q',
  KING: 'K',
  ACE: 'A',
};

// Betting limits
export const Limits = {
  NO_LIMIT: 'no-limit',
  POT_LIMIT: 'pot-limit',
  FIXED_LIMIT: 'fixed-limit',
};

// Tournament types
export const TournamentTypes = {
  SINGLE_TABLE: 'single-table',
  MULTI_TABLE: 'multi-table',
  SIT_N_GO: 'sit-n-go',
  SCHEDULED: 'scheduled',
};

// Time limits (in milliseconds)
export const TimeLimits = {
  QUICK: 15000, // 15 seconds
  STANDARD: 30000, // 30 seconds
  SLOW: 60000, // 60 seconds
  UNLIMITED: 0, // No time limit
};

// Error messages
export const ErrorMessages = {
  INVALID_ACTION: 'Invalid action',
  NOT_YOUR_TURN: 'It is not your turn',
  INSUFFICIENT_CHIPS: 'Insufficient chips',
  TABLE_FULL: 'Table is full',
  GAME_IN_PROGRESS: 'Game already in progress',
  NO_ADAPTER: 'No adapter configured for player',
  TIMEOUT: 'Action timeout',
};
