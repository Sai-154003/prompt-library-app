/**
 * auth.test.js — Tests for window.AuthService
 *
 * Covers: signup, markVerified, login, logout, getSession,
 *         getLockoutStatus, changePassword, resetPassword
 *
 * Each test clears auth-related localStorage keys in beforeEach
 * to guarantee complete isolation.
 */

const { describe, it, beforeEach } = TestRunner;
const {
  assertTrue, assertFalse, assertEqual,
  assertNotNull, assertNull, assertContains,
} = Assert;

const AUTH_KEYS = ['pl_users', 'pl_session', 'pl_login_attempts', 'pl_otp_records'];
const clearAuth = () => AUTH_KEYS.forEach(k => localStorage.removeItem(k));

// Helper: sign up + verify a user in one step
const seedVerifiedUser = async (email = 'test@example.com', password = 'Passw0rd!', name = 'Test User') => {
  await AuthService.signup(name, email, password);
  AuthService.markVerified(email);
};

// ─── signup ───────────────────────────────────────────────────────────────────
describe('AuthService.signup', () => {
  beforeEach(clearAuth);

  it('should create a new user and return success: true', async () => {
    const r = await AuthService.signup('Jane Smith', 'jane@example.com', 'Passw0rd!');
    assertTrue(r.success);
  });

  it('should include the normalised email in the result', async () => {
    const r = await AuthService.signup('Jane Smith', 'Jane@Example.COM', 'Passw0rd!');
    assertEqual(r.email, 'jane@example.com');
  });

  it('should reject a duplicate verified email', async () => {
    await AuthService.signup('Jane Smith', 'jane@example.com', 'Passw0rd!');
    AuthService.markVerified('jane@example.com');
    const r = await AuthService.signup('Another Jane', 'jane@example.com', 'Passw0rd!');
    assertFalse(r.success);
    assertContains(r.message, 'already exists');
  });

  it('should allow re-signup with an unverified email (old record replaced)', async () => {
    await AuthService.signup('Jane Smith', 'jane@example.com', 'Passw0rd!');
    // NOT verified — try again
    const r = await AuthService.signup('Jane Smith', 'jane@example.com', 'NewPass1!');
    assertTrue(r.success);
  });

  it('should not store plain-text password in users list', async () => {
    await AuthService.signup('Jane Smith', 'jane@example.com', 'Passw0rd!');
    const raw = JSON.parse(localStorage.getItem('pl_users') || '[]');
    const user = raw.find(u => u.email === 'jane@example.com');
    assertNotNull(user);
    assertTrue(user.password === undefined, 'plain password must not be stored');
    assertNotNull(user.passwordHash);
    assertNotNull(user.salt);
  });

  it('should set isVerified to false on creation', async () => {
    await AuthService.signup('Jane Smith', 'jane@example.com', 'Passw0rd!');
    const raw  = JSON.parse(localStorage.getItem('pl_users') || '[]');
    const user = raw.find(u => u.email === 'jane@example.com');
    assertFalse(user.isVerified);
  });
});

// ─── markVerified ─────────────────────────────────────────────────────────────
describe('AuthService.markVerified', () => {
  beforeEach(clearAuth);

  it('should mark a user as verified and return true', async () => {
    await AuthService.signup('Jane Smith', 'jane@example.com', 'Passw0rd!');
    const result = AuthService.markVerified('jane@example.com');
    assertTrue(result);
    const raw  = JSON.parse(localStorage.getItem('pl_users') || '[]');
    const user = raw.find(u => u.email === 'jane@example.com');
    assertTrue(user.isVerified);
  });

  it('should return false for an unknown email', async () => {
    const result = AuthService.markVerified('nobody@example.com');
    assertFalse(result);
  });
});

// ─── login ────────────────────────────────────────────────────────────────────
describe('AuthService.login', () => {
  beforeEach(clearAuth);

  it('should return success: true with a session for valid verified credentials', async () => {
    await seedVerifiedUser();
    const r = await AuthService.login('test@example.com', 'Passw0rd!');
    assertTrue(r.success);
    assertNotNull(r.session);
    assertNotNull(r.session.token);
  });

  it('should return success: false for wrong password', async () => {
    await seedVerifiedUser();
    const r = await AuthService.login('test@example.com', 'WrongPass1!');
    assertFalse(r.success);
  });

  it('should mention remaining attempts in the failure message', async () => {
    await seedVerifiedUser();
    const r = await AuthService.login('test@example.com', 'WrongPass1!');
    assertContains(r.message, 'remaining');
  });

  it('should return success: false for a non-existent email', async () => {
    const r = await AuthService.login('nobody@example.com', 'Passw0rd!');
    assertFalse(r.success);
  });

  it('should return success: false for an unverified account', async () => {
    await AuthService.signup('Jane', 'jane@example.com', 'Passw0rd!');
    // NOT calling markVerified
    const r = await AuthService.login('jane@example.com', 'Passw0rd!');
    assertFalse(r.success);
  });

  it('should succeed after the account is verified', async () => {
    await AuthService.signup('Jane', 'jane@example.com', 'Passw0rd!');
    AuthService.markVerified('jane@example.com');
    const r = await AuthService.login('jane@example.com', 'Passw0rd!');
    assertTrue(r.success);
  });

  it('should normalise email case on login', async () => {
    await seedVerifiedUser('jane@example.com');
    const r = await AuthService.login('JANE@EXAMPLE.COM', 'Passw0rd!');
    assertTrue(r.success);
  });

  it('session token should be a non-empty string', async () => {
    await seedVerifiedUser();
    const r = await AuthService.login('test@example.com', 'Passw0rd!');
    assertTrue(typeof r.session.token === 'string' && r.session.token.length >= 32);
  });

  it('session expiresAt should be in the future', async () => {
    await seedVerifiedUser();
    const r = await AuthService.login('test@example.com', 'Passw0rd!');
    assertTrue(r.session.expiresAt > Date.now());
  });
});

