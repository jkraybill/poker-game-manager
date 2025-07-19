/**
 * Event definitions for the poker game manager
 */

// Table Events
export const TableEvents = {
  CREATED: 'table:created',
  CLOSED: 'table:closed',
  EVENT: 'table:event',
  REMOVED: 'table:removed',
};

// Player Events  
export const PlayerEvents = {
  JOINED: 'player:joined',
  LEFT: 'player:left',
  WAITING: 'player:waiting',
  ACTION: 'player:action',
  ACTION_REQUESTED: 'action:requested',
  ACTION_TAKEN: 'action:taken',
  ACTION_ERROR: 'action:error',
  CARDS_RECEIVED: 'cards:received',
  MESSAGE_RECEIVED: 'message:received',
  DISCONNECTED: 'disconnected',
};

// Game Events
export const GameEvents = {
  STARTED: 'game:started',
  ENDED: 'game:ended',
  ABORTED: 'game:aborted',
};

// Hand Events
export const HandEvents = {
  STARTED: 'hand:started',
  COMPLETE: 'hand:complete',
};

// Card Events
export const CardEvents = {
  DEALT: 'cards:dealt',
  COMMUNITY: 'cards:community',
};

// Pot Events
export const PotEvents = {
  UPDATED: 'pot:updated',
};

// Chip Events
export const ChipEvents = {
  AWARDED: 'chips:awarded',
};

// Round Events
export const RoundEvents = {
  STARTED: 'round:started',
  ENDED: 'round:ended',
};

/**
 * All events for convenience
 */
export const Events = {
  ...TableEvents,
  ...PlayerEvents,
  ...GameEvents,
  ...HandEvents,
  ...CardEvents,
  ...PotEvents,
  ...ChipEvents,
  ...RoundEvents,
};