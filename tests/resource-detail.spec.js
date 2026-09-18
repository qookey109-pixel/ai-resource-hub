const { test, expect } = require('@playwright/test');

test('card hit target opens detail and Escape closes through history', async ({ page }) => {
  await page.goto('/');

  const defaultTitle = await page.title();
  const card = page.locator('.card').first();
  const resourceName = await card.locator('.name').textContent();
  const hitTarget = card.locator('.card-detail-hit');
  await expect(hitTarget).toBeVisible();
  await expect(hitTarget).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(hitTarget).toHaveAttribute('aria-controls', 'resource-detail-dialog');

  await hitTarget.click();

  const dialog = page.locator('#resource-detail-dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/resource=/);
  await expect(page).toHaveTitle(`${resourceName} — Qookey AI Resource Hub`);
  await expect(hitTarget).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/resource=/);
  await expect(page).toHaveTitle(defaultTitle);
  await expect(hitTarget).toHaveAttribute('aria-expanded', 'false');
});

test('opening a detail card increments the shared click counter once', async ({ page }) => {
  let detailPosts = 0;

  await page.route('**/api/resource-clicks', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, counts: {} })
      });
      return;
    }

    if (request.method() === 'POST') {
      detailPosts += 1;
      const body = request.postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, resource_id: body.resource_id, count: detailPosts })
      });
      return;
    }

    await route.continue();
  });

  await page.goto('/');
  await expect(page.locator('.resource-click-count').first()).toBeVisible();

  await page.locator('.card-detail-hit').first().click();
  await expect(page.locator('#resource-detail-dialog')).toBeVisible();
  await expect.poll(() => detailPosts).toBe(1);
});

test('external open and favorite controls do not open the detail dialog', async ({ page }) => {
  await page.goto('/');

  const card = page.locator('.card').first();
  const dialog = page.locator('#resource-detail-dialog');
  const visit = card.locator('.visit');

  await visit.evaluate((element) => {
    element.addEventListener('click', (event) => event.preventDefault(), { once: true });
  });
  await visit.click();
  await expect(dialog).toBeHidden();

  const favorite = card.locator('.favorite-button');
  await expect(favorite).toBeVisible();
  await favorite.click();
  await expect(dialog).toBeHidden();
});

test('direct Archify detail URL opens and browser back closes it', async ({ page }) => {
  await page.goto('/?resource=tt-a1i-archify');

  const dialog = page.locator('#resource-detail-dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveTitle('Archify — Qookey AI Resource Hub');
  await expect(page.locator('#resource-detail-title')).toContainText('Archify');
  await expect(page.locator('.resource-detail-links')).toContainText('Project Page');

  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/resource=/);
});

test('share action exposes a resource-specific URL', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');

  await page.locator('.card-detail-hit').first().click();
  const currentUrl = page.url();
  expect(currentUrl).toContain('resource=');

  const share = page.locator('.resource-detail-share');
  await share.click();
  await expect(share).toContainText('已複製');

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toBe(currentUrl);
});


test('deprecated status is localized in resource detail', async ({ page }) => {
  const catalog = require('../data/resources.json');
  const fixture = JSON.parse(JSON.stringify(catalog));
  const resource = fixture.resources[0];
  resource.status = 'deprecated';

  await page.route('**/data/resources.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture)
    });
  });

  await page.goto('/?resource=' + encodeURIComponent(resource.id));
  await expect(page.locator('#resource-detail-dialog')).toBeVisible();
  await expect(page.locator('.resource-detail-facts')).toContainText('已棄用');
});


test('detail dialog exposes its summary and keeps global search shortcut inactive', async ({ page }) => {
  await page.goto('/');

  await page.locator('.card-detail-hit').first().click();

  const dialog = page.locator('#resource-detail-dialog');
  const close = page.locator('.resource-detail-close');
  await expect(dialog).toHaveAttribute('aria-describedby', 'resource-detail-summary');
  await expect(page.locator('#resource-detail-summary')).not.toBeEmpty();
  await expect(close).toBeFocused();

  await page.keyboard.press('/');
  await expect(close).toBeFocused();
  await expect(page.locator('#search')).not.toBeFocused();
  await expect(dialog).toBeVisible();
});
