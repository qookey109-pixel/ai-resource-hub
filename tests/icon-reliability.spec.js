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


test('verified official app icons are used on cards and detail', async ({ page }) => {
  const fixtures = [
    {
      query: 'Flowsint',
      name: 'Flowsint',
      src: 'https://raw.githubusercontent.com/reconurge/flowsint/main/flowsint-app/public/icon.png'
    },
    {
      query: 'Fincept Terminal',
      name: 'Fincept Terminal',
      src: 'https://raw.githubusercontent.com/Fincept-Corporation/FinceptTerminal/main/fincept-qt/resources/in.fincept.FinceptTerminal.png'
    }
  ];

  for (const fixture of fixtures) {
    await page.goto('/');
    await page.locator('#search').fill(fixture.query);

    const card = page.locator('.card', { hasText: fixture.name }).first();
    await expect(card.locator('.resource-icon img')).toHaveAttribute('src', fixture.src);

    await card.locator('.card-detail-hit').click();
    await expect(page.locator('.resource-detail-icon img')).toHaveAttribute('src', fixture.src);
  }
});


test('lightweight official brand icons are used for OneWorks and Agent-Native', async ({ page }) => {
  const fixtures = [
    {
      query: 'OneWorks Avatar',
      name: 'OneWorks Avatar',
      src: 'https://raw.githubusercontent.com/oneworks-ai/avatar/main/public/favicon.svg'
    },
    {
      query: 'Agent-Native',
      name: 'Agent-Native',
      src: 'https://raw.githubusercontent.com/BuilderIO/agent-native/main/packages/core/src/assets/branding/icon-on-light.svg'
    }
  ];

  for (const fixture of fixtures) {
    await page.goto('/');
    await page.locator('#search').fill(fixture.query);

    const card = page.locator('.card', { hasText: fixture.name }).first();
    await expect(card.locator('.resource-icon img')).toHaveAttribute('src', fixture.src);

    await card.locator('.card-detail-hit').click();
    await expect(page.locator('.resource-detail-icon img')).toHaveAttribute('src', fixture.src);
  }
});
