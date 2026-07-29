const AUTH_KEY    = 'promptlib_users';
const SESSION_KEY = 'promptlib_session';

function getUsers() {
  return JSON.parse(localStorage.getItem(AUTH_KEY) || '[]');
}

function saveUsers(users) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(users));
}

function signup(name, email, password) {
  const users = getUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, message: 'This email is already registered.' };
  }
  users.push({ name, email: email.toLowerCase(), password });
  saveUsers(users);
  return { success: true };
}

function login(email, password) {
  const users = getUsers();
  const user  = users.find(u => u.email === email.toLowerCase() && u.password === password);
  if (!user) return { success: false, message: 'Invalid email or password. Please try again.' };
  localStorage.setItem(SESSION_KEY, JSON.stringify({ name: user.name, email: user.email }));
  return { success: true };
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = 'index.html';
}

function getSession() {
  return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
}

function checkAuth() {
  if (!getSession()) window.location.href = 'index.html';
}
