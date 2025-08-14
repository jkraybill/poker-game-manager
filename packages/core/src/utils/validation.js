/**
 * Validation utilities for poker game amounts
 */

/**
 * Validates that a value is a valid integer amount for chips/bets
 * @param {any} value - The value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {number} The validated integer value
 * @throws {Error} If the value is not a valid integer
 */
export function validateIntegerAmount(value, fieldName = 'amount') {
  // Check if value is defined
  if (value === undefined || value === null) {
    throw new Error(`${fieldName} is required but was ${value}`);
  }

  // Convert to number if string
  const numValue = typeof value === 'string' ? Number(value) : value;

  // Check if it's a valid number
  if (typeof numValue !== 'number' || isNaN(numValue)) {
    throw new Error(
      `${fieldName} must be a number, got ${typeof value}: ${value}`,
    );
  }

  // Check if it's an integer
  if (!Number.isInteger(numValue)) {
    throw new Error(`${fieldName} must be an integer, got ${numValue}`);
  }

  // Check if it's non-negative
  if (numValue < 0) {
    throw new Error(`${fieldName} must be non-negative, got ${numValue}`);
  }

  return numValue;
}

/**
 * Ensures a value is an integer by rounding if necessary
 * @param {number} value - The value to ensure is an integer
 * @param {string} fieldName - Name of the field for logging
 * @returns {number} The integer value
 */
export function ensureInteger(value, fieldName = 'amount') {
  if (value === undefined || value === null) {
    return 0;
  }

  const numValue = typeof value === 'string' ? Number(value) : value;

  if (isNaN(numValue)) {
    return 0;
  }

  // Round to nearest integer if not already an integer
  const intValue = Math.round(numValue);

  if (intValue !== numValue && fieldName) {
    // console.warn(`Warning: ${fieldName} ${numValue} was rounded to ${intValue}`);
  }

  return Math.max(0, intValue); // Ensure non-negative
}

/**
 * Validates chip assignment to a player
 * @param {number} chips - The chip amount to validate
 * @returns {number} The validated integer chip amount
 * @throws {Error} If chips is not a valid positive integer
 */
export function validateChips(chips) {
  const validatedChips = validateIntegerAmount(chips, 'chips');

  // Chips must be positive (except when busted)
  if (validatedChips < 0) {
    throw new Error(`Chips cannot be negative, got ${validatedChips}`);
  }

  return validatedChips;
}

/**
 * Validates a bet amount
 * @param {number} amount - The bet amount to validate
 * @param {number} minBet - Minimum allowed bet
 * @param {number} maxBet - Maximum allowed bet
 * @returns {number} The validated integer bet amount
 * @throws {Error} If bet is not valid
 */
export function validateBet(amount, minBet = 0, maxBet = Infinity) {
  const validatedAmount = validateIntegerAmount(amount, 'bet amount');

  if (minBet !== undefined && validatedAmount < minBet) {
    throw new Error(`Bet amount ${validatedAmount} is below minimum ${minBet}`);
  }

  if (maxBet !== undefined && validatedAmount > maxBet) {
    throw new Error(`Bet amount ${validatedAmount} exceeds maximum ${maxBet}`);
  }

  return validatedAmount;
}
