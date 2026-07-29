window.PasswordMeter = (() => {
  const LEVEL_CLASSES = ['', 'meter--weak', 'meter--fair', 'meter--good', 'meter--strong', 'meter--very-strong'];

  const attach = (inputEl, meterEl) => {
    if (!inputEl || !meterEl) return;

    const bar   = meterEl.querySelector('.meter__bar');
    const label = meterEl.querySelector('.meter__label');

    const update = () => {
      const { score, label: lvlLabel } = Validator.getPasswordStrength(inputEl.value);
      const pct = (score / 5) * 100;

      bar.style.width = `${pct}%`;
      bar.className   = `meter__bar ${LEVEL_CLASSES[score] || ''}`;
      label.textContent = inputEl.value ? lvlLabel : '';
    };

    inputEl.addEventListener('input', update);
    update();
  };

  return Object.freeze({ attach });
})();
