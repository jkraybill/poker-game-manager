# WildcardEventEmitter Documentation 🎯

## Overview

`WildcardEventEmitter` is a powerful extension of EventEmitter3 that automatically emits a wildcard `*` event for every event emitted. This allows you to listen to ALL events with a single listener, perfect for logging, debugging, analytics, and event monitoring.

## Installation

```javascript
// Available since v4.4.2
import { WildcardEventEmitter } from '@jkraybill/poker-game-manager';

// Or import directly
import { WildcardEventEmitter } from '@jkraybill/poker-game-manager/wildcard-event-emitter';
```

## Basic Usage

### Creating a WildcardEventEmitter

```javascript
import { WildcardEventEmitter } from '@jkraybill/poker-game-manager';

class MyGameComponent extends WildcardEventEmitter {
  constructor() {
    super();
  }
  
  doSomething() {
    this.emit('action:taken', { type: 'something', timestamp: Date.now() });
  }
}
```

### Listening to All Events

```javascript
const component = new MyGameComponent();

// Listen to ALL events with wildcard
component.on('*', (eventName, ...args) => {
  console.log(`Event: ${eventName}`, args);
});

// Also listen to specific events normally
component.on('action:taken', (data) => {
  console.log('Action taken:', data);
});

component.doSomething();
// Output:
// Action taken: { type: 'something', timestamp: 1755... }
// Event: action:taken [{ type: 'something', timestamp: 1755... }]
```

## Use Cases

### 1. Event Logging and Debugging

```javascript
class DebugTable extends WildcardEventEmitter {
  constructor() {
    super();
    
    // Log all events in development
    if (process.env.NODE_ENV === 'development') {
      this.on('*', (eventName, ...args) => {
        console.log(`[TABLE EVENT] ${eventName}`, args);
      });
    }
  }
}
```

### 2. Event Analytics

```javascript
class AnalyticsCollector {
  constructor(table) {
    this.eventCounts = new Map();
    this.eventTimings = new Map();
    
    // Track all events from the table
    table.on('*', (eventName, ...args) => {
      // Count events
      this.eventCounts.set(eventName, 
        (this.eventCounts.get(eventName) || 0) + 1
      );
      
      // Track timing
      this.eventTimings.set(eventName, Date.now());
      
      // Send to analytics service
      this.sendToAnalytics(eventName, args);
    });
  }
  
  getStats() {
    return {
      eventCounts: Object.fromEntries(this.eventCounts),
      lastEventTimes: Object.fromEntries(this.eventTimings),
    };
  }
}
```

### 3. Event Recording for Testing

```javascript
// Capture all events for test assertions
const captureEvents = (emitter) => {
  const events = [];
  
  emitter.on('*', (eventName, ...args) => {
    events.push({
      name: eventName,
      args: args,
      timestamp: Date.now(),
    });
  });
  
  return events;
};

// In tests
it('should emit events in correct order', () => {
  const table = new Table();
  const events = captureEvents(table);
  
  // Play a hand...
  await table.tryStartGame();
  
  // Assert event order
  expect(events[0].name).toBe('game:started');
  expect(events[1].name).toBe('hand:started');
  // etc...
});
```

### 4. Event Forwarding/Proxying

```javascript
class EventForwarder extends WildcardEventEmitter {
  constructor(source, destination) {
    super();
    
    // Forward all events from source to destination
    source.on('*', (eventName, ...args) => {
      // Optionally transform or filter
      if (!eventName.startsWith('internal:')) {
        destination.emit(eventName, ...args);
      }
    });
  }
}
```

### 5. Tournament Event Aggregation

```javascript
class TournamentManager extends WildcardEventEmitter {
  constructor() {
    super();
    this.tables = new Map();
  }
  
  addTable(tableId, table) {
    this.tables.set(tableId, table);
    
    // Forward all table events with table context
    table.on('*', (eventName, ...args) => {
      this.emit(`table:${tableId}:${eventName}`, ...args);
      
      // Also emit aggregated tournament events
      if (eventName === 'player:eliminated') {
        this.checkTournamentElimination(tableId, ...args);
      }
    });
  }
}
```

## Real-World Example: Complete Event Monitor

