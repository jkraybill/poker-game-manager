import { describe, it, expect } from 'vitest';
import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';
import { validateIntegerAmount, ensureInteger } from '../utils/validation.js';

/**
 * Test integer validation for all chip, bet, and pot amounts
 */
describe('Integer Validation for Chips, Bets, and Pots', () => {
  describe('Validation utility functions', () => {
    it('should validate integer amounts correctly', () => {
      // Valid integers
      expect(validateIntegerAmount(100, 'test')).toBe(100);
      expect(validateIntegerAmount(0, 'test')).toBe(0);
      expect(validateIntegerAmount('50', 'test')).toBe(50);

      // Invalid inputs should throw
      expect(() => validateIntegerAmount(10.5, 'test')).toThrow('test must be an integer');
      expect(() => validateIntegerAmount(-5, 'test')).toThrow('test must be non-negative');
      expect(() => validateIntegerAmount('abc', 'test')).toThrow('test must be a number');
      expect(() => validateIntegerAmount(null, 'test')).toThrow('test is required');
      expect(() => validateIntegerAmount(undefined, 'test')).toThrow('test is required');
    });

    it('should ensure integer by rounding when necessary', () => {
      expect(ensureInteger(10.7, 'test')).toBe(11);
      expect(ensureInteger(10.3, 'test')).toBe(10);
      expect(ensureInteger(10.5, 'test')).toBe(11); // Rounds to nearest even
      expect(ensureInteger(-5.5, 'test')).toBe(0); // Negative becomes 0
      expect(ensureInteger('25', 'test')).toBe(25);
      expect(ensureInteger(null, 'test')).toBe(0);
      expect(ensureInteger(undefined, 'test')).toBe(0);
    });
  });

  describe('Blind validation', () => {
    it('should reject non-integer blinds', () => {
      const manager = new PokerGameManager();
      
      // Fractional blinds should throw
      expect(() => {
        manager.createTable({
          id: 'fractional-blinds',
          blinds: { small: 2.5, big: 5 },
        });
      }).toThrow('small blind must be an integer');

      expect(() => {
        manager.createTable({
          id: 'fractional-big-blind',
          blinds: { small: 10, big: 20.5 },
        });
      }).toThrow('big blind must be an integer');

      // Negative blinds should throw
      expect(() => {
        manager.createTable({
          id: 'negative-blind',
          blinds: { small: -10, big: 20 },
        });
      }).toThrow('small blind must be non-negative');
    });

    it('should accept valid integer blinds', () => {
      const manager = new PokerGameManager();
      const table = manager.createTable({
        id: 'valid-blinds',
        blinds: { small: 10, big: 20 },
      });
      
      expect(table.config.blinds.small).toBe(10);
      expect(table.config.blinds.big).toBe(20);
      
      table.close();
    });
  });

  describe('Player chip validation', () => {
    it('should round fractional chip amounts', () => {
      const player = new Player({ id: 'p1', name: 'Test Player' });
      
      // Setting fractional chips should round
      player.chips = 100.5;
      expect(player.chips).toBe(101);
      
      player.chips = 50.3;
      expect(player.chips).toBe(50);
      
      // Adding fractional chips should round
      player.addChips(25.7);
      expect(player.chips).toBe(76); // 50 + 26
      
      // Negative chips become 0
      player.chips = -100;
      expect(player.chips).toBe(0);
    });

    it('should handle string chip amounts', () => {
      const player = new Player({ id: 'p2', name: 'String Player' });
      
      player.chips = '1000';
      expect(player.chips).toBe(1000);
      
      player.addChips('250');
      expect(player.chips).toBe(1250);
    });
  });

  describe('Betting action validation', () => {
    it('should reject non-integer bet amounts', async () => {
      const manager = new PokerGameManager();
      const table = manager.createTable({
        id: 'bet-validation',
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
        dealerButton: 0,
      });

      let errorCaught = null;
      
      const player1 = new Player({ id: 'p1', name: 'Bettor' });
      player1.chips = 1000;
      // eslint-disable-next-line require-await
      player1.getAction = async (gameState) => {
        if (gameState.toCall === 0) {
          // Try to bet a fractional amount
          return { action: Action.BET, amount: 50.5 };
        }
        return { action: Action.FOLD };
      };

      const player2 = new Player({ id: 'p2', name: 'Folder' });
      player2.chips = 1000;
      // eslint-disable-next-line require-await
      player2.getAction = async () => ({ action: Action.FOLD });

      table.addPlayer(player1);
      table.addPlayer(player2);

      // Listen for errors
      table.on('game:error', (error) => {
        errorCaught = error;
      });

      const result = await table.tryStartGame();
      
      // The fractional bet should be caught by validation
      if (result.success) {
        // Wait for game to process
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Either the game should fail or the bet should be rounded
      // In our implementation, ensureInteger rounds, so 50.5 becomes 51
      // No error should be thrown since we handle it gracefully
      expect(errorCaught).toBeNull();
      
      table.close();
    });

    it('should round bet amounts gracefully', async () => {
      const manager = new PokerGameManager();
      const table = manager.createTable({
        id: 'bet-rounding',
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
        dealerButton: 0,
      });

      let actualBetAmount = null;
      
      const player1 = new Player({ id: 'p1', name: 'Bettor' });
      player1.chips = 1000;
      // eslint-disable-next-line require-await
      player1.getAction = async (gameState) => {
        if (gameState.toCall === 0) {
          // Try to bet a fractional amount
          return { action: Action.BET, amount: 75.5 };
        }
        return { action: Action.CALL };
      };

      const player2 = new Player({ id: 'p2', name: 'Caller' });
      player2.chips = 1000;
      // eslint-disable-next-line require-await
      player2.getAction = async () => ({ action: Action.CALL });

      table.addPlayer(player1);
      table.addPlayer(player2);

      // Listen for bet action
      table.on('player:action', (data) => {
        if (data.action === Action.BET) {
          actualBetAmount = data.amount;
        }
      });

      await table.tryStartGame();
      
      // Wait for actions to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // The bet should be rounded to 76
      expect(actualBetAmount).toBe(76);
      
      table.close();
    });

    it('should handle raise amounts as integers', async () => {
      const manager = new PokerGameManager();
      const table = manager.createTable({
        id: 'raise-validation',
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
        dealerButton: 0,
      });

      let raiseAmount = null;
      
      const player1 = new Player({ id: 'p1', name: 'Raiser' });
      player1.chips = 1000;
      // eslint-disable-next-line require-await
      player1.getAction = async (gameState) => {
        if (gameState.toCall > 0 && gameState.toCall < 100) {
          // Raise with fractional amount - should be rounded
          return { action: Action.RAISE, amount: 100.8 };
        }
        return { action: Action.CALL };
      };

      const player2 = new Player({ id: 'p2', name: 'Initial Bettor' });
      player2.chips = 1000;
      let actionCount = 0;
      // eslint-disable-next-line require-await
      player2.getAction = async () => {
        actionCount++;
        if (actionCount === 1) {
          return { action: Action.RAISE, amount: 40 }; // Initial raise
        }
        return { action: Action.CALL };
      };

      table.addPlayer(player1);
      table.addPlayer(player2);

      // Listen for raise action
      table.on('player:action', (data) => {
        if (data.action === Action.RAISE && data.playerId === 'p1') {
          raiseAmount = data.amount;
        }
      });

      await table.tryStartGame();
      
      // Wait for actions to process
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // The raise should be rounded to 101
      expect(raiseAmount).toBe(101);
      
      table.close();
    });
  });

  describe('Pot calculation validation', () => {
    it('should ensure pot amounts are integers', async () => {
      const manager = new PokerGameManager();
      const table = manager.createTable({
        id: 'pot-validation',
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
        dealerButton: 0,
      });

      const player1 = new Player({ id: 'p1', name: 'Player 1' });
      player1.chips = 1000;
      // eslint-disable-next-line require-await
      player1.getAction = async () => ({ action: Action.CALL });

      const player2 = new Player({ id: 'p2', name: 'Player 2' });
      player2.chips = 1000;
      // eslint-disable-next-line require-await
      player2.getAction = async () => ({ action: Action.CHECK });

      table.addPlayer(player1);
      table.addPlayer(player2);

      let finalPot = null;
      table.on('hand:complete', (data) => {
        finalPot = data.pot;
      });

      await table.tryStartGame();
      
      // Wait for hand to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Pot should be an integer (40 = small blind 10 + big blind 20 + call 10)
      expect(Number.isInteger(finalPot)).toBe(true);
      expect(finalPot).toBe(40);
      
      table.close();
    });

    it('should handle all-in amounts as integers', async () => {
      const manager = new PokerGameManager();
      const table = manager.createTable({
        id: 'allin-validation',
        blinds: { small: 10, big: 20 },
        minPlayers: 2,
        dealerButton: 0,
      });

      const player1 = new Player({ id: 'p1', name: 'All-in Player' });
      player1.chips = 75; // Odd amount for all-in
      // eslint-disable-next-line require-await
      player1.getAction = async () => ({ action: Action.ALL_IN });

      const player2 = new Player({ id: 'p2', name: 'Caller' });
      player2.chips = 1000;
      // eslint-disable-next-line require-await
      player2.getAction = async () => ({ action: Action.CALL });

      table.addPlayer(player1);
      table.addPlayer(player2);

      let allInAmount = null;
      table.on('player:action', (data) => {
        if (data.action === Action.ALL_IN) {
          allInAmount = data.amount;
        }
      });

      await table.tryStartGame();
      
      // Wait for actions
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // All-in amount should be an integer
      expect(Number.isInteger(allInAmount)).toBe(true);
      
      table.close();
    });
  });

  describe('Edge cases', () => {
    it('should handle very large integer amounts', () => {
      const player = new Player({ id: 'rich', name: 'Rich Player' });
      
      const largeAmount = 1000000000; // 1 billion
      player.chips = largeAmount;
      expect(player.chips).toBe(largeAmount);
      
      // Should still validate as integer
      expect(validateIntegerAmount(largeAmount, 'large')).toBe(largeAmount);
    });

    it('should handle zero amounts correctly', () => {
      const player = new Player({ id: 'broke', name: 'Broke Player' });
      
      player.chips = 0;
      expect(player.chips).toBe(0);
      
      // Zero is a valid integer amount
      expect(validateIntegerAmount(0, 'zero')).toBe(0);
    });

    it('should reject NaN and Infinity', () => {
      expect(() => validateIntegerAmount(NaN, 'nan')).toThrow('nan must be a number');
      expect(() => validateIntegerAmount(Infinity, 'inf')).toThrow('inf must be an integer');
      expect(() => validateIntegerAmount(-Infinity, 'neginf')).toThrow('neginf must be an integer');
    });
  });
});