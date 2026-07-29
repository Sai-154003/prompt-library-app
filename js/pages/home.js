(() => {
  const session = AuthService.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  PromptService.seedForUser(session.userId);

  const { CATEGORIES } = Constants;

  // State
  const state = {
    prompts:         [],
    activeCategory:  'all',
    activeFavorites: false,
    activeRecent:    false,
    sortMode:        'newest',
    searchQuery:     '',
  };

  // DOM refs
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

  // Modal refs
  const promptModal    = document.getElementById('promptModal');
  const promptModalBd  = document.getElementById('promptModalBackdrop');
  const viewModal      = document.getElementById('viewModal');
  const viewModalBd    = document.getElementById('viewModalBackdrop');
  const deleteModal    = document.getElementById('deleteModalBackdrop');

  // ── Helpers ──────────────────────────────────────────────

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

  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  };

  const savedTheme = StorageRepository.get(Constants.STORAGE_KEYS.THEME) || 'light';
  applyTheme(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    StorageRepository.set(Constants.STORAGE_KEYS.THEME, next);
    AuthService.updateProfile(session.email, { theme: next });
  });

  // ── User menu ────────────────────────────────────────────

  userNameEl.textContent = session.name;
  setAvatar(userAvatarEl, session.name);

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
    AuthService.logout();
    window.location.href = 'index.html';
  });

  // ── Filtering + Sorting ──────────────────────────────────

  const loadPrompts = () => {
    state.prompts = PromptService.getAll(session.userId);
    render();
    updateSidebarCounts();
  };

  const getFiltered = () => {
    let list = [...state.prompts];

    if (state.activeCategory !== 'all') {
      list = list.filter(p => p.category === state.activeCategory);
    }
    if (state.activeFavorites) {
      list = list.filter(p => p.isFavorite);
    }
    if (state.activeRecent) {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      list = list.filter(p => p.createdAt >= cutoff);
    }
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
      case 'favorites': list.sort((a,b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0)); break;
      default:          list.sort((a,b) => b.createdAt - a.createdAt); break;
    }

    return list;
  };

  // ── Render cards ─────────────────────────────────────────

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
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.dataset.id = prompt.id;

    const cat = CATEGORIES.find(c => c.id === prompt.category) || { icon: '📄', label: prompt.category };
    const tags = (prompt.tags || []).slice(0, 3).map(t => `<span class="tag">${Validator.sanitizeHtml(t)}</span>`).join('');
    const favClass = prompt.isFavorite ? 'is-favorite' : '';

    card.innerHTML = `
      <div class="prompt-card__top">
        <span class="prompt-card__title" data-action="view">${Validator.sanitizeHtml(prompt.title)}</span>
        <span class="badge badge--${prompt.category}">${cat.icon} ${cat.label}</span>
      </div>
      <div class="prompt-card__excerpt">${Validator.sanitizeHtml(prompt.text)}</div>
      <div class="prompt-card__tags">${tags}</div>
      <div class="prompt-card__footer">
        <span class="copy-count">📋 Copied ${prompt.copyCount || 0} time${prompt.copyCount !== 1 ? 's' : ''}</span>
        <div class="prompt-card__actions">
          <button class="card-action-btn card-action-btn--fav ${favClass}" data-action="fav" aria-label="Toggle favorite" title="Favorite">★</button>
          <button class="card-action-btn" data-action="copy" aria-label="Copy prompt" title="Copy">📋</button>
          <button class="card-action-btn" data-action="edit" aria-label="Edit prompt" title="Edit">✏️</button>
          <button class="card-action-btn card-action-btn--danger" data-action="delete" aria-label="Delete prompt" title="Delete">🗑</button>
        </div>
      </div>`;

    card.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      handleCardAction(action, prompt.id, e.target.closest('[data-action]'));
    });

    return card;
  };

  const handleCardAction = async (action, id, el) => {
    if (action === 'view')   openViewModal(id);
    if (action === 'edit')   openPromptModal(id);
    if (action === 'delete') openDeleteModal(id);
    if (action === 'copy') {
      const p = state.prompts.find(x => x.id === id);
      if (!p) return;
      await navigator.clipboard.writeText(p.text).catch(() => {});
      const count = PromptService.incrementCopyCount(id, session.userId);
      loadPrompts();
      ToastManager.show('Prompt copied to clipboard!', 'success');
    }
    if (action === 'fav') {
      PromptService.toggleFavorite(id, session.userId);
      loadPrompts();
    }
  };

  // ── Sidebar ──────────────────────────────────────────────

  const updateSidebarCounts = () => {
    const all = PromptService.getAll(session.userId);
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
  };

  document.querySelectorAll('[data-sidebar-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-sidebar-cat]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.activeCategory  = btn.dataset.sidebarCat;
      state.activeFavorites = false;
      state.activeRecent    = false;
      render();
    });
  });

  document.getElementById('sidebarFavorites')?.addEventListener('click', function() {
    document.querySelectorAll('[data-sidebar-cat], #sidebarFavorites, #sidebarRecent').forEach(b => b.classList.remove('is-active'));
    this.classList.add('is-active');
    state.activeFavorites = true;
    state.activeRecent    = false;
    state.activeCategory  = 'all';
    render();
  });

  document.getElementById('sidebarRecent')?.addEventListener('click', function() {
    document.querySelectorAll('[data-sidebar-cat], #sidebarFavorites, #sidebarRecent').forEach(b => b.classList.remove('is-active'));
    this.classList.add('is-active');
    state.activeRecent    = true;
    state.activeFavorites = false;
    state.activeCategory  = 'all';
    render();
  });

  // ── Sort pills ───────────────────────────────────────────

  document.querySelectorAll('.sort-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.sort-pill').forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      state.sortMode = pill.dataset.sort;
      render();
    });
  });

  // ── Search ───────────────────────────────────────────────

  let searchTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = searchInput.value.trim();
      render();
    }, 220);
  });

  // ── Add/Edit Prompt Modal ────────────────────────────────

  let editingId = null;
  let tagList   = [];

  const titleInput    = document.getElementById('promptTitle');
  const categoryInput = document.getElementById('promptCategory');
  const textInput     = document.getElementById('promptText');
  const tagsWrapper   = document.getElementById('tagsInputWrapper');
  const tagsHidden    = document.getElementById('tagsInput');

  const renderTagChips = () => {
    const chips = tagList.map((t, i) => `
      <span class="tag-chip">
        ${Validator.sanitizeHtml(t)}
        <button class="tag-chip__remove" data-tag-idx="${i}" aria-label="Remove tag">×</button>
      </span>`).join('');
    tagsWrapper.innerHTML = chips + `<input class="tags-input" id="tagsRealInput" placeholder="${tagList.length ? '' : 'Add tags…'}" maxlength="30">`;
    bindTagInput();
  };

  const bindTagInput = () => {
    const inp = document.getElementById('tagsRealInput');
    if (!inp) return;
    inp.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ',') && inp.value.trim()) {
        e.preventDefault();
        addTag(inp.value.trim());
      }
      if (e.key === 'Backspace' && !inp.value && tagList.length) {
        tagList.pop();
        renderTagChips();
      }
    });
    inp.addEventListener('blur', () => { if (inp.value.trim()) addTag(inp.value.trim()); });
  };

  const addTag = (tag) => {
    const clean = tag.replace(/,/g, '').trim().toLowerCase().slice(0, 30);
    if (clean && !tagList.includes(clean) && tagList.length < 8) {
      tagList.push(clean);
      renderTagChips();
    }
  };

  tagsWrapper.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tag-idx]');
    if (btn) {
      tagList.splice(Number(btn.dataset.tagIdx), 1);
      renderTagChips();
    } else {
      document.getElementById('tagsRealInput')?.focus();
    }
  });

  tagsWrapper.addEventListener('focusin', () => tagsWrapper.classList.add('is-focused'));
  tagsWrapper.addEventListener('focusout', () => tagsWrapper.classList.remove('is-focused'));

  const openPromptModal = (id = null) => {
    editingId = id;
    tagList   = [];

    document.getElementById('promptModalTitle').textContent = id ? 'Edit Prompt' : 'New Prompt';
    titleInput.value    = '';
    textInput.value     = '';
    categoryInput.value = CATEGORIES[0].id;
    [titleInput, textInput].forEach(el => el.classList.remove('is-error'));
    document.querySelectorAll('#promptForm .form-error').forEach(el => el.textContent = '');
    renderTagChips();

    if (id) {
      const p = state.prompts.find(x => x.id === id);
      if (p) {
        titleInput.value    = p.title;
        textInput.value     = p.text;
        categoryInput.value = p.category;
        tagList = [...(p.tags || [])];
        renderTagChips();
      }
    }

    promptModalBd.classList.add('is-open');
    titleInput.focus();
  };

  const closePromptModal = () => promptModalBd.classList.remove('is-open');

  document.getElementById('addPromptBtn').addEventListener('click', () => openPromptModal());
  document.getElementById('promptModalClose').addEventListener('click', closePromptModal);
  document.getElementById('promptModalCancel').addEventListener('click', closePromptModal);
  promptModalBd.addEventListener('click', (e) => { if (e.target === promptModalBd) closePromptModal(); });

  document.getElementById('promptModalSave').addEventListener('click', () => {
    const title    = titleInput.value.trim();
    const text     = textInput.value.trim();
    const category = categoryInput.value;
    let hasError   = false;

    if (!title) { titleInput.classList.add('is-error'); document.getElementById('titleError').textContent = 'Title is required.'; hasError = true; }
    if (!text)  { textInput.classList.add('is-error');  document.getElementById('textError').textContent  = 'Prompt text is required.'; hasError = true; }
    if (hasError) return;

    if (editingId) {
      PromptService.update(editingId, session.userId, { title, category, text, tags: tagList });
      ToastManager.show('Prompt updated.', 'success');
    } else {
      PromptService.create(session.userId, { title, category, text, tags: tagList });
      ToastManager.show('Prompt added.', 'success');
    }

    closePromptModal();
    loadPrompts();
  });

  // ── View Modal ───────────────────────────────────────────

  const openViewModal = (id) => {
    const p = state.prompts.find(x => x.id === id);
    if (!p) return;
    const cat = CATEGORIES.find(c => c.id === p.category) || { icon: '📄', label: p.category };

    document.getElementById('viewTitle').textContent    = p.title;
    document.getElementById('viewCategory').className   = `badge badge--${p.category}`;
    document.getElementById('viewCategory').textContent = `${cat.icon} ${cat.label}`;
    document.getElementById('viewText').textContent     = p.text;
    document.getElementById('viewCopyCount').textContent = `Copied ${p.copyCount || 0} time${p.copyCount !== 1 ? 's' : ''}`;

    const tags = (p.tags || []).map(t => `<span class="tag">${Validator.sanitizeHtml(t)}</span>`).join('');
    document.getElementById('viewTags').innerHTML = tags;

    document.getElementById('usePromptBtn').onclick = async () => {
      await navigator.clipboard.writeText(p.text).catch(() => {});
      const count = PromptService.incrementCopyCount(id, session.userId);
      document.getElementById('viewCopyCount').textContent = `Copied ${count} time${count !== 1 ? 's' : ''}`;
      loadPrompts();
      ToastManager.show('Prompt copied to clipboard!', 'success');
    };

    viewModalBd.classList.add('is-open');
  };

  const closeViewModal = () => viewModalBd.classList.remove('is-open');
  document.getElementById('viewModalClose').addEventListener('click', closeViewModal);
  viewModalBd.addEventListener('click', (e) => { if (e.target === viewModalBd) closeViewModal(); });

  // ── Delete Modal ─────────────────────────────────────────

  let deletingId = null;

  const openDeleteModal = (id) => {
    deletingId = id;
    deleteModal.classList.add('is-open');
  };

  const closeDeleteModal = () => {
    deletingId = null;
    deleteModal.classList.remove('is-open');
  };

  document.getElementById('deleteModalClose').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
  deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) closeDeleteModal(); });

  document.getElementById('deleteConfirmBtn').addEventListener('click', () => {
    if (!deletingId) return;
    PromptService.remove(deletingId, session.userId);
    closeDeleteModal();
    closeViewModal();
    loadPrompts();
    ToastManager.show('Prompt deleted.', 'success');
  });

  // ── Import / Export ──────────────────────────────────────

  exportBtn.addEventListener('click', () => {
    PromptService.exportPrompts(session.userId);
    ToastManager.show('Export downloaded.', 'success');
  });

  importBtn.addEventListener('click', () => importFileInput.click());

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = PromptService.importPrompts(session.userId, ev.target.result);
      if (result.success) {
        ToastManager.show(`Imported ${result.count} prompt${result.count !== 1 ? 's' : ''}.`, 'success');
        loadPrompts();
      } else {
        ToastManager.show(result.message, 'error');
      }
    };
    reader.readAsText(file);
    importFileInput.value = '';
  });

  // ── Keyboard ─────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePromptModal();
      closeViewModal();
      closeDeleteModal();
    }
  });

  // ── Init ─────────────────────────────────────────────────
  loadPrompts();
})();
