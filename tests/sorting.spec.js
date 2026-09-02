import { test, expect } from '@playwright/test';

async function cardNumbers(page, key) {
  return page.locator('#resource-grid .card').evaluateAll((cards, dataKey) =>
    cards.map((card) => Number(card.dataset[dataKey] || 0)), key
  );
}

async function cardDates(page) {
  return page.locator('#resource-grid .card').evaluateAll((cards) =>
    cards.map((card) => card.dataset.addedAt || '').filter(Boolean)
  );
}

function isMonotonic(values, direction) {
  return values.every((value, index) => index === 0 || (direction === 'desc' ? values[index - 1] >= value : values[index - 1] <= value));
}

test.beforeEach(async ({ page }) => {
  await page.route('**/data/click-config.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ schema_version: '0.1', enabled: true, endpoint: 'https://clicks.test/api/resource-clicks' })
    });
  });

  await page.route('https://clicks.test/api/resource-clicks', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          counts: {
            'money-printer-turbo': 120,
            'voice-studio': 40,
            'meshy-ai': 5
          }
        })
      });
      return;
    }
    const body = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, resource_id: body.resource_id, count: 121 })
    });
  });

  await page.goto('/');
  await expect(page.locator('#resource-grid .card').first()).toBeVisible();
  await expect(page.locator('.resource-click-count').first()).toBeVisible();
  await expect(page.locator('.hero-sort-button')).toHaveCount(2);
  await expect(page.locator('#sort-filter')).toBeHidden();
});

test('sorting uses exactly two buttons beside search and defaults to newest first', async ({ page }) => {
  const added = page.locator('#sort-added-button');
  const clicks = page.locator('#sort-clicks-button');

  await expect(added).toBeVisible();
  await expect(clicks).toBeVisible();
  await expect(added).toHaveAttribute('aria-pressed', 'true');
  await expect(added.locator('[data-sort-direction]')).toHaveText('新→舊');
  await expect(clicks.locator('[data-sort-direction]')).toHaveText('多→少');
  await expect.poll(async () => isMonotonic(await cardDates(page), 'desc')).toBe(true);
});

test('sorting buttons stay usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#sort-added-button')).toBeVisible();
  await expect(page.locator('#sort-clicks-button')).toBeVisible();
});

test('join-date button toggles newest and oldest', async ({ page }) => {
  const added = page.locator('#sort-added-button');

  await expect.poll(async () => isMonotonic(await cardDates(page), 'desc')).toBe(true);

  await added.click();
  await expect(added.locator('[data-sort-direction]')).toHaveText('舊→新');
  await expect.poll(async () => isMonotonic(await cardDates(page), 'asc')).toBe(true);

  await added.click();
  await expect(added.locator('[data-sort-direction]')).toHaveText('新→舊');
  await expect.poll(async () => isMonotonic(await cardDates(page), 'desc')).toBe(true);
});

test('click-count button toggles descending and ascending', async ({ page }) => {
  const clicks = page.locator('#sort-clicks-button');

  await clicks.click();
  await expect(clicks).toHaveAttribute('aria-pressed', 'true');
  await expect(clicks.locator('[data-sort-direction]')).toHaveText('多→少');
  await expect.poll(async () => isMonotonic(await cardNumbers(page, 'clickCount'), 'desc')).toBe(true);

  await clicks.click();
  await expect(clicks.locator('[data-sort-direction]')).toHaveText('少→多');
  await expect.poll(async () => isMonotonic(await cardNumbers(page, 'clickCount'), 'asc')).toBe(true);
});
