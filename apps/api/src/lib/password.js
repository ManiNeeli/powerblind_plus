const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 12;
const MIN_LENGTH = 10;

// Top-100 most common passwords (abbreviated — expand for production)
const COMMON_PASSWORDS = new Set([
  'password123', 'password1', '123456789', '12345678', 'qwerty123',
  'iloveyou1', 'admin1234', 'letmein1!', 'welcome1!', 'monkey123',
  'dragon123', 'master123', 'sunshine1', 'princess1', 'superman1',
  'shadow123', 'michael1!', 'football1', 'baseball1', 'whatever1',
]);

/**
 * Enforces password policy. Returns an error string or null if valid.
 */
function validatePassword(password) {
  if (!password || password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters long.`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one special character.';
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'That password is too common. Please choose a stronger password.';
  }
  return null;
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { validatePassword, hashPassword, comparePassword };
