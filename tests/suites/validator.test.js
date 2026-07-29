/**
 * validator.test.js — Tests for window.Validator
 *
 * Covers: validateEmail, validatePassword, validateName,
 *         sanitizeHtml, validateOtp, getPasswordStrength
 */

const { describe, it } = TestRunner;
const {
  assertEqual, assertTrue, assertFalse,
  assertContains, assertMatch,
} = Assert;

// ─── validateEmail ───────────────────────────────────────────────────────────
describe('Validator.validateEmail', () => {
  it('should accept a standard valid email', () => {
    const r = Validator.validateEmail('user@example.com');
    assertTrue(r.valid);
  });

  it('should accept email with subdomain', () => {
    const r = Validator.validateEmail('user@mail.example.co.uk');
    assertTrue(r.valid);
  });

  it('should accept email with plus alias', () => {
    const r = Validator.validateEmail('user+tag@example.com');
    assertTrue(r.valid);
  });

  it('should reject empty string', () => {
    const r = Validator.validateEmail('');
    assertFalse(r.valid);
  });

  it('should reject null', () => {
    const r = Validator.validateEmail(null);
    assertFalse(r.valid);
  });

  it('should reject whitespace-only string', () => {
    const r = Validator.validateEmail('   ');
    assertFalse(r.valid);
  });

  it('should reject email missing @ symbol', () => {
    const r = Validator.validateEmail('userexample.com');
    assertFalse(r.valid);
  });

  it('should reject email missing domain', () => {
    const r = Validator.validateEmail('user@');
    assertFalse(r.valid);
  });

  it('should reject email missing TLD', () => {
    const r = Validator.validateEmail('user@example');
    assertFalse(r.valid);
  });

  it('should reject SQL injection string as email', () => {
    const r = Validator.validateEmail("' OR 1=1 --");
    assertFalse(r.valid);
  });

  it('should reject XSS payload as email', () => {
    const r = Validator.validateEmail('<script>alert(1)</script>');
    assertFalse(r.valid);
  });

  it('should return a message string on failure', () => {
    const r = Validator.validateEmail('bad-email');
    assertTrue(typeof r.message === 'string' && r.message.length > 0);
  });
});

// ─── validatePassword ─────────────────────────────────────────────────────────
describe('Validator.validatePassword', () => {
  it('should accept a strong password with all criteria', () => {
    const r = Validator.validatePassword('Str0ng!Pass');
    assertTrue(r.valid);
  });

  it('should reject empty password', () => {
    const r = Validator.validatePassword('');
    assertFalse(r.valid);
  });

  it('should reject null password', () => {
    const r = Validator.validatePassword(null);
    assertFalse(r.valid);
  });

  it('should reject password shorter than 8 characters', () => {
    const r = Validator.validatePassword('Ab1!');
    assertFalse(r.valid);
  });

  it('should reject password with only lowercase letters', () => {
    const r = Validator.validatePassword('alllowercase');
    assertFalse(r.valid);
  });

  it('should accept password meeting 3 of 5 criteria (length + upper + lower)', () => {
    const r = Validator.validatePassword('Abcdefgh');
    assertTrue(r.valid);
  });

  it('should reject password meeting fewer than 3 criteria', () => {
    // length=true, lowercase=true → score=2
    const r = Validator.validatePassword('alllower1');
    // score: length=true, lowercase=true, number=true → score=3 → valid
    // Let me use lowercase only, 8 chars → score=2
    const r2 = Validator.validatePassword('alllower');
    assertFalse(r2.valid);
  });

  it('should return a message string on failure', () => {
    const r = Validator.validatePassword('weak');
    assertTrue(typeof r.message === 'string' && r.message.length > 0);
  });
});

// ─── getPasswordStrength ──────────────────────────────────────────────────────
describe('Validator.getPasswordStrength', () => {
  it('should return score 0 for empty password', () => {
    const r = Validator.getPasswordStrength('');
    assertEqual(r.score, 0);
  });

  it('should return score 5 for password with all criteria', () => {
    const r = Validator.getPasswordStrength('Str0ng!Pa');
    assertEqual(r.score, 5);
    assertEqual(r.label, 'Very Strong');
  });

  it('should detect missing uppercase', () => {
    const r = Validator.getPasswordStrength('alllower1!');
    assertFalse(r.checks.uppercase);
  });

  it('should detect missing lowercase', () => {
    const r = Validator.getPasswordStrength('ALLUPPER1!');
    assertFalse(r.checks.lowercase);
  });

  it('should detect missing number', () => {
    const r = Validator.getPasswordStrength('NoNumbers!');
    assertFalse(r.checks.number);
  });

  it('should detect missing special character', () => {
    const r = Validator.getPasswordStrength('NoSpecial1');
    assertFalse(r.checks.special);
  });

  it('should detect length below 8', () => {
    const r = Validator.getPasswordStrength('Ab1!');
    assertFalse(r.checks.length);
  });

  it('should return label "Weak" for score 2', () => {
    // lowercase=true, number=true → score=2
    const r = Validator.getPasswordStrength('abcde123');
    // length=true, lowercase=true, number=true → score=3 → "Strong"
    // need exactly score=2: length=false (< 8), but some others
    const r2 = Validator.getPasswordStrength('abc1');
    // length=false, uppercase=false, lowercase=true, number=true, special=false → score=2
    assertEqual(r2.score, 2);
    assertEqual(r2.label, 'Weak');
  });
});

