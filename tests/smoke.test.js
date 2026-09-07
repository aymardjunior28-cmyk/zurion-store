'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { connectDatabase, sequelize } = require('../src/config/db');
const { Courier, Category, Coupon, Product, Order, Livraison } = require('../src/models');
const catalogService = require('../src/services/catalog.service');

/** Extrait la valeur du cookie CSRF d'une réponse (pattern double-soumission). */
function csrfTokenFrom(res) {
  const raw = (res.headers['set-cookie'] || []).find((c) => c.startsWith('zurion_csrf='));
  return raw ? decodeURIComponent(raw.split(';')[0].split('=').slice(1).join('=')) : null;
}

function csrfTokenFromHtml(html) {
  const match = html.match(/name="?_csrf"? value="([^"]+)"/);
  return match ? match[1] : null;
}

test.before(async () => {
  await connectDatabase();
});

test.after(async () => {
  await sequelize.close();
});

test('GET /health returns service status', async () => {
  const res = await request(app).get('/health');

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.service, 'zurion');
});

test('authentication protects private endpoints', async () => {
  const unauthenticated = await request(app).get('/api/auth/me');
  assert.equal(unauthenticated.status, 401);

  const api = request.agent(app);
  const pre = await api.get('/api/health');
  const csrfToken = csrfTokenFrom(pre);
  assert.ok(csrfToken, 'A CSRF cookie must be issued');

  const admin = await api
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'admin@zurion.store', password: 'Admin1234!' });
  assert.equal(admin.status, 200);
  assert.equal(admin.body.user.role, 'admin');
  assert.ok((admin.headers['set-cookie'] || []).some((cookie) => cookie.startsWith('zurion_token=')));

  const me = await api.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'admin@zurion.store');
});

test('GET / returns the storefront homepage', async () => {
  const res = await request(app).get('/');

  assert.equal(res.status, 200);
  assert.match(res.text, /ZURION|Accueil|Catalogue/i);
});

test('GET /api/products returns product list data', async () => {
  const res = await request(app).get('/api/products?limit=50');

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.products));
  assert.ok(res.body.products.length > 0);
});

test('catalogue price filter and authenticated product reviews work', async () => {
  const filtered = await catalogService.listProducts({ max: 5000, limit: 48 });
  assert.ok(filtered.products.every((product) => Number(product.price) <= 5000));

  const admin = request.agent(app);
  const pre = await admin.get('/api/health');
  const csrfToken = csrfTokenFrom(pre);
  const login = await admin
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'admin@zurion.store', password: 'Admin1234!' });
  assert.equal(login.status, 200);
  const categoryId = (await admin.get('/api/categories')).body.categories[0].id;

  const created = await admin
    .post('/api/admin/products')
    .set('X-CSRF-Token', csrfToken)
    .send({ name: `Review Product ${Date.now()}`, price: 1800, stock: 2, categoryId });
  assert.equal(created.status, 201);
  const product = created.body.product;
  const productPage = await admin.get(`/produit/${product.slug}`);
  const formToken = csrfTokenFromHtml(productPage.text);
  const review = await admin
    .post(`/produit/${product.slug}/avis`)
    .type('form')
    .send({ _csrf: formToken, rating: '5', comment: 'Avis de test authentifié' });
  assert.equal(review.status, 302);
  const reviewedPage = await admin.get(`/produit/${product.slug}`);
  assert.match(reviewedPage.text, /Avis de test authentifié/);

  const deleted = await admin
    .delete(`/api/admin/products/${product.id}`)
    .set('X-CSRF-Token', csrfToken);
  assert.equal(deleted.status, 200);
});

test('cart flow can add an item and create an order', async () => {
  // Un agent conserve les cookies entre requêtes (dont le cookie CSRF).
  const api = request.agent(app);
  const pre = await api.get('/api/health');
  const csrfToken = csrfTokenFrom(pre);
  assert.ok(csrfToken, 'A CSRF cookie must be issued');

  const productRes = await api.get('/api/products?limit=50');
  assert.equal(productRes.status, 200);

  const product = productRes.body.products.find((item) => item.stock >= 2);
  assert.ok(product && product.id, 'A product is required for the cart/order flow');

  const cartToken = 'flow-' + Date.now();
  const addRes = await api
    .post('/api/cart/items')
    .set('X-Cart-Token', cartToken)
    .set('X-CSRF-Token', csrfToken)
    .send({ productId: product.id, quantity: 2 });

  assert.equal(addRes.status, 201);
  assert.equal(addRes.body.count, 2);
  assert.ok(addRes.body.items.some((item) => item.productId === product.id));

  const orderRes = await api
    .post('/api/orders')
    .set('X-Cart-Token', cartToken)
    .set('X-CSRF-Token', csrfToken)
    .send({
      paymentMethod: 'Paiement à la livraison',
      deliveryMode: 'standard',
      address: {
        fullName: 'Test Client',
        phone: '0123456789',
        line1: 'Rue de test',
        city: 'Yaoundé',
        region: 'Centre',
      },
    });

  assert.equal(orderRes.status, 201);
  assert.ok(orderRes.body.reference, 'The order should return a reference');
  assert.equal(orderRes.body.status, 'créée');
});

