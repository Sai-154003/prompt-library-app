/**
 * otp.test.js — Tests for window.OtpService
 *
 * EmailService is mocked before each test so no real emails are sent.
 * CryptoService.generateOtp is intercepted to capture the OTP value
 * (since generate() never returns the raw OTP to the caller by design).
 */

const { describe, it, beforeEach, afterEach } = TestRunner;
const {
  assertTrue, assertFalse, assertEqual,
  assertContains, assertNotNull,
} = Assert;

// ── helpers ──────────────────────────────────────────────────────────────────
const OTP_KEY      = 'pl_otp_records';
const clearOtp     = () => localStorage.removeItem(OTP_KEY);

let _savedEmailService   = null;
let _savedCryptoService  = null;
let _capturedOtp         = null;

const mockEmailSuccess = () => {
  _savedEmailService = window.EmailService;
  window.EmailService = { sendOtp: async () => ({ success: true }), isConfigured: () => true };
};

const mockEmailFail = (message = 'SMTP error') => {
  _savedEmailService = window.EmailService;
  window.EmailService = { sendOtp: async () => ({ success: false, message }), isConfigured: () => true };
};

const restoreEmailService = () => {
  if (_savedEmailService) { window.EmailService = _savedEmailService; _savedEmailService = null; }
};

// Intercept generateOtp to capture the value
const interceptOtp = () => {
  _savedCryptoService = window.CryptoService;
  _capturedOtp        = null;
  const original      = _savedCryptoService.generateOtp;
  window.CryptoService = {
    ...window.CryptoService,
    generateOtp: () => {
      _capturedOtp = original.call(_savedCryptoService);
      return _capturedOtp;
    },
  };
};

const restoreCryptoService = () => {
  if (_savedCryptoService) { window.CryptoService = _savedCryptoService; _savedCryptoService = null; }
};

// ─── generate ─────────────────────────────────────────────────────────────────
describe('OtpService.generate', () => {
  beforeEach(() => { clearOtp(); mockEmailSuccess(); });
  afterEach(restoreEmailService);

  it('should return success: true when email sends successfully', async () => {
    const r = await OtpService.generate('user@test.com', 'signup', 'Test User');
    assertTrue(r.success);
  });

  it('should persist an OTP record in storage', async () => {
    await OtpService.generate('user@test.com', 'signup', 'Test User');
    const records = JSON.parse(localStorage.getItem(OTP_KEY) || '[]');
    assertEqual(records.length, 1);
    assertEqual(records[0].email, 'user@test.com');
    assertEqual(records[0].purpose, 'signup');
  });

  it('should replace existing record for same email+purpose', async () => {
    await OtpService.generate('user@test.com', 'signup', 'Test User');
    await OtpService.generate('user@test.com', 'signup', 'Test User');
    const records = JSON.parse(localStorage.getItem(OTP_KEY) || '[]');
    assertEqual(records.length, 1);
  });

  it('should return success: false and roll back when email fails', async () => {
    restoreEmailService();
    mockEmailFail('SMTP connection refused');
    const r = await OtpService.generate('user@test.com', 'signup', 'Test User');
    assertFalse(r.success);
    const records = JSON.parse(localStorage.getItem(OTP_KEY) || '[]');
    assertEqual(records.length, 0, 'Record should be rolled back on email failure');
  });

  it('should include the error message from email service on failure', async () => {
    restoreEmailService();
    mockEmailFail('Service unavailable');
    const r = await OtpService.generate('user@test.com', 'signup', 'Test User');
    assertContains(r.message, 'Service unavailable');
  });
});

