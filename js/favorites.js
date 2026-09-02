const FAVORITES_STORAGE_KEY = 'qookey-ai-resource-favorites-v1';
const CLICK_CONFIG_PATH = './data/click-config.json';
const CLICK_SORTS = new Set(['clicks-desc', 'clicks-asc']);
const DATE_SORTS = new Set(['newest', 'oldest']);

let favorites = loadFavorites();
let resourceIdByUrl = new Map();
let resourceById = new Map();
let clickCounts = {};
let clickCountsLoaded = false;
let clickEndpoint = '';
let applying = false;
let scheduled = false;

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // Local storage can be unavailable in strict privacy modes; keep session behavior working.
  }
}

function normaliseUrl(value) {
  try {
    const url = new URL(value, window.location.href);
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch {
    return String(value || '').replace(/\/$/, '');
  }
}

function safeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
}

async function loadResourceMap() {
  try {
    const response = await fetch('./data/resources.json', { cache: 'no-store' });
    if (!response.ok) return;
    const doc = await response.json();
    for (const resource of (doc.resources || [])) {
      if (!resource?.id) continue;
      resourceById.set(resource.id, resource);
      if (resource.url) resourceIdByUrl.set(normaliseUrl(resource.url), resource.id);
    }
  } catch (error) {
    console.warn('Favorite resource map unavailable', error);
  }
}

async function loadClickCounts() {
  try {
    const configResponse = await fetch(CLICK_CONFIG_PATH, { cache: 'no-store' });
    if (!configResponse.ok) return;
    const config = await configResponse.json();
    if (config?.enabled !== true || !config?.endpoint) return;

    clickEndpoint = String(config.endpoint);
    const response = await fetch(clickEndpoint, {
      method: 'GET',
      cache: 'no-store',
      headers: { accept: 'application/json' }
    });
    if (!response.ok) return;

    const payload = await response.json();
    if (!payload?.ok || !payload?.counts || typeof payload.counts !== 'object') return;
    clickCounts = Object.fromEntries(
      Object.entries(payload.counts).map(([id, count]) => [id, safeCount(count)])
    );
    clickCountsLoaded = true;
    scheduleDecorateAndSort();
  } catch (error) {
    console.warn('Resource click counts unavailable', error);
  }
}

function favoriteTime(id) {
  return Number(favorites[id] || 0);
}

function isFavorite(id) {
  return favoriteTime(id) > 0;
}

function clickCount(id) {
  return safeCount(clickCounts[id]);
}

function updateFavoriteButton(button, card, id) {
  const active = isFavorite(id);
  button.classList.toggle('is-favorite', active);
  card.classList.toggle('is-favorite', active);
  button.textContent = active ? '★' : '☆';
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  button.setAttribute('aria-label', active ? '移除最愛' : '加入最愛');
  button.title = active ? '已加入最愛' : '加入最愛';
}

function toggleFavorite(id, button, card) {
  if (isFavorite(id)) {
    delete favorites[id];
  } else {
    favorites[id] = Date.now();
  }
  saveFavorites();
  updateFavoriteButton(button, card, id);
  scheduleDecorateAndSort();
}

function ensureFavoriteButton(card, id) {
  let button = card.querySelector('.favorite-button');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'favorite-button';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(id, button, card);
    });
    card.append(button);
  }
  updateFavoriteButton(button, card, id);
}

function ensureClickBadge(card, id) {
  let badge = card.querySelector('.resource-click-count');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'resource-click-count';
    const facts = card.querySelector('.resource-facts');
    if (facts) facts.append(badge);
  }
  if (!badge) return;

  badge.hidden = !clickCountsLoaded;
  if (clickCountsLoaded) {
    const count = clickCount(id);
    badge.textContent = `↗ ${count.toLocaleString('zh-TW')}`;
    badge.title = `累積前往資源點擊：${count.toLocaleString('zh-TW')}`;
    badge.setAttribute('aria-label', `累積點擊 ${count.toLocaleString('zh-TW')} 次`);
  }
}

function bindRecentUse(link, id) {
  if (link.dataset.favoriteRecentUseBound === 'true') return;
  link.dataset.favoriteRecentUseBound = 'true';
  link.addEventListener('click', () => {
    if (!isFavorite(id)) return;
    favorites[id] = Date.now();
    saveFavorites();
    scheduleDecorateAndSort();
  });
}

function setupSortOptions() {
  const sort = document.querySelector('#sort-filter');
  if (!sort || sort.dataset.qookeySortV2 === 'true') return;

  const previousValue = sort.value || 'rating';
  const options = [
    ['rating', '推薦優先'],
    ['newest', '加入日期：新 → 舊'],
    ['oldest', '加入日期：舊 → 新'],
    ['clicks-desc', '點擊次數：多 → 少'],
    ['clicks-asc', '點擊次數：少 → 多'],
    ['name', '名稱 A–Z']
  ];

  sort.replaceChildren(...options.map(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }));
  sort.value = options.some(([value]) => value === previousValue) ? previousValue : 'rating';
  sort.dataset.qookeySortV2 = 'true';
  sort.addEventListener('change', scheduleDecorateAndSort);
}

function compareDate(a, b, newestFirst) {
  const aDate = String(a.resource?.added_at || '');
  const bDate = String(b.resource?.added_at || '');
  if (!aDate && bDate) return 1;
  if (aDate && !bDate) return -1;
  const diff = aDate.localeCompare(bDate);
  return newestFirst ? -diff : diff;
}

