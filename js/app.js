checkAuth();

const PROMPTS_KEY = 'promptlib_prompts';
let currentCategory = 'all';
let currentSearch   = '';
let viewingId       = null;
let editingId       = null;

/* ── SAMPLE DATA ── */
const SAMPLES = [
  {
    id: 's1', title: 'Code Review Assistant', category: 'coding',
    text: 'Please review the following code and provide feedback on:\n1. Code quality and readability\n2. Potential bugs or edge cases\n3. Performance improvements\n4. Security considerations\n5. Best practices and patterns\n\nCode:\n[PASTE YOUR CODE HERE]',
    tags: ['code review', 'debugging', 'best practices']
  },
  {
    id: 's2', title: 'Python Function Generator', category: 'coding',
    text: 'Write a Python function that [DESCRIBE FUNCTIONALITY].\n\nRequirements:\n- Accept [INPUT PARAMETERS]\n- Return [OUTPUT TYPE]\n- Handle edge cases: [EDGE CASES]\n- Include type hints and a docstring\n- Follow PEP 8 style guidelines',
    tags: ['python', 'function', 'generator']
  },
  {
    id: 's3', title: 'SQL Query Optimizer', category: 'coding',
    text: 'Analyze and optimize the following SQL query for performance.\n\nProvide:\n1. Identified bottlenecks\n2. Index recommendations\n3. Rewritten optimized query\n4. Explanation of improvements\n\nQuery:\n[PASTE SQL HERE]',
    tags: ['sql', 'database', 'optimization']
  },
  {
    id: 's4', title: 'Blog Post Writer', category: 'writing',
    text: 'Write an engaging blog post about [TOPIC] for [TARGET AUDIENCE].\n\nRequirements:\n- Compelling opening hook\n- [NUMBER] main sections with subheadings\n- Real-world examples and data points\n- Clear call-to-action at the end\n- Approx. [WORD COUNT] words\n- Tone: [professional / conversational / educational]',
    tags: ['blog', 'content writing', 'seo']
  },
  {
    id: 's5', title: 'Professional Email Composer', category: 'writing',
    text: 'Write a professional email for the following scenario:\n\nFrom: [YOUR NAME / ROLE]\nTo: [RECIPIENT NAME / ROLE]\nContext: [DESCRIBE THE SITUATION]\nGoal: [WHAT YOU WANT TO ACHIEVE]\nTone: [Formal / Semi-formal / Friendly]\n\nInclude a subject line. Keep it concise and persuasive.',
    tags: ['email', 'professional', 'template']
  },
  {
    id: 's6', title: 'Product Description Writer', category: 'marketing',
    text: 'Write a compelling product description for:\n\nProduct: [NAME]\nCategory: [CATEGORY]\nKey Features: [LIST 3–5]\nTarget Audience: [DESCRIBE]\nUnique Selling Point: [WHAT MAKES IT SPECIAL]\nPrice Tier: [Budget / Mid-range / Premium]\n\nFocus on benefits over features. Drive conversions.',
    tags: ['ecommerce', 'product', 'copywriting']
  },
  {
    id: 's7', title: 'Social Media Campaign', category: 'marketing',
    text: 'Create a full social media campaign for [PRODUCT / SERVICE / EVENT]:\n\n1. 5 LinkedIn post variations\n2. 5 tweet variations (≤280 chars)\n3. 3 Instagram captions with hashtags\n4. 10 relevant hashtags\n5. Recommended posting times\n6. Visual content ideas\n\nGoal: [Awareness / Engagement / Conversions]\nBrand voice: [DESCRIBE]',
    tags: ['social media', 'campaign', 'content']
  },
  {
    id: 's8', title: 'Short Story Opener', category: 'creative',
    text: 'Write the opening 3 paragraphs of a short story:\n\nGenre: [Fantasy / Sci-Fi / Thriller / Romance / Mystery]\nSetting: [DESCRIBE WORLD / LOCATION]\nProtagonist: [NAME, age, key trait]\nInciting Incident: [DESCRIBE]\nMood: [Dark / Whimsical / Tense / Hopeful]\n\nMake it gripping enough to hook the reader immediately.',
    tags: ['fiction', 'storytelling', 'creative writing']
  },
  {
    id: 's9', title: 'Concept Explainer (ELI5)', category: 'education',
    text: 'Explain [COMPLEX CONCEPT] as if talking to a complete beginner with no technical background.\n\nYour explanation must:\n- Use simple, everyday language\n- Include at least one real-world analogy\n- Break it into clear steps\n- Avoid jargon (or define it)\n- End with a one-sentence summary\n\nConcept: [INSERT CONCEPT]',
    tags: ['eli5', 'teaching', 'simplification']
  },
  {
    id: 's10', title: 'Quiz Question Generator', category: 'education',
    text: 'Generate [NUMBER] multiple-choice questions about [TOPIC] at [Beginner / Intermediate / Advanced] level.\n\nFor each question:\n- The question itself\n- 4 answer options (A–D)\n- Correct answer marked\n- Brief explanation of why it is correct\n\nTest factual, conceptual, and applied knowledge.',
    tags: ['quiz', 'assessment', 'learning']
  }
];

