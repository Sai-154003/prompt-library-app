window.CryptoService = (() => {
  const bufferToHex = (buffer) =>
    Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

  const generateSalt = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return bufferToHex(bytes.buffer);
  };

  const generateToken = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return bufferToHex(bytes.buffer);
  };

  const generateOtp = () => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return String(arr[0] % 1000000).padStart(6, '0');
  };

  const hashString = async (input) => {
    const encoded = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return bufferToHex(hashBuffer);
  };

  const hashPassword = async (password, salt) => hashString(salt + password);

  const hashOtp = async (otp) => hashString(otp);

  const verifyPassword = async (password, salt, storedHash) => {
    const hash = await hashPassword(password, salt);
    return hash === storedHash;
  };

  return Object.freeze({
    generateSalt,
    generateToken,
    generateOtp,
    hashPassword,
    hashOtp,
    hashString,
    verifyPassword,
  });
})();
