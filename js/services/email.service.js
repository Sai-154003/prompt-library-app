window.EmailService = (() => {
  const _isConfigured = () => {
    const { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY } = AppConfig;
    return (
      EMAILJS_SERVICE_ID  && EMAILJS_SERVICE_ID  !== 'YOUR_SERVICE_ID'  &&
      EMAILJS_TEMPLATE_ID && EMAILJS_TEMPLATE_ID !== 'YOUR_TEMPLATE_ID' &&
      EMAILJS_PUBLIC_KEY  && EMAILJS_PUBLIC_KEY  !== 'YOUR_PUBLIC_KEY'
    );
  };

  const sendOtp = async (toEmail, toName, otp, purpose) => {
    if (AppConfig.DEV_MODE) {
      console.warn('[DEV_MODE] OTP for', toEmail, '→', otp);
      return { success: true, dev: true };
    }

    if (!_isConfigured()) {
      return {
        success: false,
        message: 'Email service is not configured. Please set up EmailJS in js/core/config.js.',
      };
    }

    if (typeof emailjs === 'undefined') {
      return { success: false, message: 'EmailJS SDK failed to load. Check your internet connection.' };
    }

    const subjects = {
      signup:         'Your PromptLib verification code',
      reset_password: 'Your PromptLib password reset code',
      change_email:   'Confirm your new email address',
    };

    const params = {
      to_email:   toEmail,
      to_name:    toName || toEmail,
      otp,
      subject:    subjects[purpose] || 'Your PromptLib verification code',
      app_name:   'PromptLib',
      expiry_min: '10',
    };

    try {
      emailjs.init(AppConfig.EMAILJS_PUBLIC_KEY);
      await emailjs.send(AppConfig.EMAILJS_SERVICE_ID, AppConfig.EMAILJS_TEMPLATE_ID, params);
      return { success: true };
    } catch (err) {
      const msg = err?.text || err?.message || 'Failed to send email. Please try again.';
      return { success: false, message: msg };
    }
  };

  const sendNotification = async (toEmail, toName, subject, message) => {
    const notifyId = AppConfig.EMAILJS_NOTIFY_TEMPLATE_ID;
    if (!notifyId || notifyId === 'YOUR_NOTIFY_TEMPLATE_ID') return { success: true };
    if (!_isConfigured()) return { success: true };
    if (typeof emailjs === 'undefined') return { success: true };
    try {
      emailjs.init(AppConfig.EMAILJS_PUBLIC_KEY);
      await emailjs.send(AppConfig.EMAILJS_SERVICE_ID, notifyId, {
        to_email: toEmail,
        to_name:  toName || toEmail,
        subject,
        message,
        app_name: 'PromptLib',
      });
    } catch (err) {
      console.warn('[EmailService] Notification failed silently:', err?.text || err?.message);
    }
    return { success: true };
  };

  return Object.freeze({ sendOtp, sendNotification, isConfigured: _isConfigured });
})();