/* ── DATA LAYER ── */
function getPrompts() {
  const raw = localStorage.getItem(PROMPTS_KEY);
  if (!raw) {
    localStorage.setItem(PROMPTS_KEY, JSON.stringify(SAMPLES));
    return SAMPLES;
  }
  return JSON.parse(raw);
}

function savePrompts(prompts) {
  localStorage.setItem(PROMPTS_KEY, JSON.stringify(prompts));
}

function filtered() {
  let list = getPrompts();
  if (currentCategory !== 'all') list = list.filter(p => p.category === currentCategory);
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    list = list.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.text.toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  return list;
}

/* ── CATEGORY META ── */
const CAT = {
  coding:    { label: '💻 Coding',    cls: 'cat-coding'    },
  writing:   { label: '✍️ Writing',   cls: 'cat-writing'   },
  marketing: { label: '📣 Marketing', cls: 'cat-marketing' },
  creative:  { label: '🎨 Creative',  cls: 'cat-creative'  },
  education: { label: '🎓 Education', cls: 'cat-education' },
};

/* ── RENDER ── */
function render() {
  const prompts   = filtered();
  const grid      = document.getElementById('prompts-grid');
  const emptyEl   = document.getElementById('empty-state');
  const countEl   = document.getElementById('result-count');

  countEl.textContent = `${prompts.length} prompt${prompts.length !== 1 ? 's' : ''}`;

  if (!prompts.length) {
    grid.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  grid.innerHTML = prompts.map(p => {
    const cat  = CAT[p.category] || { label: p.category, cls: '' };
    const tags = (p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    return `
      <div class="prompt-card" onclick="openView('${p.id}')">
        <div class="card-header">
          <div class="card-title">${esc(p.title)}</div>
          <div class="card-actions" onclick="event.stopPropagation()">
            <button class="btn-icon" title="Copy" onclick="copyById('${p.id}')">📋</button>
            <button class="btn-icon del" title="Delete" onclick="del('${p.id}')">🗑</button>
          </div>
        </div>
        <span class="card-category ${cat.cls}">${cat.label}</span>
        <p class="card-excerpt">${esc(p.text)}</p>
        <div class="card-footer">${tags}</div>
      </div>`;
  }).join('');

  updateCounts();
}

function updateCounts() {
  const all = getPrompts();
  document.getElementById('count-all').textContent = all.length;
  Object.keys(CAT).forEach(c => {
    document.getElementById('count-' + c).textContent = all.filter(p => p.category === c).length;
  });
}

/* ── CATEGORY SELECT ── */
function selectCat(cat) {
  currentCategory = cat;
  document.querySelectorAll('.category-item').forEach(el =>
    el.classList.toggle('active', el.dataset.category === cat)
  );
  const titles = { all: 'All Prompts', coding: 'Coding', writing: 'Writing', marketing: 'Marketing', creative: 'Creative', education: 'Education' };
  document.getElementById('page-title').textContent = titles[cat] || cat;
  render();
}

/* ── ADD / EDIT MODAL ── */
function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'New Prompt';
  document.getElementById('save-btn').textContent     = 'Save Prompt';
  document.getElementById('prompt-title').value    = '';
  document.getElementById('prompt-category').value = 'coding';
  document.getElementById('prompt-text').value     = '';
  document.getElementById('prompt-tags').value     = '';
  document.getElementById('add-modal').classList.remove('hidden');
  document.getElementById('prompt-title').focus();
}

function closeAddModal() {
  document.getElementById('add-modal').classList.add('hidden');
}

function savePrompt() {
  const title    = document.getElementById('prompt-title').value.trim();
  const category = document.getElementById('prompt-category').value;
  const text     = document.getElementById('prompt-text').value.trim();
  const tagsRaw  = document.getElementById('prompt-tags').value.trim();

  if (!title) { toast('Please enter a title'); return; }
  if (!text)  { toast('Please enter the prompt text'); return; }

  const tags    = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
  const prompts = getPrompts();

  if (editingId) {
    const i = prompts.findIndex(p => p.id === editingId);
    if (i !== -1) prompts[i] = { ...prompts[i], title, category, text, tags };
  } else {
    prompts.unshift({ id: 'p' + Date.now(), title, category, text, tags, createdAt: Date.now() });
  }

  savePrompts(prompts);
  closeAddModal();
  render();
  toast(editingId ? 'Prompt updated!' : 'Prompt saved!');
}

/* ── DELETE ── */
function del(id) {
  if (!confirm('Delete this prompt?')) return;
  savePrompts(getPrompts().filter(p => p.id !== id));
  render();
  toast('Prompt deleted');
}

/* ── COPY ── */
function copyById(id) {
  const p = getPrompts().find(p => p.id === id);
  if (!p) return;
  navigator.clipboard.writeText(p.text)
    .then(() => toast('Copied to clipboard!'))
    .catch(() => toast('Copy failed — try again'));
}

function copyFromView() {
  if (viewingId) copyById(viewingId);
}

/* ── VIEW MODAL ── */
function openView(id) {
  const p = getPrompts().find(p => p.id === id);
  if (!p) return;
  viewingId = id;
  const cat = CAT[p.category] || { label: p.category, cls: '' };
  document.getElementById('view-title').textContent            = p.title;
  const badge = document.getElementById('view-category-badge');
  badge.textContent = cat.label;
  badge.className   = `card-category ${cat.cls}`;
  document.getElementById('view-text').textContent             = p.text;
  document.getElementById('view-tags').innerHTML =
    (p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  document.getElementById('view-modal').classList.remove('hidden');
}

function closeViewModal() {
  document.getElementById('view-modal').classList.add('hidden');
  viewingId = null;
}

/* ── TOAST ── */
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

/* ── HELPERS ── */
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

/* ── INIT ── */
const session = getSession();
if (session) {
  document.getElementById('user-avatar').textContent         = session.name[0].toUpperCase();
  document.getElementById('user-name-display').textContent   = session.name;
  document.getElementById('user-email-display').textContent  = session.email;
}

/* Event listeners */
document.getElementById('search-input').addEventListener('input', function() {
  currentSearch = this.value.trim();
  render();
});

document.getElementById('category-list').addEventListener('click', function(e) {
  const item = e.target.closest('.category-item');
  if (item) selectCat(item.dataset.category);
});

document.getElementById('btn-add-prompt').addEventListener('click', openAddModal);

document.getElementById('menu-toggle').addEventListener('click', function() {
  document.getElementById('sidebar').classList.toggle('collapsed');
  document.getElementById('main-content').classList.toggle('full-width');
});

document.getElementById('user-avatar').addEventListener('click', function() {
  document.getElementById('user-dropdown').classList.toggle('show');
});

document.addEventListener('click', function(e) {
  if (!e.target.closest('.user-menu'))
    document.getElementById('user-dropdown').classList.remove('show');
});

document.getElementById('add-modal').addEventListener('click', function(e) {
  if (e.target === this) closeAddModal();
});
document.getElementById('view-modal').addEventListener('click', function(e) {
  if (e.target === this) closeViewModal();
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { closeAddModal(); closeViewModal(); }
});

render();
