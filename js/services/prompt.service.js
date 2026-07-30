window.PromptService = (() => {
  const { STORAGE_KEYS } = Constants;
  const store = StorageRepository;

  const SAMPLE_PROMPTS = [
    { title: 'Senior Code Reviewer', category: 'coding', text: 'Review the following code as a senior engineer. Identify bugs, security vulnerabilities, performance issues, and violations of SOLID principles. Provide specific, actionable feedback with code examples for each issue.\n\nCode:\n```\n[PASTE CODE HERE]\n```', tags: ['review', 'quality', 'best-practices'] },
    { title: 'Git Commit Message Generator', category: 'coding', text: 'Generate a concise, conventional git commit message for the following changes. Use the format: <type>(<scope>): <subject>. Types: feat, fix, docs, style, refactor, test, chore. Keep the subject under 72 characters.\n\nChanges:\n[DESCRIBE CHANGES]', tags: ['git', 'commit', 'conventional'] },
    { title: 'Debug This Error', category: 'coding', text: 'I am getting the following error. Explain what it means, identify the root cause, and provide a step-by-step solution with corrected code.\n\nError:\n[ERROR MESSAGE]\n\nContext:\n[RELEVANT CODE OR ENVIRONMENT]', tags: ['debug', 'error', 'fix'] },
    { title: 'Blog Post Outline', category: 'writing', text: 'Create a detailed blog post outline on the topic: "[TOPIC]". Include: a compelling headline, introduction hook, 5-7 main sections with sub-points, key takeaways, and a CTA. Target audience: [AUDIENCE]. Tone: [TONE].', tags: ['blog', 'outline', 'content'] },
    { title: 'Professional Email Rewriter', category: 'writing', text: 'Rewrite the following email to be professional, clear, and concise. Maintain the core message but improve tone, structure, and impact. Aim for brevity without losing important context.\n\nOriginal email:\n[PASTE EMAIL]', tags: ['email', 'professional', 'rewrite'] },
    { title: 'Executive Summary Writer', category: 'writing', text: 'Write an executive summary for the following document. In 3-4 paragraphs, cover: the purpose, key findings, recommended actions, and expected outcomes. Use clear, jargon-free language suitable for C-suite readers.\n\nDocument:\n[PASTE CONTENT]', tags: ['summary', 'executive', 'concise'] },
    { title: 'Social Media Campaign', category: 'marketing', text: 'Create a 5-post social media campaign for [PRODUCT/SERVICE]. For each post provide: the platform (choose from LinkedIn, Twitter, Instagram), the copy (within character limits), relevant hashtags, and a suggested visual description. Goal: [CAMPAIGN GOAL]. Audience: [TARGET AUDIENCE].', tags: ['social', 'campaign', 'engagement'] },
    { title: 'Cold Email Outreach', category: 'marketing', text: 'Write a cold outreach email for [PRODUCT/SERVICE] targeting [PERSONA]. The email should: open with a relevant hook, clearly state the value proposition in one sentence, include a specific pain point we solve, provide brief social proof, and end with a low-friction CTA. Max 150 words.', tags: ['cold-email', 'outreach', 'sales'] },
    { title: 'Product Description Optimizer', category: 'marketing', text: 'Rewrite the following product description to maximize conversions. Use persuasive language, focus on benefits over features, include sensory details, address objections, and end with urgency. Target customer: [CUSTOMER TYPE].\n\nCurrent description:\n[PASTE DESCRIPTION]', tags: ['product', 'copywriting', 'conversion'] },
    { title: 'Short Story Starter', category: 'creative', text: 'Write the opening 3 paragraphs of a short story with the following parameters:\n- Genre: [GENRE]\n- Setting: [SETTING]\n- Protagonist: [CHARACTER DESCRIPTION]\n- Opening conflict: [CONFLICT]\n\nUse vivid sensory details, establish atmosphere immediately, and end on a hook that makes the reader need to continue.', tags: ['fiction', 'story', 'creative-writing'] },
    { title: 'Explain Like I\'m Five', category: 'education', text: 'Explain [COMPLEX TOPIC] to a complete beginner with zero background knowledge. Use: simple everyday analogies, a step-by-step breakdown, a real-world example they can relate to, and end with the 3 most important things to remember. Avoid jargon entirely.', tags: ['explain', 'beginner', 'analogy'] },
    { title: 'Socratic Study Guide', category: 'education', text: 'Create a Socratic-method study guide for [TOPIC/SUBJECT]. Generate 10 progressively deeper questions that build understanding from foundational concepts to advanced applications. For each question, provide a hint and the key insight it should lead to. Include connections to related topics.', tags: ['study', 'questions', 'learning'] },
  ];

  const _getAll = () => store.getList(STORAGE_KEYS.PROMPTS);
  const _save   = (list) => store.setList(STORAGE_KEYS.PROMPTS, list);

  const _uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const seedForUser = (userId) => {
    const all = _getAll();
    const hasUserPrompts = all.some(p => p.userId === userId);
    if (hasUserPrompts) return;
    const now = Date.now();
    const seeded = SAMPLE_PROMPTS.map((p, i) => ({
      ...p,
      id:         _uid(),
      userId,
      isFavorite: i < 2,
      isLocked:   false,
      copyCount:  Math.floor(Math.random() * 20),
      createdAt:  now - (SAMPLE_PROMPTS.length - i) * 3600000,
      updatedAt:  now - (SAMPLE_PROMPTS.length - i) * 3600000,
    }));
    _save([...all, ...seeded]);
  };

  const getAll = (userId) => _getAll().filter(p => p.userId === userId);

  const getById = (id, userId) => _getAll().find(p => p.id === id && p.userId === userId) || null;

  const create = (userId, data) => {
    const prompt = {
      id:        _uid(),
      userId,
      title:     data.title.trim(),
      category:  data.category,
      text:      data.text.trim(),
      tags:      (data.tags || []).map(t => t.trim()).filter(Boolean),
      isFavorite: false,
      isLocked:   false,
      copyCount:  0,
      createdAt:  Date.now(),
      updatedAt:  Date.now(),
    };
    const all = _getAll();
    all.push(prompt);
    _save(all);
    return prompt;
  };

  const update = (id, userId, data) => {
    const all = _getAll();
    const idx = all.findIndex(p => p.id === id && p.userId === userId);
    if (idx === -1) return null;
    all[idx] = {
      ...all[idx],
      title:    data.title.trim(),
      category: data.category,
      text:     data.text.trim(),
      tags:     (data.tags || []).map(t => t.trim()).filter(Boolean),
      updatedAt: Date.now(),
    };
    _save(all);
    return all[idx];
  };

  const remove = (id, userId) => {
    const all = _getAll();
    const filtered = all.filter(p => !(p.id === id && p.userId === userId));
    if (filtered.length === all.length) return false;
    _save(filtered);
    return true;
  };

  const toggleFavorite = (id, userId) => {
    const all = _getAll();
    const idx = all.findIndex(p => p.id === id && p.userId === userId);
    if (idx === -1) return null;
    all[idx].isFavorite = !all[idx].isFavorite;
    _save(all);
    return all[idx];
  };

  const toggleLock = (id, userId) => {
    const all = _getAll();
    const idx = all.findIndex(p => p.id === id && p.userId === userId);
    if (idx === -1) return null;
    all[idx].isLocked = !all[idx].isLocked;
    _save(all);
    return all[idx];
  };

  const incrementCopyCount = (id, userId) => {
    const all = _getAll();
    const idx = all.findIndex(p => p.id === id && p.userId === userId);
    if (idx === -1) return;
    all[idx].copyCount = (all[idx].copyCount || 0) + 1;
    _save(all);
    return all[idx].copyCount;
  };

  const deleteAllForUser = (userId) => {
    const filtered = _getAll().filter(p => p.userId !== userId);
    _save(filtered);
  };

  const exportPrompts = (userId) => {
    const prompts = getAll(userId);
    const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), prompts }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `promptlib-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importPrompts = (userId, jsonString) => {
    let parsed;
    try { parsed = JSON.parse(jsonString); } catch { return { success: false, message: 'Invalid JSON file.' }; }
    if (!parsed.prompts || !Array.isArray(parsed.prompts)) return { success: false, message: 'File format not recognized.' };
    const valid = parsed.prompts.filter(p => p.title && p.text && p.category);
    if (!valid.length) return { success: false, message: 'No valid prompts found in file.' };
    const now = Date.now();
    const imported = valid.map(p => ({
      id:        _uid(),
      userId,
      title:     String(p.title).trim(),
      category:  String(p.category).trim(),
      text:      String(p.text).trim(),
      tags:      Array.isArray(p.tags) ? p.tags.map(String) : [],
      isFavorite: false,
      copyCount:  0,
      createdAt:  now,
      updatedAt:  now,
    }));
    const all = _getAll();
    _save([...all, ...imported]);
    return { success: true, count: imported.length };
  };

  return Object.freeze({
    seedForUser, getAll, getById, create, update, remove,
    toggleFavorite, toggleLock, incrementCopyCount, deleteAllForUser,
    exportPrompts, importPrompts,
  });
})();
