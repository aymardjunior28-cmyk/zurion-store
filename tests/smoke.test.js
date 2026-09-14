'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../back/src/app');
const { connectDatabase, sequelize } = require('../back/src/config/db');
const {
  User,
  Address,
  Review,
  Wishlist,
  Cart,
  ContactMessage,
  Order,
  OrderItem,
  Courier,
  Category,
  Coupon,
  Product,
  Livraison,
} = require('../back/src/models');
const catalogService = require('../back/src/services/catalog.service');

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
  assert.equal(admin.body.user.role, 'superadmin');
  assert.ok((admin.headers['set-cookie'] || []).some((cookie) => cookie.startsWith('zurion_token=')));

  const me = await api.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'admin@zurion.store');
});

test('superadmin creates a limited admin account', async () => {
  const superAdmin = request.agent(app);
  const pre = await superAdmin.get('/api/health');
  const csrfToken = csrfTokenFrom(pre);
  const login = await superAdmin
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'admin@zurion.store', password: 'Admin1234!' });
  assert.equal(login.status, 200);

  const email = `limited-admin-${Date.now()}@example.test`;
  const created = await superAdmin
    .post('/api/admin/admins')
    .set('X-CSRF-Token', csrfToken)
    .send({ firstName: 'Gestion', lastName: 'Produits', email, password: 'AdminTest123!' });
  assert.equal(created.status, 201);
  assert.equal(created.body.user.role, 'admin');

  const limited = request.agent(app);
  const limitedPre = await limited.get('/api/health');
  const limitedCsrf = csrfTokenFrom(limitedPre);
  const limitedLogin = await limited
    .post('/api/auth/login')
    .set('X-CSRF-Token', limitedCsrf)
    .send({ email, password: 'AdminTest123!' });
  assert.equal(limitedLogin.status, 200);
  // Le compte admin limité gère la marchandise et les codes promo (API).
  assert.equal((await limited.get('/api/admin/products')).status, 200);
  assert.equal((await limited.get('/api/admin/coupons')).status, 200);
  // Les sections financières et la gestion des comptes restent au super-admin.
  assert.equal((await limited.get('/api/admin/users')).status, 403);
  assert.equal((await limited.get('/api/admin/stats')).status, 403);
  assert.equal((await limited.get('/api/admin/orders')).status, 403);
  assert.equal((await limited.post('/api/admin/admins').set('X-CSRF-Token', limitedCsrf).send({
    firstName: 'Interdit', lastName: 'Admin', email: `blocked-${Date.now()}@example.test`, password: 'AdminTest123!',
  })).status, 403);

  // Il gère aussi la logistique : répertoire et création de comptes livreurs.
  assert.equal((await limited.get('/api/admin/livreurs')).status, 200);
  const courierAccount = await limited
    .post('/api/admin/livreurs')
    .set('X-CSRF-Token', limitedCsrf)
    .send({ firstName: 'Logistique', lastName: 'Test', email: `logistics-${Date.now()}@example.test`, phone: '+237 699000000', password: 'AdminTest123!' });
  assert.equal(courierAccount.status, 201);
  assert.equal(courierAccount.body.user.role, 'livreur');

  // La vue d'ensemble financière reste réservée (redirigée vers les livraisons).
  const limitedOverview = await limited.get('/admin?tab=overview');
  assert.equal(limitedOverview.status, 302);
  assert.equal(limitedOverview.headers.location, '/admin?tab=livraisons');

  // L'admin limité accède à ses onglets marchandise / codes promo / livraisons.
  const limitedProducts = await limited.get('/admin?tab=products');
  assert.equal(limitedProducts.status, 200);
  assert.match(limitedProducts.text, /Ajouter un produit/);
  const limitedCoupons = await limited.get('/admin?tab=coupons');
  assert.equal(limitedCoupons.status, 200);
  assert.match(limitedCoupons.text, /Créer un code promo/);
  const limitedDeliveries = await limited.get('/admin?tab=livraisons');
  assert.equal(limitedDeliveries.status, 200);
  // Navigation visible mais panneaux réservés invalides (ordres, catégories, utilisateurs).
  assert.match(limitedDeliveries.text, /Marchandise/);
  assert.match(limitedDeliveries.text, /Codes promo/);
  assert.doesNotMatch(limitedDeliveries.text, /Créer un compte admin|data-tab="categories"|data-tab="orders"|data-tab="users"/);

  // Nettoyage du compte livreur créé par l'admin limité.
  await superAdmin.delete(`/api/admin/livreurs/${courierAccount.body.user.id}`).set('X-CSRF-Token', csrfToken);
});

