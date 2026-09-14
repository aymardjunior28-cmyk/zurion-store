'use strict';

const crypto = require('crypto');
const { sequelize, Cart, CartItem, Product, ProductImage } = require('../models');

/* ═══════════════════════════════════════════════════════════════════════════
 *  SERVICE PANIER — invité (token) ou connecté (userId)
 *  - Un invité est identifié par un token stocké en cookie httpOnly `zurion_cart`.
 *  - Un utilisateur connecté est identifié par son userId.
 *  - Les quantités sont toujours bornées par le stock disponible.
 *  - La fusion invité→compte a lieu à la connexion (mergeGuestIntoUser).
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Génère un token aléatoire (48 hex) pour identifier un panier invité. */
function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

/** Charge le panier (items + produits + images) pour un userId OU un token invité.
 *  Lance une 400 si aucun contexte n'est fourni (évite de charger un panier arbitraire). */
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
        include: [{
          model: Product,
          as: 'product',
          // Les images sont chargées avec le panier : la vignette du panier
          // et du récapitulatif checkout affiche le produit réel (et non le
          // placeholder). Tri par position : la première image est la vignette.
          include: [{ model: ProductImage, as: 'images', attributes: ['id', 'url', 'position'], separate: true, order: [['position', 'ASC']] }],
        }],
        order: [['id', 'ASC']],
      },
    ],
    transaction,
  });
  return cart;
}

/** Récupère le panier existant ou en crée un (préserve le token invité fourni). */
async function getOrCreateCart({ userId, token }) {
  const existing = await getCart({ userId, token });
  if (existing) return existing;
  return Cart.create({ userId: userId || null, token: userId ? null : token || newToken() });
}

/** Ajoute un article (ou incrémente sa quantité) en respectant le stock disponible.
 *  Lance 404 si le produit est inactif/introuvable, 409 si le stock est épuisé. */
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

/** Modifie la quantité d'une ligne (bornée au stock). Quantité ≤ 0 → suppression. */
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

/** Supprime une ligne du panier. */
async function removeItem({ userId, token, productId }) {
  const cart = await getOrCreateCart({ userId, token });
  const item = await CartItem.findOne({ where: { cartId: cart.id, productId } });
  if (item) await item.destroy();
  return getCart({ userId: cart.userId, token: cart.token });
}

/** Vide toutes les lignes d'un panier (utilisé après une commande). */
async function clearCart(cart, { transaction } = {}) {
  if (!cart) return;
  await CartItem.destroy({ where: { cartId: cart.id }, transaction });
}

/** Fusionne le panier invité vers le panier du compte à la connexion.
 *  Ignore les produits devenus indisponibles et supprime le panier invité.
 *  Tout se déroule dans une transaction : pas de fusion partielle si un pas échoue. */
async function mergeGuestIntoUser(guestToken, userId) {
  if (!guestToken || !userId) return;
  await sequelize.transaction(async (tx) => {
    const guestCart = await Cart.findOne({ where: { token: guestToken }, include: [{ model: CartItem, as: 'items' }], transaction: tx });
    if (!guestCart || !guestCart.items.length) return;

    const userCart = await getOrCreateCart({ userId, token: null });
    for (const item of guestCart.items) {
      const product = await Product.findByPk(item.productId, { transaction: tx });
      if (!product || !product.active || product.stock <= 0) {
        await item.destroy({ transaction: tx });
        continue;
      }
      const qty = Math.min(item.quantity, product.stock);
      if (qty <= 0) {
        await item.destroy({ transaction: tx });
        continue;
      }
      const existing = await CartItem.findOne({ where: { cartId: userCart.id, productId: item.productId }, transaction: tx });
      if (existing) {
        existing.quantity = Math.min(Math.max(existing.quantity, qty), product.stock);
        await existing.save({ transaction: tx });
      } else {
        await CartItem.create({ cartId: userCart.id, productId: item.productId, quantity: qty }, { transaction: tx });
      }
    }
    await guestCart.destroy({ transaction: tx });
  });
}

/** Calcule les totaux d'un panier : sous-total, frais, total et nombre d'articles. */
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
