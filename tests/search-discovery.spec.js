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
  await expect(status).toHaveText('目前顯示 1 個資源，依相關性排序');

  await search.fill('no-such-qookey-resource-zzzz');
  await expect(status).toHaveText('找不到符合目前條件的資源');
});


test('compact search accessibility state follows the scroll threshold', async ({ page }) => {
  await page.goto('/');

  const compactWrap = page.locator('.compact-search-wrap');
  const compactSearch = page.locator('#compact-search');

  await expect(page.locator('body')).not.toHaveClass(/compact-mode/);
  await expect(compactWrap).toHaveAttribute('aria-hidden', 'true');
  await expect(compactSearch).toHaveAttribute('tabindex', '-1');

  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(page.locator('body')).toHaveClass(/compact-mode/);
  await expect(compactWrap).toHaveAttribute('aria-hidden', 'false');
  await expect(compactSearch).toHaveAttribute('tabindex', '0');

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('body')).not.toHaveClass(/compact-mode/);
  await expect(compactWrap).toHaveAttribute('aria-hidden', 'true');
  await expect(compactSearch).toHaveAttribute('tabindex', '-1');
});


test('active search preserves relevance order and suspends manual sorting', async ({ page }) => {
  await page.goto('/');

  const search = page.locator('#search');
  const added = page.locator('#sort-added-button');
  const clicks = page.locator('#sort-clicks-button');

  await search.fill('UI Skills');

  await expect(page.locator('.card').first().locator('.name')).toHaveText('UI Skills');
  await expect(page.locator('#resource-search-status')).toContainText('依相關性排序');
  await expect(added).toBeDisabled();
  await expect(clicks).toBeDisabled();

  await search.fill('');

  await expect(added).toBeEnabled();
  await expect(clicks).toBeEnabled();
  await expect(page.locator('#resource-search-status')).not.toContainText('依相關性排序');
});


test('Create360 verified source metadata participates in discovery', async ({ page }) => {
  await page.goto('/');
  const search = page.locator('#search');

  await search.fill('WebMCP');
  await expect(page.locator('.card', { hasText: 'Create360.ai' })).toHaveCount(1);

  await search.fill('888-url2md');
  await expect(page.locator('.card', { hasText: 'Create360.ai' })).toHaveCount(1);
});

test('Taiwan virtual-currency wording discovers crypto resources', async ({ page }) => {
  await page.goto('/');

  const search = page.locator('#search');
  await search.fill('虛擬貨幣');

  await expect(page.locator('.card')).not.toHaveCount(0);
  await expect(page.locator('.card', { hasText: 'TradingAgents' })).toHaveCount(1);
});


test('security acronyms do not match inside unrelated words', async ({ page }) => {
  await page.goto('/');

  const search = page.locator('#search');
  await search.fill('SAST');

  await expect(page.locator('.card').first().locator('.name')).toHaveText('Hermes Snyk Plugin');
  await expect(page.locator('.card', { hasText: 'ABYSSAL — Natural Disasters' })).toHaveCount(0);
});



test('common Taiwan search intents discover existing catalog resources', async ({ page }) => {
  await page.goto('/');

  const search = page.locator('#search');

  await search.fill('流程圖');
  await expect(page.locator('.card', { hasText: 'Archify' })).toHaveCount(1);

  await search.fill('網頁設計');
  await expect(page.locator('.card', { hasText: 'GetLayers' })).toHaveCount(1);

  await search.fill('代理人');
  await expect(page.locator('.card', { hasText: 'Agent-Native' })).toHaveCount(1);

  await search.fill('智能體');
  await expect(page.locator('.card', { hasText: 'Agent-Native' })).toHaveCount(1);
});


test('natural Traditional Chinese search phrases are tokenized by intent', async ({ page }) => {
  await page.goto('/');

  const search = page.locator('#search');
  const cases = [
    ['我要做流程圖', 'Archify'],
    ['幫我找流程圖工具', 'Archify'],
    ['我想做網頁設計', 'GetLayers'],
    ['找 AI 代理人工具', 'Agent-Native'],
    ['有沒有智能體資源', 'Agent-Native'],
    ['免費網頁設計資源', 'GetLayers'],
    ['我想找虛擬貨幣交易工具', 'TradingAgents'],
    ['幫我找資安掃描工具', 'Hermes Snyk Plugin'],
    ['我要做簡報', 'NESA-SLIDE'],
    ['找免費語音工具', 'ElevenLabs']
  ];

  for (const [query, expectedResource] of cases) {
    await search.fill(query);
    await expect(page.locator('.card', { hasText: expectedResource })).toHaveCount(1);
  }
});
