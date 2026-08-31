const { test, expect } = require('@playwright/test');

const FALLBACK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="12" fill="#111"/></svg>';

test('failed project icon falls back to the GitHub owner avatar on cards and detail', async ({ page }) => {
  await page.route('https://raw.githubusercontent.com/MengTo/threeui/main/public/threeui-mark.svg', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('https://github.com/MengTo.png?size=256', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: FALLBACK_SVG }));

  await page.goto('/');
  await page.locator('#search').fill('ThreeUI Community');

  const card = page.locator('.card', { hasText: 'ThreeUI Community' }).first();
  const cardIcon = card.locator('.resource-icon');
  await expect(cardIcon.locator('img')).toHaveAttribute('src', 'https://github.com/MengTo.png?size=256');
  await expect(cardIcon).toHaveAttribute('data-icon-reliability', 'derived-fallback');

  await card.locator('.card-detail-hit').click();
  const detailIcon = page.locator('.resource-detail-icon');
  await expect(detailIcon.locator('img')).toHaveAttribute('src', 'https://github.com/MengTo.png?size=256');
  await expect(detailIcon).toHaveAttribute('data-icon-reliability', 'derived-fallback');
});

test('exhausted derived icon candidates preserve the category fallback', async ({ page }) => {
  await page.route('https://raw.githubusercontent.com/MengTo/threeui/main/public/threeui-mark.svg', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('https://github.com/MengTo.png?size=256', (route) => route.fulfill({ status: 404, body: '' }));

  await page.goto('/');
  await page.locator('#search').fill('ThreeUI Community');

  const cardIcon = page.locator('.card', { hasText: 'ThreeUI Community' }).first().locator('.resource-icon');
  await expect(cardIcon.locator('img')).toHaveCount(0);
  await expect(cardIcon).toContainText('🧊');
  await expect(cardIcon).toHaveAttribute('data-icon-reliability', 'category-fallback');
});
