import { EventEmitter } from 'eventemitter3';

/**
 * Extended EventEmitter that automatically emits a wildcard "*" event
 * for every event that is emitted, allowing subscribers to listen to all events
 */
export class WildcardEventEmitter extends EventEmitter {
  emit(event, ...args) {
    // First emit the specific event
    const result = super.emit(event, ...args);
    
    // Then emit the wildcard event with the event name as first argument
    super.emit('*', event, ...args);
    
    return result;
  }
}