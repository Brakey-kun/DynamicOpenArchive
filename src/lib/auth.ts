import crypto from 'crypto';

// Hash a password with scrypt and a random salt. Returns "scrypt:<salt>:<hash>"
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

// Verify a password string against the stored representation.
// Supports both hashed (scrypt) and legacy plaintext values.
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  const parts = stored.split(':');
  if (parts.length === 3 && parts[0] === 'scrypt') {
    const [, salt, hash] = parts;
    const test = crypto.scryptSync(password, salt, 64).toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
    } catch {
      return hash === test;
    }
  }
  // Legacy fallback: plaintext comparison
  return stored === password;
}