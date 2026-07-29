(() => {
  const { OTP_PURPOSES, OTP_RESEND_COOLDOWN } = Constants;

  const steps   = [1, 2, 3].map(n => document.getElementById(`fpStep${n}`));
  const circles = document.querySelectorAll('.step-item');

  const emailInput   = document.getElementById('fpEmail');
  const submitStep1  = document.getElementById('fpSubmitStep1');

  const otpDigits    = Array.from(document.querySelectorAll('.otp-digit'));
  const timerEl      = document.getElementById('otpTimer');
  const timerVal     = document.getElementById('timerValue');
  const emailDisplay = document.getElementById('otpEmailDisplay');
  const resendBtn    = document.getElementById('resendOtp');
  const submitStep2  = document.getElementById('fpSubmitStep2');

  const newPassInput  = document.getElementById('newPassword');
  const confPassInput = document.getElementById('confirmNewPassword');
  const meterEl       = document.getElementById('passwordMeter');
  const submitStep3   = document.getElementById('fpSubmitStep3');

  let currentEmail   = '';
  let timerInterval  = null;
  let resendInterval = null;

  PasswordMeter.attach(newPassInput, meterEl);

  document.getElementById('toggleNewPassword').addEventListener('click', function() {
    const t = newPassInput.type === 'password' ? 'text' : 'password';
    newPassInput.type = t;
    this.textContent = t === 'text' ? '🙈' : '👁';
  });

  const setStep = (n) => {
    steps.forEach((s, i) => s.classList.toggle('is-active', i + 1 === n));
    circles.forEach((c, i) => {
      c.classList.toggle('is-active', i + 1 === n);
      c.classList.toggle('is-done', i + 1 < n);
    });
  };

  setStep(1);

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

  const getOtp   = () => otpDigits.map(d => d.value).join('');
  const clearOtp = () => {
    otpDigits.forEach(d => { d.value = ''; d.classList.remove('is-filled'); });
  };

  const startTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    let secs = 10 * 60;
    timerEl.classList.remove('otp-timer--expired');
    const tick = () => {
      if (secs <= 0) {
        clearInterval(timerInterval);
        timerVal.textContent = 'Expired';
        timerEl.classList.add('otp-timer--expired');
        return;
      }
      timerVal.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      secs--;
    };
    tick();
    timerInterval = setInterval(tick, 1000);
  };

  const startResendCooldown = () => {
    resendBtn.disabled = true;
    let sec = OTP_RESEND_COOLDOWN;
    resendBtn.textContent = `Resend in ${sec}s`;
    if (resendInterval) clearInterval(resendInterval);
    resendInterval = setInterval(() => {
      sec--;
      if (sec <= 0) {
        clearInterval(resendInterval);
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend OTP';
      } else {
        resendBtn.textContent = `Resend in ${sec}s`;
      }
    }, 1000);
  };

  const sendOtp = async () => {
    LoaderManager.show();
    const result = await OtpService.generate(currentEmail, OTP_PURPOSES.RESET_PASSWORD);
    LoaderManager.hide();

    if (!result.success) {
      ToastManager.show(result.message, 'error');
      return false;
    }

    clearOtp();
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
    const email = emailInput.value.trim();
    const check = Validator.validateEmail(email);
    if (!check.valid) {
      emailInput.classList.add('is-error');
      document.getElementById('fpEmailError').textContent = check.message;
      return;
    }

    LoaderManager.showInline(submitStep1);
    const user = AuthService.findUser(email);
    await new Promise(r => setTimeout(r, 400)); // timing-safe: don't reveal whether email exists
    LoaderManager.hideInline(submitStep1);

    ToastManager.show('If an account with that email exists, a reset code has been sent.', 'info', 6000);

    if (!user || !user.isVerified) return;

    currentEmail = email.toLowerCase().trim();
    emailDisplay.textContent = email;
    setStep(2);

    await sendOtp();
  });

  submitStep2.addEventListener('click', async () => {
    const otp = getOtp();
    const check = Validator.validateOtp(otp);
    if (!check.valid) { ToastManager.show(check.message, 'error'); return; }

    LoaderManager.showInline(submitStep2);
    const result = await OtpService.verify(currentEmail, OTP_PURPOSES.RESET_PASSWORD, otp);
    LoaderManager.hideInline(submitStep2);

    if (!result.success) {
      ToastManager.show(result.message, 'error');
      clearOtp();
      otpDigits[0].focus();
      return;
    }

    clearInterval(timerInterval);
    setStep(3);
    newPassInput.focus();
  });

  submitStep3.addEventListener('click', async () => {
    const pass = newPassInput.value;
    const conf = confPassInput.value;

    const check = Validator.validatePassword(pass);
    if (!check.valid) {
      newPassInput.classList.add('is-error');
      document.getElementById('newPasswordError').textContent = check.message;
      return;
    }
    if (pass !== conf) {
      confPassInput.classList.add('is-error');
      document.getElementById('confirmNewPasswordError').textContent = 'Passwords do not match.';
      return;
    }

    LoaderManager.showInline(submitStep3);
    const result = await AuthService.resetPassword(currentEmail, pass);
    LoaderManager.hideInline(submitStep3);

    if (!result.success) { ToastManager.show(result.message, 'error'); return; }

    window.location.href = 'index.html?reset=1';
  });
})();