```javascript
import { WildcardEventEmitter } from '@jkraybill/poker-game-manager';

class PokerEventMonitor {
  constructor(table) {
    this.startTime = Date.now();
    this.eventLog = [];
    this.eventStats = new Map();
    
    // Monitor all events
    table.on('*', (eventName, ...args) => {
      const event = {
        name: eventName,
        timestamp: Date.now(),
        elapsed: Date.now() - this.startTime,
        data: args[0], // First argument is usually the data object
      };
      
      // Store event
      this.eventLog.push(event);
      
      // Update statistics
      const stats = this.eventStats.get(eventName) || {
        count: 0,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
      };
      stats.count++;
      stats.lastSeen = event.timestamp;
      this.eventStats.set(eventName, stats);
      
      // Handle specific events
      this.handleSpecificEvent(eventName, args);
    });
  }
  
  handleSpecificEvent(eventName, args) {
    switch(eventName) {
      case 'hand:started':
        console.log(`Hand ${args[0].handNumber} started`);
        break;
      case 'player:action':
        const { playerId, action, amount } = args[0];
        console.log(`${playerId} ${action} ${amount || ''}`);
        break;
      case 'hand:ended':
        this.printHandSummary(args[0]);
        break;
    }
  }
  
  printHandSummary(result) {
    console.log('\n=== Hand Summary ===');
    console.log(`Winners: ${result.winners.map(w => w.playerId).join(', ')}`);
    console.log(`Total pot: ${result.pot}`);
    console.log(`Events this hand: ${this.getHandEventCount()}`);
  }
  
  getHandEventCount() {
    // Count events since last hand:ended or start
    let count = 0;
    for (let i = this.eventLog.length - 1; i >= 0; i--) {
      count++;
      if (this.eventLog[i].name === 'hand:ended') break;
    }
    return count;
  }
  
  getReport() {
    return {
      totalEvents: this.eventLog.length,
      duration: Date.now() - this.startTime,
      eventTypes: this.eventStats.size,
      mostFrequent: Array.from(this.eventStats.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([name, stats]) => ({ name, count: stats.count })),
    };
  }
}

// Usage
const table = new Table({ blinds: { small: 10, big: 20 } });
const monitor = new PokerEventMonitor(table);

// Play some hands...
// ...

console.log(monitor.getReport());
// {
//   totalEvents: 245,
//   duration: 15234,
//   eventTypes: 18,
//   mostFrequent: [
//     { name: 'player:action', count: 87 },
//     { name: 'pot:updated', count: 43 },
//     ...
//   ]
// }
```

## Performance Considerations

### Zero Overhead When Not Used
If no wildcard listeners are registered, the overhead is minimal (one extra `emit` call that returns immediately).

### Efficient Event Handling
```javascript
class OptimizedMonitor extends WildcardEventEmitter {
  constructor() {
    super();
    this.wildcardListeners = 0;
    
    // Track wildcard listener count
    this.on('newListener', (event) => {
      if (event === '*') this.wildcardListeners++;
    });
    
    this.on('removeListener', (event) => {
      if (event === '*') this.wildcardListeners--;
    });
  }
  
  emit(event, ...args) {
    // Skip wildcard emission if no listeners
    if (this.wildcardListeners === 0) {
      return super.emit(event, ...args);
    }
    
    // Normal wildcard behavior
    const result = super.emit(event, ...args);
    super.emit('*', event, ...args);
    return result;
  }
}
```

## API Reference

### Class: WildcardEventEmitter

Extends: `EventEmitter` (from eventemitter3)

#### Methods

All methods from EventEmitter3 are available, plus:

##### `emit(event, ...args)`
Emits an event and automatically emits a wildcard `*` event.

**Parameters:**
- `event` (string): The event name
- `...args` (any): Arguments to pass to event listeners

**Returns:** Boolean indicating if any listeners were called

##### `on('*', listener)`
Listen to all events.

**Parameters:**
- `listener` (function): Callback receiving `(eventName, ...args)`

**Example:**
```javascript
emitter.on('*', (eventName, data) => {
  console.log(`Event ${eventName} fired with:`, data);
});
```

## Integration with Poker Game Manager

The poker library uses WildcardEventEmitter throughout:

```javascript
import { Table, WildcardEventEmitter } from '@jkraybill/poker-game-manager';

// Table extends WildcardEventEmitter
const table = new Table({ blinds: { small: 10, big: 20 } });

// Monitor all table events
table.on('*', (eventName, ...args) => {
  console.log(`[TABLE] ${eventName}`, args);
});

// Your custom components can too
class CustomTournament extends WildcardEventEmitter {
  constructor() {
    super();
    // Your tournament logic
  }
}
```

## Best Practices

1. **Use for debugging** - Great for development, consider removing in production
2. **Filter events** - Not all events need to be logged/tracked
3. **Avoid heavy processing** - Wildcard listeners are called for EVERY event
4. **Clean up listeners** - Remove wildcard listeners when done
5. **Consider performance** - Wildcard listeners add overhead to every event

## Migration Guide

If you're currently using EventEmitter3 directly:

```javascript
// Before
import { EventEmitter } from 'eventemitter3';
class MyClass extends EventEmitter {
  // Manual wildcard implementation
}

// After  
import { WildcardEventEmitter } from '@jkraybill/poker-game-manager';
class MyClass extends WildcardEventEmitter {
  // Wildcard support built-in!
}
```

## TypeScript Support

```typescript
import { WildcardEventEmitter } from '@jkraybill/poker-game-manager';

interface MyEvents {
  'user:login': (user: User) => void;
  'user:logout': (userId: string) => void;
  '*': (event: string, ...args: any[]) => void;
}

class TypedEmitter extends WildcardEventEmitter<MyEvents> {
  // Fully typed event emitter with wildcard support
}
```

---

**Available in v4.4.2+** - The WildcardEventEmitter is now fully exported and ready for use in your poker applications!