test('superadmin deletes a customer account with all its data', async () => {
  const superAdmin = request.agent(app);
  const csrfToken = csrfTokenFrom(await superAdmin.get('/api/health'));
  const login = await superAdmin
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'admin@zurion.store', password: 'Admin1234!' });
  assert.equal(login.status, 200);

  const suffix = Date.now();
  const customer = request.agent(app);
  const customerCsrf = csrfTokenFrom(await customer.get('/api/health'));
  const email = `delete-me-${suffix}@example.test`;
  const registered = await customer
    .post('/api/auth/register')
    .set('X-CSRF-Token', customerCsrf)
    .send({ firstName: 'Supprimé', lastName: 'Prochain', email, password: 'Customer123!' });
  assert.equal(registered.status, 201);
  const userId = registered.body.user.id;

  const product = (await customer.get('/api/products?limit=50')).body.products.find((p) => p.stock >= 1);
  assert.ok(product, 'A product is required to build customer data');

  const cart = await customer
    .post('/api/cart/items')
    .set('X-CSRF-Token', customerCsrf)
    .send({ productId: product.id, quantity: 1 });
  assert.equal(cart.status, 201);

  const order = await customer
    .post('/api/orders')
    .set('X-CSRF-Token', customerCsrf)
    .send({
      paymentMethod: 'Paiement à la livraison',
      deliveryMode: 'standard',
      address: {
        fullName: 'Supprimé Test',
        phone: '0698765432',
        line1: '12 Rue de la Suppression',
        city: 'Douala',
        region: 'Littoral',
      },
    });
  assert.equal(order.status, 201);

  await Address.create({ userId, label: 'Domicile', fullName: 'Supprimé Test', phone: '0698765432', line1: '12 Rue Test', city: 'Douala', region: 'Littoral' });
  await Wishlist.create({ userId, productId: product.id });
  await Review.create({ userId, productId: product.id, rating: 5, comment: 'Avis à supprimer' });
  await ContactMessage.create({ userId, name: 'Supprimé', email, subject: 'Test', message: 'Message à rattacher avant suppression' });
  assert.equal(await OrderItem.count({ where: { orderId: order.body.id } }), 1);

  // Un administrateur limité ne peut pas supprimer de comptes.
  const limitedEmail = `limited-del-${suffix}@example.test`;
  const createdLimited = await superAdmin
    .post('/api/admin/admins')
    .set('X-CSRF-Token', csrfToken)
    .send({ firstName: 'Limité', lastName: 'Suppression', email: limitedEmail, password: 'AdminTest123!' });
  assert.equal(createdLimited.status, 201);
  const limited = request.agent(app);
  const limitedCsrf = csrfTokenFrom(await limited.get('/api/health'));
  const limitedLogin = await limited
    .post('/api/auth/login')
    .set('X-CSRF-Token', limitedCsrf)
    .send({ email: limitedEmail, password: 'AdminTest123!' });
  assert.equal(limitedLogin.status, 200);
  assert.equal(
    (await limited.delete(`/api/admin/users/${userId}`).set('X-CSRF-Token', limitedCsrf)).status,
    403
  );

  // Le superadmin ne peut pas supprimer son propre compte.
  const me = await superAdmin.get('/api/auth/me');
  assert.equal(
    (await superAdmin.delete(`/api/admin/users/${me.body.user.id}`).set('X-CSRF-Token', csrfToken)).status,
    400
  );

  // Suppression réelle : compte + toutes ses données (transaction).
  const deleted = await superAdmin
    .delete(`/api/admin/users/${userId}`)
    .set('X-CSRF-Token', csrfToken);
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.deleted, true);

  assert.equal(await User.findByPk(userId), null);
  assert.equal(await Address.count({ where: { userId } }), 0);
  assert.equal(await Wishlist.count({ where: { userId } }), 0);
  assert.equal(await Review.count({ where: { userId } }), 0);
  assert.equal(await Order.count({ where: { userId } }), 0);
  assert.equal(await OrderItem.count({ where: { orderId: order.body.id } }), 0);
  assert.equal(await Cart.count({ where: { userId } }), 0);
  assert.equal(await ContactMessage.count({ where: { userId } }), 0);
});

