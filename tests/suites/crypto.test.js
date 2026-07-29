/**
 * crypto.test.js — Tests for window.CryptoService
 *
 * Covers: generateSalt, generateToken, generateOtp,
 *         hashPassword, verifyPassword, hashOtp
 *
 * All tests are async (Web Crypto API is async).
 */

const { describe, it } = TestRunner;
const {
  assertTrue, assertFalse, assertEqual,
  assertNotEqual, assertNotNull, assertMatch, assertLength,
} = Assert;

// ─── generateSalt ─────────────────────────────────────────────────────────────
describe('CryptoService.generateSalt', () => {
  it('should return a non-empty string', async () => {
    const salt = CryptoService.generateSalt();
    assertTrue(typeof salt === 'string' && salt.length > 0);
  });

  it('should return a hex string', async () => {
    const salt = CryptoService.generateSalt();
    assertMatch(salt, /^[0-9a-f]+$/);
  });

  it('should return a different value on each call', async () => {
    const a = CryptoService.generateSalt();
    const b = CryptoService.generateSalt();
    assertNotEqual(a, b);
  });

  it('should return 32 hex chars (16 bytes)', async () => {
    const salt = CryptoService.generateSalt();
    assertEqual(salt.length, 32);
  });
});

// ─── generateToken ────────────────────────────────────────────────────────────
describe('CryptoService.generateToken', () => {
  it('should return a non-empty string', async () => {
    const token = CryptoService.generateToken();
    assertTrue(typeof token === 'string' && token.length > 0);
  });

  it('should return a hex string', async () => {
    const token = CryptoService.generateToken();
    assertMatch(token, /^[0-9a-f]+$/);
  });

  it('should be at least 32 characters long', async () => {
    const token = CryptoService.generateToken();
    assertTrue(token.length >= 32);
  });

  it('should return a unique value on each call', async () => {
    const a = CryptoService.generateToken();
    const b = CryptoService.generateToken();
    assertNotEqual(a, b);
  });

  it('should return 64 hex chars (32 bytes)', async () => {
    const token = CryptoService.generateToken();
    assertEqual(token.length, 64);
  });
});

// ─── generateOtp ──────────────────────────────────────────────────────────────
describe('CryptoService.generateOtp', () => {
  it('should return a string', async () => {
    const otp = CryptoService.generateOtp();
    assertTrue(typeof otp === 'string');
  });

  it('should return exactly 6 characters', async () => {
    const otp = CryptoService.generateOtp();
    assertEqual(otp.length, 6);
  });

  it('should contain only digits 0-9', async () => {
    const otp = CryptoService.generateOtp();
    assertMatch(otp, /^\d{6}$/);
  });

  it('should produce different values across calls', async () => {
    const otps = new Set(Array.from({ length: 10 }, () => CryptoService.generateOtp()));
    assertTrue(otps.size > 1, 'Expected at least 2 different OTPs in 10 calls');
  });
});

// ─── hashPassword ─────────────────────────────────────────────────────────────
describe('CryptoService.hashPassword', () => {
  it('should return a non-empty string', async () => {
    const hash = await CryptoService.hashPassword('password123', 'somesalt');
    assertTrue(typeof hash === 'string' && hash.length > 0);
  });

  it('should return a hex string', async () => {
    const hash = await CryptoService.hashPassword('password', 'salt');
    assertMatch(hash, /^[0-9a-f]+$/);
  });

  it('should return the same hash for the same inputs', async () => {
    const h1 = await CryptoService.hashPassword('mypassword', 'mysalt');
    const h2 = await CryptoService.hashPassword('mypassword', 'mysalt');
    assertEqual(h1, h2);
  });

  it('should return a different hash when the salt differs', async () => {
    const h1 = await CryptoService.hashPassword('mypassword', 'salt1');
    const h2 = await CryptoService.hashPassword('mypassword', 'salt2');
    assertNotEqual(h1, h2);
  });

  it('should return a different hash when the password differs', async () => {
    const h1 = await CryptoService.hashPassword('password1', 'salt');
    const h2 = await CryptoService.hashPassword('password2', 'salt');
    assertNotEqual(h1, h2);
  });

  it('should hash an empty password without throwing', async () => {
    const hash = await CryptoService.hashPassword('', 'salt');
    assertTrue(typeof hash === 'string' && hash.length > 0);
  });

  it('should produce a different hash for empty vs non-empty password', async () => {
    const h1 = await CryptoService.hashPassword('', 'salt');
    const h2 = await CryptoService.hashPassword('a', 'salt');
    assertNotEqual(h1, h2);
  });
});

// ─── verifyPassword ───────────────────────────────────────────────────────────
describe('CryptoService.verifyPassword', () => {
  it('should return true for the correct password', async () => {
    const salt = CryptoService.generateSalt();
    const hash = await CryptoService.hashPassword('correctPass1!', salt);
    const ok   = await CryptoService.verifyPassword('correctPass1!', salt, hash);
    assertTrue(ok);
  });

  it('should return false for the wrong password', async () => {
    const salt = CryptoService.generateSalt();
    const hash = await CryptoService.hashPassword('correctPass1!', salt);
    const ok   = await CryptoService.verifyPassword('wrongpassword', salt, hash);
    assertFalse(ok);
  });

  it('should return false when the salt is different', async () => {
    const salt1 = CryptoService.generateSalt();
    const salt2 = CryptoService.generateSalt();
    const hash  = await CryptoService.hashPassword('password', salt1);
    const ok    = await CryptoService.verifyPassword('password', salt2, hash);
    assertFalse(ok);
  });

  it('should return false for empty password against non-empty hash', async () => {
    const salt = CryptoService.generateSalt();
    const hash = await CryptoService.hashPassword('realpassword', salt);
    const ok   = await CryptoService.verifyPassword('', salt, hash);
    assertFalse(ok);
  });
});

// ─── hashOtp ──────────────────────────────────────────────────────────────────
describe('CryptoService.hashOtp', () => {
  it('should return a non-empty string', async () => {
    const hash = await CryptoService.hashOtp('123456');
    assertTrue(typeof hash === 'string' && hash.length > 0);
  });

  it('should return the same hash for the same OTP', async () => {
    const h1 = await CryptoService.hashOtp('999999');
    const h2 = await CryptoService.hashOtp('999999');
    assertEqual(h1, h2);
  });

  it('should return different hashes for different OTPs', async () => {
    const h1 = await CryptoService.hashOtp('111111');
    const h2 = await CryptoService.hashOtp('222222');
    assertNotEqual(h1, h2);
  });

  it('should return a 64-char SHA-256 hex string', async () => {
    const hash = await CryptoService.hashOtp('123456');
    assertEqual(hash.length, 64);
    assertMatch(hash, /^[0-9a-f]+$/);
  });
});
