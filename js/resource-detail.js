const dialog = document.querySelector('#resource-detail-dialog');

if (dialog) {
  const detailEls = {
    icon: dialog.querySelector('.resource-detail-icon'),
    kicker: dialog.querySelector('.resource-detail-kicker'),
    title: dialog.querySelector('.resource-detail-title'),
    summary: dialog.querySelector('.resource-detail-summary'),
    useCases: dialog.querySelector('.resource-detail-use-cases'),
    notesSection: dialog.querySelector('[data-detail-section="notes"]'),
    notes: dialog.querySelector('.resource-detail-notes'),
    facts: dialog.querySelector('.resource-detail-facts'),
    categoriesSection: dialog.querySelector('[data-detail-section="categories"]'),
    categories: dialog.querySelector('.resource-detail-pills'),
    tagsSection: dialog.querySelector('[data-detail-section="tags"]'),
    tags: dialog.querySelector('.resource-detail-tags'),
    visit: dialog.querySelector('.resource-detail-visit'),
    closeButtons: dialog.querySelectorAll('[data-detail-close]')
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

  const difficultyLabels = {
    beginner: '入門',
    intermediate: '中階',
    advanced: '進階',
    unknown: '難度未知'
  };

  const statusLabels = {
    active: '活躍',
    beta: 'Beta',
    inactive: '停止維護',
    archived: '已封存',
    unknown: '狀態未知'
  };

  const interactiveSelector = 'a, button, input, select, textarea, label, [contenteditable="true"]';

  let resources = [];
  let categories = [];
  let icons = {};
  let resourceById = new Map();
  let resourceIdByUrl = new Map();
  let lastTrigger = null;

  async function loadJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
    return response.json();
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

  function categoryInfo(name) {
    return categories.find((category) => category.name === name);
  }

  function categoryDisplayName(name) {
    const info = categoryInfo(name);
    return info?.display_name ?? info?.name ?? name ?? '其他';
  }

  function categoryIcon(resource) {
    return categoryInfo(resource.categories?.[0])?.icon || String(resource.name || '?').slice(0, 1).toUpperCase();
  }

  function showFallbackIcon(resource) {
    detailEls.icon.replaceChildren();
    detailEls.icon.textContent = categoryIcon(resource);
  }

  function renderIcon(resource) {
    const icon = icons?.[resource.id];
    if (!icon?.url) {
      showFallbackIcon(resource);
      return;
    }

    const img = document.createElement('img');
    img.src = icon.url;
    img.alt = '';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => showFallbackIcon(resource), { once: true });
    detailEls.icon.replaceChildren(img);
  }

  function renderChipList(container, values, className, display = (value) => value) {
    container.replaceChildren();
    for (const value of values || []) {
      const chip = document.createElement('span');
      chip.className = className;
      chip.textContent = display(value);
      container.append(chip);
    }
  }

  function renderUseCases(resource) {
    detailEls.useCases.replaceChildren();
    const items = resource.use_cases || [];
    for (const item of items) {
      const li = document.createElement('li');
      li.textContent = item;
      detailEls.useCases.append(li);
    }
  }

  function openSourceLabel(value) {
    if (value === true) return '開源';
    if (value === false) return '非開源';
    return '未確認';
  }

  function formatDate(value) {
    if (!value) return null;
    return String(value);
  }

  function renderFacts(resource) {
    const facts = [
      ['價格', pricingLabels[resource.pricing] ?? '價格未知'],
      ['來源', openSourceLabel(resource.open_source)],
      ['授權', resource.license || '未確認'],
      ['難度', difficultyLabels[resource.difficulty] ?? resource.difficulty ?? '難度未知'],
      ['狀態', statusLabels[resource.status] ?? resource.status ?? '狀態未知'],
      ['評分', resource.rating ? `★ ${resource.rating} / 5` : '待評估'],
      ['加入日期', formatDate(resource.added_at)],
      ['最近檢查', formatDate(resource.last_checked)]
    ].filter(([, value]) => value !== null && value !== undefined && value !== '');

    detailEls.facts.replaceChildren();
    for (const [label, value] of facts) {
      const row = document.createElement('div');
      row.className = 'resource-detail-fact';
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      row.append(dt, dd);
      detailEls.facts.append(row);
    }
  }

  function visitLabel(resource) {
    if (resource.type === 'github') return '開啟 GitHub ↗';
    if (resource.type === 'documentation') return '查看文件 ↗';
    return '前往資源 ↗';
  }

  function renderResource(resource) {
    dialog.dataset.resourceId = resource.id;
    renderIcon(resource);

    const type = typeLabels[resource.type] ?? '其他';
    const primaryCategory = categoryDisplayName(resource.categories?.[0]);
    detailEls.kicker.textContent = `${type} · ${primaryCategory}`;
    detailEls.title.textContent = resource.name || '未命名資源';
    detailEls.summary.textContent = resource.long_description || resource.summary || '目前沒有詳細介紹。';

    renderUseCases(resource);
    renderFacts(resource);

    const resourceCategories = resource.categories || [];
    detailEls.categoriesSection.hidden = resourceCategories.length === 0;
    renderChipList(detailEls.categories, resourceCategories, 'resource-detail-pill', categoryDisplayName);

    const resourceTags = resource.tags || [];
    detailEls.tagsSection.hidden = resourceTags.length === 0;
    renderChipList(detailEls.tags, resourceTags, 'resource-detail-tag');

    const notes = String(resource.notes || '').trim();
    detailEls.notesSection.hidden = !notes;
    detailEls.notes.textContent = notes;

    detailEls.visit.href = resource.url || '#';
    detailEls.visit.textContent = visitLabel(resource);
    detailEls.visit.setAttribute('aria-label', `${visitLabel(resource).replace(' ↗', '')}：${resource.name}`);
  }

  function showDialog(resource, trigger = null) {
    lastTrigger = trigger || document.activeElement;
    renderResource(resource);
    document.body.classList.add('resource-detail-open');

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    requestAnimationFrame(() => dialog.querySelector('.resource-detail-close')?.focus());
  }

  function closeDialog() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  function findResourceForCard(card) {
    const directId = card?.dataset?.resourceId;
    if (directId && resourceById.has(directId)) return resourceById.get(directId);

    const href = card?.querySelector('.visit')?.href;
    const id = href ? resourceIdByUrl.get(normaliseUrl(href)) : null;
    return id ? resourceById.get(id) : null;
  }

  function decorateCard(card) {
    if (!(card instanceof HTMLElement)) return;
    card.dataset.detailTrigger = 'true';
    card.tabIndex = 0;
    const name = card.querySelector('.name')?.textContent?.trim() || '這個資源';
    card.setAttribute('aria-label', `查看 ${name} 的詳細資訊`);
  }

  function decorateCards(root = document) {
    if (root instanceof Element && root.matches('.card')) decorateCard(root);
    for (const card of root.querySelectorAll?.('.card') || []) decorateCard(card);
  }

  const ready = Promise.all([
    loadJson('./data/resources.json'),
    loadJson('./data/categories.json'),
    loadJson('./data/resource-icons.json')
  ]).then(([resourceDoc, categoryDoc, iconDoc]) => {
    resources = Array.isArray(resourceDoc.resources) ? resourceDoc.resources : [];
    categories = Array.isArray(categoryDoc.categories) ? categoryDoc.categories : [];
    icons = iconDoc && typeof iconDoc.icons === 'object' ? iconDoc.icons : {};
    resourceById = new Map(resources.filter((resource) => resource?.id).map((resource) => [resource.id, resource]));
    resourceIdByUrl = new Map(resources.filter((resource) => resource?.url).map((resource) => [normaliseUrl(resource.url), resource.id]));
  }).catch((error) => {
    console.warn('Resource detail data unavailable', error);
  });

  const grid = document.querySelector('#resource-grid');
  if (grid) {
    decorateCards(grid);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) decorateCards(node);
        }
      }
    });
    observer.observe(grid, { childList: true });
  }

  document.addEventListener('click', async (event) => {
    const card = event.target.closest?.('.card[data-detail-trigger="true"]');
    if (!card) return;
    if (event.target.closest?.(interactiveSelector)) return;

    event.preventDefault();
    await ready;
    const resource = findResourceForCard(card);
    if (!resource) return;
    showDialog(resource, card);
  });

  document.addEventListener('keydown', async (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    const card = event.target.closest?.('.card[data-detail-trigger="true"]');
    if (!card || event.target !== card) return;

    event.preventDefault();
    await ready;
    const resource = findResourceForCard(card);
    if (!resource) return;
    showDialog(resource, card);
  });

  for (const button of detailEls.closeButtons) {
    button.addEventListener('click', closeDialog);
  }

  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) closeDialog();
  });

  dialog.addEventListener('close', () => {
    document.body.classList.remove('resource-detail-open');
    if (lastTrigger instanceof HTMLElement && document.contains(lastTrigger)) lastTrigger.focus();
    lastTrigger = null;
  });
}
