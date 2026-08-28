const state = {
  resources: [],
  categories: [],
  icons: {},
  searchDocs: new Map()
};

const els = {
  search: document.querySelector('#search'),
  compactSearch: document.querySelector('#compact-search'),
  category: document.querySelector('#category-filter'),
  type: document.querySelector('#type-filter'),
  free: document.querySelector('#free-filter'),
  openSource: document.querySelector('#open-source-filter'),
  reset: document.querySelector('#reset-filters'),
  sort: document.querySelector('#sort-filter'),
  quickCategories: document.querySelector('#quick-categories'),
  grid: document.querySelector('#resource-grid'),
  empty: document.querySelector('#empty-state'),
  count: document.querySelector('#result-count'),
  totalStat: document.querySelector('#total-stat'),
  categoryStat: document.querySelector('#category-stat'),
  openStat: document.querySelector('#open-stat'),
  template: document.querySelector('#resource-template')
};

const typeLabels = {
  website: '網站',
  github: 'GitHub',
  documentation: '文件',
  service: '服務',
  library: '函式庫',
  model: '模型',
  dataset: '資料集',
  platform: '平台',
  other: '其他'
};

const pricingLabels = {
  free: '免費',
  freemium: '免費增值',
  paid: '付費',
  'open-source': '開源',
  unknown: '價格未知'
};

const stopWords = new Set([
  '我要', '我想', '想要', '幫我', '請', '可以', '一個', '一些', '的', '用', '做', '找', '搜尋', '資源', '工具'
]);

const synonymGroups = new Map(Object.entries({
  ai: ['ai', '人工智慧', 'llm', '模型', 'agent'],
  llm: ['llm', 'ai', '大語言模型', '模型'],
  agent: ['agent', '代理', '智能體', 'mcp', 'skill'],
  skills: ['skills', 'skill', 'agent skills', '技能'],
  skill: ['skill', 'skills', 'agent skills', '技能'],
  mcp: ['mcp', 'agent', 'tool calling'],
  網站: ['網站', 'web', 'website', 'frontend', '前端'],
  前端: ['前端', 'frontend', 'ui', 'web'],
  ui: ['ui', 'ux', '設計', '介面', 'frontend'],
  設計: ['設計', 'ui', 'ux', 'design'],
  影片: ['影片', 'video', '短影片', '剪輯', 'shorts'],
  短影片: ['短影片', 'shorts', 'video', '影片生成', '剪輯'],
  剪輯: ['剪輯', 'editing', 'video', '影片'],
  圖片: ['圖片', 'image', '圖像', '設計'],
  語音: ['語音', 'voice', 'speech', 'tts', '音訊'],
  音訊: ['音訊', 'audio', 'music', '語音'],
  音樂: ['音樂', 'music', 'audio'],
  '3d': ['3d', 'webgl', 'avatar', '模型'],
  avatar: ['avatar', '3d', '角色', '虛擬人'],
  遊戲: ['遊戲', 'game', 'game development'],
  客服: ['客服', 'chatbot', '聊天', 'agent', 'line'],
  line: ['line', '客服', '聊天', 'chatbot'],
  爬蟲: ['爬蟲', 'scraping', '擷取', '資料蒐集'],
  擷取: ['擷取', 'scraping', 'reader', 'markdown', '資料蒐集'],
  研究: ['研究', 'research', 'search', '搜尋'],
  搜尋: ['搜尋', 'search', 'research'],
  法律: ['法律', 'legal', '法遵', 'compliance'],
  法遵: ['法遵', 'compliance', 'legal', '法律'],
  交易: ['交易', 'trading', '金融', '投資', 'crypto'],
  投資: ['投資', 'trading', '交易', '金融'],
  加密貨幣: ['加密貨幣', 'crypto', 'bitcoin', '交易'],
  資安: ['資安', 'security', 'reverse', '逆向'],
  逆向: ['逆向', 'reverse engineering', 'security', '資安'],
  部署: ['部署', 'deployment', 'cloud', '雲端'],
  雲端: ['雲端', 'cloud', 'deployment'],
  資料庫: ['資料庫', 'database', 'backend', '後端'],
  後端: ['後端', 'backend', 'database', 'api'],
  自動化: ['自動化', 'automation', 'workflow'],
  文件: ['文件', 'documentation', 'docs', 'learning'],
  開源: ['開源', 'open source', 'open-source', 'github'],
  免費: ['免費', 'free', 'freemium', 'open-source']
}));

