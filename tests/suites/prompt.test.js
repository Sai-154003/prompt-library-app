/**
 * prompt.test.js — Tests for window.PromptService
 *
 * A fake session for user "test-user-1" is set in beforeEach.
 * pl_prompts is cleared before each test for full isolation.
 */

const { describe, it, beforeEach } = TestRunner;
const {
  assertTrue, assertFalse, assertEqual,
  assertNotNull, assertNull, assertLength,
} = Assert;

const PROMPT_KEY = 'pl_prompts';
const USER_ID    = 'test-user-1';
const USER_ID_2  = 'other-user-99';

const fakeSession = (uid = USER_ID) => ({
  token: 'fake-token', userId: uid,
  email: `${uid}@test.com`, name: 'Test User',
  expiresAt: Date.now() + 999999999, rememberMe: false,
});

const clearPrompts = () => localStorage.removeItem(PROMPT_KEY);
const setSession   = (uid = USER_ID) =>
  localStorage.setItem('pl_session', JSON.stringify(fakeSession(uid)));

const sampleData = (overrides = {}) => ({
  title:    'My Test Prompt',
  category: 'coding',
  text:     'Write a function that does X',
  tags:     ['test', 'coding'],
  ...overrides,
});

// ─── create ───────────────────────────────────────────────────────────────────
describe('PromptService.create', () => {
  beforeEach(() => { clearPrompts(); setSession(); });

  it('should return a prompt object with an id for valid input', () => {
    const p = PromptService.create(USER_ID, sampleData());
    assertNotNull(p);
    assertNotNull(p.id);
  });

  it('should assign the correct userId', () => {
    const p = PromptService.create(USER_ID, sampleData());
    assertEqual(p.userId, USER_ID);
  });

  it('should set createdAt and updatedAt timestamps', () => {
    const before = Date.now();
    const p = PromptService.create(USER_ID, sampleData());
    assertTrue(p.createdAt >= before);
    assertTrue(p.updatedAt >= before);
  });

  it('should set copyCount to 0 and isFavorite to false', () => {
    const p = PromptService.create(USER_ID, sampleData());
    assertEqual(p.copyCount, 0);
    assertFalse(p.isFavorite);
  });

  it('should trim whitespace from title and text', () => {
    const p = PromptService.create(USER_ID, sampleData({ title: '  Padded Title  ', text: '  padded text  ' }));
    assertEqual(p.title, 'Padded Title');
    assertEqual(p.text, 'padded text');
  });

  it('should store the prompt so getAll returns it', () => {
    PromptService.create(USER_ID, sampleData());
    const all = PromptService.getAll(USER_ID);
    assertLength(all, 1);
  });

  it('should throw when title is missing', () => {
    let threw = false;
    try { PromptService.create(USER_ID, { category: 'coding', text: 'text' }); }
    catch { threw = true; }
    assertTrue(threw, 'Expected TypeError when title is missing');
  });

  it('should throw when text is missing', () => {
    let threw = false;
    try { PromptService.create(USER_ID, { title: 'Title', category: 'coding' }); }
    catch { threw = true; }
    assertTrue(threw, 'Expected TypeError when text is missing');
  });
});

// ─── getAll ───────────────────────────────────────────────────────────────────
describe('PromptService.getAll', () => {
  beforeEach(() => { clearPrompts(); setSession(); });

  it('should return an empty array when no prompts exist', () => {
    assertLength(PromptService.getAll(USER_ID), 0);
  });

  it('should return all prompts for the current user', () => {
    PromptService.create(USER_ID, sampleData({ title: 'Prompt A' }));
    PromptService.create(USER_ID, sampleData({ title: 'Prompt B' }));
    assertLength(PromptService.getAll(USER_ID), 2);
  });

  it('should not return prompts belonging to a different user', () => {
    PromptService.create(USER_ID,   sampleData({ title: 'My Prompt' }));
    PromptService.create(USER_ID_2, sampleData({ title: 'Other Prompt' }));
    const mine = PromptService.getAll(USER_ID);
    assertLength(mine, 1);
    assertEqual(mine[0].title, 'My Prompt');
  });
});