function compareRatingThenName(a, b) {
  const ratingDiff = Number(b.resource?.rating ?? -1) - Number(a.resource?.rating ?? -1);
  if (ratingDiff) return ratingDiff;
  return String(a.resource?.name || '').localeCompare(String(b.resource?.name || ''));
}

function compareEntries(a, b, mode) {
  if (mode === 'rating') {
    const aFavorite = a.favoriteAt > 0;
    const bFavorite = b.favoriteAt > 0;
    if (aFavorite !== bFavorite) return aFavorite ? -1 : 1;
    if (aFavorite && bFavorite && a.favoriteAt !== b.favoriteAt) return b.favoriteAt - a.favoriteAt;
    return a.originalIndex - b.originalIndex;
  }

  if (mode === 'name') {
    return String(a.resource?.name || '').localeCompare(String(b.resource?.name || '')) || a.originalIndex - b.originalIndex;
  }

  if (DATE_SORTS.has(mode)) {
    return compareDate(a, b, mode === 'newest') || compareRatingThenName(a, b) || a.originalIndex - b.originalIndex;
  }

  if (CLICK_SORTS.has(mode)) {
    const diff = a.clickCount - b.clickCount;
    const ordered = mode === 'clicks-desc' ? -diff : diff;
    return ordered || compareRatingThenName(a, b) || a.originalIndex - b.originalIndex;
  }

  return a.originalIndex - b.originalIndex;
}

function decorateAndSort() {
  setupSortOptions();
  const grid = document.querySelector('#resource-grid');
  if (!grid || applying) return;

  const cards = [...grid.querySelectorAll('.card')];
  if (!cards.length) return;

  const entries = cards.map((card, originalIndex) => {
    const link = card.querySelector('.visit');
    const id = link ? resourceIdByUrl.get(normaliseUrl(link.href)) : null;
    const resource = id ? resourceById.get(id) : null;

    if (id) {
      card.dataset.resourceId = id;
      card.dataset.addedAt = String(resource?.added_at || '');
      card.dataset.clickCount = String(clickCount(id));
      ensureFavoriteButton(card, id);
      ensureClickBadge(card, id);
      bindRecentUse(link, id);
    }

    return {
      card,
      id,
      resource,
      originalIndex,
      favoriteAt: id ? favoriteTime(id) : 0,
      clickCount: id ? clickCount(id) : 0
    };
  });

  const mode = document.querySelector('#sort-filter')?.value || 'rating';
  entries.sort((a, b) => compareEntries(a, b, mode));

  const orderChanged = entries.some((entry, index) => entry.card !== cards[index]);
  if (!orderChanged) return;

  applying = true;
  try {
    for (const entry of entries) grid.append(entry.card);
  } finally {
    applying = false;
  }
}

function scheduleDecorateAndSort() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    decorateAndSort();
  });
}

function resourceIdForOutboundLink(link) {
  if (!(link instanceof HTMLAnchorElement)) return null;
  const cardId = link.closest('.card')?.dataset.resourceId;
  if (cardId) return cardId;
  const dialogId = link.closest('#resource-detail-dialog')?.dataset.resourceId;
  if (dialogId) return dialogId;
  return resourceIdByUrl.get(normaliseUrl(link.href)) || null;
}

async function recordResourceClick(resourceId) {
  if (!resourceId || !clickEndpoint) return;

  try {
    const response = await fetch(clickEndpoint, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ resource_id: resourceId })
    });
    if (!response.ok) return;
    const payload = await response.json();
    if (!payload?.ok) return;
    clickCounts[resourceId] = safeCount(payload.count);
    clickCountsLoaded = true;
    scheduleDecorateAndSort();
  } catch (error) {
    console.warn('Resource click could not be recorded', error);
  }
}

function bindClickTracking() {
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest('a.visit, a.resource-detail-visit, .resource-detail-links a');
    if (!link) return;
    const resourceId = resourceIdForOutboundLink(link);
    if (resourceId) void recordResourceClick(resourceId);
  }, { capture: true });
}

function updateResourceScrollOffset() {
  const resources = document.querySelector('#resources');
  if (!resources) return;

  const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0;
  const toolbarHeight = document.querySelector('#market-toolbar')?.getBoundingClientRect().height ?? 0;
  resources.style.scrollMarginTop = `${Math.ceil(headerHeight + toolbarHeight + 12)}px`;
}

function initResourceScrollOffset() {
  const header = document.querySelector('.site-header');
  const toolbar = document.querySelector('#market-toolbar');

  updateResourceScrollOffset();
  window.addEventListener('resize', updateResourceScrollOffset, { passive: true });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(updateResourceScrollOffset);
    if (header) observer.observe(header);
    if (toolbar) observer.observe(toolbar);
  }
}

async function initFavorites() {
  setupSortOptions();
  bindClickTracking();
  await loadResourceMap();
  const grid = document.querySelector('#resource-grid');
  if (!grid) return;

  const observer = new MutationObserver(() => {
    if (!applying) scheduleDecorateAndSort();
  });
  observer.observe(grid, { childList: true });
  scheduleDecorateAndSort();
  void loadClickCounts();
}

initResourceScrollOffset();
initFavorites();