let renderFrame = 0;

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json();
}

function normalise(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[＿_–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryInfo(name) {
  return state.categories.find((category) => category.name === name);
}

function categoryDisplayName(name) {
  const info = categoryInfo(name);
  return info?.display_name ?? info?.name ?? name ?? '其他';
}

function tokenizeQuery(query) {
  const raw = normalise(query);
  if (!raw) return [];
  const tokens = raw
    .split(/[\s,，、|/+]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !stopWords.has(token));
  return [...new Set(tokens.length ? tokens : [raw])];
}

function alternativesFor(token) {
  return synonymGroups.get(token) ?? [token];
}

function buildSearchDoc(resource) {
  const categories = resource.categories ?? [];
  const translatedCategories = categories.map(categoryDisplayName);
  const tags = resource.tags ?? [];
  const useCases = resource.use_cases ?? [];

  const fields = {
    name: normalise(resource.name),
    categories: normalise([...categories, ...translatedCategories].join(' ')),
    tags: normalise(tags.join(' ')),
    useCases: normalise(useCases.join(' ')),
    summary: normalise(resource.summary),
    notes: normalise(resource.notes),
    meta: normalise([
      resource.type,
      typeLabels[resource.type],
      resource.pricing,
      pricingLabels[resource.pricing],
      resource.open_source === true ? '開源 open source' : ''
    ].join(' '))
  };

  fields.all = normalise(Object.values(fields).join(' '));
  return fields;
}

function matchesAny(text, alternatives) {
  return alternatives.some((term) => text.includes(normalise(term)));
}

function scoreResource(resource, query) {
  if (!query) return 0;
  const doc = state.searchDocs.get(resource.id) ?? buildSearchDoc(resource);
  const phrase = normalise(query);
  const tokens = tokenizeQuery(query);
  if (!tokens.length) return 0;

  let score = 0;
  let matchedTokens = 0;

  if (doc.name.includes(phrase)) score += 24;
  else if (doc.all.includes(phrase)) score += 8;

  for (const token of tokens) {
    const alternatives = alternativesFor(token);
    let matched = false;

    if (matchesAny(doc.name, alternatives)) {
      score += 12;
      matched = true;
    }
    if (matchesAny(doc.categories, alternatives)) {
      score += 9;
      matched = true;
    }
    if (matchesAny(doc.tags, alternatives)) {
      score += 8;
      matched = true;
    }
    if (matchesAny(doc.useCases, alternatives)) {
      score += 6;
      matched = true;
    }
    if (matchesAny(doc.summary, alternatives)) {
      score += 5;
      matched = true;
    }
    if (matchesAny(doc.meta, alternatives)) {
      score += 4;
      matched = true;
    }
    if (!matched && matchesAny(doc.notes, alternatives)) {
      score += 2;
      matched = true;
    }

    if (matched) matchedTokens += 1;
  }

  const minimumMatches = tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.67);
  if (matchedTokens < minimumMatches) return -1;

  score += matchedTokens * 2;
  score += Math.max(0, Number(resource.rating ?? 0) - 3);
  return score;
}

function isFree(resource) {
  return ['free', 'freemium', 'open-source'].includes(resource.pricing) || resource.open_source === true;
}

function matchesSecondaryFilters(resource) {
  const category = els.category.value;
  const type = els.type.value;
  if (category && !(resource.categories ?? []).includes(category)) return false;
  if (type && resource.type !== type) return false;
  if (els.free.checked && !isFree(resource)) return false;
  if (els.openSource.checked && resource.open_source !== true) return false;
  return true;
}

function filteredResources() {
  const query = normalise(els.search.value);
  let resources = state.resources.filter(matchesSecondaryFilters);

  if (query) {
    resources = resources
      .map((resource) => ({ resource, score: scoreResource(resource, query) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score || (b.resource.rating ?? -1) - (a.resource.rating ?? -1) || String(a.resource.name).localeCompare(String(b.resource.name)))
      .map((item) => item.resource);
    return resources;
  }

  const sort = els.sort.value;
  resources.sort((a, b) => {
    if (sort === 'name') return String(a.name).localeCompare(String(b.name));
    if (sort === 'newest') {
      const dateDiff = String(b.added_at ?? '').localeCompare(String(a.added_at ?? ''));
      return dateDiff || (b.rating ?? -1) - (a.rating ?? -1) || String(a.name).localeCompare(String(b.name));
    }
    return (b.rating ?? -1) - (a.rating ?? -1) || String(a.name).localeCompare(String(b.name));
  });
  return resources;
}

function makePill(text) {
  const span = document.createElement('span');
  span.className = 'pill';
  span.textContent = categoryDisplayName(text);
  return span;
}

function categoryIcon(resource) {
  const firstCategory = resource.categories?.[0];
  return categoryInfo(firstCategory)?.icon || String(resource.name || '?').slice(0, 1).toUpperCase();
}

function showFallbackIcon(iconEl, resource) {
  iconEl.replaceChildren();
  iconEl.textContent = categoryIcon(resource);
  iconEl.classList.remove('has-brand-icon');
}

function renderResourceIcon(iconEl, resource) {
  const icon = state.icons?.[resource.id];
  if (!icon?.url) return showFallbackIcon(iconEl, resource);

  const img = document.createElement('img');
  img.src = icon.url;
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.width = 40;
  img.height = 40;
  img.style.width = '40px';
  img.style.height = '40px';
  img.style.objectFit = 'contain';
  img.style.borderRadius = '9px';
  img.addEventListener('error', () => showFallbackIcon(iconEl, resource), { once: true });
  iconEl.replaceChildren(img);
  iconEl.classList.add('has-brand-icon');
}

function render() {
  const resources = filteredResources();
  els.grid.replaceChildren();
  els.count.textContent = String(resources.length);
  els.empty.hidden = resources.length !== 0;

  resources.forEach((resource, index) => {
    const fragment = els.template.content.cloneNode(true);
    const card = fragment.querySelector('.card');
    if (index === 0 && (resource.rating ?? 0) >= 5) card.classList.add('featured');

    renderResourceIcon(fragment.querySelector('.resource-icon'), resource);
    fragment.querySelector('.name').textContent = resource.name;
    fragment.querySelector('.type').textContent = typeLabels[resource.type] ?? '其他';
    fragment.querySelector('.primary-category').textContent = categoryDisplayName(resource.categories?.[0]);
    fragment.querySelector('.description').textContent = resource.summary ?? '';
    fragment.querySelector('.rating').textContent = resource.rating ? `★ ${resource.rating}` : '待評估';

    const useCase = fragment.querySelector('.use-case');
    const primaryUseCase = resource.use_cases?.[0];
    if (primaryUseCase) useCase.textContent = `適合：${primaryUseCase}`;
    else useCase.hidden = true;

    const categories = fragment.querySelector('.categories');
    for (const category of (resource.categories ?? []).slice(0, 5)) categories.append(makePill(category));

    const sourceLabel = resource.open_source === true ? '開源' : resource.open_source === false ? '非開源' : '來源未確認';
    fragment.querySelector('.meta').textContent = [pricingLabels[resource.pricing] ?? '價格未知', sourceLabel].join(' · ');

    const link = fragment.querySelector('.visit');
    link.href = resource.url;
    link.setAttribute('aria-label', `開啟 ${resource.name}`);
    els.grid.append(fragment);
  });

  syncQuickCategoryState();
}

function scheduleRender() {
  if (renderFrame) cancelAnimationFrame(renderFrame);
  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0;
    render();
  });
}

function populateCategories() {
  for (const category of state.categories) {
    const option = document.createElement('option');
    option.value = category.name;
    option.textContent = `${category.icon ?? ''} ${category.display_name ?? category.name}`.trim();
    els.category.append(option);
  }
}

function populateTypes() {
  const types = [...new Set(state.resources.map((resource) => resource.type).filter(Boolean))].sort();
  for (const type of types) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = typeLabels[type] ?? type;
    els.type.append(option);
  }
}

