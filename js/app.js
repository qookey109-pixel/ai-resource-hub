const state = {
  resources: [],
  categories: [],
  icons: {},
  aiConfig: { enabled: false, endpoint: '' },
  ai: {
    active: false,
    loading: false,
    mode: '',
    intentSummary: '',
    recommendations: [],
    stackPlan: [],
    caveats: []
  }
};

const els = {
  search: document.querySelector('#search'),
  compactSearch: document.querySelector('#compact-search'),
  heroSubmit: document.querySelector('#hero-submit'),
  compactSubmit: document.querySelector('#compact-submit'),
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
  template: document.querySelector('#resource-template'),
  aiPanel: document.querySelector('#ai-panel'),
  aiPanelStatus: document.querySelector('#ai-panel-status'),
  aiPanelBadge: document.querySelector('#ai-panel-badge'),
  aiRecommendations: document.querySelector('#ai-recommendations'),
  aiPlan: document.querySelector('#ai-plan'),
  aiCaveats: document.querySelector('#ai-caveats')
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

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json();
}

function normalise(value) {
  return String(value ?? '').trim().toLowerCase();
}

function categoryInfo(name) {
  return state.categories.find((category) => category.name === name);
}

function categoryDisplayName(name) {
  const info = categoryInfo(name);
  return info?.display_name ?? info?.name ?? name ?? '其他';
}

function searchableText(resource) {
  const translatedCategories = (resource.categories ?? []).map(categoryDisplayName);
  return [
    resource.name,
    resource.summary,
    resource.type,
    typeLabels[resource.type],
    resource.pricing,
    pricingLabels[resource.pricing],
    resource.notes,
    ...(resource.categories ?? []),
    ...translatedCategories,
    ...(resource.tags ?? []),
    ...(resource.use_cases ?? [])
  ].join(' ').toLowerCase();
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
  if (state.ai.active && state.ai.recommendations.length) {
    const byId = new Map(state.resources.map((resource) => [resource.id, resource]));
    return state.ai.recommendations
      .map((recommendation) => byId.get(recommendation.id))
      .filter(Boolean)
      .filter(matchesSecondaryFilters);
  }

  const query = normalise(els.search.value);
  const resources = state.resources.filter((resource) => {
    if (query && !searchableText(resource).includes(query)) return false;
    return matchesSecondaryFilters(resource);
  });

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
  if (!icon?.url) {
    showFallbackIcon(iconEl, resource);
    return;
  }

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
    if (primaryUseCase) {
      useCase.textContent = `適合：${primaryUseCase}`;
    } else {
      useCase.hidden = true;
    }

    const categories = fragment.querySelector('.categories');
    for (const category of (resource.categories ?? []).slice(0, 5)) {
      categories.append(makePill(category));
    }

    const sourceLabel = resource.open_source === true
      ? '開源'
      : resource.open_source === false
        ? '非開源'
        : '來源未確認';

    fragment.querySelector('.meta').textContent = [
      pricingLabels[resource.pricing] ?? '價格未知',
      sourceLabel
    ].join(' · ');

    const link = fragment.querySelector('.visit');
    link.href = resource.url;
    link.setAttribute('aria-label', `開啟 ${resource.name}`);

    els.grid.append(fragment);
  });

  syncQuickCategoryState();
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
    clearAiState(true);
    els.category.value = category;
    render();
    document.querySelector('#resources')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  return button;
}

