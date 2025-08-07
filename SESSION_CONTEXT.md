# SESSION CONTEXT - Poker Game Manager v3.0.2

## 🎉 v3.0.2 RACE CONDITION FIX! 🏁

**STATUS: PRODUCTION READY - Chip Conservation Guaranteed** ✅

### **Current Release: v3.0.2**
- **🔧 RACE CONDITION FIXED**: `hand:ended` now fires AFTER elimination processing
- **✅ CHIP CONSERVATION**: External systems always see consistent state
- **✅ EVENT ORDERING**: Eliminations complete before hand:ended
- **✅ 247 TESTS PASSING**: All tests updated and passing
- **✅ TOURNAMENT READY**: Perfect for multi-table tournament managers

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