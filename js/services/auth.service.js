window.AuthService = (() => {
  const { STORAGE_KEYS, SESSION_TTL_MS, SESSION_REMEMBER_MS, LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_MS } = Constants;
  const store  = StorageRepository;
  const crypto = CryptoService;

  const _getUsers        = () => store.getList(STORAGE_KEYS.USERS);
  const _saveUsers       = (u) => store.setList(STORAGE_KEYS.USERS, u);
  const _getAttempts     = () => store.getList(STORAGE_KEYS.LOGIN_ATTEMPTS);
  const _saveAttempts    = (a) => store.setList(STORAGE_KEYS.LOGIN_ATTEMPTS, a);

  const findUser = (email) => _getUsers().find(u => u.email === email.toLowerCase().trim()) || null;

  const signup = async (name, email, password) => {
    const norm = email.toLowerCase().trim();
    const existing = findUser(norm);
    if (existing && existing.isVerified) {
      return { success: false, message: 'An account with this email already exists.' };
    }
    if (existing && !existing.isVerified) {
      // Remove stale unverified account so user can retry signup
      _saveUsers(_getUsers().filter(u => u.email !== norm));
    }

    const salt = crypto.generateSalt();
    const passwordHash = await crypto.hashPassword(password, salt);
    const user = {
      id:           crypto.generateToken().slice(0, 16),
      name:         name.trim(),
      email:        norm,
      passwordHash,
      salt,
      createdAt:    Date.now(),
      isVerified:   false,
      theme:        'light',
    };
    const users = _getUsers();
    users.push(user);
    _saveUsers(users);
    return { success: true, email: norm };
  };

  const markVerified = (email) => {
    const users = _getUsers();
    const idx = users.findIndex(u => u.email === email.toLowerCase().trim());
    if (idx === -1) return false;
    users[idx].isVerified = true;
    _saveUsers(users);
    return true;
  };

  const _getAttemptRecord = (email) => _getAttempts().find(r => r.email === email) || null;

  const getLockoutStatus = (email) => {
    const rec = _getAttemptRecord(email);
    if (!rec) return { locked: false, remaining: LOGIN_MAX_ATTEMPTS };
    if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
      return { locked: true, lockedUntil: rec.lockedUntil, remaining: 0 };
    }
    const remaining = Math.max(0, LOGIN_MAX_ATTEMPTS - (rec.count || 0));
    return { locked: false, remaining };
  };

  const _recordFailedAttempt = (email) => {
    const attempts = _getAttempts();
    const idx = attempts.findIndex(r => r.email === email);
    const now = Date.now();
    if (idx === -1) {
      attempts.push({ email, count: 1, lockedUntil: null, lastAttempt: now });
    } else {
      attempts[idx].count += 1;
      attempts[idx].lastAttempt = now;
      if (attempts[idx].count >= LOGIN_MAX_ATTEMPTS) {
        attempts[idx].lockedUntil = now + LOGIN_LOCKOUT_MS;
      }
    }
    _saveAttempts(attempts);
  };

  const _clearAttempts = (email) => {
    const attempts = _getAttempts().filter(r => r.email !== email);
    _saveAttempts(attempts);
  };

  const login = async (email, password, rememberMe = false) => {
    const norm = email.toLowerCase().trim();
    const lockout = getLockoutStatus(norm);
    if (lockout.locked) return { success: false, locked: true, lockedUntil: lockout.lockedUntil };

    const user = findUser(norm);
    if (!user || !user.isVerified) {
      _recordFailedAttempt(norm);
      return { success: false, message: 'Invalid email or password.' };
    }

    const valid = await crypto.verifyPassword(password, user.salt, user.passwordHash);
    if (!valid) {
      _recordFailedAttempt(norm);
      const status = getLockoutStatus(norm);
      if (status.locked) return { success: false, locked: true, lockedUntil: status.lockedUntil };
      return { success: false, message: `Invalid email or password. ${status.remaining} attempt${status.remaining !== 1 ? 's' : ''} remaining.` };
    }

    _clearAttempts(norm);
    const ttl = rememberMe ? SESSION_REMEMBER_MS : SESSION_TTL_MS;
    const session = {
      token:      crypto.generateToken(),
      userId:     user.id,
      email:      user.email,
      name:       user.name,
      expiresAt:  Date.now() + ttl,
      rememberMe,
    };
    store.set(STORAGE_KEYS.SESSION, session);
    return { success: true, session };
  };

  const logout = () => {
    store.remove(STORAGE_KEYS.SESSION);
  };

  const getSession = () => {
    const session = store.get(STORAGE_KEYS.SESSION);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      store.remove(STORAGE_KEYS.SESSION);
      return null;
    }
    return session;
  };

  const changePassword = async (email, currentPassword, newPassword) => {
    const user = findUser(email);
    if (!user) return { success: false, message: 'User not found.' };
    const valid = await crypto.verifyPassword(currentPassword, user.salt, user.passwordHash);
    if (!valid) return { success: false, message: 'Current password is incorrect.' };

    const newSalt = crypto.generateSalt();
    const newHash = await crypto.hashPassword(newPassword, newSalt);
    const users = _getUsers();
    const idx = users.findIndex(u => u.email === user.email);
    users[idx].salt = newSalt;
    users[idx].passwordHash = newHash;
    _saveUsers(users);
    return { success: true };
  };

  const resetPassword = async (email, newPassword) => {
    const user = findUser(email);
    if (!user) return { success: false, message: 'User not found.' };
    const newSalt = crypto.generateSalt();
    const newHash = await crypto.hashPassword(newPassword, newSalt);
    const users = _getUsers();
    const idx = users.findIndex(u => u.email === user.email);
    users[idx].salt = newSalt;
    users[idx].passwordHash = newHash;
    _saveUsers(users);
    return { success: true };
  };

  const updateProfile = (email, updates) => {
    const users = _getUsers();
    const idx = users.findIndex(u => u.email === email.toLowerCase().trim());
    if (idx === -1) return { success: false, message: 'User not found.' };
    if (updates.name)  users[idx].name  = updates.name.trim();
    if (updates.theme) users[idx].theme = updates.theme;
    _saveUsers(users);
    const session = getSession();
    if (session) {
      if (updates.name)  session.name  = updates.name.trim();
      store.set(STORAGE_KEYS.SESSION, session);
    }
    return { success: true };
  };

  const deleteAccount = async (email, password) => {
    const user = findUser(email);
    if (!user) return { success: false, message: 'User not found.' };
    const valid = await crypto.verifyPassword(password, user.salt, user.passwordHash);
    if (!valid) return { success: false, message: 'Password is incorrect.' };
    const users = _getUsers().filter(u => u.email !== email.toLowerCase().trim());
    _saveUsers(users);
    store.remove(STORAGE_KEYS.SESSION);
    return { success: true };
  };

  return Object.freeze({
    signup, markVerified, login, logout, getSession,
    getLockoutStatus, changePassword, resetPassword,
    updateProfile, deleteAccount, findUser,
  });
})();
