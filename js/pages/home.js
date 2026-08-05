(async () => {
  const session = AuthService.getSession();
  if (!session) { window.location.href = 'portal.html'; return; }

  await PromptService.seedForUser(session.userId);

  const { CATEGORIES } = Constants;

  const state = {
    prompts:         [],
    activeCategory:  'all',
    activeFavorites: false,
    activeRecent:    false,
    activeOwned:     false,
    sortMode:        'newest',
    searchQuery:     '',
  };

  const promptGrid      = document.getElementById('promptGrid');
  const searchInput     = document.getElementById('headerSearch');
  const userNameEl      = document.getElementById('userName');
  const userAvatarEl    = document.getElementById('userAvatar');
  const importBtn       = document.getElementById('importBtn');
  const exportBtn       = document.getElementById('exportBtn');
  const importFileInput = document.getElementById('importFileInput');
  const themeToggleBtn  = document.getElementById('themeToggle');
  const userMenuToggle  = document.getElementById('userMenuToggle');
  const userMenuDrop    = document.getElementById('userMenuDropdown');
  const promptModalBd   = document.getElementById('promptModalBackdrop');
  const viewModalBd     = document.getElementById('viewModalBackdrop');
  const deleteModal     = document.getElementById('deleteModalBackdrop');

  // ── Helpers ──────────────────────────────────────────────

  const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const avatarColor = (name) => {
    let hash = 0;
    for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 55%, 45%)`;
  };

  const initials = (name) => name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const setAvatar = (el, name) => { el.style.background = avatarColor(name); el.textContent = initials(name); };

  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  };

  applyTheme(StorageRepository.get(Constants.STORAGE_KEYS.THEME) || 'light');

  themeToggleBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    StorageRepository.set(Constants.STORAGE_KEYS.THEME, next);
    AuthService.updateProfile(session.email, { theme: next });
  });

  // ── User menu ────────────────────────────────────────────

  userNameEl.textContent = session.name;
  setAvatar(userAvatarEl, session.name);
  if (UserService.isAdmin()) {
    const adminLink = document.getElementById('adminPanelLink');
    if (adminLink) adminLink.style.display = '';
  }
  const menuAvatarEl = document.getElementById('menuAvatar');
  if (menuAvatarEl) setAvatar(menuAvatarEl, session.name);
  const menuNameEl = document.getElementById('menuName');
  if (menuNameEl) menuNameEl.textContent = session.name;

  userMenuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = userMenuDrop.classList.toggle('is-open');
    userMenuToggle.setAttribute('aria-expanded', open);
  });
  document.addEventListener('click', () => userMenuDrop.classList.remove('is-open'));
  userMenuDrop.addEventListener('click', e => e.stopPropagation());

  document.getElementById('logoutBtn').addEventListener('click', () => {
    AuthService.logout(); window.location.href = 'portal.html';
  });

  // ── Load + Filter ─────────────────────────────────────────

  const loadPrompts = async () => {
    LoaderManager.show();
    try {
      state.prompts = await PromptService.getAll(session.userId);
    } catch {
      ToastManager.show('Could not load prompts — check your internet connection.', 'error');
      state.prompts = [];
    } finally {
      LoaderManager.hide();
    }
    render();
    updateSidebarCounts();
    updateStreak();
  };

  const getFiltered = () => {
    let list = [...state.prompts];
    if (state.activeCategory !== 'all') list = list.filter(p => p.category === state.activeCategory);
    if (state.activeFavorites) list = list.filter(p => p.isFavorite);
    if (state.activeRecent) {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      list = list.filter(p => p.createdAt >= cutoff);
    }
    if (state.activeOwned) list = list.filter(p => p.userId === session.userId);
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.text.toLowerCase().includes(q) ||
        (p.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    switch (state.sortMode) {
      case 'oldest':    list.sort((a,b) => a.createdAt - b.createdAt); break;
      case 'az':        list.sort((a,b) => a.title.localeCompare(b.title)); break;
      case 'mostused':  list.sort((a,b) => (b.copyCount||0) - (a.copyCount||0)); break;
      case 'favorites': list.sort((a,b) => (b.isFavorite?1:0) - (a.isFavorite?1:0)); break;
      default:          list.sort((a,b) => b.createdAt - a.createdAt); break;
    }
    return list;
  };

  // ── Render ────────────────────────────────────────────────

  const render = () => {
    const filtered = getFiltered();
    promptGrid.innerHTML = '';
    if (!filtered.length) {
      promptGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">✨</div>
          <div class="empty-state__title">No prompts found</div>
          <div class="empty-state__body">
            ${state.searchQuery ? 'No results match your search.' : 'Add your first prompt to get started.'}
          </div>
        </div>`;
      return;
    }
    filtered.forEach(prompt => promptGrid.appendChild(buildCard(prompt)));
  };

  const buildCard = (prompt) => {
    const card       = document.createElement('div');
    const isSelected = selState.ids.has(prompt.id);
    const isLocked   = !!prompt.isLocked;
    const isOwner    = prompt.userId === session.userId;
    const isPending  = prompt.status === 'pending';
    const isRejected = prompt.status === 'rejected';

    card.className = `prompt-card${selState.active?' is-selectable':''}${isSelected?' is-selected':''}${isLocked?' is-locked':''}${isPending?' is-pending':''}${isRejected?' is-rejected':''}`;
    card.dataset.id = prompt.id;

    const cat  = CATEGORIES.find(c => c.id === prompt.category) || { icon: '📄', label: prompt.category };
    const tags = (prompt.tags || []).slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join('');

    const checkboxHtml = selState.active
      ? `<div class="card-checkbox${isSelected?' is-checked':''}" aria-hidden="true">${isSelected?'✓':''}</div>`
      : '';

    const lockBadge     = isLocked ? `<span class="lock-badge" title="Locked — copy only">🔒 Locked</span>` : '';
    const ownerBadge    = !isOwner ? `<span class="owner-badge" title="Created by ${esc(prompt.creatorName)}">👤 ${esc(prompt.creatorName)}</span>` : '';
    const pendingBadge  = (isPending && isOwner) ? `<span class="status-badge status-badge--pending" title="Awaiting admin approval">⏳ Pending</span>` : '';
    const rejectedBadge = (isRejected && isOwner) ? `<span class="status-badge status-badge--rejected" title="${esc(prompt.rejectionReason || 'Rejected by admin')}">✗ Rejected</span>` : '';

    const canEdit   = isOwner && !isLocked && !isPending && !isRejected;
    const canDelete = isOwner;
    const canCopy   = !isPending && !isRejected;
    const canFav    = !isPending && !isRejected;
    const canLock   = isOwner && !isPending && !isRejected;

    const lockBtn = canLock
      ? (isLocked
          ? `<button class="card-action-btn card-action-btn--lock" data-action="lock" title="Unlock">🔓</button>`
          : `<button class="card-action-btn card-action-btn--lock" data-action="lock" title="Lock to protect">🔒</button>`)
      : '';

    const mutableBtns = canEdit ? `
          <button class="card-action-btn" data-action="edit" title="Edit">✏️</button>
          <button class="card-action-btn" data-action="duplicate" title="Duplicate">⎘</button>` : '';

    const deleteBtn = canDelete ? `<button class="card-action-btn card-action-btn--danger" data-action="delete" title="Delete">🗑</button>` : '';
    const favBtn    = canFav ? `<button class="card-action-btn card-action-btn--fav ${prompt.isFavorite?'is-favorite':''}" data-action="fav" title="Favorite">★</button>` : '';
    const copyBtn   = canCopy ? `<button class="card-action-btn" data-action="copy" title="Copy">📋</button>` : '';

    card.innerHTML = `
      ${checkboxHtml}
      <div class="prompt-card__top">
        <span class="prompt-card__title" data-action="view">${esc(prompt.title)}</span>
        <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;">
          ${lockBadge}${ownerBadge}${pendingBadge}${rejectedBadge}
          <span class="badge badge--${prompt.category}">${cat.icon} ${cat.label}</span>
        </div>
      </div>
      <div class="prompt-card__excerpt">${esc(prompt.text)}</div>
      <div class="prompt-card__tags">${tags}</div>
      <div class="prompt-card__footer">
        <span class="copy-count">📋 Copied ${prompt.copyCount||0} time${prompt.copyCount!==1?'s':''}</span>
        <div class="prompt-card__actions">
          ${favBtn}${copyBtn}${lockBtn}${mutableBtns}${deleteBtn}
        </div>
      </div>`;

    card.addEventListener('click', (e) => {
      if (selState.active) {
        selState.ids.has(prompt.id) ? selState.ids.delete(prompt.id) : selState.ids.add(prompt.id);
        updateSelectionBar(); render(); return;
      }
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action) handleCardAction(action, prompt.id);
    });

    return card;
  };

  const handleCardAction = async (action, id) => {
    if (action === 'view')   { openViewModal(id); return; }
    if (action === 'edit')   { openPromptModal(id); return; }
    if (action === 'delete') { openDeleteModal(id); return; }

    if (action === 'copy') {
      const p = state.prompts.find(x => x.id === id);
      if (!p) return;
      await navigator.clipboard.writeText(p.text).catch(() => {});
      const count = await PromptService.incrementCopyCount(id);
      await loadPrompts();
      ToastManager.show('Prompt copied to clipboard!', 'success');
    }
    if (action === 'fav') {
      await PromptService.toggleFavorite(id, session.userId);
      await loadPrompts();
    }
    if (action === 'duplicate') {
      const p = state.prompts.find(x => x.id === id);
      if (!p) return;
      await PromptService.create(session.userId, { title: `${p.title} (copy)`, category: p.category, text: p.text, tags: [...(p.tags||[])] });
      await loadPrompts();
      ToastManager.show('Prompt duplicated.', 'success');
    }
    if (action === 'lock') {
      const updated = await PromptService.toggleLock(id, session.userId);
      if (!updated) return;
      await loadPrompts();
      ToastManager.show(updated.isLocked ? '🔒 Prompt locked — copy only mode.' : '🔓 Prompt unlocked — editing enabled.', 'info');
    }
  };

  // ── Sidebar ───────────────────────────────────────────────

  const updateSidebarCounts = () => {
    const all = state.prompts;
    document.querySelectorAll('[data-cat-count]').forEach(el => {
      const cat = el.dataset.catCount;
      el.textContent = cat === 'all' ? all.length : all.filter(p => p.category === cat).length;
    });
    const favCount = document.getElementById('favCount');
    if (favCount) favCount.textContent = all.filter(p => p.isFavorite).length;
    const recentCount = document.getElementById('recentCount');
    if (recentCount) {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      recentCount.textContent = all.filter(p => p.createdAt >= cutoff).length;
    }
    const ownedCount = document.getElementById('ownedCount');
    if (ownedCount) ownedCount.textContent = all.filter(p => p.userId === session.userId).length;
  };

  const _clearSidebarActive = () =>
    document.querySelectorAll('[data-sidebar-cat], #sidebarFavorites, #sidebarRecent, #sidebarOwned').forEach(b => b.classList.remove('is-active'));

  document.querySelectorAll('[data-sidebar-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      _clearSidebarActive(); btn.classList.add('is-active');
      state.activeCategory = btn.dataset.sidebarCat;
      state.activeFavorites = false; state.activeRecent = false; state.activeOwned = false;
      render();
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  document.getElementById('sidebarFavorites')?.addEventListener('click', function() {
    _clearSidebarActive(); this.classList.add('is-active');
    state.activeFavorites = true; state.activeRecent = false; state.activeOwned = false; state.activeCategory = 'all';
    render();
    if (window.innerWidth <= 768) closeSidebar();
  });

  document.getElementById('sidebarRecent')?.addEventListener('click', function() {
    _clearSidebarActive(); this.classList.add('is-active');
    state.activeRecent = true; state.activeFavorites = false; state.activeOwned = false; state.activeCategory = 'all';
    render();
    if (window.innerWidth <= 768) closeSidebar();
  });

  document.getElementById('sidebarOwned')?.addEventListener('click', function() {
    _clearSidebarActive(); this.classList.add('is-active');
    state.activeOwned = true; state.activeFavorites = false; state.activeRecent = false; state.activeCategory = 'all';
    render();
    if (window.innerWidth <= 768) closeSidebar();
  });

  // ── Sidebar overlay (mobile) ──────────────────────────────

  const appSidebar       = document.getElementById('appSidebar');
  const sidebarBackdrop  = document.getElementById('sidebarBackdrop');
  const sidebarToggleBtn = document.getElementById('sidebarToggle');

  const openSidebar  = () => { appSidebar?.classList.add('is-open'); sidebarBackdrop?.classList.add('is-visible'); };
  const closeSidebar = () => { appSidebar?.classList.remove('is-open'); sidebarBackdrop?.classList.remove('is-visible'); };

  sidebarToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    appSidebar?.classList.contains('is-open') ? closeSidebar() : openSidebar();
  });
  sidebarBackdrop?.addEventListener('click', closeSidebar);

  // ── Sort pills ────────────────────────────────────────────

  document.querySelectorAll('.sort-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.sort-pill').forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      state.sortMode = pill.dataset.sort;
      render();
    });
  });

  // ── Search ────────────────────────────────────────────────

  let searchTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { state.searchQuery = searchInput.value.trim(); render(); }, 220);
  });

  // ── Add/Edit Modal ────────────────────────────────────────

  let editingId = null;
  let tagList   = [];

  const titleInput    = document.getElementById('promptTitle');
  const categoryInput = document.getElementById('promptCategory');
  const textInput     = document.getElementById('promptText');
  const tagsWrapper   = document.getElementById('tagsInputWrapper');

  const renderTagChips = () => {
    const chips = tagList.map((t, i) => `
      <span class="tag-chip">${esc(t)}<button class="tag-chip__remove" data-tag-idx="${i}" aria-label="Remove tag">×</button></span>`).join('');
    tagsWrapper.innerHTML = chips + `<input class="tags-input" id="tagsRealInput" placeholder="${tagList.length?'':'Add tags…'}" maxlength="30">`;
    bindTagInput();
  };

  const bindTagInput = () => {
    const inp = document.getElementById('tagsRealInput');
    if (!inp) return;
    inp.addEventListener('keydown', (e) => {
      if ((e.key==='Enter'||e.key===',') && inp.value.trim()) { e.preventDefault(); addTag(inp.value.trim()); }
      if (e.key==='Backspace' && !inp.value && tagList.length) { tagList.pop(); renderTagChips(); }
    });
    inp.addEventListener('blur', () => { if (inp.value.trim()) addTag(inp.value.trim()); });
  };

  const addTag = (tag) => {
    const clean = tag.replace(/,/g,'').trim().toLowerCase().slice(0,30);
    if (clean && !tagList.includes(clean) && tagList.length < 8) { tagList.push(clean); renderTagChips(); }
  };

  tagsWrapper.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tag-idx]');
    if (btn) { tagList.splice(Number(btn.dataset.tagIdx),1); renderTagChips(); }
    else document.getElementById('tagsRealInput')?.focus();
  });
  tagsWrapper.addEventListener('focusin',  () => tagsWrapper.classList.add('is-focused'));
  tagsWrapper.addEventListener('focusout', () => tagsWrapper.classList.remove('is-focused'));

  const openPromptModal = (id = null) => {
    editingId = id; tagList = [];
    document.getElementById('promptModalTitle').textContent = id ? 'Edit Prompt' : 'New Prompt';
    titleInput.value = ''; textInput.value = ''; categoryInput.value = CATEGORIES[0].id;
    [titleInput, textInput].forEach(el => el.classList.remove('is-error'));
    document.querySelectorAll('#promptForm .form-error').forEach(el => el.textContent = '');
    renderTagChips();
    if (id) {
      const p = state.prompts.find(x => x.id === id);
      if (p) { titleInput.value = p.title; textInput.value = p.text; categoryInput.value = p.category; tagList = [...(p.tags||[])]; renderTagChips(); }
    }
    promptModalBd.classList.add('is-open');
    titleInput.focus();
  };

  const closePromptModal = () => promptModalBd.classList.remove('is-open');

  document.getElementById('addPromptBtn').addEventListener('click', () => openPromptModal());
  document.getElementById('promptModalClose').addEventListener('click', closePromptModal);
  document.getElementById('promptModalCancel').addEventListener('click', closePromptModal);
  promptModalBd.addEventListener('click', (e) => { if (e.target === promptModalBd) closePromptModal(); });

  document.getElementById('promptModalSave').addEventListener('click', async () => {
    const title = titleInput.value.trim(), text = textInput.value.trim(), category = categoryInput.value;
    let hasError = false;
    if (!title) { titleInput.classList.add('is-error'); document.getElementById('titleError').textContent = 'Title is required.'; hasError = true; }
    if (!text)  { textInput.classList.add('is-error');  document.getElementById('textError').textContent  = 'Prompt text is required.'; hasError = true; }
    if (hasError) return;
    const btn = document.getElementById('promptModalSave');
    LoaderManager.showInline(btn);
    if (editingId) {
      await PromptService.update(editingId, session.userId, { title, category, text, tags: tagList });
      ToastManager.show('Prompt updated.', 'success');
    } else {
      const newPrompt = await PromptService.create(session.userId, { title, category, text, tags: tagList });
      if (newPrompt.status === 'pending') {
        document.getElementById('promptSubmittedBackdrop').classList.add('is-open');
        EmailService.sendNotification(
          AppConfig.ADMIN_EMAIL, AppConfig.ADMIN_NAME,
          'New prompt awaiting approval',
          `${session.name} submitted a new prompt titled "${title}" for your review. Please log in to the admin panel to approve or reject it.`
        );
      } else {
        ToastManager.show('Prompt added.', 'success');
      }
    }
    LoaderManager.hideInline(btn);
    closePromptModal();
    await loadPrompts();
  });

  // ── View Modal ────────────────────────────────────────────

  const openViewModal = (id) => {
    const p = state.prompts.find(x => x.id === id);
    if (!p) return;
    const isOwner = p.userId === session.userId;
    const cat = CATEGORIES.find(c => c.id === p.category) || { icon: '📄', label: p.category };

    document.getElementById('viewTitle').textContent    = p.title;
    document.getElementById('viewCategory').className   = `badge badge--${p.category}`;
    document.getElementById('viewCategory').textContent = `${cat.icon} ${cat.label}`;

    const lockEl = document.getElementById('viewLockBadge');
    if (lockEl) lockEl.style.display = p.isLocked ? 'inline-flex' : 'none';

    const safeText = Validator.sanitizeHtml(p.text)
      .replace(/\{\{([^}]+)\}\}/g, '<mark class="var-highlight">{{$1}}</mark>');
    document.getElementById('viewText').innerHTML = safeText;
    document.getElementById('viewCopyCount').textContent = `Copied ${p.copyCount||0} time${p.copyCount!==1?'s':''}`;

    const tags = (p.tags||[]).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    document.getElementById('viewTags').innerHTML = tags;

    const editBtn = document.getElementById('viewEditBtn');
    if (editBtn) {
      editBtn.style.display = (isOwner && !p.isLocked) ? '' : 'none';
      editBtn.onclick = () => { closeViewModal(); openPromptModal(id); };
    }

    document.getElementById('usePromptBtn').onclick = async () => {
      await navigator.clipboard.writeText(p.text).catch(() => {});
      const count = await PromptService.incrementCopyCount(id);
      document.getElementById('viewCopyCount').textContent = `Copied ${count} time${count!==1?'s':''}`;
      await loadPrompts();
      ToastManager.show('Prompt copied to clipboard!', 'success');
    };

    viewModalBd.classList.add('is-open');
  };

  const closeViewModal = () => viewModalBd.classList.remove('is-open');
  document.getElementById('viewModalClose').addEventListener('click', closeViewModal);
  viewModalBd.addEventListener('click', (e) => { if (e.target === viewModalBd) closeViewModal(); });

  // ── Delete Modal ──────────────────────────────────────────

  let deletingId = null;

  const openDeleteModal  = (id) => { deletingId = id; deleteModal.classList.add('is-open'); };
  const closeDeleteModal = () => { deletingId = null; deleteModal.classList.remove('is-open'); };

  document.getElementById('deleteModalClose').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
  deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) closeDeleteModal(); });

  const closeSubmittedModal = () => document.getElementById('promptSubmittedBackdrop').classList.remove('is-open');
  document.getElementById('promptSubmittedClose').addEventListener('click', closeSubmittedModal);
  document.getElementById('promptSubmittedOkBtn').addEventListener('click', closeSubmittedModal);
  document.getElementById('promptSubmittedBackdrop').addEventListener('click', (e) => { if (e.target === document.getElementById('promptSubmittedBackdrop')) closeSubmittedModal(); });

  document.getElementById('deleteConfirmBtn').addEventListener('click', async () => {
    if (!deletingId) return;
    await PromptService.remove(deletingId, session.userId);
    closeDeleteModal(); closeViewModal();
    await loadPrompts();
    ToastManager.show('Prompt deleted.', 'success');
  });

  // ── Selection mode ────────────────────────────────────────

  const selState = { active: false, ids: new Set() };
  const selectionBar    = document.getElementById('selectionBar');
  const selectionCount  = document.getElementById('selectionCount');
  const selectionPlural = document.getElementById('selectionPlural');
  const exportScopeNote = document.getElementById('exportScopeNote');

  const updateSelectionBar = () => {
    const n = selState.ids.size;
    selectionCount.textContent  = n;
    selectionPlural.textContent = n === 1 ? '' : 's';
    exportScopeNote.textContent = selState.active
      ? (n ? `${n} prompt${n!==1?'s':''} selected` : 'No prompts selected')
      : 'Exporting all prompts';
  };

  const enterSelectMode = () => {
    selState.active = true; selState.ids.clear();
    selectionBar.classList.add('is-visible');
    document.getElementById('toggleSelectMode').querySelector('div > div:first-child').textContent = 'Exit selection mode';
    updateSelectionBar(); render();
  };

  const exitSelectMode = () => {
    selState.active = false; selState.ids.clear();
    selectionBar.classList.remove('is-visible');
    document.getElementById('toggleSelectMode').querySelector('div > div:first-child').textContent = 'Select specific prompts';
    updateSelectionBar(); render();
  };

  document.getElementById('toggleSelectMode').addEventListener('click', () => { closeDropdown('exportMenu'); selState.active ? exitSelectMode() : enterSelectMode(); });
  document.getElementById('cancelSelectBtn').addEventListener('click', exitSelectMode);
  document.getElementById('selectAllBtn').addEventListener('click', () => { getFiltered().forEach(p => selState.ids.add(p.id)); updateSelectionBar(); render(); });
  document.getElementById('clearSelBtn').addEventListener('click', () => { selState.ids.clear(); updateSelectionBar(); render(); });

  // ── Export ────────────────────────────────────────────────

  const downloadFile = (content, filename, mime) => {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([content], { type: mime })), download: filename,
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const csvCell = (val) => { const s = String(val??'').replace(/"/g,'""'); return /[,"\n\r]/.test(s)?`"${s}"`:s; };

  const doExport = (fmt, prompts) => {
    if (!prompts.length) { ToastManager.show('No prompts to export.', 'warning'); return; }
    if (fmt === 'json') {
      downloadFile(JSON.stringify(prompts.map(p => ({ title:p.title, category:p.category, text:p.text, tags:p.tags||[] })), null, 2), 'promptlib-export.json', 'application/json');
      ToastManager.show(`Exported ${prompts.length} prompt${prompts.length!==1?'s':''} as JSON.`, 'success');
    } else if (fmt === 'csv') {
      const rows = prompts.map(p => [csvCell(p.title),csvCell(p.category),csvCell(p.text),csvCell((p.tags||[]).join('; '))].join(','));
      downloadFile(['title,category,text,tags',...rows].join('\n'), 'promptlib-export.csv', 'text/csv');
      ToastManager.show(`Exported ${prompts.length} prompt${prompts.length!==1?'s':''} as CSV.`, 'success');
    } else if (fmt === 'pdf') {
      if (!window.jspdf) { ToastManager.show('PDF library still loading — try again in a moment.', 'warning'); return; }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit:'mm', format:'a4' });
      const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight();
      const ml=18, mr=18, cW=pageW-ml-mr;
      let y=0;
      const newPage = () => { doc.addPage(); y=18; };
      const need = (h) => { if (y+h > pageH-14) newPage(); };
      doc.setFillColor(92,107,192); doc.rect(0,0,pageW,13,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont('helvetica','bold');
      doc.text('PromptLib Export', ml, 8.5);
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      doc.text(`${prompts.length} prompt${prompts.length!==1?'s':''}  |  ${new Date().toLocaleDateString()}`, pageW-mr, 8.5, {align:'right'});
      y=22; doc.setTextColor(30,30,30);
      prompts.forEach((p,i) => {
        need(22);
        doc.setFillColor(232,234,246); doc.roundedRect(ml,y,cW,9,1.5,1.5,'F');
        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(60,80,170);
        doc.text(doc.splitTextToSize(`${i+1}. ${p.title}`, cW-28)[0], ml+3, y+6);
        doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,110,150);
        doc.text(p.category.toUpperCase(), pageW-mr-2, y+5.8, {align:'right'});
        y+=12;
        doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(50,50,50);
        doc.splitTextToSize(p.text, cW-4).forEach(line => { need(5.5); doc.text(line, ml+2, y); y+=5; });
        if (p.tags&&p.tags.length) { need(7); y+=1.5; doc.setFontSize(7.5); doc.setTextColor(130,130,130); doc.text('Tags: '+p.tags.join('  |  '), ml+2, y); y+=5; }
        y+=4;
        if (i<prompts.length-1) { need(3); doc.setDrawColor(210,214,240); doc.line(ml,y-2,pageW-mr,y-2); }
      });
      doc.save('promptlib-export.pdf');
      ToastManager.show(`PDF downloaded — ${prompts.length} prompt${prompts.length!==1?'s':''}.`, 'success');
    }
  };

  const getExportPrompts = () => (selState.active && selState.ids.size)
    ? state.prompts.filter(p => selState.ids.has(p.id))
    : state.prompts;

  document.querySelectorAll('[data-export-fmt]').forEach(btn => {
    btn.addEventListener('click', () => { closeDropdown('exportMenu'); doExport(btn.dataset.exportFmt, getExportPrompts()); });
  });
  document.querySelectorAll('[data-sel-fmt]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeDropdown('exportSelMenu');
      const prompts = selState.ids.size ? state.prompts.filter(p => selState.ids.has(p.id)) : [];
      if (!prompts.length) { ToastManager.show('Select at least one prompt first.', 'warning'); return; }
      doExport(btn.dataset.selFmt, prompts);
    });
  });

  // ── Import ────────────────────────────────────────────────

  let pendingImport = [];

  const parseCsvRow = (line) => {
    const res=[]; let inQ=false; let cur='';
    for (let i=0; i<line.length; i++) {
      const ch=line[i];
      if (ch==='"') { if (inQ&&line[i+1]==='"') { cur+='"'; i++; } else inQ=!inQ; }
      else if (ch===','&&!inQ) { res.push(cur.trim()); cur=''; }
      else cur+=ch;
    }
    res.push(cur.trim()); return res;
  };

  const VALID_CATS = ['coding','writing','marketing','creative','education'];
  const normCat = (raw='') => { const s=raw.toLowerCase().trim(); return VALID_CATS.includes(s)?s:'coding'; };

  const parseJsonImport = (text) => {
    try {
      const data = JSON.parse(text);
      const arr  = Array.isArray(data) ? data : (data.prompts||[]);
      return arr.filter(p=>p&&(p.title||p.text)).map(p => ({
        title:    String(p.title||p.name||'Untitled').trim().slice(0,80),
        category: normCat(p.category||p.type),
        text:     String(p.text||p.content||p.prompt||'').trim(),
        tags:     Array.isArray(p.tags)?p.tags.map(String):[],
      }));
    } catch { ToastManager.show('Invalid JSON — could not parse the file.', 'error'); return null; }
  };

  const parseCsvImport = (text) => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) { ToastManager.show('CSV file appears empty.', 'error'); return null; }
    const hdrs = parseCsvRow(lines[0]).map(h=>h.toLowerCase().replace(/[^a-z0-9]/g,''));
    const idx = {
      title:    hdrs.findIndex(h=>['title','name','promptname'].includes(h)),
      category: hdrs.findIndex(h=>['category','type','cat'].includes(h)),
      text:     hdrs.findIndex(h=>['text','prompt','content','body','prompttext'].includes(h)),
      tags:     hdrs.findIndex(h=>['tags','tag','keywords','labels'].includes(h)),
    };
    if (idx.title===-1&&idx.text===-1) { ToastManager.show('Could not detect required columns.', 'error'); return null; }
    return lines.slice(1).map(line => {
      const c = parseCsvRow(line);
      return {
        title:    (idx.title>=0?c[idx.title]:'')||'Untitled',
        category: normCat(idx.category>=0?c[idx.category]:''),
        text:     (idx.text>=0?c[idx.text]:'').trim(),
        tags:     idx.tags>=0&&c[idx.tags]?c[idx.tags].split(/[;,]/).map(t=>t.trim()).filter(Boolean):[],
      };
    }).filter(p=>p.title!=='Untitled'||p.text);
  };

  const showImportPreview = (prompts) => {
    if (!prompts.length) { ToastManager.show('No valid prompts found.', 'warning'); return; }
    pendingImport = prompts;
    const preview = prompts.slice(0,5);
    document.getElementById('importPreviewSummary').textContent =
      `Found ${prompts.length} prompt${prompts.length!==1?'s':''} ready to import${prompts.length>5?' (showing first 5 below)':''}:`;
    document.getElementById('importPreviewConfirm').textContent = `Import all ${prompts.length}`;
    document.getElementById('importPreviewTable').innerHTML = preview.map(p => `
      <div class="import-preview-row">
        <div class="import-preview-row__title">${esc(p.title)}</div>
        <span class="badge badge--${p.category}">${p.category}</span>
        <div class="import-preview-row__text">${esc(p.text.slice(0,120))}${p.text.length>120?'…':''}</div>
        ${p.tags.length?`<div class="import-preview-row__tags">${p.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>`:''}
      </div>`).join('');
    document.getElementById('importPreviewBackdrop').classList.add('is-open');
  };

  const closeImportPreview = () => { document.getElementById('importPreviewBackdrop').classList.remove('is-open'); pendingImport = []; };

  document.getElementById('importPreviewClose').addEventListener('click', closeImportPreview);
  document.getElementById('importPreviewCancel').addEventListener('click', closeImportPreview);
  document.getElementById('importPreviewBackdrop').addEventListener('click', (e) => { if (e.target===document.getElementById('importPreviewBackdrop')) closeImportPreview(); });

  document.getElementById('importPreviewConfirm').addEventListener('click', async () => {
    const btn = document.getElementById('importPreviewConfirm');
    LoaderManager.showInline(btn);
    const result = await PromptService.importPrompts(session.userId, pendingImport);
    LoaderManager.hideInline(btn);
    closeImportPreview();
    await loadPrompts();
    if (result.success) ToastManager.show(`Successfully imported ${result.count} prompt${result.count!==1?'s':''}.`, 'success');
    else ToastManager.show(result.message, 'error');
  });

  const triggerImport = (accept) => { importFileInput.accept=accept; importFileInput.click(); closeDropdown('importMenu'); };
  document.getElementById('importJsonBtn').addEventListener('click', () => triggerImport('.json'));
  document.getElementById('importCsvBtn').addEventListener('click',  () => triggerImport('.csv'));

  document.getElementById('downloadTemplateBtn').addEventListener('click', () => {
    closeDropdown('importMenu');
    downloadFile(['title,category,text,tags',
      '"Code Review Assistant","coding","Review the following code:\n\n[PASTE CODE HERE]","code review,debugging"',
      '"Blog Post Writer","writing","Write an engaging blog post about [TOPIC] for [AUDIENCE].","blog,content writing"',
    ].join('\n'), 'promptlib-import-template.csv', 'text/csv');
    ToastManager.show('Template downloaded.', 'success');
  });

  importBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown('importMenu','exportMenu'); });
  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = (ev) => { const p = ext==='csv'?parseCsvImport(ev.target.result):parseJsonImport(ev.target.result); if (p) showImportPreview(p); };
    reader.readAsText(file);
    importFileInput.value = '';
  });

  // ── Dropdowns ─────────────────────────────────────────────

  const closeDropdown  = (id) => document.getElementById(id)?.classList.remove('is-open');
  const toggleDropdown = (id, closeOther) => { if (closeOther) closeDropdown(closeOther); document.getElementById(id)?.classList.toggle('is-open'); };

  exportBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown('exportMenu','importMenu'); });
  document.getElementById('exportSelBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown('exportSelMenu'); });
  document.addEventListener('click', () => { closeDropdown('exportMenu'); closeDropdown('importMenu'); closeDropdown('exportSelMenu'); });
  ['exportMenu','importMenu','exportSelMenu'].forEach(id => document.getElementById(id)?.addEventListener('click', e=>e.stopPropagation()));

  // ── Shortcuts modal ───────────────────────────────────────

  const shortcutsBackdrop  = document.getElementById('shortcutsBackdrop');
  const openShortcutsModal  = () => shortcutsBackdrop?.classList.add('is-open');
  const closeShortcutsModal = () => shortcutsBackdrop?.classList.remove('is-open');
  document.getElementById('shortcutsBtn')?.addEventListener('click', openShortcutsModal);
  document.getElementById('shortcutsClose')?.addEventListener('click', closeShortcutsModal);
  document.getElementById('shortcutsCloseBtn')?.addEventListener('click', closeShortcutsModal);
  shortcutsBackdrop?.addEventListener('click', (e) => { if (e.target===shortcutsBackdrop) closeShortcutsModal(); });

  // ── Bulk actions ──────────────────────────────────────────

  document.getElementById('bulkFavBtn')?.addEventListener('click', async () => {
    if (!selState.ids.size) { ToastManager.show('Select at least one prompt first.', 'warning'); return; }
    const count = selState.ids.size;
    await Promise.all([...selState.ids].map(id => PromptService.toggleFavorite(id, session.userId)));
    exitSelectMode();
    await loadPrompts();
    ToastManager.show(`Toggled favorite on ${count} prompt${count!==1?'s':''}.`, 'success');
  });

  document.getElementById('bulkDeleteBtn')?.addEventListener('click', async () => {
    if (!selState.ids.size) { ToastManager.show('Select at least one prompt first.', 'warning'); return; }
    const count = selState.ids.size;
    await Promise.all([...selState.ids].map(id => PromptService.remove(id, session.userId)));
    exitSelectMode();
    await loadPrompts();
    ToastManager.show(`Deleted ${count} prompt${count!==1?'s':''}.`, 'success');
  });

  // ── Session expiry warning ────────────────────────────────

  const watchSession = () => {
    const banner = document.getElementById('sessionBanner');
    setInterval(() => {
      const s = AuthService.getSession();
      if (!s) { window.location.href = 'portal.html'; return; }
      if (banner) banner.classList.toggle('is-visible', s.expiresAt - Date.now() < 5 * 60 * 1000);
    }, 30_000);
  };

  // ── Keyboard ──────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    const inInput = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);
    if (e.key === 'Escape') {
      closePromptModal(); closeViewModal(); closeDeleteModal(); closeShortcutsModal(); closeSubmittedModal();
      closeDropdown('exportMenu'); closeDropdown('importMenu');
      if (selState.active) exitSelectMode();
    }
    if (!inInput) {
      if (e.key === '/') { e.preventDefault(); searchInput.focus(); }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); openPromptModal(); }
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); openShortcutsModal(); }
    }
  });

  // ── Streak ────────────────────────────────────────────────

  const updateStreak = () => {
    const approvedCount = state.prompts.filter(p => p.userId === session.userId && p.status === 'approved').length;
    const badge = document.getElementById('streakBadge');
    const count = document.getElementById('streakCount');
    if (badge && count) {
      count.textContent = approvedCount;
      badge.style.display = approvedCount > 0 ? 'flex' : 'none';
    }
  };

  // ── Init ──────────────────────────────────────────────────

  await loadPrompts();
  updateStreak();
  watchSession();
})();
