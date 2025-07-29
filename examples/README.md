# Poker Game Manager Examples

This directory contains example implementations demonstrating how to use the Poker Game Manager library.

## Examples

### 1. simple-game.js
A basic example showing a single hand of poker with 3 players. Demonstrates:
- Basic player implementations (Folding, Calling, Aggressive)
- Event listening and logging
- Single hand gameplay
- Final chip counts

### 2. simple-game-multi-hand.js
A clean, educational example showing 5 hands of poker with 3 players. Demonstrates:
- **Multi-hand gameplay** - Plays exactly 5 hands
- **Dealer button rotation** - Tracks button movement across hands
- **Chip persistence** - Shows chip counts between hands
- **Player elimination** - Handles players running out of chips
- **Final standings** - Shows tournament-style results with medals
- **Game statistics** - Tracks hands played and chip conservation
- **Proper hand restart** - Uses `table.tryStartGame()` between hands

### 3. simple-game-multiple-hands.js
An advanced example showing multi-hand gameplay with 6 players over 12 hands. Demonstrates:
- **Comprehensive event listening** - All available events from both Manager and Table
- **Multi-hand gameplay** - 12 consecutive hands with proper dealer rotation
- **6-player dynamics** - Full table with diverse player strategies
- **Player elimination** - Handling players running out of chips
- **Tournament-style play** - Continues until completion or single winner
- **Detailed logging** - Every event is captured and displayed

## Running the Examples

```bash
# Run single hand example
node examples/simple-game.js

# Run simple multi-hand example (5 hands with 3 players)
node examples/simple-game-multi-hand.js

# Run advanced multi-hand example (12 hands with 6 players)
node examples/simple-game-multiple-hands.js
```

## Key Events Demonstrated in Multi-Hand Example

### Manager Events
- `table:created` - When a new table is created
- `table:destroyed` - When a table is closed

### Table Events
- `player:joined` - Player joins the table
- `player:left` - Player leaves the table
- `table:ready` - Minimum players reached
- `game:started` - New game begins
- `hand:started` - New hand begins with dealer button position
- `round:started` - Betting round begins (PRE_FLOP, FLOP, TURN, RIVER)
- `round:ended` - Betting round completes
- `cards:dealt` - Private cards dealt to players
- `cards:community` - Community cards revealed
- `action:requested` - Player's turn to act with betting details
- `player:action` - Player makes an action
- `pot:updated` - Pot amount changes
- `pot:created` - New side pot created
- `showdown:started` - Showdown phase begins
- `hand:ended` - Hand completes with winners
- `chips:awarded` - Chips distributed to winners
- `player:eliminated` - Player runs out of chips
- `error` - Error events

## Player Strategies

### ConservativePlayer
- Rarely bets (10% chance)
- Only calls small bets (≤ 10% of stack)
- Folds to pressure

### LoosePlayer
- Occasionally goes all-in (5% chance)
- Bets frequently (30% chance)
- Calls up to 50% of stack
- Only folds to very large bets

## Customization

You can modify the examples by:
- Changing `HANDS_TO_PLAY` constant for different game lengths
- Adjusting `PLAYER_COUNT` for different table sizes (min 3)
- Creating custom Player implementations
- Modifying blinds and buy-in amounts
- Adding additional event handlers