test('FAQ page and product image endpoint are available', async () => {
  const faq = await request(app).get('/faq');
  assert.equal(faq.status, 200);
  assert.match(faq.text, /Questions fréquentes/i);

  const products = await request(app).get('/api/products?limit=50');
  const product = products.body.products.find((item) => item.image);
  assert.ok(product, 'A product with an image is required');

  const images = await request(app).get(`/api/product-images?slug=${encodeURIComponent(product.slug)}`);
  assert.equal(images.status, 200);
  assert.equal(images.body.slug, product.slug);
  assert.ok(Array.isArray(images.body.images));
  assert.ok(images.body.images.length > 0);
});

test('admin SSR courier management supports create, update and delete', async () => {
  const admin = request.agent(app);
  const pre = await admin.get('/api/health');
  const csrfToken = csrfTokenFrom(pre);
  const login = await admin
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'admin@zurion.store', password: 'Admin1234!' });
  assert.equal(login.status, 200);

  const page = await admin.get('/admin?tab=couriers');
  assert.equal(page.status, 200);
  const formToken = csrfTokenFromHtml(page.text);
  assert.ok(formToken);

  const name = `Test Courier ${Date.now()}`;
  const created = await admin
    .post('/admin/livreurs')
    .type('form')
    .send({ _csrf: formToken, name, phone: '+237 690000000' });
  assert.equal(created.status, 302);
  assert.equal(created.headers.location, '/admin?tab=couriers');

  const afterCreate = await admin.get('/admin?tab=couriers');
  assert.match(afterCreate.text, new RegExp(name));
  const createdCourier = await Courier.findOne({ where: { name } });
  assert.ok(createdCourier, 'The created courier must be persisted');
  const courierId = createdCourier.id;

  const updated = await admin
    .post(`/admin/livreurs/${courierId}`)
    .type('form')
    .send({
      _csrf: csrfTokenFromHtml(afterCreate.text),
      name: `${name} Updated`,
      phone: '+237 691111111',
      active: 'on',
    });
  assert.equal(updated.status, 302);

  const afterUpdate = await admin.get('/admin?tab=couriers');
  assert.match(afterUpdate.text, new RegExp(`${name} Updated`));
  const deleted = await admin
    .post(`/admin/livreurs/${courierId}/supprimer`)
    .type('form')
    .send({ _csrf: csrfTokenFromHtml(afterUpdate.text) });
  assert.equal(deleted.status, 302);

  const afterDelete = await admin.get('/admin?tab=couriers');
  assert.doesNotMatch(afterDelete.text, new RegExp(`${name} Updated`));
});

test('admin SSR panels and direct management pages are reachable', async () => {
  const admin = request.agent(app);
  const pre = await admin.get('/api/health');
  const csrfToken = csrfTokenFrom(pre);
  const login = await admin
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'admin@zurion.store', password: 'Admin1234!' });
  assert.equal(login.status, 200);

  for (const path of ['/admin', '/admin/commandes', '/admin/codes-promo', '/admin/livraisons', '/admin/livreurs']) {
    const page = await admin.get(path);
    assert.equal(page.status, 200, `${path} should render successfully`);
  }

  for (const path of ['/admin/produits', '/admin/categories', '/admin/utilisateurs']) {
    const page = await admin.get(path);
    assert.equal(page.status, 302, `${path} should redirect to its dashboard tab`);
  }
});

