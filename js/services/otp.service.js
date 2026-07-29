window.OtpService = (() => {
  const { STORAGE_KEYS, OTP_EXPIRY_MS, OTP_MAX_ATTEMPTS } = Constants;
  const store = StorageRepository;

  const _getRecords = () => store.getList(STORAGE_KEYS.OTP_RECORDS);
  const _saveRecords = (list) => store.setList(STORAGE_KEYS.OTP_RECORDS, list);

  // Returns { success, message? } — OTP is sent to email ONLY, never returned to caller.
  const generate = async (email, purpose, recipientName) => {
    const otp     = CryptoService.generateOtp();
    const otpHash = await CryptoService.hashOtp(otp);
    const now     = Date.now();

    const records = _getRecords().filter(r => !(r.email === email && r.purpose === purpose));
    records.push({
      email,
      otpHash,
      purpose,
      expiresAt: now + OTP_EXPIRY_MS,
      attempts:  0,
      createdAt: now,
    });
    _saveRecords(records);

    const emailResult = await EmailService.sendOtp(email, recipientName || email, otp, purpose);
    if (!emailResult.success) {
      // Roll back so user can retry cleanly
      _saveRecords(_getRecords().filter(r => !(r.email === email && r.purpose === purpose)));
      return { success: false, message: emailResult.message };
    }

    return { success: true };
  };

  const verify = async (email, purpose, otp) => {
    const records = _getRecords();
    const idx = records.findIndex(r => r.email === email && r.purpose === purpose);

    if (idx === -1) return { success: false, message: 'OTP not found. Please request a new one.' };

    const record = records[idx];

    if (Date.now() > record.expiresAt) {
      records.splice(idx, 1);
      _saveRecords(records);
      return { success: false, message: 'OTP has expired. Please request a new one.' };
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      records.splice(idx, 1);
      _saveRecords(records);
      return { success: false, message: 'Too many attempts. Please request a new OTP.' };
    }

    const inputHash = await CryptoService.hashOtp(otp.trim());
    if (inputHash !== record.otpHash) {
      records[idx].attempts += 1;
      const remaining = OTP_MAX_ATTEMPTS - records[idx].attempts;
      _saveRecords(records);
      return {
        success: false,
        message: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      };
    }

    records.splice(idx, 1);
    _saveRecords(records);
    return { success: true };
  };

  const invalidate = (email, purpose) => {
    const records = _getRecords().filter(r => !(r.email === email && r.purpose === purpose));
    _saveRecords(records);
  };

  return Object.freeze({ generate, verify, invalidate });
})();
