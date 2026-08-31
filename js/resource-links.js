const dialog = document.querySelector('#resource-detail-dialog');
const section = dialog?.querySelector('[data-detail-section="links"]');
const container = dialog?.querySelector('.resource-detail-links');

if (dialog && section && container) {
  const kindLabels = {
    github: 'GitHub',
    website: '網站',
    documentation: '文件',
    demo: 'Demo',
    gallery: 'Gallery',
    api: 'API',
    download: '下載',
    other: '連結'
  };

  let resourcesById = new Map();
  let linksById = {};

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

  function safeHttpUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function hostLabel(value) {
    try {
      const url = new URL(value);
      return url.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function primaryEntry(resource) {
    const isGitHub = resource.type === 'github';
    return {
      label: isGitHub ? 'GitHub 專案' : '官方主連結',
      kind: isGitHub ? 'github' : 'website',
      url: resource.url,
      description: isGitHub ? '查看原始碼、README、Issues 與專案更新。' : '前往此資源目前收錄的正式主網址。',
      primary: true
    };
  }

  function mergedLinks(resource) {
    const entries = [primaryEntry(resource), ...(linksById?.[resource.id] || [])];
    const seen = new Set();
    const output = [];

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const url = safeHttpUrl(entry.url);
      if (!url) continue;
      const key = normaliseUrl(url);
      if (seen.has(key)) continue;
      seen.add(key);
      output.push({ ...entry, url });
    }

    return output;
  }

  function renderLinks(resource) {
    const entries = mergedLinks(resource);
    container.replaceChildren();
    section.hidden = entries.length === 0;

    for (const entry of entries) {
      const link = document.createElement('a');
      link.className = 'resource-detail-link-card';
      if (entry.primary) link.classList.add('is-primary');
      link.href = entry.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `${entry.label}：${resource.name}`);

      const top = document.createElement('span');
      top.className = 'resource-detail-link-top';

      const label = document.createElement('strong');
      label.textContent = entry.label || '官方連結';

      const kind = document.createElement('span');
      kind.className = 'resource-detail-link-kind';
      kind.textContent = kindLabels[entry.kind] || kindLabels.other;

      top.append(label, kind);

      const description = document.createElement('span');
      description.className = 'resource-detail-link-description';
      description.textContent = entry.description || hostLabel(entry.url);

      const host = document.createElement('span');
      host.className = 'resource-detail-link-host';
      host.textContent = `${hostLabel(entry.url)} ↗`;

      link.append(top, description, host);
      container.append(link);
    }
  }

  function clearLinks() {
    container.replaceChildren();
    section.hidden = true;
  }

  const ready = Promise.all([
    loadJson('./data/resources.json'),
    loadJson('./data/resource-links.json')
  ]).then(([resourceDoc, linkDoc]) => {
    const resources = Array.isArray(resourceDoc.resources) ? resourceDoc.resources : [];
    resourcesById = new Map(resources.filter((resource) => resource?.id).map((resource) => [resource.id, resource]));
    linksById = linkDoc && typeof linkDoc.links === 'object' ? linkDoc.links : {};
  }).catch((error) => {
    console.warn('Resource link registry unavailable', error);
    clearLinks();
  });

  async function refresh() {
    await ready;
    const resource = resourcesById.get(dialog.dataset.resourceId);
    if (!resource) {
      clearLinks();
      return;
    }
    renderLinks(resource);
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.attributeName === 'data-resource-id' || mutation.attributeName === 'open')) {
      refresh();
    }
  });

  observer.observe(dialog, { attributes: true, attributeFilter: ['data-resource-id', 'open'] });
  dialog.addEventListener('close', clearLinks);

  if (dialog.open || dialog.dataset.resourceId) refresh();
}