test('admin SSR category and coupon management supports create, update, toggle and delete', async () => {
  const admin = request.agent(app);
  const pre = await admin.get('/api/health');
  const csrfToken = csrfTokenFrom(pre);
  const login = await admin
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'admin@zurion.store', password: 'Admin1234!' });
  assert.equal(login.status, 200);

  const categoryName = `SSR Category ${Date.now()}`;
  const categoryToken = csrfTokenFromHtml((await admin.get('/admin?tab=categories')).text);
  const categoryCreated = await admin
    .post('/admin/categories')
    .type('form')
    .send({ _csrf: categoryToken, name: categoryName, description: 'SSR test', sortOrder: '1', active: 'on' });
  assert.equal(categoryCreated.status, 302);
  const category = await Category.findOne({ where: { name: categoryName } });
  assert.ok(category);

  const categoryUpdated = await admin
    .post(`/admin/categories/${category.id}`)
    .type('form')
    .send({ _csrf: csrfTokenFromHtml((await admin.get('/admin?tab=categories')).text), name: `${categoryName} Updated`, sortOrder: '2', active: 'on' });
  assert.equal(categoryUpdated.status, 302);
  await category.reload();
  assert.equal(category.name, `${categoryName} Updated`);
  const categoryDeleted = await admin
    .post(`/admin/categories/${category.id}/supprimer`)
    .type('form')
    .send({ _csrf: csrfTokenFromHtml((await admin.get('/admin?tab=categories')).text) });
  assert.equal(categoryDeleted.status, 302);
  assert.equal(await Category.count({ where: { id: category.id } }), 0);

  const couponCode = `SSR${Date.now()}`.slice(0, 12);
  const couponToken = csrfTokenFromHtml((await admin.get('/admin/codes-promo')).text);
  const couponCreated = await admin
    .post('/admin/codes-promo')
    .type('form')
    .send({ _csrf: couponToken, code: couponCode, type: 'percent', value: '10', active: 'on' });
  assert.equal(couponCreated.status, 302);
  const coupon = await Coupon.findOne({ where: { code: couponCode } });
  assert.ok(coupon);
  const couponToggled = await admin
    .post(`/admin/codes-promo/${coupon.id}/toggle`)
    .type('form')
    .send({ _csrf: csrfTokenFromHtml((await admin.get('/admin/codes-promo')).text) });
  assert.equal(couponToggled.status, 302);
  await coupon.reload();
  assert.equal(coupon.active, false);
  const couponDeleted = await admin
    .post(`/admin/codes-promo/${coupon.id}/supprimer`)
    .type('form')
    .send({ _csrf: csrfTokenFromHtml((await admin.get('/admin/codes-promo')).text) });
  assert.equal(couponDeleted.status, 302);
  assert.equal(await Coupon.count({ where: { id: coupon.id } }), 0);
});

test('admin SSR product and delivery workflows support create, update and shipment', async () => {
  const admin = request.agent(app);
  const pre = await admin.get('/api/health');
  const csrfToken = csrfTokenFrom(pre);
  const login = await admin
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'admin@zurion.store', password: 'Admin1234!' });
  assert.equal(login.status, 200);

  const productsPage = await admin.get('/admin?tab=products');
  const productToken = csrfTokenFromHtml(productsPage.text);
  const name = `SSR Product ${Date.now()}`;
  const created = await admin
    .post('/admin/produits')
    .type('form')
    .send({
      _csrf: productToken,
      name,
      price: '2400',
      oldPrice: '3000',
      stock: '4',
      description: 'Produit SSR de test',
      active: 'on',
    });
  assert.equal(created.status, 302);
  const product = await Product.findOne({ where: { name } });
  assert.ok(product);

  const editPage = await admin.get(`/admin/produits/${product.id}`);
  assert.equal(editPage.status, 200);
  const updated = await admin
    .post(`/admin/produits/${product.id}`)
    .type('form')
    .send({
      _csrf: csrfTokenFromHtml(editPage.text),
      name: `${name} Updated`,
      price: '2600',
      stock: '3',
      specs: 'Couleur: Bleu',
      active: 'on',
    });
  assert.equal(updated.status, 302);
  await product.reload();
  assert.equal(product.name, `${name} Updated`);
  assert.equal(product.price, 2600);

  const customer = request.agent(app);
  const customerPre = await customer.get('/api/health');
  const customerCsrf = csrfTokenFrom(customerPre);
  const available = (await customer.get('/api/products?limit=50')).body.products.find((item) => item.stock >= 1);
  assert.ok(available);
  const cartToken = `ssr-delivery-${Date.now()}`;
  const added = await customer
    .post('/api/cart/items')
    .set('X-Cart-Token', cartToken)
    .set('X-CSRF-Token', customerCsrf)
    .send({ productId: available.id, quantity: 1 });
  assert.equal(added.status, 201);
  const orderRes = await customer
    .post('/api/orders')
    .set('X-Cart-Token', cartToken)
    .set('X-CSRF-Token', customerCsrf)
    .send({
      paymentMethod: 'Paiement à la livraison',
      deliveryMode: 'standard',
      address: { fullName: 'SSR Delivery', phone: '0123456789', line1: 'Rue SSR', city: 'Yaoundé', region: 'Centre' },
    });
  assert.equal(orderRes.status, 201);
  const order = await Order.findOne({ where: { reference: orderRes.body.reference } });

  for (let i = 0; i < 4 && order.status !== 'expédition'; i += 1) {
    const ordersPage = await admin.get('/admin/commandes');
    const statusRes = await admin
      .post(`/admin/commandes/${order.reference}/statut`)
      .type('form')
      .send({ _csrf: csrfTokenFromHtml(ordersPage.text) });
    assert.equal(statusRes.status, 302);
    await order.reload();
  }
  assert.equal(order.status, 'expédition');
  const delivery = await Livraison.findOne({ where: { orderId: order.id } });
  assert.ok(delivery, 'A delivery must be created when the order is shipped');
  const deliveriesPage = await admin.get('/admin/livraisons');
  assert.equal(deliveriesPage.status, 200);
  const ordersPage = await admin.get('/admin/commandes');
  assert.match(ordersPage.text, /SSR Delivery/);
  assert.match(ordersPage.text, /0123456789/);

  const deleted = await admin
    .post(`/admin/produits/${product.id}/supprimer`)
    .type('form')
    .send({ _csrf: csrfTokenFromHtml(await admin.get('/admin?tab=products').then((res) => res.text)) });
  assert.equal(deleted.status, 302);
  assert.equal(await Product.count({ where: { id: product.id } }), 0);
});