// ─── verify ───────────────────────────────────────────────────────────────────
describe('OtpService.verify', () => {
  beforeEach(() => { clearOtp(); mockEmailSuccess(); interceptOtp(); });
  afterEach(() => { restoreEmailService(); restoreCryptoService(); });

  it('should return success: true for the correct OTP', async () => {
    await OtpService.generate('user@test.com', 'signup', 'Test User');
    const r = await OtpService.verify('user@test.com', 'signup', _capturedOtp);
    assertTrue(r.success);
  });

  it('should remove the record after successful verification', async () => {
    await OtpService.generate('user@test.com', 'signup', 'Test User');
    await OtpService.verify('user@test.com', 'signup', _capturedOtp);
    const records = JSON.parse(localStorage.getItem(OTP_KEY) || '[]');
    assertEqual(records.length, 0);
  });

  it('should return success: false for a wrong OTP', async () => {
    await OtpService.generate('user@test.com', 'signup', 'Test User');
    const r = await OtpService.verify('user@test.com', 'signup', '000000');
    assertFalse(r.success);
  });

  it('should increment attempts counter on wrong OTP', async () => {
    await OtpService.generate('user@test.com', 'signup', 'Test User');
    await OtpService.verify('user@test.com', 'signup', '000000');
    const records = JSON.parse(localStorage.getItem(OTP_KEY) || '[]');
    assertEqual(records[0].attempts, 1);
  });

  it('should include remaining attempt count in failure message', async () => {
    await OtpService.generate('user@test.com', 'signup', 'Test User');
    const r = await OtpService.verify('user@test.com', 'signup', '000000');
    assertContains(r.message, 'remaining');
  });

  it('should return success: false for a non-existent OTP record', async () => {
    const r = await OtpService.verify('nobody@test.com', 'signup', '123456');
    assertFalse(r.success);
    assertContains(r.message, 'not found');
  });

  it('should return success: false and remove record after max attempts exceeded', async () => {
    await OtpService.generate('user@test.com', 'signup', 'Test User');
    // 3 wrong attempts (OTP_MAX_ATTEMPTS = 3)
    await OtpService.verify('user@test.com', 'signup', '000000');
    await OtpService.verify('user@test.com', 'signup', '000000');
    const r = await OtpService.verify('user@test.com', 'signup', '000000');
    assertFalse(r.success);
    const records = JSON.parse(localStorage.getItem(OTP_KEY) || '[]');
    assertEqual(records.length, 0, 'Record should be removed after max attempts');
  });

  it('should return success: false for an expired OTP', async () => {
    // Directly write an expired record
    restoreCryptoService();
    const expiredHash = await CryptoService.hashOtp('123456');
    const expired = [{
      email: 'user@test.com', otpHash: expiredHash, purpose: 'signup',
      expiresAt: Date.now() - 1000, attempts: 0, createdAt: Date.now() - 700000,
    }];
    localStorage.setItem(OTP_KEY, JSON.stringify(expired));
    const r = await OtpService.verify('user@test.com', 'signup', '123456');
    assertFalse(r.success);
    assertContains(r.message, 'expired');
  });
});

// ─── invalidate ───────────────────────────────────────────────────────────────
describe('OtpService.invalidate', () => {
  beforeEach(() => { clearOtp(); mockEmailSuccess(); });
  afterEach(restoreEmailService);

  it('should remove the OTP record for the given email and purpose', async () => {
    await OtpService.generate('user@test.com', 'signup', 'Test User');
    OtpService.invalidate('user@test.com', 'signup');
    const records = JSON.parse(localStorage.getItem(OTP_KEY) || '[]');
    assertEqual(records.length, 0);
  });

  it('should not affect records for a different purpose', async () => {
    await OtpService.generate('user@test.com', 'signup', 'Test User');
    await OtpService.generate('user@test.com', 'reset_password', 'Test User');
    OtpService.invalidate('user@test.com', 'signup');
    const records = JSON.parse(localStorage.getItem(OTP_KEY) || '[]');
    assertEqual(records.length, 1);
    assertEqual(records[0].purpose, 'reset_password');
  });

  it('should not throw when no matching record exists', async () => {
    // Should complete without error
    OtpService.invalidate('nobody@test.com', 'signup');
    assertTrue(true);
  });
});
