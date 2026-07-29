window.Constants = Object.freeze({
  APP_NAME: 'PromptLib',

  STORAGE_KEYS: Object.freeze({
    USERS:          'pl_users',
    SESSION:        'pl_session',
    OTP_RECORDS:    'pl_otp_records',
    LOGIN_ATTEMPTS: 'pl_login_attempts',
    PROMPTS:        'pl_prompts',
    THEME:          'pl_theme',
  }),

  OTP_EXPIRY_MS:        10 * 60 * 1000,   // 10 minutes
  OTP_MAX_ATTEMPTS:     3,
  OTP_RESEND_COOLDOWN:  60,                // seconds

  SESSION_TTL_MS:       2 * 60 * 60 * 1000,    // 2 hours
  SESSION_REMEMBER_MS:  7 * 24 * 60 * 60 * 1000, // 7 days

  LOGIN_MAX_ATTEMPTS:   5,
  LOGIN_LOCKOUT_MS:     15 * 60 * 1000,   // 15 minutes

  PASSWORD_MIN_LENGTH:  8,

  CATEGORIES: Object.freeze([
    { id: 'coding',    label: 'Coding',    icon: '💻' },
    { id: 'writing',   label: 'Writing',   icon: '✍️' },
    { id: 'marketing', label: 'Marketing', icon: '📣' },
    { id: 'creative',  label: 'Creative',  icon: '🎨' },
    { id: 'education', label: 'Education', icon: '🎓' },
  ]),

  OTP_PURPOSES: Object.freeze({
    SIGNUP:         'signup',
    RESET_PASSWORD: 'reset_password',
    CHANGE_EMAIL:   'change_email',
  }),
});
