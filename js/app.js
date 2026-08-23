const state = {
  resources: [],
  categories: []
};

const els = {
  search: document.querySelector('#search'),
  category: document.querySelector('#category-filter'),
  free: document.querySelector('#free-filter'),
  openSource: document.querySelector('#open-source-filter'),
  grid: document.querySelector('#resource-grid'),
  empty: document.querySelector('#empty-state'),
  count: document.querySelector('#result-count'),
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
    ...(resource.categories ?? []),
    ...(resource.tags ?? []),
    ...(resource.use_cases ?? [])
  ].join(' ').toLowerCase();
}

function isFree(resource) {
  return ['free', 'freemium', 'open-source'].includes(resource.pricing) || resource.open_source === true;
}

function filterResources() {
  const query = normalise(els.search.value);
  const category = els.category.value;

  return state.resources.filter((resource) => {
    if (query && !searchableText(resource).includes(query)) return false;
    if (category && !(resource.categories ?? []).includes(category)) return false;
    if (els.free.checked && !isFree(resource)) return false;
    if (els.openSource.checked && resource.open_source !== true) return false;
    return true;
  });
}

function makePill(text, className) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function render() {
  const resources = filterResources();
  els.grid.replaceChildren();
  els.count.textContent = String(resources.length);
  els.empty.hidden = resources.length !== 0;

  for (const resource of resources) {
    const fragment = els.template.content.cloneNode(true);
    fragment.querySelector('.type').textContent = resource.type ?? 'other';
    fragment.querySelector('.rating').textContent = resource.rating ? `★ ${resource.rating}/5` : '未評分';
    fragment.querySelector('.name').textContent = resource.name;
    fragment.querySelector('.description').textContent = resource.summary ?? '';

    const categories = fragment.querySelector('.categories');
    for (const category of resource.categories ?? []) categories.append(makePill(category, 'pill'));

    const tags = fragment.querySelector('.tags');
    for (const tag of resource.tags ?? []) tags.append(makePill(`#${tag}`, 'tag'));

    fragment.querySelector('.meta').textContent = [
      resource.pricing ?? 'unknown',
      resource.open_source === true ? 'open source' : resource.open_source === false ? 'closed source' : 'source unknown',
      resource.status ?? 'unknown'
    ].join(' · ');

    const link = fragment.querySelector('.visit');
    link.href = resource.url;
    link.setAttribute('aria-label', `前往 ${resource.name}`);

    els.grid.append(fragment);
  }
}

function populateCategories() {
  for (const category of state.categories) {
    const option = document.createElement('option');
    option.value = category.name;
    option.textContent = `${category.icon ?? ''} ${category.name}`.trim();
    els.category.append(option);
  }
}

function bindEvents() {
  for (const el of [els.search, els.category, els.free, els.openSource]) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  }
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
