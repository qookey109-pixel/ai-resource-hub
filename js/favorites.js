const FAVORITES_STORAGE_KEY = 'qookey-ai-resource-favorites-v1';

let favorites = loadFavorites();
let resourceIdByUrl = new Map();
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

async function loadResourceMap() {
  try {
    const response = await fetch('./data/resources.json', { cache: 'no-store' });
    if (!response.ok) return;
    const doc = await response.json();
    for (const resource of (doc.resources || [])) {
      if (!resource?.id || !resource?.url) continue;
      resourceIdByUrl.set(normaliseUrl(resource.url), resource.id);
    }
  } catch (error) {
    console.warn('Favorite resource map unavailable', error);
  }
}

function favoriteTime(id) {
  return Number(favorites[id] || 0);
}

function isFavorite(id) {
  return favoriteTime(id) > 0;
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

function decorateAndSort() {
  const grid = document.querySelector('#resource-grid');
  if (!grid || applying) return;

  const cards = [...grid.querySelectorAll('.card')];
  if (!cards.length) return;

  const entries = cards.map((card, originalIndex) => {
    const link = card.querySelector('.visit');
    const id = link ? resourceIdByUrl.get(normaliseUrl(link.href)) : null;

    if (id) {
      card.dataset.resourceId = id;
      ensureFavoriteButton(card, id);
      bindRecentUse(link, id);
    }

    return {
      card,
      id,
      originalIndex,
      favoriteAt: id ? favoriteTime(id) : 0
    };
  });

  entries.sort((a, b) => {
    const aFavorite = a.favoriteAt > 0;
    const bFavorite = b.favoriteAt > 0;
    if (aFavorite !== bFavorite) return aFavorite ? -1 : 1;
    if (aFavorite && bFavorite && a.favoriteAt !== b.favoriteAt) return b.favoriteAt - a.favoriteAt;
    return a.originalIndex - b.originalIndex;
  });

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

async function initFavorites() {
  await loadResourceMap();
  const grid = document.querySelector('#resource-grid');
  if (!grid) return;

  const observer = new MutationObserver(() => {
    if (!applying) scheduleDecorateAndSort();
  });
  observer.observe(grid, { childList: true });
  scheduleDecorateAndSort();
}

initFavorites();
