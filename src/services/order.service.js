'use strict';

const { Order, OrderItem, User } = require('../models');
const cartService = require('./cart.service');

/** Cycle de vie des commandes (exigence cahier des charges). */
const ORDER_STATUSES = [
  'créée',
  'paiement_confirmé',
  'préparation',
  'expédition',
  'livraison',
  'terminée',
];

/** Modes de livraison proposés au checkout. */
const DELIVERY_MODES = {
  standard: { label: 'Livraison standard', days: '2 à 5 jours ouvrés', fee: 2000 },
  express: { label: 'Livraison express', days: '24 à 48 h', fee: 5000 },
  pickup: { label: 'Retrait en agence', days: 'Dès disponibilité', fee: 0 },
};

/** Moyens de paiement simulés (démonstration) : clé stable + libellé affiché. */
const PAYMENT_METHODS = [
  'Paiement à la livraison',
  'Mobile Money (simulation)',
  'Carte bancaire (simulation)',
];

/** Alias de clés stables → libellés (accepte les deux à l'entrée). */
const PAYMENT_METHOD_KEYS = {
  cash_on_delivery: 'Paiement à la livraison',
  mobile_money: 'Mobile Money (simulation)',
  card: 'Carte bancaire (simulation)',
};

/** Normalise une clé ou un libellé vers le libellé canonique. */
function normalizePaymentMethod(value) {
  if (PAYMENT_METHOD_KEYS[value]) return PAYMENT_METHOD_KEYS[value];
  if (PAYMENT_METHODS.includes(value)) return value;
  return null;
}

function nextReference() {
  return 'ZR-' + Date.now().toString().slice(-8);
}

/**
 * Passe la commande : contrôle le panier, décrémente les stocks,
 * crée la commande + ses lignes puis vide le panier.
 * Tout se déroule dans une transaction.
 */
async function placeOrder({ userId, cartToken, paymentMethod, deliveryMode, address }) {
  if (!Object.prototype.hasOwnProperty.call(DELIVERY_MODES, deliveryMode)) {
    throw Object.assign(new Error('Mode de livraison inconnu.'), { status: 400 });
  }
  if (!normalizePaymentMethod(paymentMethod)) {
    throw Object.assign(new Error('Mode de paiement inconnu.'), { status: 400 });
  }
  if (!address || !address.fullName || !address.phone || !address.city || !address.line1) {
    throw Object.assign(new Error('Adresse de livraison incomplète.'), { status: 400 });
  }

  const cart = await cartService.getCart({ userId, token: cartToken });
  if (!cart || !cart.items.length) {
    throw Object.assign(new Error('Votre panier est vide.'), { status: 400 });
  }

  const { subtotal, shipping, total } = cartService.cartTotals(cart, DELIVERY_MODES[deliveryMode].fee);
  const reference = nextReference();
  const addressSnapshot = JSON.stringify({ ...address });

  const order = await Order.create(
    {
      reference,
      userId: userId || null,
      status: 'créée',
      total,
      shipping,
      paymentMethod: normalizePaymentMethod(paymentMethod),
      deliveryMode,
      addressSnapshot,
    },
    { include: [] }
  );

  for (const line of cart.items) {
    const product = line.product;
    await OrderItem.create({
      orderId: order.id,
      productId: product ? product.id : null,
      nameSnapshot: product ? product.name : 'Produit indisponible',
      priceSnapshot: product ? product.price : 0,
      quantity: line.quantity,
    });
    // Décrément du stock (borné à zéro)
    if (product) {
      await product.update({ stock: Math.max(0, product.stock - line.quantity) });
    }
  }

  await cartService.clearCart(cart);

  return getOrderForUser(userId || null, reference);
}

async function listOrders(userId) {
  return Order.findAll({
    where: { userId },
    include: [{ model: OrderItem, as: 'items' }],
    order: [['createdAt', 'DESC']],
  });
}

async function getOrderForUser(userId, reference) {
  const where = { reference };
  if (userId) where.userId = userId;
  return Order.findOne({ where, include: [{ model: OrderItem, as: 'items' }] });
}

/** Avance le statut d'un cran dans le cycle (usage back-office). */
async function advanceStatus(order) {
  const index = ORDER_STATUSES.indexOf(order.status);
  if (index >= 0 && index < ORDER_STATUSES.length - 1) {
    order.status = ORDER_STATUSES[index + 1];
    await order.save();
  }
  return order;
}

/** Statut d'après pour l'affichage du bouton admin. */
function nextStatus(order) {
  const index = ORDER_STATUSES.indexOf(order.status);
  return index >= 0 && index < ORDER_STATUSES.length - 1 ? ORDER_STATUSES[index + 1] : null;
}

module.exports = {
  ORDER_STATUSES,
  DELIVERY_MODES,
  PAYMENT_METHODS,
  PAYMENT_METHOD_KEYS,
  normalizePaymentMethod,
  placeOrder,
  listOrders,
  getOrderForUser,
  advanceStatus,
  nextStatus,
};