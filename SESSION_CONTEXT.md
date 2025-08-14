# SESSION CONTEXT - Poker Game Manager v4.4.7

## 🚀 v4.4.7 INFINITE LOOP BUG ELIMINATED

**STATUS: EMERGENCY HOTFIX - Infinite Loop Bug FIXED** ✨

### **Current Release: v4.4.7** 
- **🚨 INFINITE LOOP ELIMINATED**: Fixed devastating CHECK-CHECK infinite loop from v4.4.6
- **🔒 MUTEX PROTECTION**: Race condition in `endBettingRound()` prevented with mutex  
- **🏆 TOURNAMENT READY**: Memory exhaustion and hanging completely resolved
- **🧪 REGRESSION TEST**: `infinite-loop-regression.test.js` prevents bug recurrence
- **✅ 260+ TESTS PASSING**: All tests including critical infinite loop scenarios

### **Recent v4.x Features**
- **v4.3.0**: Integer validation for all monetary values (chips, bets, pots)
- **v4.2.0**: Enhanced code quality and ESLint compliance
- **v4.1.0**: Detailed game start diagnostics with structured error results
- **v4.0.0**: Race condition fix with async `tryStartGame()`

### **v3.0 Foundation Features**
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

### **Position-Aware Quick Start**
```javascript
import { PokerGameManager, Player, Action } from '@jkraybill/poker-game-manager';

// Position-aware player with strategic decisions
class PositionalPlayer extends Player {
  async getAction(gameState) {
    switch(this.currentPosition) {
      case 'button': return { action: Action.RAISE, amount: gameState.bigBlind * 3 };
      case 'big-blind': return { action: Action.CALL };
      case 'under-the-gun': return { action: Action.FOLD };
      default: return { action: Action.CHECK };
    }
  }
}

// Set up table with position tracking
table.on('hand:started', ({ positions }) => {
  // Update players with their current positions
  Object.entries(positions.positions).forEach(([playerId, position]) => {
    const playerData = table.players.get(playerId);
    if (playerData) playerData.player.currentPosition = position;
  });
});

// Players must have chips before joining
const player = new PositionalPlayer({ name: 'Hero' });
player.chips = 1000;  // v2.0+ API
table.addPlayer(player);

// Use Action enum for all actions
return { action: Action.FOLD };  // Only when toCall > 0!
```

### **Publishing Process**
```bash
# NEVER manually publish!
git tag v4.x.x && git push origin v4.x.x  # CI handles the rest
```