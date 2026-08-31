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
    share: dialog.querySelector('.resource-detail-share'),
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

  let resources = [];
  let categories = [];
  let icons = {};
  let resourceById = new Map();
  let resourceIdByUrl = new Map();
  let lastTrigger = null;
  let shareResetTimer = 0;

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

  function currentHistoryState() {
    return history.state && typeof history.state === 'object' ? history.state : {};
  }

  function detailUrl(resourceId) {
    const url = new URL(window.location.href);
    url.searchParams.set('resource', resourceId);
    return url;
  }

  function baseUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('resource');
    return url;
  }

  function resourceIdFromLocation() {
    return new URL(window.location.href).searchParams.get('resource');
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

  function resetShareButton() {
    if (!detailEls.share) return;
    window.clearTimeout(shareResetTimer);
    shareResetTimer = 0;
    detailEls.share.textContent = '複製連結';
    detailEls.share.classList.remove('is-copied');
  }

  function renderResource(resource) {
    dialog.dataset.resourceId = resource.id;
    renderIcon(resource);
    resetShareButton();

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

  function setExpandedTrigger(trigger, expanded) {
    if (!(trigger instanceof HTMLElement)) return;
    trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function showDialog(resource, trigger = null, focusClose = true) {
    if (trigger instanceof HTMLElement) {
      if (lastTrigger && lastTrigger !== trigger) setExpandedTrigger(lastTrigger, false);
      lastTrigger = trigger;
      setExpandedTrigger(lastTrigger, true);
    } else if (!dialog.open && !lastTrigger && document.activeElement instanceof HTMLElement) {
      lastTrigger = document.activeElement;
    }

    renderResource(resource);
    document.body.classList.add('resource-detail-open');

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    if (focusClose) requestAnimationFrame(() => dialog.querySelector('.resource-detail-close')?.focus());
  }

  function closeDialogInternal() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else if (dialog.hasAttribute('open')) {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    }
  }

  function pushResourceHistory(resource) {
    if (resourceIdFromLocation() === resource.id && currentHistoryState().qookeyResource === resource.id) return;
    history.pushState({ ...currentHistoryState(), qookeyResource: resource.id }, '', detailUrl(resource.id));
  }

  function openResource(resource, trigger = null) {
    pushResourceHistory(resource);
    showDialog(resource, trigger);
  }

  function requestCloseDialog() {
    const resourceId = resourceIdFromLocation();
    if (resourceId && currentHistoryState().qookeyResource === resourceId) {
      history.back();
      return;
    }

    if (resourceId) {
      const nextState = { ...currentHistoryState() };
      delete nextState.qookeyResource;
      history.replaceState(nextState, '', baseUrl());
    }
    closeDialogInternal();
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
    card.removeAttribute('tabindex');
    card.removeAttribute('aria-label');

    let hitTarget = card.querySelector('.card-detail-hit');
    if (!hitTarget) {
      hitTarget = document.createElement('button');
      hitTarget.type = 'button';
      hitTarget.className = 'card-detail-hit';
      card.prepend(hitTarget);
    }

    const name = card.querySelector('.name')?.textContent?.trim() || '這個資源';
    hitTarget.setAttribute('aria-label', `查看 ${name} 的詳細資訊`);
    hitTarget.setAttribute('aria-haspopup', 'dialog');
    hitTarget.setAttribute('aria-controls', 'resource-detail-dialog');
    hitTarget.setAttribute('aria-expanded', 'false');
  }

  function decorateCards(root = document) {
    if (root instanceof Element && root.matches('.card')) decorateCard(root);
    for (const card of root.querySelectorAll?.('.card') || []) decorateCard(card);
  }

  async function copyShareLink() {
    const resourceId = dialog.dataset.resourceId;
    if (!resourceId || !detailEls.share) return;
    const url = detailUrl(resourceId).href;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.append(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      detailEls.share.textContent = '已複製 ✓';
      detailEls.share.classList.add('is-copied');
      shareResetTimer = window.setTimeout(resetShareButton, 1800);
    } catch (error) {
      console.warn('Unable to copy resource detail link', error);
      detailEls.share.textContent = '請複製網址列';
      shareResetTimer = window.setTimeout(resetShareButton, 2200);
    }
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
    const hitTarget = event.target.closest?.('.card-detail-hit');
    if (!hitTarget) return;

    event.preventDefault();
    await ready;
    const card = hitTarget.closest('.card');
    const resource = findResourceForCard(card);
    if (!resource) return;
    openResource(resource, hitTarget);
  });

  for (const button of detailEls.closeButtons) {
    button.addEventListener('click', requestCloseDialog);
  }

  detailEls.share?.addEventListener('click', copyShareLink);

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    requestCloseDialog();
  });

  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) requestCloseDialog();
  });

  dialog.addEventListener('close', () => {
    document.body.classList.remove('resource-detail-open');
    resetShareButton();
    setExpandedTrigger(lastTrigger, false);
    if (lastTrigger instanceof HTMLElement && document.contains(lastTrigger)) lastTrigger.focus();
    lastTrigger = null;
  });

  window.addEventListener('popstate', async () => {
    await ready;
    const resourceId = resourceIdFromLocation();
    const resource = resourceId ? resourceById.get(resourceId) : null;
    if (resource) showDialog(resource, null);
    else closeDialogInternal();
  });

  ready.then(() => {
    const resourceId = resourceIdFromLocation();
    if (!resourceId) return;

    const resource = resourceById.get(resourceId);
    if (!resource) {
      const nextState = { ...currentHistoryState() };
      delete nextState.qookeyResource;
      history.replaceState(nextState, '', baseUrl());
      return;
    }

    if (currentHistoryState().qookeyResource !== resourceId) {
      const originalUrl = new URL(window.location.href);
      const previousState = { ...currentHistoryState() };
      delete previousState.qookeyResource;
      history.replaceState({ ...previousState, qookeyResourceBase: true }, '', baseUrl());
      history.pushState({ qookeyResource: resourceId }, '', originalUrl);
    }

    showDialog(resource, null);
  });
}