test('superadmin deletion is exposed through the SSR back-office', async () => {
  const superAdmin = request.agent(app);
  const csrfToken = csrfTokenFrom(await superAdmin.get('/api/health'));
  const login = await superAdmin
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'admin@zurion.store', password: 'Admin1234!' });
  assert.equal(login.status, 200);

  const usersPage = await superAdmin.get('/admin?tab=users');
  assert.equal(usersPage.status, 200);
  assert.match(usersPage.text, /Supprimer/);
  assert.match(usersPage.text, /\/admin\/utilisateurs\/\d+\/supprimer/);
  const formToken = csrfTokenFromHtml(usersPage.text);
  assert.ok(formToken, 'A CSRF token must be rendered in the admin page');

  const customer = request.agent(app);
  const customerCsrf = csrfTokenFrom(await customer.get('/api/health'));
  const email = `ssr-delete-${Date.now()}@example.test`;
  const registered = await customer
    .post('/api/auth/register')
    .set('X-CSRF-Token', customerCsrf)
    .send({ firstName: 'Jet', lastName: 'Table', email, password: 'Customer123!' });
  assert.equal(registered.status, 201);
  const userId = registered.body.user.id;
  assert.ok(await User.findByPk(userId), 'The customer account exists');

  // L'administrateur limité est redirigé et ne peut pas supprimer côté SSR.
  const limitedEmail = `ssr-limited-${Date.now()}@example.test`;
  const createdLimited = await superAdmin
    .post('/api/admin/admins')
    .set('X-CSRF-Token', csrfToken)
    .send({ firstName: 'Limité', lastName: 'SSR', email: limitedEmail, password: 'AdminTest123!' });
  assert.equal(createdLimited.status, 201);
  const limited = request.agent(app);
  const limitedCsrf = csrfTokenFrom(await limited.get('/api/health'));
  const limitedLogin = await limited
    .post('/api/auth/login')
    .set('X-CSRF-Token', limitedCsrf)
    .send({ email: limitedEmail, password: 'AdminTest123!' });
  assert.equal(limitedLogin.status, 200);
  const blocked = await limited
    .post(`/admin/utilisateurs/${userId}/supprimer`)
    .type('form')
    .send({ _csrf: limitedCsrf });
  assert.equal(blocked.status, 302);
  assert.equal(blocked.headers.location, '/admin?tab=livraisons');
  assert.ok(await User.findByPk(userId), 'The customer account must still exist');

  // Le superadmin supprime le compte via le formulaire SSR.
  const deleted = await superAdmin
    .post(`/admin/utilisateurs/${userId}/supprimer`)
    .type('form')
    .send({ _csrf: formToken });
  assert.equal(deleted.status, 302);
  assert.match(deleted.headers.location, /tab=users&ok=deleted/);
  assert.equal(await User.findByPk(userId), null);
});

test('admin history purge reports the number of deleted orders', async () => {
  const superAdmin = request.agent(app);
  const csrfToken = csrfTokenFrom(await superAdmin.get('/api/health'));
  const login = await superAdmin
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'admin@zurion.store', password: 'Admin1234!' });
  assert.equal(login.status, 200);

  // Une commande client est créée puis menée à « terminée ».
  const customer = request.agent(app);
  const customerCsrf = csrfTokenFrom(await customer.get('/api/health'));
  const registered = await customer
    .post('/api/auth/register')
    .set('X-CSRF-Token', customerCsrf)
    .send({ firstName: 'Historique', lastName: 'Purge', email: `purge-${Date.now()}@example.test`, password: 'Customer123!' });
  assert.equal(registered.status, 201);
  const product = (await customer.get('/api/products?limit=50')).body.products.find((p) => p.stock >= 1);
  assert.ok(product);
  await customer.post('/api/cart/items').set('X-CSRF-Token', customerCsrf).send({ productId: product.id, quantity: 1 });
  const orderRes = await customer
    .post('/api/orders')
    .set('X-CSRF-Token', customerCsrf)
    .send({
      paymentMethod: 'Paiement à la livraison',
      deliveryMode: 'standard',
      address: { fullName: 'Historique Purge', phone: '0600000000', line1: 'Rue de la purge', city: 'Douala', region: 'Littoral' },
    });
  assert.equal(orderRes.status, 201);
  const order = await Order.findOne({ where: { reference: orderRes.body.reference } });
  assert.ok(order);
  const statuses = ['paiement_confirmé', 'préparation', 'expédition', 'livraison', 'terminée'];
  for (const status of statuses) {
    const r = await superAdmin
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('X-CSRF-Token', csrfToken)
      .send({ status });
    assert.equal(r.status, 200);
  }
  const before = await Order.count({ where: { status: ['terminée', 'annulée'] } });
  assert.ok(before >= 1, 'At least one history order must exist before the purge');

  // Effacement via le formulaire SSR : redirection avec compteur explicite.
  const deleted = await superAdmin
    .post('/admin/commandes/historique/effacer')
    .type('form')
    .send({ _csrf: csrfTokenFromHtml((await superAdmin.get('/admin/commandes')).text) });
  assert.equal(deleted.status, 302);
  assert.match(deleted.headers.location, /ok=cleared&count=(\d+)/);
  const count = Number(deleted.headers.location.match(/count=(\d+)/)[1]);
  assert.equal(count, before);
  assert.equal(await Order.count({ where: { status: ['terminée', 'annulée'] } }), 0);

  // Seconde purge : plus rien à effacer → compteur à 0 (message explicite côté vue).
  const second = await superAdmin
    .post('/admin/commandes/historique/effacer')
    .type('form')
    .send({ _csrf: csrfTokenFromHtml((await superAdmin.get('/admin/commandes')).text) });
  assert.equal(second.status, 302);
  assert.match(second.headers.location, /ok=cleared&count=0/);
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

