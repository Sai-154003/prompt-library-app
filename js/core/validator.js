window.Validator = (() => {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const sanitizeHtml = (str) => {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  };

  const validateEmail = (email) => {
    if (!email || typeof email !== 'string') return { valid: false, message: 'Email is required.' };
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) return { valid: false, message: 'Enter a valid email address.' };
    return { valid: true };
  };

  const validateName = (name) => {
    if (!name || typeof name !== 'string') return { valid: false, message: 'Name is required.' };
    const trimmed = name.trim();
    if (trimmed.length < 2) return { valid: false, message: 'Name must be at least 2 characters.' };
    if (trimmed.length > 80) return { valid: false, message: 'Name must be 80 characters or fewer.' };
    return { valid: true };
  };

  const getPasswordStrength = (password) => {
    if (!password) return { score: 0, label: 'Very Weak', checks: {} };
    const checks = {
      length:    password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number:    /[0-9]/.test(password),
      special:   /[^A-Za-z0-9]/.test(password),
    };
    const score = Object.values(checks).filter(Boolean).length;
    const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
    return { score, label: labels[Math.max(0, score - 1)] || 'Very Weak', checks };
  };

  const validatePassword = (password) => {
    if (!password) return { valid: false, message: 'Password is required.' };
    const { score, checks } = getPasswordStrength(password);
    if (!checks.length) return { valid: false, message: 'Password must be at least 8 characters.' };
    if (score < 3) return { valid: false, message: 'Password is too weak. Add uppercase, numbers, or symbols.' };
    return { valid: true };
  };

  const validateOtp = (otp) => {
    if (!otp || typeof otp !== 'string') return { valid: false, message: 'OTP is required.' };
    if (!/^\d{6}$/.test(otp.trim())) return { valid: false, message: 'OTP must be exactly 6 digits.' };
    return { valid: true };
  };

  return Object.freeze({
    sanitizeHtml,
    validateEmail,
    validateName,
    validatePassword,
    validateOtp,
    getPasswordStrength,
  });
})();