function renderStats() {
  els.totalStat.textContent = String(state.resources.length);
  const usedCategories = new Set(state.resources.flatMap((resource) => resource.categories ?? []));
  els.categoryStat.textContent = String(usedCategories.size);
  els.openStat.textContent = String(state.resources.filter((resource) => resource.open_source === true).length);
}

function createQuickCategory(label, category = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'quick-category';
  button.dataset.category = category;
  button.textContent = label;
  button.addEventListener('click', () => {
    els.category.value = category;
    render();
    document.querySelector('#resources')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  return button;
}

function renderQuickCategories() {
  els.quickCategories.replaceChildren();
  els.quickCategories.append(createQuickCategory('全部資源', ''));
  const usedCategories = new Set(state.resources.flatMap((resource) => resource.categories ?? []));

  for (const info of state.categories) {
    if (!usedCategories.has(info.name)) continue;
    const displayName = info.display_name ?? info.name;
    const label = `${info.icon ? `${info.icon} ` : ''}${displayName}`;
    els.quickCategories.append(createQuickCategory(label, info.name));
  }
}

function syncQuickCategoryState() {
  for (const button of els.quickCategories.querySelectorAll('.quick-category')) {
    button.classList.toggle('active', button.dataset.category === els.category.value);
  }
}

function setSearchValue(value, immediate = false) {
  els.search.value = value;
  els.compactSearch.value = value;
  if (immediate) render();
  else scheduleRender();
}

function goToResults() {
  document.querySelector('#resources')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetFilters() {
  els.search.value = '';
  els.compactSearch.value = '';
  els.category.value = '';
  els.type.value = '';
  els.free.checked = false;
  els.openSource.checked = false;
  els.sort.value = 'rating';
  render();
  (document.body.classList.contains('compact-mode') ? els.compactSearch : els.search).focus();
}

function updateCompactMode() {
  const compact = window.scrollY > 250;
  document.body.classList.toggle('compact-mode', compact);
  els.compactSearch.tabIndex = compact ? 0 : -1;
  document.querySelector('.compact-search-wrap')?.setAttribute('aria-hidden', compact ? 'false' : 'true');
}

function bindEvents() {
  els.search.addEventListener('input', () => setSearchValue(els.search.value));
  els.compactSearch.addEventListener('input', () => setSearchValue(els.compactSearch.value));

  for (const el of [els.category, els.type, els.free, els.openSource, els.sort]) {
    el.addEventListener('input', scheduleRender);
    el.addEventListener('change', scheduleRender);
  }

  els.reset.addEventListener('click', resetFilters);
  window.addEventListener('scroll', updateCompactMode, { passive: true });

  document.addEventListener('keydown', (event) => {
    const active = document.activeElement;
    const activeTag = active?.tagName;

    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) {
      event.preventDefault();
      (document.body.classList.contains('compact-mode') ? els.compactSearch : els.search).focus();
      return;
    }

    if (event.key === 'Escape' && [els.search, els.compactSearch].includes(active)) {
      setSearchValue('', true);
      active.blur();
      return;
    }

    if (event.key === 'Enter' && [els.search, els.compactSearch].includes(active)) {
      event.preventDefault();
      setSearchValue(active.value, true);
      goToResults();
    }
  });
}

async function init() {
  try {
    const [resourceDoc, categoryDoc, iconDoc] = await Promise.all([
      loadJson('./data/resources.json'),
      loadJson('./data/categories.json'),
      loadJson('./data/resource-icons.json')
    ]);

    state.resources = Array.isArray(resourceDoc.resources) ? resourceDoc.resources : [];
    state.categories = Array.isArray(categoryDoc.categories) ? categoryDoc.categories : [];
    state.icons = iconDoc && typeof iconDoc.icons === 'object' ? iconDoc.icons : {};

    populateCategories();
    populateTypes();
    renderStats();
    renderQuickCategories();

    for (const resource of state.resources) state.searchDocs.set(resource.id, buildSearchDoc(resource));

    bindEvents();
    updateCompactMode();
    render();
  } catch (error) {
    console.error(error);
    els.empty.hidden = false;
    els.empty.querySelector('h2').textContent = '資源資料載入失敗';
    els.empty.querySelector('p').textContent = '請稍後再試，或檢查 data JSON 是否有效。';
  }
}

init();
