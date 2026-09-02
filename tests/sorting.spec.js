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
});

test('sorts by join date in both directions', async ({ page }) => {
  const sort = page.locator('#sort-filter');

  await sort.selectOption('newest');
  await expect.poll(async () => isMonotonic(await cardDates(page), 'desc')).toBe(true);

  await sort.selectOption('oldest');
  await expect.poll(async () => isMonotonic(await cardDates(page), 'asc')).toBe(true);
});

test('sorts by click count in both directions', async ({ page }) => {
  const sort = page.locator('#sort-filter');

  await sort.selectOption('clicks-desc');
  await expect.poll(async () => isMonotonic(await cardNumbers(page, 'clickCount'), 'desc')).toBe(true);

  await sort.selectOption('clicks-asc');
  await expect.poll(async () => isMonotonic(await cardNumbers(page, 'clickCount'), 'asc')).toBe(true);
});
