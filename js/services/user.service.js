window.UserService = (() => {
  const APP_USER_KEY = 'pl_app_user';

  const getLocalAppUser = () => {
    try { return JSON.parse(localStorage.getItem(APP_USER_KEY) || 'null'); }
    catch { return null; }
  };

  const setLocalAppUser = (data) => localStorage.setItem(APP_USER_KEY, JSON.stringify(data));
  const clearLocalAppUser = () => localStorage.removeItem(APP_USER_KEY);
  const getLocalRole = () => getLocalAppUser()?.role || 'user';
  const isAdmin = () => getLocalRole() === 'admin';

  const getUser = async (userId) => {
    const { data } = await sb.from('app_users').select('*').eq('id', userId).maybeSingle();
    return data;
  };

  const createPendingUser = async (userId, email, name) => {
    const { error } = await sb.from('app_users').insert({
      id: userId,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role: 'user',
      status: 'pending',
      created_at: Date.now(),
    });
    return !error;
  };

  const getUserByEmail = async (email) => {
    const { data } = await sb.from('app_users').select('*').eq('email', email.toLowerCase().trim()).maybeSingle();
    return data;
  };

  const checkLoginAccess = async (userId, email, name) => {
    let user = await getUser(userId);
    if (!user && email) {
      user = await getUserByEmail(email);
    }
    if (!user) return { allowed: false, status: 'pending', role: 'user' };
    return { allowed: user.status === 'approved', status: user.status, role: user.role };
  };

  const updateLastLogin = async (userId) => {
    await sb.from('app_users').update({ last_login_at: Date.now() }).eq('id', userId);
  };

  const getAllUsers = async () => {
    const { data } = await sb.from('app_users').select('*').order('created_at', { ascending: false });
    return data || [];
  };

  const approveUser = async (userId, adminId) => {
    const { error } = await sb.from('app_users').update({ status: 'approved', approved_at: Date.now(), approved_by: adminId }).eq('id', userId);
    return !error;
  };

  const rejectUser = async (userId, adminId, reason) => {
    const { error } = await sb.from('app_users').update({ status: 'rejected', rejection_reason: reason || null, approved_at: Date.now(), approved_by: adminId }).eq('id', userId);
    return !error;
  };

  const setRole = async (userId, role) => {
    const { error } = await sb.from('app_users').update({ role }).eq('id', userId);
    return !error;
  };

  return Object.freeze({
    getLocalRole, isAdmin, setLocalAppUser, clearLocalAppUser,
    getUser, createPendingUser, checkLoginAccess, updateLastLogin,
    getAllUsers, approveUser, rejectUser, setRole,
  });
})();
