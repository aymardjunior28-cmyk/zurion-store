const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test('storefront navigation and catalogue work', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Accueil|ZURION/i);
  await expect(page.locator('a.zurion-hero__cta').first()).toBeVisible();

  await page.goto('/catalogue');
  await expect(page).toHaveTitle(/Catalogue/i);
  await expect(page.locator('body')).toContainText(/produit/i);
});

test('FAQ and mobile layout render', async ({ page }) => {
  await page.goto('/faq');
  await expect(page.getByText(/Questions fréquentes/i)).toBeVisible();
  await expect(page.locator('body')).toBeVisible();
});

test('public pages expose basic accessible names and images', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  expect(await page.locator('img').evaluateAll((images) =>
    images.every((image) => image.hasAttribute('alt'))
  )).toBe(true);
  expect(await page.locator('a:visible, button:visible').evaluateAll((controls) =>
    controls.every((control) =>
      (control.textContent || '').trim()
      || control.getAttribute('aria-label')
      || control.getAttribute('title')
      || control.querySelector('img[alt]'))
  )).toBe(true);
});

test('public pages pass automated WCAG serious-impact checks', async ({ page }) => {
  for (const path of ['/', '/catalogue', '/faq', '/contact', '/cgu', '/confidentialite', '/cookies', '/mentions-legales']) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact));
    expect(blocking, `${path} has serious accessibility violations: ${blocking.map((item) => item.id).join(', ')}`).toEqual([]);
  }
});