function renderQuickCategories() {
  els.quickCategories.replaceChildren();
  els.quickCategories.append(createQuickCategory('全部資源', ''));

  const usedCategories = new Set(
    state.resources.flatMap((resource) => resource.categories ?? [])
  );

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

function setSearchValue(value, { clearAi = false } = {}) {
  els.search.value = value;
  els.compactSearch.value = value;
  if (clearAi) clearAiState(true);
  render();
}

function goToResults() {
  document.querySelector('#resources')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearAiState(hidePanel = false) {
  state.ai.active = false;
  state.ai.mode = '';
  state.ai.intentSummary = '';
  state.ai.recommendations = [];
  state.ai.stackPlan = [];
  state.ai.caveats = [];
  if (hidePanel) {
    els.aiPanel.hidden = true;
    els.aiPanel.classList.remove('error');
  }
}

function setAiLoading(loading) {
  state.ai.loading = loading;
  for (const button of [els.heroSubmit, els.compactSubmit]) {
    button.disabled = loading;
    button.classList.toggle('is-loading', loading);
    button.textContent = loading ? '…' : '→';
  }
}

function renderList(container, items) {
  const list = container.querySelector('ol, ul');
  list.replaceChildren();
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    list.append(li);
  }
  container.hidden = items.length === 0;
}

function renderAiPanel() {
  els.aiPanel.hidden = false;
  els.aiPanel.classList.remove('error');
  els.aiRecommendations.replaceChildren();
  els.aiPanelBadge.textContent = state.ai.mode === 'fallback' ? '備援建議' : 'AI 推薦';
  els.aiPanelStatus.textContent = state.ai.intentSummary || '已依你的任務從目前資源庫挑選候選。';

  const byId = new Map(state.resources.map((resource) => [resource.id, resource]));
  for (const recommendation of state.ai.recommendations) {
    const resource = byId.get(recommendation.id);
    if (!resource) continue;

    const item = document.createElement('article');
    item.className = 'ai-recommendation-item';

    const top = document.createElement('div');
    top.className = 'ai-recommendation-top';

    const name = document.createElement('h3');
    name.className = 'ai-recommendation-name';
    name.textContent = resource.name;

    const role = document.createElement('span');
    role.className = 'ai-recommendation-role';
    role.textContent = recommendation.role || '推薦資源';

    top.append(name, role);
    item.append(top);

    if (recommendation.reason) {
      const reason = document.createElement('p');
      reason.className = 'ai-recommendation-reason';
      reason.textContent = recommendation.reason;
      item.append(reason);
    }

    if (recommendation.how_to_use) {
      const how = document.createElement('p');
      how.className = 'ai-recommendation-how';
      how.textContent = `怎麼用：${recommendation.how_to_use}`;
      item.append(how);
    }

    els.aiRecommendations.append(item);
  }

  renderList(els.aiPlan, state.ai.stackPlan);
  renderList(els.aiCaveats, state.ai.caveats);
}

function renderAiUnavailable(message) {
  clearAiState(false);
  els.aiPanel.hidden = false;
  els.aiPanel.classList.add('error');
  els.aiPanelBadge.textContent = '尚未啟用';
  els.aiPanelStatus.textContent = message;
  els.aiRecommendations.replaceChildren();
  els.aiPlan.hidden = true;
  els.aiCaveats.hidden = true;
}

async function requestAiRecommendations() {
  const query = String(els.search.value || '').trim();
  if (query.length < 2) {
    goToResults();
    return;
  }

  if (!state.aiConfig.enabled || !state.aiConfig.endpoint) {
    renderAiUnavailable('AI 後端程式已準備完成，但目前還沒有部署啟用；現在先保留關鍵字搜尋結果。');
    goToResults();
    return;
  }

  setAiLoading(true);
  els.aiPanel.hidden = false;
  els.aiPanel.classList.remove('error');
  els.aiPanelBadge.textContent = '分析中';
  els.aiPanelStatus.textContent = '正在理解任務，並從目前資源庫挑選最適合的組合…';
  els.aiRecommendations.replaceChildren();
  els.aiPlan.hidden = true;
  els.aiCaveats.hidden = true;

  try {
    const response = await fetch(state.aiConfig.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!response.ok) throw new Error(`AI backend ${response.status}`);
    const data = await response.json();
    const recommendations = Array.isArray(data.recommendations)
      ? data.recommendations.filter((item) => state.resources.some((resource) => resource.id === item.id)).slice(0, 5)
      : [];

    if (!recommendations.length) throw new Error('AI backend returned no valid catalog resources');

    state.ai.active = true;
    state.ai.mode = data.mode === 'fallback' ? 'fallback' : 'ai';
    state.ai.intentSummary = String(data.intent_summary || '');
    state.ai.recommendations = recommendations;
    state.ai.stackPlan = Array.isArray(data.stack_plan) ? data.stack_plan : [];
    state.ai.caveats = Array.isArray(data.caveats) ? data.caveats : [];

    renderAiPanel();
    render();
    els.aiPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    console.error(error);
    renderAiUnavailable('AI 推薦暫時連線失敗；原本的關鍵字搜尋仍可正常使用。');
  } finally {
    setAiLoading(false);
  }
}

function resetFilters() {
  clearAiState(true);
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
  els.search.addEventListener('input', () => setSearchValue(els.search.value, { clearAi: true }));
  els.compactSearch.addEventListener('input', () => setSearchValue(els.compactSearch.value, { clearAi: true }));

  for (const el of [els.category, els.type, els.free, els.openSource, els.sort]) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  }

  els.reset.addEventListener('click', resetFilters);
  els.heroSubmit.addEventListener('click', requestAiRecommendations);
  els.compactSubmit.addEventListener('click', requestAiRecommendations);
  window.addEventListener('scroll', updateCompactMode, { passive: true });

  document.addEventListener('keydown', (event) => {
    const activeTag = document.activeElement?.tagName;
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) {
      event.preventDefault();
      (document.body.classList.contains('compact-mode') ? els.compactSearch : els.search).focus();
    }
    if (event.key === 'Escape' && [els.search, els.compactSearch].includes(document.activeElement)) {
      clearAiState(true);
      setSearchValue('');
      document.activeElement.blur();
    }
    if (event.key === 'Enter' && [els.search, els.compactSearch].includes(document.activeElement)) {
      event.preventDefault();
      requestAiRecommendations();
    }
  });
}

async function init() {
  try {
    const [resourceDoc, categoryDoc, iconDoc, aiConfigDoc] = await Promise.all([
      loadJson('./data/resources.json'),
      loadJson('./data/categories.json'),
      loadJson('./data/resource-icons.json'),
      loadJson('./data/ai-config.json')
    ]);

    state.resources = Array.isArray(resourceDoc.resources) ? resourceDoc.resources : [];
    state.categories = Array.isArray(categoryDoc.categories) ? categoryDoc.categories : [];
    state.icons = iconDoc && typeof iconDoc.icons === 'object' ? iconDoc.icons : {};
    state.aiConfig = {
      enabled: aiConfigDoc?.enabled === true,
      endpoint: String(aiConfigDoc?.endpoint || '').trim()
    };

    populateCategories();
    populateTypes();
    renderStats();
    renderQuickCategories();
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