// ─── getLockoutStatus ─────────────────────────────────────────────────────────
describe('AuthService.getLockoutStatus', () => {
  beforeEach(clearAuth);

  it('should show not locked with 5 remaining when no attempts recorded', async () => {
    const s = AuthService.getLockoutStatus('fresh@example.com');
    assertFalse(s.locked);
    assertEqual(s.remaining, 5);
  });

  it('should decrement remaining after failed login attempts', async () => {
    await seedVerifiedUser('user@example.com');
    await AuthService.login('user@example.com', 'WrongPass1!');
    await AuthService.login('user@example.com', 'WrongPass1!');
    const s = AuthService.getLockoutStatus('user@example.com');
    assertEqual(s.remaining, 3);
  });

  it('should lock the account after 5 failed attempts', async () => {
    await seedVerifiedUser('user@example.com');
    for (let i = 0; i < 5; i++) {
      await AuthService.login('user@example.com', 'WrongPass1!');
    }
    const s = AuthService.getLockoutStatus('user@example.com');
    assertTrue(s.locked);
    assertEqual(s.remaining, 0);
  });
});

// ─── getSession ───────────────────────────────────────────────────────────────
describe('AuthService.getSession', () => {
  beforeEach(clearAuth);

  it('should return null when no session exists', async () => {
    assertNull(AuthService.getSession());
  });

  it('should return the session object after login', async () => {
    await seedVerifiedUser();
    await AuthService.login('test@example.com', 'Passw0rd!');
    const s = AuthService.getSession();
    assertNotNull(s);
    assertEqual(s.email, 'test@example.com');
  });

  it('should return null and remove storage for an expired session', async () => {
    const expired = {
      token: 'abc', userId: 'u1', email: 'x@y.com',
      name: 'X', expiresAt: Date.now() - 1000, rememberMe: false,
    };
    localStorage.setItem('pl_session', JSON.stringify(expired));
    assertNull(AuthService.getSession());
    // Confirm it was removed
    assertEqual(localStorage.getItem('pl_session'), null);
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────
describe('AuthService.logout', () => {
  beforeEach(clearAuth);

  it('should remove the session from storage', async () => {
    await seedVerifiedUser();
    await AuthService.login('test@example.com', 'Passw0rd!');
    assertNotNull(AuthService.getSession());
    AuthService.logout();
    assertNull(AuthService.getSession());
  });
});

// ─── changePassword ───────────────────────────────────────────────────────────
describe('AuthService.changePassword', () => {
  beforeEach(clearAuth);

  it('should return success: false for wrong current password', async () => {
    await seedVerifiedUser();
    const r = await AuthService.changePassword('test@example.com', 'WrongOld1!', 'NewPass1!');
    assertFalse(r.success);
  });

  it('should return success: true for correct current password', async () => {
    await seedVerifiedUser();
    const r = await AuthService.changePassword('test@example.com', 'Passw0rd!', 'NewPass1!');
    assertTrue(r.success);
  });

  it('new password should work for login after change', async () => {
    await seedVerifiedUser();
    await AuthService.changePassword('test@example.com', 'Passw0rd!', 'NewPass1!');
    const r = await AuthService.login('test@example.com', 'NewPass1!');
    assertTrue(r.success);
  });

  it('old password should no longer work after change', async () => {
    await seedVerifiedUser();
    await AuthService.changePassword('test@example.com', 'Passw0rd!', 'NewPass1!');
    const r = await AuthService.login('test@example.com', 'Passw0rd!');
    assertFalse(r.success);
  });
});

// ─── resetPassword ────────────────────────────────────────────────────────────
describe('AuthService.resetPassword', () => {
  beforeEach(clearAuth);

  it('should return success: false for unknown email', async () => {
    const r = await AuthService.resetPassword('nobody@example.com', 'NewPass1!');
    assertFalse(r.success);
  });

  it('should reset the password and return success: true', async () => {
    await seedVerifiedUser();
    const r = await AuthService.resetPassword('test@example.com', 'ResetPass1!');
    assertTrue(r.success);
  });

  it('new password should work for login after reset', async () => {
    await seedVerifiedUser();
    await AuthService.resetPassword('test@example.com', 'ResetPass1!');
    const r = await AuthService.login('test@example.com', 'ResetPass1!');
    assertTrue(r.success);
  });
});
