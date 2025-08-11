# SESSION CONTEXT - Poker Game Manager v3.0.5

## 🚀 v3.0.5 FAIL-FAST CONTRACT ENFORCEMENT!

**STATUS: PRODUCTION READY - Rock-Solid Stability** ✅

### **Current Release: v3.0.5**
- **🚀 FAIL-FAST**: Player contract violations immediately crash with no retry
- **📢 CLEAR ERRORS**: Fatal errors indicate exactly which player broke contract
- **🔧 DEVELOPER-FRIENDLY**: Broken implementations caught immediately
- **✅ 266 TESTS PASSING**: Comprehensive test coverage including fail-fast tests

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