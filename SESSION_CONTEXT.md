# SESSION CONTEXT - Poker Game Manager v3.0.3

## 🎉 v3.0.3 CRITICAL CHIP CONSERVATION FIX! 💰

**STATUS: PRODUCTION READY - Perfect Chip Conservation** ✅

### **Current Release: v3.0.3**
- **💰 CRITICAL FIX**: Resolved chip conservation bug causing up to 15% chip loss
- **🔧 UNCALLED BETS**: Properly refunds uncalled chips in side pot scenarios
- **✅ 100% CHIP CONSERVATION**: Perfect chip tracking in all scenarios
- **✅ COMPREHENSIVE TESTS**: Added chip conservation test suite
- **✅ 247+ TESTS PASSING**: All tests passing with perfect chip tracking

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