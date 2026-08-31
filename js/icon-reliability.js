const ICON_CONTAINER_SELECTOR = '.resource-icon, .resource-detail-icon';
const attemptedContainers = new WeakSet();
const failedPrimaryUrls = new WeakMap();

function uniqueUrls(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const url = String(value || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    output.push(url);
  }
  return output;
}

function canonicalResourceUrl(container) {
  const card = container.closest('.card');
  const cardLink = card?.querySelector('.visit');
  if (cardLink?.href) return cardLink.href;

  const dialog = container.closest('#resource-detail-dialog');
  const detailLink = dialog?.querySelector('.resource-detail-visit');
  if (detailLink?.href && detailLink.href !== window.location.href) return detailLink.href;

  return '';
}

function derivedFallbackUrls(canonicalUrl) {
  try {
    const url = new URL(canonicalUrl, window.location.href);
    const hostname = url.hostname.toLowerCase();

    if (hostname === 'github.com' || hostname === 'www.github.com') {
      const [owner] = url.pathname.split('/').filter(Boolean);
      return owner ? [`https://github.com/${encodeURIComponent(owner)}.png?size=256`] : [];
    }

    if (!['http:', 'https:'].includes(url.protocol)) return [];
    const origin = url.origin;
    return [
      `${origin}/favicon.ico`,
      `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(origin)}`
    ];
  } catch {
    return [];
  }
}

function restoreTextFallback(container, text) {
  container.replaceChildren();
  container.textContent = text;
  container.classList.remove('has-brand-icon');
  container.dataset.iconReliability = 'category-fallback';
}

function tryDerivedFallback(container) {
  if (!(container instanceof HTMLElement)) return;
  if (container.querySelector('img')) return;
  if (attemptedContainers.has(container)) return;

  const canonicalUrl = canonicalResourceUrl(container);
  if (!canonicalUrl) return;

  const failedPrimary = failedPrimaryUrls.get(container);
  const candidates = uniqueUrls(derivedFallbackUrls(canonicalUrl)).filter((url) => url !== failedPrimary);
  if (!candidates.length) return;

  attemptedContainers.add(container);
  const originalText = container.textContent || '';
  const image = document.createElement('img');
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';

  if (container.classList.contains('resource-icon')) {
    image.width = 40;
    image.height = 40;
    image.style.width = '40px';
    image.style.height = '40px';
    image.style.objectFit = 'contain';
    image.style.borderRadius = '9px';
  }

  let candidateIndex = 0;

  const loadNext = () => {
    const next = candidates[candidateIndex++];
    if (!next) {
      restoreTextFallback(container, originalText);
      return;
    }
    image.dataset.iconCandidate = String(candidateIndex);
    image.src = next;
  };

  image.addEventListener('load', () => {
    container.classList.add('has-brand-icon');
    container.dataset.iconReliability = candidateIndex === 1 ? 'derived-fallback' : 'derived-secondary-fallback';
  });

  image.addEventListener('error', loadNext);
  container.replaceChildren(image);
  container.classList.add('has-brand-icon');
  loadNext();
}

function queueContainer(container) {
  if (!(container instanceof HTMLElement)) return;
  queueMicrotask(() => tryDerivedFallback(container));
}

function scan(root) {
  if (root instanceof Element && root.matches(ICON_CONTAINER_SELECTOR)) queueContainer(root);
  for (const container of root.querySelectorAll?.(ICON_CONTAINER_SELECTOR) || []) queueContainer(container);
}

window.addEventListener('error', (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  const container = image.closest(ICON_CONTAINER_SELECTOR);
  if (!(container instanceof HTMLElement)) return;
  failedPrimaryUrls.set(container, image.currentSrc || image.src || '');
}, true);

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    const target = mutation.target;
    if (target instanceof Element && target.matches(ICON_CONTAINER_SELECTOR)) queueContainer(target);
    for (const node of mutation.addedNodes) {
      if (node instanceof Element) scan(node);
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
scan(document);
