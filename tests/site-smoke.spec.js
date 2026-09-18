const { test, expect } = require('@playwright/test');
const { resources } = require('../data/resources.json');

test.beforeEach(async ({ page }) => {
  await page.route('**/data/click-config.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ schema_version: '0.1', enabled: false, endpoint: '' })
    });
  });
});

test('catalog renders canonical resources without runtime errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  await expect(page.locator('#resource-grid .card')).toHaveCount(resources.length);
  await expect(page.locator('#resource-search-status')).toContainText(`目前顯示 ${resources.length} 個資源`);
  await expect(page.locator('link[rel="stylesheet"]')).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});

test('mobile layout has no horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.locator('#resource-grid .card').first()).toBeVisible();
  await expect.poll(async () => page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }))).toEqual({ scrollWidth: 390, clientWidth: 390 });
});

test('sticky compact search becomes keyboard-accessible after scrolling', async ({ page }) => {
  await page.goto('/');
  const wrap = page.locator('.compact-search-wrap');
  const input = page.locator('#compact-search');

  await expect(wrap).toHaveAttribute('aria-hidden', 'true');
  await expect(input).toHaveAttribute('tabindex', '-1');

  await page.evaluate(() => window.scrollTo(0, 400));
  await expect(wrap).toHaveAttribute('aria-hidden', 'false');
  await expect(input).toHaveAttribute('tabindex', '0');
});


test('shared catalog registries are fetched once per page', async ({ page }) => {
  const targets = new Set([
    '/data/resources.json',
    '/data/categories.json',
    '/data/resource-icons.json',
    '/data/resource-links.json'
  ]);
  const counts = new Map([...targets].map((path) => [path, 0]));

  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (targets.has(path)) counts.set(path, counts.get(path) + 1);
  });

  await page.goto('/');
  await expect(page.locator('#resource-grid .card')).toHaveCount(resources.length);
  await page.waitForTimeout(100);

  for (const path of targets) {
    expect(counts.get(path), `${path} should be fetched once`).toBe(1);
  }
});


test('legacy hidden filters are removed while quick categories still filter', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#type-filter, #free-filter, #open-source-filter, #reset-filters, #category-filter')).toHaveCount(0);

  const categoryGroup = page.locator('#quick-categories');
  await expect(categoryGroup).toHaveAttribute('role', 'group');
  await expect(categoryGroup).toHaveAttribute('aria-label', '資源分類');

  const allCategory = page.locator('.quick-category[data-category=""]');
  const aiCategory = page.locator('.quick-category[data-category="AI / LLM"]');
  await expect(allCategory).toHaveAttribute('aria-pressed', 'true');
  await expect(aiCategory).toHaveAttribute('aria-pressed', 'false');
  await expect(aiCategory).toBeVisible();
  await aiCategory.click();
  await expect(aiCategory).toHaveClass(/active/);
  await expect(aiCategory).toHaveAttribute('aria-pressed', 'true');
  await expect(allCategory).toHaveAttribute('aria-pressed', 'false');

  const filteredCount = await page.locator('#resource-grid .card').count();
  expect(filteredCount).toBeGreaterThan(0);
  expect(filteredCount).toBeLessThan(resources.length);

  await allCategory.click();
  await expect(allCategory).toHaveAttribute('aria-pressed', 'true');
  await expect(aiCategory).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#resource-grid .card')).toHaveCount(resources.length);
});


test('page exposes canonical and social metadata', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://qookey109-pixel.github.io/ai-resource-hub/'
  );
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'zh_TW');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Qookey AI Resource Hub');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    'https://qookey109-pixel.github.io/ai-resource-hub/'
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary');
});


test('result scrolling respects reduced motion preference', async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.scrollIntoView = function scrollIntoView(options) {
      window.__qookeyLastScrollBehavior = options?.behavior ?? null;
    };
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await page.locator('.quick-category[data-category="AI / LLM"]').click();
  await expect.poll(() => page.evaluate(() => window.__qookeyLastScrollBehavior)).toBe('auto');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.quick-category[data-category=""]').click();
  await expect.poll(() => page.evaluate(() => window.__qookeyLastScrollBehavior)).toBe('smooth');
});


test('SEO discovery files expose the canonical site URL', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBeTruthy();
  const robotsText = await robots.text();
  expect(robotsText).toContain('User-agent: *');
  expect(robotsText).toContain('Allow: /');
  expect(robotsText).toContain('Sitemap: https://qookey109-pixel.github.io/ai-resource-hub/sitemap.xml');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  expect(sitemapText).toContain('<loc>https://qookey109-pixel.github.io/ai-resource-hub/</loc>');
});


test('category filtering batches direct grid mutations', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#resource-grid .card')).toHaveCount(resources.length);

  await page.evaluate(() => {
    const grid = document.querySelector('#resource-grid');
    window.__qookeyGridMutationRecords = 0;
    window.__qookeyGridMutationObserver = new MutationObserver((records) => {
      window.__qookeyGridMutationRecords += records.filter((record) => record.type === 'childList').length;
    });
    window.__qookeyGridMutationObserver.observe(grid, { childList: true });
  });

  await page.locator('.quick-category[data-category="AI / LLM"]').click();
  await expect(page.locator('#resource-grid .card').first()).toBeVisible();

  const filteredCount = await page.locator('#resource-grid .card').count();
  expect(filteredCount).toBeGreaterThan(0);
  expect(filteredCount).toBeLessThan(resources.length);

  await expect.poll(() => page.evaluate(() => window.__qookeyGridMutationRecords)).toBeGreaterThan(0);
  const mutationRecords = await page.evaluate(() => window.__qookeyGridMutationRecords);
  expect(mutationRecords).toBeLessThanOrEqual(2);
});