// ─── getById ──────────────────────────────────────────────────────────────────
describe('PromptService.getById', () => {
  beforeEach(() => { clearPrompts(); setSession(); });

  it('should return the prompt for a valid id + userId', () => {
    const p = PromptService.create(USER_ID, sampleData());
    const found = PromptService.getById(p.id, USER_ID);
    assertNotNull(found);
    assertEqual(found.id, p.id);
  });

  it('should return null for a non-existent id', () => {
    const found = PromptService.getById('does-not-exist', USER_ID);
    assertNull(found);
  });

  it('should return null when userId does not match', () => {
    const p = PromptService.create(USER_ID, sampleData());
    const found = PromptService.getById(p.id, USER_ID_2);
    assertNull(found);
  });
});

// ─── update ───────────────────────────────────────────────────────────────────
describe('PromptService.update', () => {
  beforeEach(() => { clearPrompts(); setSession(); });

  it('should return the updated prompt with new values', () => {
    const p       = PromptService.create(USER_ID, sampleData());
    const updated = PromptService.update(p.id, USER_ID, {
      title: 'Updated Title', category: 'writing', text: 'New text', tags: ['new'],
    });
    assertNotNull(updated);
    assertEqual(updated.title, 'Updated Title');
    assertEqual(updated.category, 'writing');
    assertEqual(updated.text, 'New text');
  });

  it('updatedAt should be >= createdAt after update', () => {
    const p       = PromptService.create(USER_ID, sampleData());
    const updated = PromptService.update(p.id, USER_ID, sampleData({ title: 'Changed' }));
    assertTrue(updated.updatedAt >= updated.createdAt);
  });

  it('should return null for a non-existent id', () => {
    const result = PromptService.update('ghost-id', USER_ID, sampleData());
    assertNull(result);
  });

  it('should return null when userId does not match', () => {
    const p      = PromptService.create(USER_ID, sampleData());
    const result = PromptService.update(p.id, USER_ID_2, sampleData());
    assertNull(result);
  });

  it('should persist the update so getById returns new values', () => {
    const p = PromptService.create(USER_ID, sampleData());
    PromptService.update(p.id, USER_ID, sampleData({ title: 'Persisted Title' }));
    const fetched = PromptService.getById(p.id, USER_ID);
    assertEqual(fetched.title, 'Persisted Title');
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────
describe('PromptService.remove', () => {
  beforeEach(() => { clearPrompts(); setSession(); });

  it('should return true and remove the prompt', () => {
    const p = PromptService.create(USER_ID, sampleData());
    const ok = PromptService.remove(p.id, USER_ID);
    assertTrue(ok);
    assertNull(PromptService.getById(p.id, USER_ID));
  });

  it('should return false for a non-existent id', () => {
    const ok = PromptService.remove('ghost-id', USER_ID);
    assertFalse(ok);
  });

  it('should not remove a prompt belonging to a different user', () => {
    const p  = PromptService.create(USER_ID, sampleData());
    const ok = PromptService.remove(p.id, USER_ID_2);
    assertFalse(ok);
    assertNotNull(PromptService.getById(p.id, USER_ID));
  });
});

// ─── toggleFavorite ───────────────────────────────────────────────────────────
describe('PromptService.toggleFavorite', () => {
  beforeEach(() => { clearPrompts(); setSession(); });

  it('should toggle isFavorite from false to true', () => {
    const p = PromptService.create(USER_ID, sampleData());
    assertFalse(p.isFavorite);
    const toggled = PromptService.toggleFavorite(p.id, USER_ID);
    assertTrue(toggled.isFavorite);
  });

  it('should toggle isFavorite from true back to false', () => {
    const p = PromptService.create(USER_ID, sampleData());
    PromptService.toggleFavorite(p.id, USER_ID);
    const toggled = PromptService.toggleFavorite(p.id, USER_ID);
    assertFalse(toggled.isFavorite);
  });

  it('should return null for a non-existent id', () => {
    assertNull(PromptService.toggleFavorite('ghost-id', USER_ID));
  });
});

// ─── incrementCopyCount ───────────────────────────────────────────────────────
describe('PromptService.incrementCopyCount', () => {
  beforeEach(() => { clearPrompts(); setSession(); });

  it('should increment copyCount from 0 to 1', () => {
    const p = PromptService.create(USER_ID, sampleData());
    const newCount = PromptService.incrementCopyCount(p.id, USER_ID);
    assertEqual(newCount, 1);
  });

  it('should increment copyCount on successive calls', () => {
    const p = PromptService.create(USER_ID, sampleData());
    PromptService.incrementCopyCount(p.id, USER_ID);
    PromptService.incrementCopyCount(p.id, USER_ID);
    const count = PromptService.incrementCopyCount(p.id, USER_ID);
    assertEqual(count, 3);
  });

  it('should persist the new copyCount in storage', () => {
    const p = PromptService.create(USER_ID, sampleData());
    PromptService.incrementCopyCount(p.id, USER_ID);
    const fetched = PromptService.getById(p.id, USER_ID);
    assertEqual(fetched.copyCount, 1);
  });
});

// ─── importPrompts ────────────────────────────────────────────────────────────
describe('PromptService.importPrompts', () => {
  beforeEach(() => { clearPrompts(); setSession(); });

  it('should import valid prompts and return success: true with count', () => {
    const json = JSON.stringify({ version: 1, prompts: [
      { title: 'Imported A', category: 'coding', text: 'Prompt text A', tags: ['a'] },
      { title: 'Imported B', category: 'writing', text: 'Prompt text B', tags: [] },
    ]});
    const r = PromptService.importPrompts(USER_ID, json);
    assertTrue(r.success);
    assertEqual(r.count, 2);
  });

  it('should persist imported prompts so getAll returns them', () => {
    const json = JSON.stringify({ version: 1, prompts: [
      { title: 'Imported', category: 'coding', text: 'Some text', tags: [] },
    ]});
    PromptService.importPrompts(USER_ID, json);
    assertLength(PromptService.getAll(USER_ID), 1);
  });

  it('should return success: false for invalid JSON', () => {
    const r = PromptService.importPrompts(USER_ID, 'NOT { valid json }');
    assertFalse(r.success);
  });

  it('should return success: false when prompts array is missing', () => {
    const r = PromptService.importPrompts(USER_ID, JSON.stringify({ version: 1 }));
    assertFalse(r.success);
  });

  it('should return success: false when all prompts lack required fields', () => {
    const json = JSON.stringify({ version: 1, prompts: [{ tags: ['only-tags'] }] });
    const r = PromptService.importPrompts(USER_ID, json);
    assertFalse(r.success);
  });

  it('should assign new unique ids to imported prompts', () => {
    const json = JSON.stringify({ version: 1, prompts: [
      { id: 'original-id', title: 'P', category: 'coding', text: 'T', tags: [] },
    ]});
    PromptService.importPrompts(USER_ID, json);
    const all = PromptService.getAll(USER_ID);
    assertTrue(all[0].id !== 'original-id', 'Imported prompt should receive a new id');
  });

  it('should assign the correct userId to imported prompts', () => {
    const json = JSON.stringify({ version: 1, prompts: [
      { title: 'P', category: 'coding', text: 'T', tags: [] },
    ]});
    PromptService.importPrompts(USER_ID, json);
    assertEqual(PromptService.getAll(USER_ID)[0].userId, USER_ID);
  });
});

// ─── exportPrompts ────────────────────────────────────────────────────────────
describe('PromptService.exportPrompts', () => {
  beforeEach(() => { clearPrompts(); setSession(); });

  it('should not throw when called with a valid userId', () => {
    PromptService.create(USER_ID, sampleData());
    let threw = false;
    try {
      // exportPrompts triggers a download — in headless test context the anchor click
      // may be a no-op, but the function itself must not throw.
      PromptService.exportPrompts(USER_ID);
    } catch {
      threw = true;
    }
    assertFalse(threw, 'exportPrompts should not throw');
  });
});