test('cart rows expose the product image', async () => {
  const api = request.agent(app);
  const csrfToken = csrfTokenFrom(await api.get('/api/health'));
  const products = (await api.get('/api/products?limit=50')).body.products;
  const product = products.find((p) => p.stock >= 1 && p.image);
  assert.ok(product, 'A product with an image is required');

  // Galerie complète du produit (triée par position) via la fiche produit
  const detail = (await api.get(`/api/products/${product.slug}`)).body.product;
  const gallery = detail.images || [];
  assert.ok(gallery.length > 0, 'The product must have images');

  const cartToken = 'img-' + Date.now();
  const addRes = await api
    .post('/api/cart/items')
    .set('X-Cart-Token', cartToken)
    .set('X-CSRF-Token', csrfToken)
    .send({ productId: product.id, quantity: 1 });
  assert.equal(addRes.status, 201);
  const cartImage = addRes.body.items[0].image;
  assert.ok(cartImage, 'The cart row must expose a product image');
  assert.ok(gallery.includes(cartImage), 'The cart image must be one of the product images');
});

test('order lifecycle is isolated per user and controlled by admin', async () => {
  const suffix = Date.now();
  const customer = request.agent(app);
  const customerPre = await customer.get('/api/health');
  const customerCsrf = csrfTokenFrom(customerPre);
  const customerEmail = `lifecycle-${suffix}@example.test`;
  const registered = await customer
    .post('/api/auth/register')
    .set('X-CSRF-Token', customerCsrf)
    .send({
      firstName: 'Lifecycle',
      lastName: 'Customer',
      email: customerEmail,
      phone: '699000001',
      password: 'Test1234!',
    });
  assert.equal(registered.status, 201);

  const product = (await customer.get('/api/products?limit=50')).body.products.find((item) => item.stock >= 1);
  assert.ok(product, 'A product is required for the lifecycle flow');
  const added = await customer
    .post('/api/cart/items')
    .set('X-CSRF-Token', customerCsrf)
    .send({ productId: product.id, quantity: 1 });
  assert.equal(added.status, 201);

  const created = await customer
    .post('/api/orders')
    .set('X-CSRF-Token', customerCsrf)
    .send({
      paymentMethod: 'Paiement à la livraison',
      deliveryMode: 'standard',
      address: { fullName: 'Lifecycle Customer', phone: '699000001', line1: 'Rue lifecycle', city: 'Yaoundé', region: 'Centre' },
    });
  assert.equal(created.status, 201);
  const reference = created.body.reference;

  const customerOrders = await customer.get('/api/orders');
  assert.equal(customerOrders.status, 200);
  assert.ok(customerOrders.body.orders.some((order) => order.reference === reference && order.status === 'créée'));
  const customerPage = await customer.get('/compte');
  assert.equal(customerPage.status, 200);
  assert.match(customerPage.text, new RegExp(reference));

  const otherCustomer = request.agent(app);
  const otherPre = await otherCustomer.get('/api/health');
  const otherCsrf = csrfTokenFrom(otherPre);
  const otherRegistered = await otherCustomer
    .post('/api/auth/register')
    .set('X-CSRF-Token', otherCsrf)
    .send({
      firstName: 'Other',
      lastName: 'Customer',
      email: `other-${suffix}@example.test`,
      password: 'Test1234!',
    });
  assert.equal(otherRegistered.status, 201);
  assert.equal((await otherCustomer.get(`/api/orders/${reference}`)).status, 404);

  const admin = request.agent(app);
  const adminPre = await admin.get('/api/health');
  const adminCsrf = csrfTokenFrom(adminPre);
  const login = await admin
    .post('/api/auth/login')
    .set('X-CSRF-Token', adminCsrf)
    .send({ email: 'admin@zurion.store', password: 'Admin1234!' });
  assert.equal(login.status, 200);
  const order = await Order.findOne({ where: { reference } });
  assert.ok(order);

  const invalidSkip = await admin
    .patch(`/api/admin/orders/${order.id}/status`)
    .set('X-CSRF-Token', adminCsrf)
    .send({ status: 'expédition' });
  assert.equal(invalidSkip.status, 400);
  assert.match(invalidSkip.body.error, /Transition invalide/i);

  const transitions = ['paiement_confirmé', 'préparation', 'expédition', 'livraison', 'terminée'];
  for (const status of transitions) {
    const response = await admin
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ status });
    assert.equal(response.status, 200);
    assert.equal(response.body.order.status, status);

    const visibleToCustomer = await customer.get(`/api/orders/${reference}`);
    assert.equal(visibleToCustomer.status, 200);
    assert.equal(visibleToCustomer.body.order.status, status);
  }

  const reverse = await admin
    .patch(`/api/admin/orders/${order.id}/status`)
    .set('X-CSRF-Token', adminCsrf)
    .send({ status: 'livraison' });
  assert.equal(reverse.status, 400);

  const missing = await admin
    .patch('/api/admin/orders/999999999/status')
    .set('X-CSRF-Token', adminCsrf)
    .send({ status: 'terminée' });
  assert.equal(missing.status, 404);
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

