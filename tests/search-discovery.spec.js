const { test, expect } = require('@playwright/test');

test('verified secondary-link labels are searchable', async ({ page }) => {
  await page.goto('/');

  const search = page.locator('#search');
  await search.fill('Proof Lab');

  const cards = page.locator('.card');
  await expect(cards).toHaveCount(1);
  await expect(cards.first().locator('.name')).toHaveText('Archify');
});

test('verified secondary-link guide labels participate in discovery', async ({ page }) => {
  await page.goto('/');

  const search = page.locator('#search');
  await search.fill('Scenario Guide');

  const cards = page.locator('.card');
  await expect(cards).toHaveCount(1);
  await expect(cards.first().locator('.name')).toHaveText('Archify');
});
