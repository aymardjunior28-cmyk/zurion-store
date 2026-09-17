'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../back/src/app');
const { connectDatabase, sequelize } = require('../back/src/config/db');
const { User, Coupon, Cart, CartItem } = require('../back/src/models');

function csrfTokenFrom(res) {
  const raw = (res.headers['set-cookie'] || []).find((c) => c.startsWith('zurion_csrf='));
  return raw ? decodeURIComponent(raw.split(';')[0].split('=').slice(1).join('=')) : null;
}

function csrfTokenFromHtml(html) {
  const match = html.match(/name="?_csrf"? value="([^"]+)"/);
  return match ? match[1] : null;
}

/** Extrait le montant d'une balise portant l'id donné (même logique que le JS client). */
function moneyById(html, id) {
  const match = html.match(new RegExp('id="' + id + '"[^>]*>([^<]+)<'));
  return match ? Number(match[1].replace(/[^\d]/g, '')) || 0 : null;
}

test.before(async () => {
  await connectDatabase();
});

test.after(async () => {
  await sequelize.close();
});

test('checkout SSR exposes the sub-total id used by the client recompute (totals consistent)', async () => {
  const suffix = Date.now();
  const agent = request.agent(app);
  const csrf = csrfTokenFrom(await agent.get('/api/health'));
  const email = `checkout-ssr-${suffix}@example.test`;
  const couponCode = `SSR${suffix % 10000}`;

  const registered = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrf)
    .send({ firstName: 'Checkout', lastName: 'SSR', email, password: 'Customer123!' });
  assert.equal(registered.status, 201);
  const userId = registered.body.user.id;

  try {
    const product = (await agent.get('/api/products?limit=50')).body.products.find((p) => p.stock >= 2);
    assert.ok(product, 'un produit en stock est requis');
    const quantity = 2;

    const added = await agent
      .post('/api/cart/items')
      .set('X-CSRF-Token', csrf)
      .send({ productId: product.id, quantity });
    assert.equal(added.status, 201);

    await Coupon.create({ code: couponCode, type: 'percent', value: 10, minAmount: 0, maxUses: null, usedCount: 0, active: true });

    const cartPage = await agent.get('/panier');
    assert.equal(cartPage.status, 200);
    await agent.post('/panier/code-promo').type('form').send({
      _csrf: csrfTokenFromHtml(cartPage.text),
      couponCode,
    });

    const page = await agent.get('/commande');
    assert.equal(page.status, 200);

    const subtotal = moneyById(page.text, 'zurion-subtotal');
    const discount = moneyById(page.text, 'zurion-discount');
    const shipping = moneyById(page.text, 'zurion-delivery-fee');
    const total = moneyById(page.text, 'zurion-order-total');

    assert.ok(subtotal !== null, 'le sous-total doit porter id="zurion-subtotal" (lu par recomputeTotal)');
    assert.ok(discount !== null, 'la remise doit être affichée');
    assert.ok(shipping !== null, 'les frais de livraison doivent être affichés');
    assert.ok(total !== null, 'le total doit être affiché');

    const expectedSubtotal = product.price * quantity;
    const expectedDiscount = Math.round((expectedSubtotal * 10) / 100);
    assert.equal(subtotal, expectedSubtotal);
    assert.equal(discount, expectedDiscount);
    assert.equal(total, subtotal - discount + shipping, 'total = sous-total − remise + livraison');
  } finally {
    const cart = await Cart.findOne({ where: { userId } });
    if (cart) {
      await CartItem.destroy({ where: { cartId: cart.id } });
      await Cart.destroy({ where: { id: cart.id } });
    }
    await Coupon.destroy({ where: { code: couponCode } });
    await User.destroy({ where: { id: userId } });
  }
});