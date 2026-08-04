(async () => {
  const session = AuthService.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  if (!UserService.isAdmin()) { window.location.href = 'home.html'; return; }

  const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const avatarColor = (name) => {
    let h = 0;
    for (const c of String(name)) h = c.charCodeAt(0) + ((h << 5) - h);
    return `hsl(${Math.abs(h) % 360}, 55%, 45%)`;
  };

  const initials = (name) => String(name).trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const applyTheme = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    document.getElementById('adminThemeBtn').textContent = t === 'dark' ? '☀️' : '🌙';
  };

  applyTheme(localStorage.getItem('pl_theme') || 'light');

  document.getElementById('adminThemeBtn').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('pl_theme', next);
  });

  const avatarEl = document.getElementById('adminAvatar');
  avatarEl.textContent = initials(session.name);
  avatarEl.style.background = avatarColor(session.name);
  document.getElementById('adminName').textContent = session.name;

  document.getElementById('adminLogoutBtn').addEventListener('click', () => {
    AuthService.logout();
    window.location.href = 'index.html';
  });

  document.getElementById('adminLayout').style.display = '';

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
      document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('is-active'));
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      document.getElementById('tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)).classList.add('is-active');
    });
  });

  let rejectTarget = null;
  let rejectType = null;

  const openRejectModal = (id, type, name) => {
    rejectTarget = id;
    rejectType = type;
    document.getElementById('rejectModalTitle').textContent = `Reject "${name}" — Add Reason (Optional)`;
    document.getElementById('rejectReasonInput').value = '';
    document.getElementById('rejectModalBackdrop').classList.add('is-open');
    document.getElementById('rejectReasonInput').focus();
  };

  const closeRejectModal = () => {
    document.getElementById('rejectModalBackdrop').classList.remove('is-open');
    rejectTarget = null; rejectType = null;
  };

  document.getElementById('rejectCancelBtn').addEventListener('click', closeRejectModal);
  document.getElementById('rejectModalBackdrop').addEventListener('click', (e) => {
    if (e.target === document.getElementById('rejectModalBackdrop')) closeRejectModal();
  });

  document.getElementById('rejectConfirmBtn').addEventListener('click', async () => {
    if (!rejectTarget) return;
    const reason = document.getElementById('rejectReasonInput').value.trim();
    LoaderManager.show();
    if (rejectType === 'user') {
      await UserService.rejectUser(rejectTarget, session.userId, reason);
    } else {
      await PromptService.rejectPrompt(rejectTarget, session.userId, reason);
    }
    LoaderManager.hide();
    closeRejectModal();
    ToastManager.show('Rejected successfully.', 'success');
    await loadAll();
  });

  const openPreviewModal = (prompt) => {
    document.getElementById('previewModalTitle').textContent = prompt.title;
    document.getElementById('previewModalText').textContent = prompt.text;
    document.getElementById('previewApproveBtn').dataset.id = prompt.id;
    document.getElementById('previewRejectBtn').dataset.id = prompt.id;
    document.getElementById('previewRejectBtn').dataset.title = prompt.title;
    document.getElementById('previewModalBackdrop').classList.add('is-open');
  };

  const closePreviewModal = () => document.getElementById('previewModalBackdrop').classList.remove('is-open');

  document.getElementById('previewCloseBtn').addEventListener('click', closePreviewModal);
  document.getElementById('previewModalBackdrop').addEventListener('click', (e) => {
    if (e.target === document.getElementById('previewModalBackdrop')) closePreviewModal();
  });

  document.getElementById('previewApproveBtn').addEventListener('click', async (e) => {
    const id = e.currentTarget.dataset.id;
    LoaderManager.show();
    await PromptService.approvePrompt(id, session.userId);
    LoaderManager.hide();
    closePreviewModal();
    ToastManager.show('Prompt approved and published.', 'success');
    await loadAll();
  });

  document.getElementById('previewRejectBtn').addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title;
    closePreviewModal();
    openRejectModal(id, 'prompt', title);
  });

  const renderPendingUsers = (users) => {
    const container = document.getElementById('pendingUsersContainer');
    const pending = users.filter(u => u.status === 'pending');
    document.getElementById('usersTabCount').textContent = pending.length;

    if (!pending.length) {
      container.innerHTML = `<div class="admin-empty"><div class="admin-empty__icon">✅</div><div class="admin-empty__text">No pending users — all caught up!</div></div>`;
      return;
    }

    container.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Email</th>
            <th>Requested</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pending.map(u => `
            <tr>
              <td><div class="admin-table__name">${esc(u.name)}</div></td>
              <td><span style="color:var(--text-secondary);font-size:var(--text-sm);">${esc(u.email)}</span></td>
              <td><span style="color:var(--text-secondary);font-size:var(--text-sm);">${fmtDate(u.created_at)}</span></td>
              <td>
                <div class="admin-table__actions">
                  <button class="btn btn--primary btn--sm" data-action="approve-user" data-id="${esc(u.id)}">✓ Approve</button>
                  <button class="btn btn--danger btn--sm" data-action="reject-user" data-id="${esc(u.id)}" data-name="${esc(u.name)}">✗ Reject</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  };

  const renderAllUsers = (users) => {
    const container = document.getElementById('allUsersContainer');

    if (!users.length) {
      container.innerHTML = `<div class="admin-empty"><div class="admin-empty__icon">👥</div><div class="admin-empty__text">No users yet.</div></div>`;
      return;
    }

    container.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Status</th>
            <th>Role</th>
            <th>Joined</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
            const isSelf = u.id === session.userId;
            const statusBadge = `<span class="status-badge status-badge--${u.status}">${u.status}</span>`;
            const roleBadge = `<span class="status-badge status-badge--${u.role}">${u.role}</span>`;
            const toggleRoleBtn = !isSelf
              ? `<button class="btn btn--secondary btn--sm" data-action="toggle-role" data-id="${esc(u.id)}" data-role="${esc(u.role)}">${u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}</button>`
              : '';
            const revokeBtn = (!isSelf && u.status === 'approved')
              ? `<button class="btn btn--ghost btn--sm" data-action="revoke-user" data-id="${esc(u.id)}" data-name="${esc(u.name)}">Revoke Access</button>`
              : '';
            const reapproveBtn = (u.status === 'rejected')
              ? `<button class="btn btn--primary btn--sm" data-action="approve-user" data-id="${esc(u.id)}">Re-approve</button>`
              : '';
            return `
              <tr>
                <td>
                  <div class="admin-table__name">${esc(u.name)}${isSelf ? ' <span style="color:var(--text-secondary);font-size:11px;">(you)</span>' : ''}</div>
                  <div class="admin-table__sub">${esc(u.email)}</div>
                </td>
                <td>${statusBadge}</td>
                <td>${roleBadge}</td>
                <td><span style="color:var(--text-secondary);font-size:var(--text-sm);">${fmtDate(u.created_at)}</span></td>
                <td>
                  <div class="admin-table__actions">
                    ${toggleRoleBtn}${revokeBtn}${reapproveBtn}
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  };

  const renderPendingPrompts = (prompts) => {
    const container = document.getElementById('pendingPromptsContainer');
    const pending = prompts.filter(p => p.status === 'pending');
    document.getElementById('promptsTabCount').textContent = pending.length;

    if (!pending.length) {
      container.innerHTML = `<div class="admin-empty"><div class="admin-empty__icon">✅</div><div class="admin-empty__text">No pending prompts — all caught up!</div></div>`;
      return;
    }

    container.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Prompt</th>
            <th>Submitted by</th>
            <th>Category</th>
            <th>Date</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pending.map(p => `
            <tr>
              <td>
                <div class="admin-table__name">${esc(p.title)}</div>
                <div class="admin-table__sub">${esc(p.text.slice(0, 80))}${p.text.length > 80 ? '…' : ''}</div>
              </td>
              <td><span style="color:var(--text-secondary);font-size:var(--text-sm);">${esc(p.creatorName)}</span></td>
              <td><span class="badge badge--${p.category}" style="font-size:12px;">${esc(p.category)}</span></td>
              <td><span style="color:var(--text-secondary);font-size:var(--text-sm);">${fmtDate(p.createdAt)}</span></td>
              <td>
                <div class="admin-table__actions">
                  <button class="btn btn--ghost btn--sm" data-action="preview-prompt" data-id="${esc(p.id)}">Preview</button>
                  <button class="btn btn--primary btn--sm" data-action="approve-prompt" data-id="${esc(p.id)}">✓ Approve</button>
                  <button class="btn btn--danger btn--sm" data-action="reject-prompt" data-id="${esc(p.id)}" data-title="${esc(p.title)}">✗ Reject</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  };

  const renderAllPrompts = (prompts) => {
    const container = document.getElementById('allPromptsContainer');

    if (!prompts.length) {
      container.innerHTML = `<div class="admin-empty"><div class="admin-empty__icon">📚</div><div class="admin-empty__text">No prompts yet.</div></div>`;
      return;
    }

    container.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Prompt</th>
            <th>Status</th>
            <th>By</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${prompts.slice(0, 50).map(p => {
            const statusBadge = `<span class="status-badge status-badge--${p.status}">${p.status}</span>`;
            return `
              <tr>
                <td>
                  <div class="admin-table__name">${esc(p.title)}</div>
                  <div class="admin-table__sub">${esc(p.text.slice(0, 60))}${p.text.length > 60 ? '…' : ''}</div>
                </td>
                <td>${statusBadge}</td>
                <td><span style="color:var(--text-secondary);font-size:var(--text-sm);">${esc(p.creatorName)}</span></td>
                <td><span style="color:var(--text-secondary);font-size:var(--text-sm);">${fmtDate(p.createdAt)}</span></td>
              </tr>`;
          }).join('')}
          ${prompts.length > 50 ? `<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);font-size:var(--text-sm);padding:var(--space-4);">Showing first 50 of ${prompts.length} prompts.</td></tr>` : ''}
        </tbody>
      </table>`;
  };

  let allUsers = [];
  let allPrompts = [];

  const loadAll = async () => {
    LoaderManager.show();
    try {
      [allUsers, allPrompts] = await Promise.all([
        UserService.getAllUsers(),
        PromptService.getAllAdmin(),
      ]);
    } catch {
      ToastManager.show('Failed to load data. Check your connection.', 'error');
    } finally {
      LoaderManager.hide();
    }

    document.getElementById('statPendingUsers').textContent = allUsers.filter(u => u.status === 'pending').length;
    document.getElementById('statTotalUsers').textContent = allUsers.length;
    document.getElementById('statPendingPrompts').textContent = allPrompts.filter(p => p.status === 'pending').length;
    document.getElementById('statTotalPrompts').textContent = allPrompts.length;

    renderPendingUsers(allUsers);
    renderAllUsers(allUsers);
    renderPendingPrompts(allPrompts);
    renderAllPrompts(allPrompts);
  };

  document.getElementById('tabUsers').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'approve-user') {
      LoaderManager.show();
      await UserService.approveUser(id, session.userId);
      LoaderManager.hide();
      ToastManager.show('User approved — they can now log in.', 'success');
      await loadAll();
    }

    if (action === 'reject-user' || action === 'revoke-user') {
      openRejectModal(id, 'user', btn.dataset.name);
    }

    if (action === 'toggle-role') {
      const newRole = btn.dataset.role === 'admin' ? 'user' : 'admin';
      LoaderManager.show();
      await UserService.setRole(id, newRole);
      LoaderManager.hide();
      ToastManager.show(`Role updated to ${newRole}.`, 'success');
      await loadAll();
    }
  });

  document.getElementById('tabPrompts').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'approve-prompt') {
      LoaderManager.show();
      await PromptService.approvePrompt(id, session.userId);
      LoaderManager.hide();
      ToastManager.show('Prompt approved and published to library.', 'success');
      await loadAll();
    }

    if (action === 'reject-prompt') {
      openRejectModal(id, 'prompt', btn.dataset.title);
    }

    if (action === 'preview-prompt') {
      const p = allPrompts.find(x => x.id === id);
      if (p) openPreviewModal(p);
    }
  });

  await loadAll();
})();
