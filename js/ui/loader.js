window.LoaderManager = (() => {
  let overlay = null;

  const _ensureOverlay = () => {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'loader-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<div class="loader-spinner" role="status"><span class="sr-only">Loading…</span></div>';
    document.body.appendChild(overlay);
  };

  const show = () => {
    _ensureOverlay();
    overlay.classList.add('loader-overlay--visible');
    document.body.setAttribute('aria-busy', 'true');
  };

  const hide = () => {
    if (!overlay) return;
    overlay.classList.remove('loader-overlay--visible');
    document.body.removeAttribute('aria-busy');
  };

  const showInline = (btn) => {
    if (!btn) return;
    btn.disabled = true;
    btn._originalText = btn.innerHTML;
    btn.innerHTML = '<span class="btn-spinner"></span>';
  };

  const hideInline = (btn) => {
    if (!btn || btn._originalText === undefined) return;
    btn.disabled = false;
    btn.innerHTML = btn._originalText;
    delete btn._originalText;
  };

  return Object.freeze({ show, hide, showInline, hideInline });
})();
