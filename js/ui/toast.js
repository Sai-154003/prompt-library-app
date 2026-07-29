window.ToastManager = (() => {
  let container = null;

  const _ensureContainer = () => {
    if (container) return;
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
  };

  const ICONS = {
    success: '✓',
    error:   '✕',
    warning: '⚠',
    info:    'ℹ',
  };

  const show = (message, type = 'info', duration = 4000) => {
    _ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'alert');

    const icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.textContent = ICONS[type] || ICONS.info;

    const text = document.createElement('span');
    text.className = 'toast__text';
    text.textContent = message;

    const close = document.createElement('button');
    close.className = 'toast__close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.textContent = '×';
    close.addEventListener('click', () => _dismiss(toast));

    toast.append(icon, text, close);
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast--visible'));

    const timer = setTimeout(() => _dismiss(toast), duration);
    toast._timer = timer;
  };

  const _dismiss = (toast) => {
    clearTimeout(toast._timer);
    toast.classList.remove('toast--visible');
    toast.classList.add('toast--hiding');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  };

  return Object.freeze({ show });
})();