test('legal pages are reachable and linked from the footer', async () => {
  const home = await request(app).get('/');
  assert.equal(home.status, 200);
  for (const path of ['/cgu', '/confidentialite', '/cookies', '/mentions-legales']) {
    const page = await request(app).get(path);
    assert.equal(page.status, 200, `${path} should render successfully`);
  }
  assert.match(home.text, /confidentialite|cookies|mentions-legales/i);
});

test('private admin API rejects unauthenticated access', async () => {
  const response = await request(app).get('/api/admin/products');
  assert.equal(response.status, 401);
});

test('admin API covers product, category, coupon, order and delivery management', async () => {
  const admin = request.agent(app);
  const pre = await admin.get('/api/health');
  const csrfToken = csrfTokenFrom(pre);
  const login = await admin
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'admin@zurion.store', password: 'Admin1234!' });
  assert.equal(login.status, 200);

  const categories = await admin.get('/api/categories');
  const categoryId = categories.body.categories?.[0]?.id;
  assert.ok(categoryId, 'An existing category is required');

  const suffix = Date.now();
  const createdCategory = await admin
    .post('/api/admin/categories')
    .set('X-CSRF-Token', csrfToken)
    .send({ name: `Test Category ${suffix}`, active: true });
  assert.equal(createdCategory.status, 201);
  const newCategoryId = createdCategory.body.category.id;

  const createdProduct = await admin
    .post('/api/admin/products')
    .set('X-CSRF-Token', csrfToken)
    .send({ name: `Test Product ${suffix}`, price: 1234, stock: 5, categoryId });
  assert.equal(createdProduct.status, 201);
  const productId = createdProduct.body.product.id;

  const updatedProduct = await admin
    .put(`/api/admin/products/${productId}`)
    .set('X-CSRF-Token', csrfToken)
    .send({ price: 1500, stock: 7 });
  assert.equal(updatedProduct.status, 200);
  assert.equal(updatedProduct.body.product.price, 1500);

  const createdCoupon = await admin
    .post('/api/admin/coupons')
    .set('X-CSRF-Token', csrfToken)
    .send({ code: `TEST${suffix}`, type: 'fixed', value: 100 });
  assert.equal(createdCoupon.status, 201);
  const couponId = createdCoupon.body.coupon.id;
  const toggledCoupon = await admin
    .patch(`/api/admin/coupons/${couponId}/toggle`)
    .set('X-CSRF-Token', csrfToken)
    .send({});
  assert.equal(toggledCoupon.status, 200);

  const orders = await admin.get('/api/admin/orders');
  assert.equal(orders.status, 200);
  assert.ok(Array.isArray(orders.body.orders));
  const deliveries = await admin.get('/api/admin/livraisons');
  assert.equal(deliveries.status, 200);
  assert.ok(Array.isArray(deliveries.body.livraisons));

  const deletedCoupon = await admin
    .delete(`/api/admin/coupons/${couponId}`)
    .set('X-CSRF-Token', csrfToken);
  assert.equal(deletedCoupon.status, 200);
  const deletedProduct = await admin
    .delete(`/api/admin/products/${productId}`)
    .set('X-CSRF-Token', csrfToken);
  assert.equal(deletedProduct.status, 200);
  const deletedCategory = await admin
    .delete(`/api/admin/categories/${newCategoryId}`)
    .set('X-CSRF-Token', csrfToken);
  assert.equal(deletedCategory.status, 200);
});