// ─── validateName ─────────────────────────────────────────────────────────────
describe('Validator.validateName', () => {
  it('should accept a valid full name', () => {
    const r = Validator.validateName('Jane Smith');
    assertTrue(r.valid);
  });

  it('should accept a single-word name of 2+ chars', () => {
    const r = Validator.validateName('Jo');
    assertTrue(r.valid);
  });

  it('should reject empty string', () => {
    const r = Validator.validateName('');
    assertFalse(r.valid);
  });

  it('should reject null', () => {
    const r = Validator.validateName(null);
    assertFalse(r.valid);
  });

  it('should reject whitespace-only string', () => {
    const r = Validator.validateName('   ');
    assertFalse(r.valid);
  });

  it('should reject single character name', () => {
    const r = Validator.validateName('A');
    assertFalse(r.valid);
  });

  it('should reject name longer than 80 characters', () => {
    const r = Validator.validateName('A'.repeat(81));
    assertFalse(r.valid);
  });

  it('should accept name with numbers (no restriction in validator)', () => {
    const r = Validator.validateName('User123');
    assertTrue(r.valid);
  });

  it('should return a message string on failure', () => {
    const r = Validator.validateName('X');
    assertTrue(typeof r.message === 'string' && r.message.length > 0);
  });
});

// ─── sanitizeHtml ─────────────────────────────────────────────────────────────
describe('Validator.sanitizeHtml', () => {
  it('should return plain text unchanged', () => {
    const result = Validator.sanitizeHtml('Hello World');
    assertEqual(result, 'Hello World');
  });

  it('should escape < character', () => {
    const result = Validator.sanitizeHtml('<');
    assertEqual(result, '&lt;');
  });

  it('should escape > character', () => {
    const result = Validator.sanitizeHtml('>');
    assertEqual(result, '&gt;');
  });

  it('should escape & character', () => {
    const result = Validator.sanitizeHtml('&');
    assertEqual(result, '&amp;');
  });

  it('should escape double quote', () => {
    const result = Validator.sanitizeHtml('"');
    assertEqual(result, '&quot;');
  });

  it('should escape single quote', () => {
    const result = Validator.sanitizeHtml("'");
    assertEqual(result, '&#x27;');
  });

  it('should neutralise <script>alert(1)</script>', () => {
    const result = Validator.sanitizeHtml('<script>alert(1)</script>');
    assertFalse(result.includes('<script>'));
    assertFalse(result.includes('</script>'));
    assertContains(result, '&lt;script&gt;');
  });

  it('should neutralise <img onerror=...> XSS payload', () => {
    const result = Validator.sanitizeHtml('<img src=x onerror="alert(1)">');
    assertFalse(result.includes('<img'));
    assertContains(result, '&lt;img');
  });

  it('should return empty string for non-string input', () => {
    assertEqual(Validator.sanitizeHtml(null), '');
    assertEqual(Validator.sanitizeHtml(123), '');
    assertEqual(Validator.sanitizeHtml(undefined), '');
  });

  it('should escape forward slash', () => {
    const result = Validator.sanitizeHtml('/');
    assertEqual(result, '&#x2F;');
  });
});

// ─── validateOtp ──────────────────────────────────────────────────────────────
describe('Validator.validateOtp', () => {
  it('should accept a valid 6-digit OTP', () => {
    const r = Validator.validateOtp('123456');
    assertTrue(r.valid);
  });

  it('should accept OTP with leading zeros', () => {
    const r = Validator.validateOtp('001234');
    assertTrue(r.valid);
  });

  it('should reject empty string', () => {
    const r = Validator.validateOtp('');
    assertFalse(r.valid);
  });

  it('should reject OTP with fewer than 6 digits', () => {
    const r = Validator.validateOtp('12345');
    assertFalse(r.valid);
  });

  it('should reject OTP with more than 6 digits', () => {
    const r = Validator.validateOtp('1234567');
    assertFalse(r.valid);
  });

  it('should reject OTP containing letters', () => {
    const r = Validator.validateOtp('12345A');
    assertFalse(r.valid);
  });

  it('should reject null', () => {
    const r = Validator.validateOtp(null);
    assertFalse(r.valid);
  });
});
