'use strict';

const crypto = require('crypto');
const { Cart, CartItem, Product } = require('../models');

/**
 * Services panier — panier invité (token) ou connecté (userId).
 * Les quantités sont toujours bornées par le stock disponible.
 */

function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function getCart({ userId, token, transaction } = {}) {
  // Sans userId ni token, le `where` serait vide et Sequelize
  // renverrait un panier ARBITRAIRE. On refuse explicitement.
  if (!userId && !token) {
    throw Object.assign(new Error('Contexte de panier invalide.'), { status: 400 });
  }
  const where = {};
  if (userId) where.userId = userId;
  else where.token = token;

  const cart = await Cart.findOne({
    where,
    include: [
      {
        model: CartItem,
        as: 'items',
        include: [{ model: Product, as: 'product' }],
        order: [['id', 'ASC']],
      },
    ],
    transaction,
  });
  return cart;
}

/** Récupère le panier ou en crée un. Invité : le token fourni par le client est conservé. */
async function getOrCreateCart({ userId, token }) {
  const existing = await getCart({ userId, token });
  if (existing) return existing;
  return Cart.create({ userId: userId || null, token: userId ? null : token || newToken() });
}

/** Ajoute un article en respectant le stock. */
async function addItem({ userId, token, productId, quantity = 1 }) {
  const product = await Product.findByPk(productId);
  if (!product || !product.active) {
    throw Object.assign(new Error('Produit introuvable.'), { status: 404 });
  }
  if (product.stock <= 0) {
    throw Object.assign(new Error('Ce produit est momentanément indisponible.'), { status: 409 });
  }
  const cart = await getOrCreateCart({ userId, token });
  let item = await CartItem.findOne({ where: { cartId: cart.id, productId } });
  if (item) {
    const next = Math.min(item.quantity + Number(quantity), product.stock);
    item.quantity = next;
    await item.save();
  } else {
    item = await CartItem.create({
      cartId: cart.id,
      productId,
      quantity: Math.min(Number(quantity), product.stock),
    });
  }
  return getCart({ userId: cart.userId, token: cart.token });
}

/** Modifie la quantité d'une ligne. */
async function updateItem({ userId, token, productId, quantity }) {
  const product = await Product.findByPk(productId);
  const cart = await getOrCreateCart({ userId, token });
  const item = await CartItem.findOne({ where: { cartId: cart.id, productId } });
  if (!item) throw Object.assign(new Error('Article absent du panier.'), { status: 404 });

  const next = Number(quantity);
  if (next <= 0) {
    await item.destroy();
  } else {
    item.quantity = Math.min(next, product ? product.stock : item.quantity);
    await item.save();
  }
  return getCart({ userId: cart.userId, token: cart.token });
}

/** Supprime une ligne. */
async function removeItem({ userId, token, productId }) {
  const cart = await getOrCreateCart({ userId, token });
  const item = await CartItem.findOne({ where: { cartId: cart.id, productId } });
  if (item) await item.destroy();
  return getCart({ userId: cart.userId, token: cart.token });
}

async function clearCart(cart, { transaction } = {}) {
  if (!cart) return;
  await CartItem.destroy({ where: { cartId: cart.id }, transaction });
}

/** Fusion du panier invité vers le panier du compte à la connexion. */
async function mergeGuestIntoUser(guestToken, userId) {
  if (!guestToken || !userId) return;
  const guestCart = await Cart.findOne({ where: { token: guestToken }, include: [{ model: CartItem, as: 'items' }] });
  if (!guestCart || !guestCart.items.length) return;

  const userCart = await getOrCreateCart({ userId, token: null });
  for (const item of guestCart.items) {
    const product = await Product.findByPk(item.productId);
    if (!product || !product.active || product.stock <= 0) {
      await item.destroy();
      continue;
    }
    const qty = Math.min(item.quantity, product.stock);
    if (qty <= 0) {
      await item.destroy();
      continue;
    }
    const existing = await CartItem.findOne({ where: { cartId: userCart.id, productId: item.productId } });
    if (existing) {
      existing.quantity = Math.min(Math.max(existing.quantity, qty), product.stock);
      await existing.save();
    } else {
      await CartItem.create({ cartId: userCart.id, productId: item.productId, quantity: qty });
    }
  }
  await guestCart.destroy();
}

/** Calcule sous-total, frais de livraison et total d'un panier. */
function cartTotals(cart, deliveryFee = 0) {
  const items = (cart && cart.items) || [];
  const subtotal = items.reduce((sum, line) => sum + (line.product ? line.product.price * line.quantity : 0), 0);
  return { subtotal, shipping: deliveryFee, total: subtotal + deliveryFee, count: items.reduce((s, l) => s + l.quantity, 0) };
}

module.exports = {
  newToken,
  getCart,
  getOrCreateCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  mergeGuestIntoUser,
  cartTotals,
};
