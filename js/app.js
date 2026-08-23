const state = {
  resources: [],
  categories: []
};

const els = {
  search: document.querySelector('#search'),
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

function makePill(text, className) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function render() {
  const resources = filteredResources();
  els.grid.replaceChildren();
  els.count.textContent = String(resources.length);
  els.empty.hidden = resources.length !== 0;

  for (const resource of resources) {
    const fragment = els.template.content.cloneNode(true);
    fragment.querySelector('.type').textContent = resource.type ?? 'other';
    fragment.querySelector('.rating').textContent = resource.rating ? `★ ${resource.rating}/5` : '待評估';
    fragment.querySelector('.name').textContent = resource.name;
    fragment.querySelector('.description').textContent = resource.summary ?? '';

    const useCase = fragment.querySelector('.use-case');
    const primaryUseCase = resource.use_cases?.[0];
    if (primaryUseCase) {
      useCase.textContent = `適合：${primaryUseCase}`;
    } else {
      useCase.hidden = true;
    }

    const categories = fragment.querySelector('.categories');
    for (const category of (resource.categories ?? []).slice(0, 3)) {
      categories.append(makePill(category, 'pill'));
    }

    const tags = fragment.querySelector('.tags');
    for (const tag of (resource.tags ?? []).slice(0, 5)) {
      tags.append(makePill(`#${tag}`, 'tag'));
    }

    fragment.querySelector('.meta').textContent = [
      resource.pricing ?? 'unknown',
      resource.open_source === true ? 'open source' : resource.open_source === false ? 'closed source' : 'source n/a'
    ].join(' · ');

    const link = fragment.querySelector('.visit');
    link.href = resource.url;
    link.setAttribute('aria-label', `開啟 ${resource.name}`);

    els.grid.append(fragment);
  }

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
    option.textContent = type;
    els.type.append(option);
  }
}

function renderStats() {
  els.totalStat.textContent = String(state.resources.length);
  const usedCategories = new Set(state.resources.flatMap((resource) => resource.categories ?? []));
  els.categoryStat.textContent = String(usedCategories.size);
  els.openStat.textContent = String(state.resources.filter((resource) => resource.open_source === true).length);
}

function renderQuickCategories() {
  const counts = new Map();
  for (const resource of state.resources) {
    for (const category of resource.categories ?? []) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }

  const topCategories = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 7);

  for (const [category, count] of topCategories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quick-category';
    button.dataset.category = category;
    button.textContent = `${category} · ${count}`;
    button.addEventListener('click', () => {
      els.category.value = els.category.value === category ? '' : category;
      render();
      document.querySelector('#resources')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    els.quickCategories.append(button);
  }
}

function syncQuickCategoryState() {
  for (const button of els.quickCategories.querySelectorAll('.quick-category')) {
    button.classList.toggle('active', button.dataset.category === els.category.value);
  }
}

function resetFilters() {
  els.search.value = '';
  els.category.value = '';
  els.type.value = '';
  els.free.checked = false;
  els.openSource.checked = false;
  els.sort.value = 'rating';
  render();
  els.search.focus();
}

function bindEvents() {
  for (const el of [els.search, els.category, els.type, els.free, els.openSource, els.sort]) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  }

  els.reset.addEventListener('click', resetFilters);

  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== els.search && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      els.search.focus();
    }
    if (event.key === 'Escape' && document.activeElement === els.search) {
      els.search.value = '';
      render();
      els.search.blur();
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
    render();
  } catch (error) {
    console.error(error);
    els.empty.hidden = false;
    els.empty.querySelector('h2').textContent = '資源資料載入失敗';
    els.empty.querySelector('p').textContent = '請稍後再試，或檢查 data JSON 是否有效。';
  }
}

init();
