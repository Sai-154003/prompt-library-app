(() => {
  const { OTP_PURPOSES, OTP_RESEND_COOLDOWN } = Constants;

  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');

  const nameInput     = document.getElementById('name');
  const emailInput    = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmInput  = document.getElementById('confirmPassword');
  const submitStep1   = document.getElementById('submitStep1');
  const submitStep2   = document.getElementById('submitStep2');
  const resendBtn     = document.getElementById('resendOtp');
  const meterEl       = document.getElementById('passwordMeter');

  const otpDigits    = Array.from(document.querySelectorAll('.otp-digit'));
  const timerEl      = document.getElementById('otpTimer');
  const timerVal     = document.getElementById('timerValue');
  const emailDisplay = document.getElementById('otpEmailDisplay');

  let currentEmail = '';
  let currentName  = '';
  let resendCooldown = null;

  PasswordMeter.attach(passwordInput, meterEl);

  const showFieldError = (inputEl, msg) => {
    inputEl.classList.add('is-error');
    const err = document.getElementById(inputEl.id + 'Error');
    if (err) err.textContent = msg;
  };

  const clearFieldError = (inputEl) => {
    inputEl.classList.remove('is-error');
    const err = document.getElementById(inputEl.id + 'Error');
    if (err) err.textContent = '';
  };

  [nameInput, emailInput, passwordInput, confirmInput].forEach(el => {
    el.addEventListener('input', () => clearFieldError(el));
  });

  const togglePassword = (id, btnId) => {
    const input = document.getElementById(id);
    const btn   = document.getElementById(btnId);
    if (!input || !btn) return;
    btn.addEventListener('click', () => {
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      btn.textContent = isText ? '👁' : '🙈';
    });
  };

  togglePassword('password', 'togglePassword');
  togglePassword('confirmPassword', 'toggleConfirm');

  otpDigits.forEach((digit, i) => {
    digit.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val.slice(-1);
      e.target.classList.toggle('is-filled', !!e.target.value);
      if (val && i < otpDigits.length - 1) otpDigits[i + 1].focus();
    });

    digit.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !digit.value && i > 0) {
        otpDigits[i - 1].focus();
        otpDigits[i - 1].value = '';
        otpDigits[i - 1].classList.remove('is-filled');
      }
    });

    digit.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      text.split('').forEach((ch, j) => {
        if (otpDigits[j]) { otpDigits[j].value = ch; otpDigits[j].classList.add('is-filled'); }
      });
      otpDigits[Math.min(text.length, otpDigits.length - 1)].focus();
    });
  });

  const getOtpValue = () => otpDigits.map(d => d.value).join('');

  const clearOtpBoxes = () => {
    otpDigits.forEach(d => { d.value = ''; d.classList.remove('is-filled'); });
  };

  let timerInterval = null;

  const startTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    let seconds = 10 * 60;
    timerEl.classList.remove('otp-timer--expired');
    const update = () => {
      if (seconds <= 0) {
        clearInterval(timerInterval);
        timerVal.textContent = 'Expired';
        timerEl.classList.add('otp-timer--expired');
        return;
      }
      timerVal.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      seconds--;
    };
    update();
    timerInterval = setInterval(update, 1000);
  };

  const startResendCooldown = () => {
    resendBtn.disabled = true;
    let sec = OTP_RESEND_COOLDOWN;
    resendBtn.textContent = `Resend in ${sec}s`;
    if (resendCooldown) clearInterval(resendCooldown);
    resendCooldown = setInterval(() => {
      sec--;
      if (sec <= 0) {
        clearInterval(resendCooldown);
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend OTP';
      } else {
        resendBtn.textContent = `Resend in ${sec}s`;
      }
    }, 1000);
  };

  const sendOtp = async () => {
    LoaderManager.show();
    const result = await OtpService.generate(currentEmail, OTP_PURPOSES.SIGNUP, currentName);
    LoaderManager.hide();

    if (!result.success) {
      ToastManager.show(result.message, 'error');
      return false;
    }

    clearOtpBoxes();
    otpDigits[0].focus();
    startTimer();
    startResendCooldown();
    return true;
  };

  resendBtn.addEventListener('click', async () => {
    const ok = await sendOtp();
    if (ok) ToastManager.show('A new OTP has been sent to your email.', 'info');
  });

  submitStep1.addEventListener('click', async () => {
    let hasError = false;

    const name  = nameInput.value.trim();
    const email = emailInput.value.trim();
    const pass  = passwordInput.value;
    const conf  = confirmInput.value;

    const nameCheck = Validator.validateName(name);
    if (!nameCheck.valid) { showFieldError(nameInput, nameCheck.message); hasError = true; }

    const emailCheck = Validator.validateEmail(email);
    if (!emailCheck.valid) { showFieldError(emailInput, emailCheck.message); hasError = true; }

    const passCheck = Validator.validatePassword(pass);
    if (!passCheck.valid) { showFieldError(passwordInput, passCheck.message); hasError = true; }

    if (pass && conf !== pass) { showFieldError(confirmInput, 'Passwords do not match.'); hasError = true; }

    if (hasError) return;

    LoaderManager.showInline(submitStep1);
    const result = await AuthService.signup(name, email, pass);
    LoaderManager.hideInline(submitStep1);

    if (!result.success) {
      showFieldError(emailInput, result.message);
      return;
    }

    currentEmail = result.email;
    currentName  = name;
    emailDisplay.textContent = email;

    step1.classList.remove('is-active');
    step2.classList.add('is-active');

    const sent = await sendOtp();
    if (!sent) {
      // Roll back UI if email sending failed
      step1.classList.add('is-active');
      step2.classList.remove('is-active');
    }
  });

  submitStep2.addEventListener('click', async () => {
    const otp = getOtpValue();
    const otpCheck = Validator.validateOtp(otp);
    if (!otpCheck.valid) { ToastManager.show(otpCheck.message, 'error'); return; }

    LoaderManager.showInline(submitStep2);
    const result = await OtpService.verify(currentEmail, OTP_PURPOSES.SIGNUP, otp);
    LoaderManager.hideInline(submitStep2);

    if (!result.success) {
      ToastManager.show(result.message, 'error');
      clearOtpBoxes();
      otpDigits[0].focus();
      return;
    }

    AuthService.markVerified(currentEmail);
    clearInterval(timerInterval);
    window.location.href = 'index.html?registered=1';
  });

  if (AuthService.getSession()) window.location.href = 'home.html';
})();