test('admin can manually assign an order with products and destination', async () => {
  const admin = request.agent(app);
  const pre = await admin.get('/api/health');
  const csrfToken = csrfTokenFrom(pre);
  const login = await admin
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'admin@zurion.store', password: 'Admin1234!' });
  assert.equal(login.status, 200);

  const customer = request.agent(app);
  const customerPre = await customer.get('/api/health');
  const customerCsrf = csrfTokenFrom(customerPre);
  const product = (await customer.get('/api/products?limit=50')).body.products.find((item) => item.stock >= 1);
  assert.ok(product);
  const cartToken = `manual-delivery-${Date.now()}`;
  const added = await customer
    .post('/api/cart/items')
    .set('X-Cart-Token', cartToken)
    .set('X-CSRF-Token', customerCsrf)
    .send({ productId: product.id, quantity: 1 });
  assert.equal(added.status, 201);
  const orderRes = await customer
    .post('/api/orders')
    .set('X-Cart-Token', cartToken)
    .set('X-CSRF-Token', customerCsrf)
    .send({
      paymentMethod: 'Paiement à la livraison',
      deliveryMode: 'standard',
      address: { fullName: 'Client commande manuelle', phone: '690000111', line1: 'Rue commande manuelle', city: 'Douala', region: 'Littoral' },
    });
  assert.equal(orderRes.status, 201);
  const order = await Order.findOne({ where: { reference: orderRes.body.reference } });
  const courier = await Courier.create({ name: `Manual Courier ${Date.now()}`, phone: '+237 690123456', active: true });
  assert.ok(courier);

  const deliveriesPage = await admin.get('/admin/livraisons');
  assert.equal(deliveriesPage.status, 200);
  const assigned = await admin
    .post('/admin/livraisons/attribuer')
    .type('form')
    .send({
      _csrf: csrfTokenFromHtml(deliveriesPage.text),
      orderId: order.id,
      courierId: courier.id,
      fullName: 'Destinataire colis',
      phone: '699999999',
      line1: 'Avenue de la destination',
      line2: 'Immeuble 4',
      city: 'Douala',
      region: 'Littoral',
      date: '2026-09-15',
      time: '14:30',
    });
  assert.equal(assigned.status, 302);
  assert.equal(assigned.headers.location, '/admin?tab=livraisons');

  await order.reload();
  assert.equal(order.status, 'expédition');
  const delivery = await Livraison.findOne({ where: { orderId: order.id } });
  assert.ok(delivery);
  assert.equal(delivery.courierName, courier.name);
  assert.deepEqual(JSON.parse(delivery.destinationSnapshot), {
    fullName: 'Destinataire colis',
    phone: '699999999',
    line1: 'Avenue de la destination',
    line2: 'Immeuble 4',
    city: 'Douala',
    region: 'Littoral',
  });
  const scheduled = new Date('2026-09-15T14:30');
  assert.ok(
    Math.abs(new Date(delivery.scheduledAt).getTime() - scheduled.getTime()) < 1000,
    'Scheduled delivery date/time must match the submitted values'
  );
  const updatedPage = await admin.get('/admin/livraisons');
  assert.match(updatedPage.text, new RegExp(product.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(updatedPage.text, /Destinataire colis/);
  assert.match(updatedPage.text, /Avenue de la destination/);
  assert.match(updatedPage.text, /15 sept/i);
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
