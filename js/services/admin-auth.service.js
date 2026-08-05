window.AdminAuthService = (() => {
  const login = async (email, password) => {
    const norm = email.toLowerCase().trim();
    let data;
    try {
      const res = await sb.from('admin_credentials').select('*').eq('email', norm).maybeSingle();
      data = res.data;
    } catch {
      return { success: false, message: 'Could not reach the server. Check your connection.' };
    }

    if (!data) return { success: false, message: 'Invalid admin credentials.' };

    const valid = await CryptoService.verifyPassword(password, data.salt, data.password_hash);
    if (!valid) return { success: false, message: 'Invalid admin credentials.' };

    const session = {
      token:     CryptoService.generateToken(),
      userId:    data.id,
      email:     data.email,
      name:      data.name,
      expiresAt: Date.now() + 7200000,
      rememberMe: false,
    };
    localStorage.setItem('pl_session', JSON.stringify(session));
    localStorage.setItem('pl_app_user', JSON.stringify({ role: 'admin', status: 'approved' }));

    sb.from('app_users').update({ last_login_at: Date.now() }).eq('id', data.id).then(() => {});

    return { success: true, session };
  };

  return Object.freeze({ login });
})();
