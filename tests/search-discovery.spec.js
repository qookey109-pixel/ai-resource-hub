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

  const archifyCard = page.locator('.card').filter({ has: page.locator('.name', { hasText: 'Archify' }) });
  await expect(archifyCard).toHaveCount(1);
  await expect(archifyCard.locator('.name')).toHaveText('Archify');
});


test('exact and prefix name searches stay top-ranked', async ({ page }) => {
  await page.goto('/');

  const search = page.locator('#search');
  await search.fill('TradingAgents');
  await expect(page.locator('.card').first().locator('.name')).toHaveText('TradingAgents');

  await search.fill('Hermes Back');
  await expect(page.locator('.card').first().locator('.name')).toHaveText('Hermes BackSearch Plugin');
});


test('search result changes are announced through a live status', async ({ page }) => {
  await page.goto('/');

  const search = page.locator('#search');
  const status = page.locator('#resource-search-status');

  await expect(status).toContainText('目前顯示 86 個資源');

  await search.fill('Proof Lab');
  await expect(status).toHaveText('目前顯示 1 個資源');

  await search.fill('no-such-qookey-resource-zzzz');
  await expect(status).toHaveText('找不到符合目前條件的資源');
});
