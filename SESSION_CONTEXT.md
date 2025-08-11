# SESSION CONTEXT - Poker Game Manager v4.0.0

## 🚨 v4.0.0 BREAKING CHANGE - RACE CONDITION FIX!

**STATUS: MAJOR VERSION - Breaking API Change** ⚠️

### **Current Release: v4.0.0**
- **🚨 BREAKING**: `tryStartGame()` now returns `Promise<boolean>` (was `boolean`)
- **🔧 RACE CONDITION FIX**: Properly awaits `gameEngine.start()`
- **🎯 CONCURRENT TABLES**: Fixes infinite loop with multiple tables
- **✅ 267 TESTS PASSING**: All tests updated for async API

### **Previous v3.0.3-3.0.4 Features**
- **💰 CHIP CONSERVATION**: 100% perfect chip tracking guaranteed
- **🎯 ERROR MESSAGES**: Detailed validation errors with full game state

### **v3.0 Breaking Changes**
- **Action Enum Mandatory**: String actions throw fatal errors
- **Strict Fold Validation**: Cannot fold when toCall = 0
- **Simulation Framework**: Invalid actions crash immediately

### **What's Working**
- Texas Hold'em rules with dead button
- Side pots and eliminations
- Event-driven architecture
- Fast hand evaluation (32x optimized)
- Clean, tested codebase

### **Quick Start**
```javascript
import { PokerGameManager, Player, Action } from '@jkraybill/poker-game-manager';

// Players must have chips before joining
const player = new SimplePlayer({ name: 'Hero' });
player.buyIn(1000);
table.addPlayer(player);

// Use Action enum for all actions
return { action: Action.FOLD };  // Only when toCall > 0!
```

### **Publishing Process**
```bash
# NEVER manually publish!
git tag v3.x.x && git push origin v3.x.x  # CI handles the rest
```