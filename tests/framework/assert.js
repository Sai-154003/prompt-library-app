/**
 * Assert — lightweight assertion library for PromptLib test suite
 * Throws AssertionError with a descriptive message on every failure.
 */
window.Assert = (() => {
  class AssertionError extends Error {
    constructor(message) {
      super(message);
      this.name = 'AssertionError';
    }
  }

  const fail = (msg) => { throw new AssertionError(msg); };

  const assertEqual = (actual, expected, msg) => {
    if (actual !== expected)
      fail(msg || `assertEqual failed:\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  };

  const assertNotEqual = (actual, expected, msg) => {
    if (actual === expected)
      fail(msg || `assertNotEqual failed: both values are ${JSON.stringify(actual)}`);
  };

  const assertTrue = (value, msg) => {
    if (!value) fail(msg || `assertTrue failed: got ${JSON.stringify(value)}`);
  };

  const assertFalse = (value, msg) => {
    if (value) fail(msg || `assertFalse failed: got ${JSON.stringify(value)}`);
  };

  const assertNull = (value, msg) => {
    if (value !== null) fail(msg || `assertNull failed: got ${JSON.stringify(value)}`);
  };

  const assertNotNull = (value, msg) => {
    if (value === null || value === undefined)
      fail(msg || `assertNotNull failed: got ${JSON.stringify(value)}`);
  };

  const assertContains = (str, substring, msg) => {
    if (typeof str !== 'string' || !str.includes(substring))
      fail(msg || `assertContains failed: "${str}" does not contain "${substring}"`);
  };

  const assertMatch = (str, regex, msg) => {
    if (!regex.test(str))
      fail(msg || `assertMatch failed: "${str}" does not match ${regex}`);
  };

  const assertLength = (arr, len, msg) => {
    const actual = arr == null ? 'null' : arr.length;
    if (actual !== len)
      fail(msg || `assertLength failed: expected length ${len}, got ${actual}`);
  };

  const assertThrows = (fn, msg) => {
    let threw = false;
    try { fn(); } catch { threw = true; }
    if (!threw) fail(msg || 'assertThrows failed: function did not throw');
  };

  const assertAsync = async (asyncFn, msg) => {
    let threw = false;
    try { await asyncFn(); } catch { threw = true; }
    if (!threw) fail(msg || 'assertAsync failed: async function did not throw');
  };

  return Object.freeze({
    AssertionError,
    assertEqual, assertNotEqual,
    assertTrue, assertFalse,
    assertNull, assertNotNull,
    assertContains, assertMatch,
    assertLength,
    assertThrows, assertAsync,
  });
})();
