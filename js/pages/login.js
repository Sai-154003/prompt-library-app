(() => {
  const form            = document.getElementById('loginForm');
  const emailInput      = document.getElementById('email');
  const passwordInput   = document.getElementById('password');
  const rememberChk     = document.getElementById('rememberMe');
  const toggleBtn       = document.getElementById('togglePassword');
  const submitBtn       = document.getElementById('submitBtn');
  const lockoutAlert    = document.getElementById('lockoutAlert');
  const lockoutCountdown = document.getElementById('lockoutCountdown');

  let lockoutInterval = null;

  const showError = (inputEl, msg) => {
    inputEl.classList.add('is-error');
    const err = document.getElementById(inputEl.id + 'Error');
    if (err) err.textContent = msg;
  };

  const clearErrors = () => {
    [emailInput, passwordInput].forEach(el => {
      el.classList.remove('is-error');
      const err = document.getElementById(el.id + 'Error');
      if (err) err.textContent = '';
    });
    lockoutAlert.classList.remove('is-visible');
  };

  const startLockoutCountdown = (lockedUntil) => {
    if (lockoutInterval) clearInterval(lockoutInterval);
    lockoutAlert.classList.add('is-visible');
    submitBtn.disabled = true;

    const update = () => {
      const remaining = lockedUntil - Date.now();
      if (remaining <= 0) {
        clearInterval(lockoutInterval);
        lockoutAlert.classList.remove('is-visible');
        submitBtn.disabled = false;
        lockoutCountdown.textContent = '';
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      lockoutCountdown.textContent = `${m}m ${String(s).padStart(2,'0')}s`;
    };

    update();
    lockoutInterval = setInterval(update, 1000);
  };

  toggleBtn.addEventListener('click', () => {
    const isText = passwordInput.type === 'text';
    passwordInput.type = isText ? 'password' : 'text';
    toggleBtn.textContent = isText ? '👁' : '🙈';
  });

  emailInput.addEventListener('input', () => {
    emailInput.classList.remove('is-error');
    document.getElementById('emailError').textContent = '';
  });

  passwordInput.addEventListener('input', () => {
    passwordInput.classList.remove('is-error');
    document.getElementById('passwordError').textContent = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email    = emailInput.value.trim();
    const password = passwordInput.value;

    const emailCheck = Validator.validateEmail(email);
    if (!emailCheck.valid) { showError(emailInput, emailCheck.message); return; }
    if (!password)         { showError(passwordInput, 'Password is required.'); return; }

    LoaderManager.showInline(submitBtn);

    const result = await AuthService.login(email, password, rememberChk.checked);

    LoaderManager.hideInline(submitBtn);

    if (result.locked) {
      startLockoutCountdown(result.lockedUntil);
      return;
    }

    if (!result.success) {
      const lockout = AuthService.getLockoutStatus(email.toLowerCase().trim());
      if (lockout.locked) {
        startLockoutCountdown(lockout.lockedUntil);
      } else {
        showError(passwordInput, result.message);
      }
      return;
    }

    LoaderManager.showInline(submitBtn);
    let access;
    try {
      access = await UserService.checkLoginAccess(result.session.userId, result.session.email, result.session.name);
    } catch {
      AuthService.logout();
      LoaderManager.hideInline(submitBtn);
      showError(emailInput, 'Could not verify account status. Please check your connection and try again.');
      return;
    }
    LoaderManager.hideInline(submitBtn);

    if (!access.allowed) {
      AuthService.logout();
      if (access.status === 'rejected') {
        showError(emailInput, 'Your account access has been revoked. Please contact an administrator.');
      } else {
        showError(emailInput, 'Your account is awaiting admin approval. You will be notified once approved.');
      }
      return;
    }

    UserService.setLocalAppUser({ role: access.role, status: access.status });
    await UserService.updateLastLogin(result.session.userId);
    window.location.href = 'home.html';
  });

  // Check if already logged in
  const session = AuthService.getSession();
  if (session) window.location.href = 'home.html';

  // Show message from redirect
  const params = new URLSearchParams(location.search);
  if (params.get('registered') === '1') {
    ToastManager.show('Account created successfully. Please log in.', 'success', 6000);
  }
  if (params.get('pending') === '1') {
    ToastManager.show('Account created! Awaiting admin approval before you can log in.', 'info', 8000);
  }
  if (params.get('reset') === '1') {
    ToastManager.show('Password reset successfully. Please log in.', 'success', 6000);
  }
})();
