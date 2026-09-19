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


test('search result changes are announced through a live status', async ({ page, request }) => {
  await page.goto('/');

  const search = page.locator('#search');
  const status = page.locator('#resource-search-status');

  const catalogResponse = await request.get('/data/resources.json');
  expect(catalogResponse.ok()).toBeTruthy();
  const catalog = await catalogResponse.json();
  const expectedResourceCount = Array.isArray(catalog.resources) ? catalog.resources.length : 0;
  expect(expectedResourceCount).toBeGreaterThan(0);

  await expect(status).toContainText(`目前顯示 ${expectedResourceCount} 個資源`);

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


test('real-world Traditional Chinese search QA corpus keeps relevant resources discoverable', async ({ page }) => {
  await page.goto('/');

  const search = page.locator('#search');
  const cases = [
    ['有沒有免費做簡報的 AI', 'NESA-SLIDE'],
    ['我想找可以做圖表的工具', 'Lieflat Charts'],
    ['幫我做流程圖', 'Archify'],
    ['找可以畫架構圖的工具', 'Archify'],
    ['想找網頁設計靈感', 'Curated'],
    ['有沒有 UI 設計參考網站', 'Refero Styles'],
    ['我要做網站動畫', 'Anime.js'],
    ['找 Three.js 3D 元件', 'ThreeUI Community'],
    ['有沒有 AI 生成 3D 模型', 'Meshy AI'],
    ['想做虛擬人物 avatar', 'OneWorks Avatar'],
    ['找免費音樂素材', 'SoundShockAudio'],
    ['有沒有 AI 語音生成工具', 'ElevenLabs'],
    ['我想做文字轉語音', 'ElevenLabs'],
    ['找影片剪輯工具', 'OpenMontage'],
    ['想自動產生短影片', 'MoneyPrinterTurbo'],
    ['有沒有 AI 短劇編劇', 'AI 短劇編劇'],
    ['找虛擬貨幣交易研究工具', 'TradingAgents'],
    ['有沒有 AI 交易代理人', 'TradingAgents'],
    ['想看金融市場終端', 'Fincept Terminal'],
    ['找世界市場監控工具', 'World Monitor'],
    ['幫我找 SAST 掃描', 'Hermes Snyk Plugin'],
    ['找程式碼安全審計工具', 'Cloudflare Security Audit Skill'],
    ['有沒有逆向工程工具', 'reverse-skill'],
    ['找供應鏈安全掃描', 'Hermes Snyk Plugin'],
    ['我要部署到雲端', 'Oracle Cloud Free Tier'],
    ['找免費雲端主機', 'Oracle Cloud Free Tier'],
    ['有沒有資料庫後端平台', 'Supabase Dashboard'],
    ['找 API 整合工具', 'Nango'],
    ['我想做 SEO 分析', 'Open SEO Advisor'],
    ['找網站抓取工具', 'Create360.ai'],
    ['有沒有網頁轉 Markdown', 'Create360.ai'],
    ['想找資料擷取工具', 'Create360.ai'],
    ['找 MCP 記憶工具', 'Codebase Memory MCP'],
    ['有沒有 agent memory', 'Codebase Memory MCP'],
    ['找 agent telemetry', 'Hermes Telemetry'],
    ['找歷史時間點搜尋工具', 'Hermes BackSearch Plugin'],
    ['有沒有 agent skills 清單', 'Awesome Agent Skills'],
    ['想找法律 agent skills', 'Legal Skills (Open)'],
    ['找自動化 email agent', 'Agentic Inbox'],
    ['想做 shader 特效', 'MetalForge'],
    ['找像素畫轉換工具', 'PixelArtBase'],
    ['有沒有產品設計案例', 'Curated'],
    ['找 UI 動畫元件', 'React Bits — Shape Grid'],
    ['找 MCP server 目錄', 'MCP.so'],
    ['找 GitHub MCP', 'GitHub MCP Server'],
    ['找瀏覽器自動化 MCP', 'Playwright MCP'],
    ['找最新程式庫文件 MCP', 'Context7'],
    ['找 Stripe MCP', 'Stripe AI / MCP']
  ];

  for (const [query, expectedResource] of cases) {
    await test.step(`search: ${query} -> ${expectedResource}`, async () => {
      await search.fill(query);
      await expect(page.locator('.card', { hasText: expectedResource })).toHaveCount(1);
    });
  }
});


test('broad synonym expansion does not swamp high-confidence search intents', async ({ page }) => {
  await page.goto('/');

  const search = page.locator('#search');

  await search.fill('流程圖');
  await expect(page.locator('.card', { hasText: 'Archify' })).toHaveCount(1);
  await expect(page.locator('.card', { hasText: 'Agency Agents' })).toHaveCount(0);

  await search.fill('3D');
  await expect(page.locator('.card', { hasText: 'Meshy AI' })).toHaveCount(1);
  await expect(page.locator('.card', { hasText: 'FreeLLMAPI' })).toHaveCount(0);

  await search.fill('MCP');
  await expect(page.locator('.card', { hasText: 'Codebase Memory MCP' })).toHaveCount(1);
  await expect(page.locator('.card', { hasText: 'AI 短劇編劇' })).toHaveCount(0);

  await search.fill('逆向');
  await expect(page.locator('.card').first().locator('.name')).toHaveText('reverse-skill');
});
