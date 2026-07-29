/**
 * TestRunner — async-safe test runner for PromptLib
 * Supports describe / it / beforeEach / afterEach with full async support.
 */
window.TestRunner = (() => {
  const _suites = [];
  let _current  = null;

  const describe = (name, fn) => {
    const suite = { name, tests: [], beforeEachs: [], afterEachs: [] };
    const prev  = _current;
    _current    = suite;
    try { fn(); } finally { _current = prev; }
    _suites.push(suite);
  };

  const it = (name, fn) => {
    if (!_current) throw new Error('it() must be called inside describe()');
    _current.tests.push({ name, fn });
  };

  const beforeEach = (fn) => {
    if (!_current) throw new Error('beforeEach() must be called inside describe()');
    _current.beforeEachs.push(fn);
  };

  const afterEach = (fn) => {
    if (!_current) throw new Error('afterEach() must be called inside describe()');
    _current.afterEachs.push(fn);
  };

  const _runHooks = async (hooks) => {
    for (const h of hooks) {
      try { await h(); } catch (e) { console.warn('[hook error]', e.message); }
    }
  };

  const run = async (onProgress) => {
    const wallStart = Date.now();
    let passed = 0;
    let failed = 0;
    const suiteResults = [];

    for (const suite of _suites) {
      const suiteResult = { name: suite.name, tests: [], passed: 0, failed: 0 };

      for (const test of suite.tests) {
        await _runHooks(suite.beforeEachs);

        let status   = 'pass';
        let errorMsg = null;
        const t0     = Date.now();

        try {
          await test.fn();
        } catch (e) {
          status   = 'fail';
          errorMsg = e.message || String(e);
        }

        await _runHooks(suite.afterEachs);

        const result = { name: test.name, status, error: errorMsg, duration: Date.now() - t0 };
        suiteResult.tests.push(result);

        if (status === 'pass') { passed++; suiteResult.passed++; }
        else                  { failed++; suiteResult.failed++; }

        if (onProgress) onProgress({ suite: suite.name, ...result });
      }

      suiteResults.push(suiteResult);
    }

    return {
      suites:   suiteResults,
      passed,
      failed,
      total:    passed + failed,
      duration: Date.now() - wallStart,
    };
  };

  const getSuites = () => _suites;

  return { describe, it, beforeEach, afterEach, run, getSuites };
})();
