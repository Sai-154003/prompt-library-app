window.PromptService = (() => {
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
    { title: "Explain Like I'm Five", category: 'education', text: 'Explain [COMPLEX TOPIC] to a complete beginner with zero background knowledge. Use: simple everyday analogies, a step-by-step breakdown, a real-world example they can relate to, and end with the 3 most important things to remember. Avoid jargon entirely.', tags: ['explain', 'beginner', 'analogy'] },
    { title: 'Socratic Study Guide', category: 'education', text: 'Create a Socratic-method study guide for [TOPIC/SUBJECT]. Generate 10 progressively deeper questions that build understanding from foundational concepts to advanced applications. For each question, provide a hint and the key insight it should lead to. Include connections to related topics.', tags: ['study', 'questions', 'learning'] },
  ];

  const _lookupName = (userId) => {
    try {
      const users = JSON.parse(localStorage.getItem('pl_users') || '[]');
      const u = users.find(x => x.id === userId);
      return u ? u.name : 'Unknown';
    } catch { return 'Unknown'; }
  };

  const _toJs = (row, favIds = new Set()) => ({
    id:              row.id,
    userId:          row.user_id,
    title:           row.title,
    category:        row.category,
    text:            row.text,
    tags:            row.tags || [],
    isLocked:        row.is_locked,
    copyCount:       row.copy_count,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
    isFavorite:      favIds.has(row.id),
    creatorName:     _lookupName(row.user_id),
    status:          row.status || 'approved',
    rejectionReason: row.rejection_reason || null,
  });

  const seedForUser = async (userId) => {
    const { data } = await sb.from('prompts').select('id').eq('user_id', userId).limit(1);
    if (data && data.length > 0) return;
    const now = Date.now();
    const rows = SAMPLE_PROMPTS.map((p, i) => ({
      user_id:    userId,
      title:      p.title,
      category:   p.category,
      text:       p.text,
      tags:       p.tags,
      is_locked:  false,
      copy_count: Math.floor(Math.random() * 20),
      created_at: now - (SAMPLE_PROMPTS.length - i) * 3600000,
      updated_at: now - (SAMPLE_PROMPTS.length - i) * 3600000,
      status:     'approved',
    }));
    const { data: inserted } = await sb.from('prompts').insert(rows).select('id');
    if (inserted && inserted.length >= 2) {
      await sb.from('user_favorites').upsert({
        user_id:    userId,
        prompt_ids: [inserted[0].id, inserted[1].id],
      });
    }
  };

  const getAll = async (userId) => {
    const isAdminUser = window.UserService ? UserService.isAdmin() : false;

    let promptQuery;
    if (isAdminUser) {
      promptQuery = sb.from('prompts').select('*').order('created_at', { ascending: false });
    } else {
      promptQuery = sb.from('prompts').select('*')
        .or(`status.eq.approved,user_id.eq.${userId}`)
        .order('created_at', { ascending: false });
    }

    const [{ data: prompts, error }, { data: favRow }] = await Promise.all([
      promptQuery,
      sb.from('user_favorites').select('prompt_ids').eq('user_id', userId).maybeSingle(),
    ]);
    if (error) throw error;
    const favIds = new Set(favRow?.prompt_ids || []);
    return (prompts || []).map(row => _toJs(row, favIds));
  };

  const create = async (userId, data) => {
    const isAdminUser = window.UserService ? UserService.isAdmin() : false;
    const now = Date.now();
    const { data: row, error } = await sb.from('prompts').insert({
      user_id:    userId,
      title:      data.title.trim(),
      category:   data.category,
      text:       data.text.trim(),
      tags:       (data.tags || []).map(t => t.trim()).filter(Boolean),
      is_locked:  false,
      copy_count: 0,
      created_at: now,
      updated_at: now,
      status:     isAdminUser ? 'approved' : 'pending',
    }).select().single();
    if (error) throw error;
    return _toJs(row);
  };

  const update = async (id, userId, data) => {
    const { error } = await sb.from('prompts')
      .update({
        title:      data.title.trim(),
        category:   data.category,
        text:       data.text.trim(),
        tags:       (data.tags || []).map(t => t.trim()).filter(Boolean),
        updated_at: Date.now(),
      })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  };

  const remove = async (id, userId) => {
    const { error } = await sb.from('prompts').delete().eq('id', id).eq('user_id', userId);
    return !error;
  };

  const toggleFavorite = async (promptId, userId) => {
    const { data: favRow } = await sb.from('user_favorites').select('prompt_ids').eq('user_id', userId).maybeSingle();
    let ids = favRow?.prompt_ids || [];
    const wasFav = ids.includes(promptId);
    ids = wasFav ? ids.filter(x => x !== promptId) : [...ids, promptId];
    await sb.from('user_favorites').upsert({ user_id: userId, prompt_ids: ids });
    return !wasFav;
  };

  const toggleLock = async (id, userId) => {
    const { data: row } = await sb.from('prompts').select('is_locked').eq('id', id).eq('user_id', userId).maybeSingle();
    if (!row) return null;
    const newLocked = !row.is_locked;
    await sb.from('prompts').update({ is_locked: newLocked }).eq('id', id).eq('user_id', userId);
    return { id, isLocked: newLocked };
  };

  const incrementCopyCount = async (id) => {
    const { data: row } = await sb.from('prompts').select('copy_count').eq('id', id).maybeSingle();
    if (!row) return 0;
    const newCount = (row.copy_count || 0) + 1;
    await sb.from('prompts').update({ copy_count: newCount }).eq('id', id);
    return newCount;
  };

  const deleteAllForUser = async (userId) => {
    await sb.from('prompts').delete().eq('user_id', userId);
    await sb.from('user_favorites').delete().eq('user_id', userId);
  };

  const exportPrompts = async (userId) => {
    const all = await getAll(userId);
    const mine = all.filter(p => p.userId === userId);
    const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), prompts: mine }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `promptlib-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const importPrompts = async (userId, items) => {
    if (!items || !items.length) return { success: false, message: 'No prompts to import.' };
    const isAdminUser = window.UserService ? UserService.isAdmin() : false;
    const now = Date.now();
    const { error } = await sb.from('prompts').insert(items.map(p => ({
      user_id:    userId,
      title:      String(p.title || 'Untitled').trim(),
      category:   String(p.category || 'coding').trim(),
      text:       String(p.text || '').trim(),
      tags:       Array.isArray(p.tags) ? p.tags.map(String) : [],
      is_locked:  false,
      copy_count: 0,
      created_at: now,
      updated_at: now,
      status:     isAdminUser ? 'approved' : 'pending',
    })));
    if (error) return { success: false, message: error.message };
    return { success: true, count: items.length };
  };

  const getAllAdmin = async () => {
    const { data } = await sb.from('prompts').select('*').order('created_at', { ascending: false });
    return (data || []).map(row => _toJs(row));
  };

  const approvePrompt = async (id, adminId) => {
    const { error } = await sb.from('prompts').update({
      status:      'approved',
      reviewed_by: adminId,
      reviewed_at: Date.now(),
    }).eq('id', id);
    return !error;
  };

  const rejectPrompt = async (id, adminId, reason) => {
    const { error } = await sb.from('prompts').update({
      status:           'rejected',
      rejection_reason: reason || null,
      reviewed_by:      adminId,
      reviewed_at:      Date.now(),
    }).eq('id', id);
    return !error;
  };

  return Object.freeze({
    seedForUser, getAll, create, update, remove,
    toggleFavorite, toggleLock, incrementCopyCount, deleteAllForUser,
    exportPrompts, importPrompts,
    getAllAdmin, approvePrompt, rejectPrompt,
  });
})();
