'use strict';

const cartService = require('../services/cart.service');
const { money } = require('../utils/money');

/* ═══════════════════════════════════════════════════════════════════════════
 *  CONTRÔLEUR PANIER — endpoints JSON (invité via X-Cart-Token, connecté via cookie)
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Détermine le contexte du panier : userId (connecté) ou token (invité). */
function guestContext(req) {
  return {
    userId: req.user ? req.user.id : null,
    token: req.user ? null : req.headers['x-cart-token'] || null,
  };
}

/** Sérialise le panier en JSON (lignes + totaux formatés + images). */
function serializeCart(cart) {
  const totals = cartService.cartTotals(cart);
  return {
    count: totals.count,
    subtotal: totals.subtotal,
    subtotalFormatted: money(totals.subtotal),
    items: (cart && cart.items ? cart.items : []).map((line) => ({
      productId: line.product ? line.product.id : null,
      slug: line.product ? line.product.slug : null,
      name: line.product ? line.product.name : 'Produit indisponible',
      price: line.product ? line.product.price : 0,
      priceFormatted: line.product ? money(line.product.price) : money(0),
      image: line.product ? (line.product.images && line.product.images[0] ? line.product.images[0].url : null) : null,
      quantity: line.quantity,
      lineTotalFormatted: line.product ? money(line.product.price * line.quantity) : money(0),
      stock: line.product ? line.product.stock : 0,
    })),
  };
}

/** GET /api/cart */
/** GET /api/cart — retourne le panier courant. */
async function getCart(req, res, next) {
  try {
    const ctx = guestContext(req);
    const cart = await cartService.getCart(ctx);
    return res.json(serializeCart(cart));
  } catch (err) {
    return next(err);
  }
}

/** POST /api/cart/items { productId, quantity } */
/** POST /api/cart/items — ajoute un article (ou incrémente sa quantité). */
async function addItem(req, res, next) {
  try {
    const ctx = guestContext(req);
    const productId = Number(req.body.productId);
    const quantity = req.body.quantity !== undefined ? Number(req.body.quantity) : 1;
    const cart = await cartService.addItem({ ...ctx, productId, quantity });
    return res.status(201).json(serializeCart(cart));
  } catch (err) {
    return next(err);
  }
}

/** PUT /api/cart/items/:productId { quantity } */
/** PUT /api/cart/items/:productId — modifie la quantité. */
async function updateItem(req, res, next) {
  try {
    const ctx = guestContext(req);
    const cart = await cartService.updateItem({ ...ctx, productId: Number(req.params.productId), quantity: Number(req.body.quantity) });
    return res.json(serializeCart(cart));
  } catch (err) {
    return next(err);
  }
}

/** DELETE /api/cart/items/:productId */
/** DELETE /api/cart/items/:productId — retire un article. */
async function removeItem(req, res, next) {
  try {
    const ctx = guestContext(req);
    const cart = await cartService.removeItem({ ...ctx, productId: Number(req.params.productId) });
    return res.json(serializeCart(cart));
  } catch (err) {
    return next(err);
  }
}

module.exports = { getCart, addItem, updateItem, removeItem };