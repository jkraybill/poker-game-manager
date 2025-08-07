# Troubleshooting Guide

## Common Development Issues & Solutions

> **Note**: This covers general development issues. The core poker engine is production-ready and extensively tested with 242 tests.

### 1. All Tests Failing with Dealer Button Errors
**Symptom**: Tests fail with position/betting order issues
**Cause**: Non-deterministic dealer button position
**Solution**: 
```javascript
// Always use dealerButton: 0 in tests
const table = manager.createTable({
  blinds: { small: 10, big: 20 },
  dealerButton: 0,  // REQUIRED for deterministic tests
});
```

### 2. Custom Player Implementation Issues
**Symptom**: Player actions not being processed correctly
**Common Causes**: Missing required fields in action objects
**Solution**: 
```javascript
// Always return complete action objects
getAction(gameState) {
  return {
    playerId: this.id,
    action: Action.FOLD,
    amount: 0,
    timestamp: Date.now(),  // REQUIRED
  };
}
```

### 3. Test Timeout Errors
**Symptom**: Test hangs and times out
**Common Causes**:
1. Player not returning action with timestamp
2. minPlayers not set correctly
3. Infinite loop in player logic

**Debug Steps**:
```javascript
// Add debug logging to player
getAction(gameState) {
  console.log('Player state:', gameState.players[this.id]);
  // ... rest of logic
  
  // Always include timestamp!
  return {
    playerId: this.id,
    action: Action.FOLD,
    timestamp: Date.now(),  // REQUIRED
  };
}
```

### 4. ESLint Errors in CI
**Symptom**: CI fails even though tests pass locally
**Solution**: Run linting before pushing
```bash
# Run this before every commit
npm run lint && npm run format && npm test
```

### 5. Module Import Errors
**Symptom**: Cannot find module errors
**Cause**: Missing .js extension in imports
```javascript
// Wrong
import { Player } from './Player';

// Correct
import { Player } from './Player.js';
```

### 6. Event Name Confusion
**Symptom**: Event listeners not firing
**Issue**: `hand:complete` vs `hand:ended`
**Solution**: Use `hand:ended` - Table maps internally for compatibility

### 7. Position Calculations Wrong
**Symptom**: Players acting in wrong order
**Reference**: With `dealerButton: 0`
- 2 players: Player 0 = SB/Button, Player 1 = BB
- 3 players: Player 0 = Button, Player 1 = SB, Player 2 = BB
- 4+ players: Player 0 = Button, then SB, BB, UTG, MP, CO...

### 8. Race Conditions in Tests
**Symptom**: Tests pass individually but fail when run together
**Solutions**:
```javascript
// 1. Use afterEach cleanup
afterEach(() => {
  if (manager) {
    manager.tables.forEach(table => table.close());
  }
});

// 2. Control event capture
let captureEvents = true;
table.on('hand:ended', () => {
  captureEvents = false;  // Stop capturing
});

// 3. Don't reuse player instances
// Create fresh players for each test
```

### 9. Card Format Errors
**Symptom**: Hand evaluation fails
**Cause**: Using '10' instead of 'T'
```javascript
// Wrong
const cards = ['As', '10h', '2c'];

// Correct (pokersolver format)
const cards = ['As', 'Th', '2c'];  // T = 10
```

### 10. Git Push Rejected
**Symptom**: Push fails with "rejected" error
**Common Causes**:
1. Behind remote (need to pull first)
2. Protected branch rules
3. CI checks failing

**Solution**:
```bash
# Pull latest changes
git pull origin master

# If conflicts, resolve them then:
git add .
git commit -m "resolve conflicts"
git push origin master
```

## Debugging Commands

### Run Single Test with Full Output
```bash
# Show all console.log output
npm test -- betting-scenarios --no-silence

# Verbose reporter
npm test -- --reporter=verbose
```

### Find Specific Test
```bash
# Search for test by name pattern
npm test -- -t "squeeze play"
```

### Check File Differences
```bash
# See what changed
git diff

# See staged changes
git diff --staged
```

## When All Else Fails

1. **Check GitHub Issues**: Known bugs may already be tracked
2. **Read SESSION_CONTEXT.md**: May have recent workarounds
3. **Run Clean Install**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm test
   ```
4. **Check Node Version**: Must be 22.0.0 or higher
   ```bash
   node --version  # Should show v22.x.x
   ```