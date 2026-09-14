const { test, expect } = require('@playwright/test');

async function getCsrfFromContext(page) {
  const cookies = await page.context().cookies();
  const csrfCookie = cookies.find((c) => c.name === 'zurion_csrf');
  return csrfCookie ? csrfCookie.value : null;
}

test('admin can clear the order history from the dashboard', async ({ page }) => {
  const request = page.request; // partage les cookies avec le contexte de la page

  // Amorce le cookie CSRF via une première visite
  await page.goto('/');
  const csrf = await getCsrfFromContext(page);
  expect(csrf, 'A CSRF cookie must be set').toBeTruthy();

  // Créer une commande via l'API (client invité)
  const products = await (await request.get('/api/products?limit=50')).json();
  const product = products.products.find((p) => p.stock >= 1);
  const cartToken = 'pw-' + Date.now();
  await request.post('/api/cart/items', {
    headers: { 'X-Cart-Token': cartToken, 'X-CSRF-Token': csrf },
    data: { productId: product.id, quantity: 1 },
  });
  const orderRes = await request.post('/api/orders', {
    headers: { 'X-Cart-Token': cartToken, 'X-CSRF-Token': csrf },
    data: {
      paymentMethod: 'Paiement à la livraison',
      deliveryMode: 'standard',
      address: { fullName: 'PW History', phone: '0600000000', line1: 'Rue pw', city: 'Douala', region: 'Littoral' },
    },
  });
  expect(orderRes.status()).toBe(201);
  const reference = (await orderRes.json()).reference;

  // Login admin (superadmin seedé) — même cookie CSRF partagé avec le contexte
  const loginRes = await request.post('/api/auth/login', {
    headers: { 'X-CSRF-Token': csrf },
    data: { email: 'admin@zurion.store', password: 'Admin1234!' },
  });
  expect(loginRes.status()).toBe(200);

  // Avancer la commande jusqu'à « terminée »
  const ordersList = await (await request.get('/api/admin/orders')).json();
  const order = ordersList.orders.find((o) => o.reference === reference);
  const statuses = ['paiement_confirmé', 'préparation', 'expédition', 'livraison', 'terminée'];
  for (const status of statuses) {
    const r = await request.patch(`/api/admin/orders/${order.id}/status`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { status },
    });
    expect(r.status()).toBe(200);
  }

  // Navigue dans l'onglet Commandes du dashboard
  await page.goto('/admin?tab=orders');
  const ordersPanel = page.locator('[data-tab="orders"]');
  await expect(ordersPanel.getByText(reference).first()).toBeVisible();
  await expect(ordersPanel.getByText('Terminée').first()).toBeVisible();

  // Clique « Effacer l'historique » et accepte la confirmation native
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    await dialog.accept();
  });
  await page.getByRole('button', { name: /Effacer l'historique/ }).click();
  await page.waitForURL(/tab=orders/);

  // Le retour visuel confirme l'effacement
  await expect(page.getByText(/commande\(s\) d'historique effacée/)).toBeVisible();

  // La commande terminée doit avoir disparu (commande + livraison supprimées)
  await page.reload();
  await expect(page.locator('[data-tab="orders"]').getByText(reference)).toHaveCount(0);
  const after = await (await request.get('/api/admin/orders')).json();
  expect(after.orders.some((o) => o.reference === reference)).toBe(false);
});