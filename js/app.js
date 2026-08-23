const state = {
  resources: [],
  categories: []
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

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json();
}

function normalise(value) {
  return String(value ?? '').trim().toLowerCase();
}

function searchableText(resource) {
  return [
    resource.name,
    resource.summary,
    resource.type,
    resource.pricing,
    resource.notes,
    ...(resource.categories ?? []),
    ...(resource.tags ?? []),
    ...(resource.use_cases ?? [])
  ].join(' ').toLowerCase();
}

function isFree(resource) {
  return ['free', 'freemium', 'open-source'].includes(resource.pricing) || resource.open_source === true;
}

function filteredResources() {
  const query = normalise(els.search.value);
  const category = els.category.value;
  const type = els.type.value;

  const resources = state.resources.filter((resource) => {
    if (query && !searchableText(resource).includes(query)) return false;
    if (category && !(resource.categories ?? []).includes(category)) return false;
    if (type && resource.type !== type) return false;
    if (els.free.checked && !isFree(resource)) return false;
    if (els.openSource.checked && resource.open_source !== true) return false;
    return true;
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
  span.textContent = text;
  return span;
}

function categoryIcon(resource) {
  const firstCategory = resource.categories?.[0];
  return state.categories.find((category) => category.name === firstCategory)?.icon || String(resource.name || '?').slice(0, 1).toUpperCase();
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

    fragment.querySelector('.resource-icon').textContent = categoryIcon(resource);
    fragment.querySelector('.name').textContent = resource.name;
    fragment.querySelector('.type').textContent = typeLabels[resource.type] ?? '其他';
    fragment.querySelector('.primary-category').textContent = resource.categories?.[0] ?? '資源';
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
    for (const category of (resource.categories ?? []).slice(0, 2)) {
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
    option.textContent = `${category.icon ?? ''} ${category.name}`.trim();
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
  els.quickCategories.append(createQuickCategory('趨勢', ''));

  const counts = new Map();
  for (const resource of state.resources) {
    for (const category of resource.categories ?? []) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 16);

  for (const [category] of ranked) {
    const categoryInfo = state.categories.find((item) => item.name === category);
    const label = `${categoryInfo?.icon ? `${categoryInfo.icon} ` : ''}${category}`;
    els.quickCategories.append(createQuickCategory(label, category));
  }
}

function syncQuickCategoryState() {
  for (const button of els.quickCategories.querySelectorAll('.quick-category')) {
    button.classList.toggle('active', button.dataset.category === els.category.value);
  }
}

function setSearchValue(value, source) {
  els.search.value = value;
  els.compactSearch.value = value;
  render();
  if (source === 'hero') els.compactSearch.value = value;
  if (source === 'compact') els.search.value = value;
}

function goToResults() {
  document.querySelector('#resources')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetFilters() {
  setSearchValue('', 'hero');
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
  els.search.addEventListener('input', () => setSearchValue(els.search.value, 'hero'));
  els.compactSearch.addEventListener('input', () => setSearchValue(els.compactSearch.value, 'compact'));

  for (const el of [els.category, els.type, els.free, els.openSource, els.sort]) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  }

  els.reset.addEventListener('click', resetFilters);
  els.heroSubmit.addEventListener('click', goToResults);
  els.compactSubmit.addEventListener('click', goToResults);
  window.addEventListener('scroll', updateCompactMode, { passive: true });

  document.addEventListener('keydown', (event) => {
    const activeTag = document.activeElement?.tagName;
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) {
      event.preventDefault();
      (document.body.classList.contains('compact-mode') ? els.compactSearch : els.search).focus();
    }
    if (event.key === 'Escape' && [els.search, els.compactSearch].includes(document.activeElement)) {
      setSearchValue('', 'hero');
      document.activeElement.blur();
    }
    if (event.key === 'Enter' && [els.search, els.compactSearch].includes(document.activeElement)) {
      goToResults();
    }
  });
}

async function init() {
  try {
    const [resourceDoc, categoryDoc] = await Promise.all([
      loadJson('./data/resources.json'),
      loadJson('./data/categories.json')
    ]);

    state.resources = Array.isArray(resourceDoc.resources) ? resourceDoc.resources : [];
    state.categories = Array.isArray(categoryDoc.categories) ? categoryDoc.categories : [];

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