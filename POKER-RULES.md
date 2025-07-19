# Texas Hold'em Tournament Poker Rules for Simulation

This document contains poker rules specifically for computer simulation of multi-table tournaments, focusing only on game mechanics and logic.

## Table of Contents

1. [General Game Structure](#1-general-game-structure)
2. [Seating and Table Management](#2-seating-and-table-management)
3. [Button and Blinds](#3-button-and-blinds)
4. [Dealing and Game Progression](#4-dealing-and-game-progression)
5. [Betting Rules](#5-betting-rules)
6. [Showdown and Pot Distribution](#6-showdown-and-pot-distribution)
7. [All-In Situations](#7-all-in-situations)
8. [Tournament Specific Rules](#8-tournament-specific-rules)

---

## 1. General Game Structure

### 1.1 Game Integrity
The best hand wins at showdown based on standard poker hand rankings.

### 1.2 New Hand and Level Progression
- **1.2.1** A new hand begins when cards are dealt
- **1.2.2** A new blind level applies to the next hand after the level change
- **1.2.3** Once substantial action occurs, the hand continues at the current blind level

### 1.3 Substantial Action Definition
Substantial Action (SA) is either:
- **1.3.1** Any 2 actions in turn, at least one of which puts chips in the pot (except 2 checks or 2 folds)
- **1.3.2** Any combination of 3 actions in turn (check, bet, raise, call, fold)
- **1.3.3** Posted blinds do not count towards SA

---

## 2. Seating and Table Management

### 2.1 Table Assignment
- **2.1.1** Tournament seats are randomly assigned
- **2.1.2** Players entering late receive full starting stacks
- **2.1.3** New players and players from broken tables can get any seat and are dealt in except between SB and button

### 2.2 Table Balancing
- **2.2.1** The player to be big blind next moves to the worst position (including single big blind)
- **2.2.2** Worst position is never the small blind
- **2.2.3** Players may be big blind twice in a row when balancing
- **2.2.4** Play halts on tables 3 or more players short of the table with most players

---

## 3. Button and Blinds

### 3.1 Dead Button Rule
- **3.1.1** Tournament play uses a dead button
- **3.1.2** Small blind may have the button
- **3.1.3** Big blind is never on the button

### 3.2 Heads-Up Rules
- **3.2.1** The small blind is on the button
- **3.2.2** The button/SB is dealt last card
- **3.2.3** The button/SB acts first pre-flop and last on all other betting rounds
- **3.2.4** When starting heads-up, button position adjusts to ensure no player has big blind twice in a row

### 3.3 Blind Posting
- **3.3.1** Players must post blinds in turn
- **3.3.2** A player who posts a short blind creates a dead small blind
- **3.3.3** Players cannot skip blinds

---

## 4. Dealing and Game Progression

### 4.1 Initial Deal
- **4.1.1** Each player receives 2 hole cards
- **4.1.2** Cards are dealt clockwise starting from small blind
- **4.1.3** Deal continues even if players are absent

### 4.2 Community Cards
- **4.2.1** Burn one card before each street
- **4.2.2** Flop: 3 cards dealt together
- **4.2.3** Turn: 1 card
- **4.2.4** River: 1 card

### 4.3 Betting Rounds
- **4.3.1** Pre-flop: Action starts with player to left of big blind
- **4.3.2** Post-flop: Action starts with first active player to left of button
- **4.3.3** Betting continues until all active players have acted and matched the current bet

---

## 5. Betting Rules

### 5.1 Valid Actions
- **5.1.1** Check: When no bet is faced
- **5.1.2** Bet: First chips into pot on a betting round
- **5.1.3** Call: Match the current bet
- **5.1.4** Raise: Increase the current bet
- **5.1.5** Fold: Surrender hand and forfeit chips in pot
- **5.1.6** All-in: Bet all remaining chips

### 5.2 Betting Amounts

#### 5.2.1 Minimum Bets and Raises
- **5.2.1.1** Opening bet must be at least the big blind
- **5.2.1.2** A raise must be at least equal to the largest prior bet or raise of the current round
- **5.2.1.3** In no-limit, a bet amount must be either a valid call or a valid raise (no in-between amounts)

#### 5.2.2 All-In Wagers
- **5.2.2.1** A player may bet all remaining chips at any time
- **5.2.2.2** An all-in wager less than a full raise does not reopen betting for players who already acted

### 5.3 Pot-Limit Specific Rules
- **5.3.1** Maximum bet is the size of the pot
- **5.3.2** Pot size calculation includes all prior bets and the amount needed to call
- **5.3.3** Pre-flop, assume full blinds are posted for pot calculations

### 5.4 Acting in Turn
- **5.4.1** Players must act in clockwise order
- **5.4.2** All actions are final once taken

---

## 6. Showdown and Pot Distribution

### 6.1 Showdown Order
- **6.1.1** Last aggressor on final betting round shows first
- **6.1.2** If no betting on final round, first position shows first
- **6.1.3** Subsequent players show in clockwise order
- **6.1.4** In simulation, all hands in showdown are revealed

### 6.2 Hand Rankings (High to Low)
1. **6.2.1** Royal Flush
2. **6.2.2** Straight Flush
3. **6.2.3** Four of a Kind
4. **6.2.4** Full House
5. **6.2.5** Flush
6. **6.2.6** Straight
7. **6.2.7** Three of a Kind
8. **6.2.8** Two Pair
9. **6.2.9** One Pair
10. **6.2.10** High Card

### 6.3 Pot Distribution
- **6.3.1** Best hand wins entire pot if no all-ins
- **6.3.2** Identical hands split the pot equally
- **6.3.3** Odd chips go to first position from button

### 6.4 Playing the Board
- **6.4.1** Best 5-card hand using any combination of hole cards and community cards

---

## 7. All-In Situations

### 7.1 Side Pots
- **7.1.1** When a player is all-in and other players continue betting, a side pot is created
- **7.1.2** All-in player can only win the main pot
- **7.1.3** Each all-in creates a separate pot if at different amounts
- **7.1.4** Pots are awarded from last created (side pots) to first created (main pot)

### 7.2 All-In Showdown
- **7.2.1** When a player is all-in and all action is complete, proceed to showdown
- **7.2.2** Remaining cards are dealt without further betting

### 7.3 Multiple All-Ins
- **7.3.1** Process in order from smallest stack to largest
- **7.3.2** Each all-in amount creates a pot that player is eligible for
- **7.3.3** Only players who contributed to a pot can win it

---

## 8. Tournament Specific Rules

### 8.1 Chip Management
- **8.1.1** Tournament chips have no cash value
- **8.1.2** Chip denominations should be optimized for efficient calculation

### 8.2 Elimination
- **8.2.1** A player with no chips is eliminated
- **8.2.2** Eliminated players are removed from tournament

### 8.3 Re-entry Rules (if applicable)
- **8.3.1** Re-entering players receive full starting stack
- **8.3.2** Re-entries are seated using same random process as new players

### 8.4 Blind Level Progression
- **8.4.1** Blinds increase at predetermined intervals
- **8.4.2** New blind level applies to next hand
- **8.4.3** Antes may be introduced at certain levels

### 8.5 Final Table
- **8.5.1** 9-handed events: Final table forms when 9 players remain
- **8.5.2** 6-handed events: Final table forms when 6 or 7 players remain
- **8.5.3** Seats are randomly reassigned at final table

---

## Key Definitions

**Betting Round**: One complete cycle of betting action (pre-flop, flop, turn, river)

**Street**: Another term for betting round

**Position**: Seat location relative to button/blinds

**In Position**: Acting after opponent(s)

**Out of Position**: Acting before opponent(s)

**Under the Gun (UTG)**: First position to act pre-flop (left of big blind)

**Cutoff**: Position immediately before the button

**Hijack**: Position immediately before the cutoff

---

## Implementation Notes for Simulation

1. **Random Number Generation**: All shuffling and seat assignments must use cryptographically secure randomization
2. **Timing**: Blind levels progress based on configurable hand counts or time intervals
3. **Action Validation**: All actions must be validated against current game state
4. **State Persistence**: Maintain complete game state for each hand
5. **Side Pot Calculation**: Implement precise algorithm for multiple all-in scenarios
6. **Hand Evaluation**: Use efficient poker hand ranking algorithms
7. **Position Tracking**: Maintain accurate position for each player relative to button
8. **Tournament State**: Track eliminations, table breaking, and rebalancing

---

*Adapted for computer simulation of multi-table poker tournaments*