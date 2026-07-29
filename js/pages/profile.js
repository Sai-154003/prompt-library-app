(() => {
  const session = AuthService.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  const { OTP_PURPOSES } = Constants;

  const avatarColor = (name) => {
    let hash = 0;
    for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 45%)`;
  };

  const initials = (name) => name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const setAvatar = (el, name) => {
    el.style.background = avatarColor(name);
    el.textContent = initials(name);
  };

  // ── Init UI ──────────────────────────────────────────────

  const profileAvatarEl = document.getElementById('profileAvatar');
  const profileNameEl   = document.getElementById('profileName');
  const profileEmailEl  = document.getElementById('profileEmail');

  setAvatar(profileAvatarEl, session.name);
  profileNameEl.textContent  = session.name;
  profileEmailEl.textContent = session.email;

  document.getElementById('headerUserName').textContent = session.name;
  const headerAvatar = document.getElementById('headerAvatar');
  if (headerAvatar) setAvatar(headerAvatar, session.name);

  const userMenuToggle  = document.getElementById('userMenuToggle');
  const userMenuDrop    = document.getElementById('userMenuDropdown');

  userMenuToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = userMenuDrop.classList.toggle('is-open');
    userMenuToggle.setAttribute('aria-expanded', open);
  });

  document.addEventListener('click', () => userMenuDrop?.classList.remove('is-open'));
  userMenuDrop?.addEventListener('click', e => e.stopPropagation());

  document.getElementById('logoutBtn').addEventListener('click', () => {
    AuthService.logout();
    window.location.href = 'index.html';
  });

  // Theme toggle
  const themeToggleBtn = document.getElementById('themeToggle');
  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  };

  const savedTheme = StorageRepository.get(Constants.STORAGE_KEYS.THEME) || 'light';
  applyTheme(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    StorageRepository.set(Constants.STORAGE_KEYS.THEME, next);
    AuthService.updateProfile(session.email, { theme: next });
  });

  // ── Stats ────────────────────────────────────────────────

  const loadStats = () => {
    const prompts = PromptService.getAll(session.userId);
    document.getElementById('statTotal').textContent     = prompts.length;
    document.getElementById('statFavorites').textContent = prompts.filter(p => p.isFavorite).length;
    document.getElementById('statCopies').textContent    = prompts.reduce((s, p) => s + (p.copyCount || 0), 0);
  };

  loadStats();

  // ── Edit Name ────────────────────────────────────────────

  document.getElementById('nameInput').value = session.name;

  document.getElementById('saveNameBtn').addEventListener('click', async () => {
    const name = document.getElementById('nameInput').value.trim();
    const check = Validator.validateName(name);
    if (!check.valid) {
      ToastManager.show(check.message, 'error');
      return;
    }

    const btn = document.getElementById('saveNameBtn');
    LoaderManager.showInline(btn);
    const result = AuthService.updateProfile(session.email, { name });
    LoaderManager.hideInline(btn);

    if (result.success) {
      setAvatar(profileAvatarEl, name);
      profileNameEl.textContent = name;
      if (headerAvatar) setAvatar(headerAvatar, name);
      document.getElementById('headerUserName').textContent = name;
      ToastManager.show('Name updated.', 'success');
    } else {
      ToastManager.show(result.message, 'error');
    }
  });

  // ── Change Password ──────────────────────────────────────

  document.getElementById('toggleCurrentPassword')?.addEventListener('click', function() {
    const inp = document.getElementById('currentPassword');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    this.textContent = inp.type === 'text' ? '🙈' : '👁';
  });
  document.getElementById('toggleNewPassword')?.addEventListener('click', function() {
    const inp = document.getElementById('newPassword');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    this.textContent = inp.type === 'text' ? '🙈' : '👁';
  });

  PasswordMeter.attach(
    document.getElementById('newPassword'),
    document.getElementById('passwordMeter')
  );

  document.getElementById('changePasswordBtn').addEventListener('click', async () => {
    const current = document.getElementById('currentPassword').value;
    const next    = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmNewPassword').value;

    if (!current) { ToastManager.show('Current password is required.', 'error'); return; }
    const check = Validator.validatePassword(next);
    if (!check.valid) { ToastManager.show(check.message, 'error'); return; }
    if (next !== confirm) { ToastManager.show('New passwords do not match.', 'error'); return; }

    const btn = document.getElementById('changePasswordBtn');
    LoaderManager.showInline(btn);
    const result = await AuthService.changePassword(session.email, current, next);
    LoaderManager.hideInline(btn);

    if (result.success) {
      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value     = '';
      document.getElementById('confirmNewPassword').value = '';
      ToastManager.show('Password changed successfully.', 'success');
    } else {
      ToastManager.show(result.message, 'error');
    }
  });

  // ── Delete all prompts ───────────────────────────────────

  document.getElementById('deleteAllPromptsBtn').addEventListener('click', () => {
    openConfirmModal(
      '🗑️',
      'Delete All Prompts',
      'This will permanently delete all your prompts. This action cannot be undone.',
      'Delete All',
      'btn--danger',
      () => {
        PromptService.deleteAllForUser(session.userId);
        loadStats();
        ToastManager.show('All prompts deleted.', 'success');
      }
    );
  });

  // ── Delete account ───────────────────────────────────────

  document.getElementById('deleteAccountBtn').addEventListener('click', () => {
    const modal = openConfirmModal(
      '⚠️',
      'Delete Account',
      'This will permanently delete your account and all your data. Enter your password to confirm.',
      'Delete Account',
      'btn--danger',
      async (password) => {
        if (!password) { ToastManager.show('Password is required to delete account.', 'error'); return false; }
        LoaderManager.show();
        const result = await AuthService.deleteAccount(session.email, password);
        LoaderManager.hide();
        if (result.success) {
          PromptService.deleteAllForUser(session.userId);
          window.location.href = 'index.html';
        } else {
          ToastManager.show(result.message, 'error');
          return false;
        }
      },
      true // requiresPassword
    );
  });

  // ── Confirm Modal helper ─────────────────────────────────

  const confirmBackdrop = document.getElementById('confirmModalBackdrop');
  const confirmIcon     = document.getElementById('confirmIcon');
  const confirmTitle    = document.getElementById('confirmTitle');
  const confirmMessage  = document.getElementById('confirmMessage');
  const confirmOkBtn    = document.getElementById('confirmOkBtn');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const confirmCloseBtn  = document.getElementById('confirmCloseBtn');
  const confirmPassField = document.getElementById('confirmPasswordField');
  const confirmPassInput = document.getElementById('confirmPassword');

  const closeConfirmModal = () => {
    confirmBackdrop.classList.remove('is-open');
    confirmPassField.style.display = 'none';
    confirmPassInput.value = '';
  };

  confirmCancelBtn.addEventListener('click', closeConfirmModal);
  confirmCloseBtn.addEventListener('click', closeConfirmModal);
  confirmBackdrop.addEventListener('click', (e) => { if (e.target === confirmBackdrop) closeConfirmModal(); });

  const openConfirmModal = (icon, title, message, okLabel, okClass, onConfirm, requiresPassword = false) => {
    confirmIcon.textContent    = icon;
    confirmTitle.textContent   = title;
    confirmMessage.textContent = message;
    confirmOkBtn.textContent   = okLabel;
    confirmOkBtn.className     = `btn ${okClass}`;
    confirmPassField.style.display = requiresPassword ? 'block' : 'none';
    confirmPassInput.value     = '';

    confirmOkBtn.onclick = async () => {
      const pass = requiresPassword ? confirmPassInput.value : undefined;
      const keep = await onConfirm(pass);
      if (keep !== false) closeConfirmModal();
    };

    confirmBackdrop.classList.add('is-open');
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeConfirmModal();
  });
})();
