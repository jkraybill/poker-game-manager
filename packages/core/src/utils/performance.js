/**
 * Performance optimization utilities
 */

/**
 * Object pool for reusing objects to reduce GC pressure
 */
export class ObjectPool {
  constructor(factory, reset, maxSize = 100) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
    this.pool = [];
  }

  acquire() {
    return this.pool.length > 0 ? this.pool.pop() : this.factory();
  }

  release(obj) {
    if (this.pool.length < this.maxSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
  }

  clear() {
    this.pool.length = 0;
  }
}

/**
 * LRU Cache implementation for caching expensive computations
 */
export class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    // Add/update
    this.cache.delete(key);
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

/**
 * Create a cache key from cards array
 */
export function createCardKey(cards) {
  return cards
    .map(c => typeof c === 'string' ? c : c.toString())
    .sort()
    .join(',');
}

/**
 * Batch events to reduce emission overhead
 */
export class EventBatcher {
  constructor(emitter, batchDelay = 0) {
    this.emitter = emitter;
    this.batchDelay = batchDelay;
    this.batches = new Map();
    this.timers = new Map();
  }

  emit(event, data) {
    if (this.batchDelay === 0) {
      this.emitter.emit(event, data);
      return;
    }

    if (!this.batches.has(event)) {
      this.batches.set(event, []);
    }
    
    this.batches.get(event).push(data);

    // Clear existing timer
    if (this.timers.has(event)) {
      clearTimeout(this.timers.get(event));
    }

    // Set new timer
    const timer = setTimeout(() => {
      const batch = this.batches.get(event);
      this.batches.delete(event);
      this.timers.delete(event);
      
      if (batch.length === 1) {
        this.emitter.emit(event, batch[0]);
      } else {
        this.emitter.emit(`${event}:batch`, batch);
      }
    }, this.batchDelay);

    this.timers.set(event, timer);
  }

  flush() {
    for (const [event, timer] of this.timers) {
      clearTimeout(timer);
      const batch = this.batches.get(event);
      if (batch && batch.length > 0) {
        if (batch.length === 1) {
          this.emitter.emit(event, batch[0]);
        } else {
          this.emitter.emit(`${event}:batch`, batch);
        }
      }
    }
    this.batches.clear();
    this.timers.clear();
  }
}

// Singleton pools for common objects
export const actionPool = new ObjectPool(
  () => ({ playerId: null, action: null, amount: 0, timestamp: 0 }),
  (obj) => {
    obj.playerId = null;
    obj.action = null;
    obj.amount = 0;
    obj.timestamp = 0;
  },
);

export const gameStatePool = new ObjectPool(
  () => ({
    tableId: null,
    phase: null,
    communityCards: [],
    pot: 0,
    currentBet: 0,
    currentPlayer: null,
    players: {},
    actionHistory: [],
    validActions: [],
    minRaise: 0,
    toCall: 0,
  }),
  (obj) => {
    obj.tableId = null;
    obj.phase = null;
    obj.communityCards = [];
    obj.pot = 0;
    obj.currentBet = 0;
    obj.currentPlayer = null;
    obj.players = {};
    obj.actionHistory = [];
    obj.validActions = [];
    obj.minRaise = 0;
    obj.toCall = 0;
  },
);