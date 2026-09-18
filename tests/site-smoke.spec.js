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
  await expect(page.locator('#result-count')).toHaveText(String(resources.length));
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
