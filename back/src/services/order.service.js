'use strict';

const crypto = require('crypto');
const { sequelize, Order, OrderItem, Product, Livraison } = require('../models');
const cartService = require('./cart.service');
const couponService = require('./coupon.service');
const deliveryService = require('./delivery.service');
const paymentService = require('./payment.service');

/** Cycle de vie des commandes (exigence cahier des charges). */
/* ═══════════════════════════════════════════════════════════════════════════
 *  SERVICE COMMANDES — cycle de vie, paiement, annulation, historique
 *  - placeOrder : valide le panier, décrée le stock, crée la commande (transaction).
 *  - advanceStatus / transitionStatus : fait progresser le cycle de vie.
 *  - cancelOrder : annule (client ou admin) et restaure les stocks.
 *  - clearHistory / clearHistoryAdmin : purge l'historique terminé/annulé.
 *  - productsPurchased : produits achetés par un client (pour les avis vérifiés).
 * ═══════════════════════════════════════════════════════════════════════════ */

const ORDER_STATUSES = [
  'créée',
  'paiement_confirmé',
  'préparation',
  'expédition',
  'livraison',
  'terminée',
];

/** Modes de livraison proposés au checkout (clé stable → libellé + délai + frais). */
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

/** Normalise une clé ou un libellé vers le libellé canonique du moyen de paiement. */
function normalizePaymentMethod(value) {
  if (PAYMENT_METHOD_KEYS[value]) return PAYMENT_METHOD_KEYS[value];
  if (PAYMENT_METHODS.includes(value)) return value;
  return null;
}

/** Génère une référence unique non énumérable (48 bits d'aléatoire). */
function nextReference() {
  // 48 bits d'aléatoire : non énumérable, contrairement à l'ancienne
  // référence basée sur Date.now() + 2 octets seulement.
  return `ZR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

/** Nettoie les champs d'adresse avant stockage (trim + bornes + anti-XSS). */
function sanitizeAddress(address) {
  // Supprime les balises HTML/scripts : empêche le XSS stocké via la fiche commande.
  const stripHtml = (v) => String(v).replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
  const clean = (v, max) => (v == null ? '' : stripHtml(v).trim().slice(0, max));
  return {
    fullName: clean(address.fullName, 120),
    phone: clean(address.phone, 30),
    line1: clean(address.line1, 180),
    line2: clean(address.line2, 180),
    city: clean(address.city, 80),
    region: clean(address.region, 80),
  };
}

/**
 * Passe la commande : contrôle le panier, décrémente les stocks,
 * crée la commande + ses lignes puis vide le panier.
 * Tout se déroule dans une transaction : aucune commande partielle ne doit
 * rester si le stock ou l'écriture d'une ligne échoue.
 */
async function placeOrder({ userId, cartToken, paymentMethod, deliveryMode, address, couponCode }) {
  if (!Object.prototype.hasOwnProperty.call(DELIVERY_MODES, deliveryMode)) {
    throw Object.assign(new Error('Mode de livraison inconnu.'), { status: 400 });
  }
  if (!normalizePaymentMethod(paymentMethod)) {
    throw Object.assign(new Error('Mode de paiement inconnu.'), { status: 400 });
  }
  paymentService.assertPaymentMethodAllowed(normalizePaymentMethod(paymentMethod));
  if (!address || !address.fullName || !address.phone || !address.city || !address.line1) {
    throw Object.assign(new Error('Adresse de livraison incomplète.'), { status: 400 });
  }
  const cleanAddress = sanitizeAddress(address);
  if (cleanAddress.fullName.length < 2 || cleanAddress.phone.length < 5 || cleanAddress.city.length < 2 || cleanAddress.line1.length < 3) {
    throw Object.assign(new Error('Adresse de livraison invalide.'), { status: 400 });
  }

  const order = await sequelize.transaction(async (transaction) => {
    const cart = await cartService.getCart({ userId, token: cartToken, transaction });
    if (!cart || !cart.items.length) {
      throw Object.assign(new Error('Votre panier est vide.'), { status: 400 });
    }

    // Recharger les produits dans la transaction afin d'utiliser le prix et
    // le stock courants, plutôt que des données devenues obsolètes du panier.
    const lines = [];
    for (const line of cart.items) {
      const product = await Product.findByPk(line.productId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!product || !product.active || product.stock < line.quantity) {
        throw Object.assign(new Error(`Stock insuffisant pour « ${line.product ? line.product.name : 'ce produit'} ».`), { status: 409 });
      }
      lines.push({ product, quantity: line.quantity });
    }

    const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
    const shipping = DELIVERY_MODES[deliveryMode].fee;

    // Code promo (optionnel) : validé dans la transaction, remise calculée sur le sous-total.
    let discount = 0;
    let coupon = null;
    let cleanCouponCode = null;
    if (couponCode) {
      coupon = await couponService.validateCoupon(couponCode, subtotal);
      discount = couponService.applyDiscount(coupon, subtotal);
      cleanCouponCode = coupon.code;
    }

    const created = await Order.create({
      reference: nextReference(), userId: userId || null, status: 'créée',
      total: subtotal + shipping - discount, shipping,
      paymentMethod: normalizePaymentMethod(paymentMethod), deliveryMode,
      addressSnapshot: JSON.stringify(cleanAddress), couponCode: cleanCouponCode, discount,
    }, { transaction });

    if (coupon) await couponService.consumeCoupon(coupon, transaction);

    for (const { product, quantity } of lines) {
      await OrderItem.create({ orderId: created.id, productId: product.id, nameSnapshot: product.name, priceSnapshot: product.price, quantity }, { transaction });
      await product.decrement('stock', { by: quantity, transaction });
    }
    await cartService.clearCart(cart, { transaction });
    return created;
  });

  return getOrderForUser(userId || null, order.reference, { allowGuest: true });
}

/** Liste les commandes d'un client (du plus récent au plus ancien). */
async function listOrders(userId) {
  return Order.findAll({
    where: { userId },
    include: [{ model: OrderItem, as: 'items' }],
    order: [['createdAt', 'DESC']],
  });
}

/** Récupère une commande par sa référence.
 *  Vérifie qu'elle appartient au client. Le lookup invité (userId === null) est
 *  uniquement permis quand allowGuest est explicitement vrai, pour empêcher tout
 *  IDOR (lecture de commande d'autrui par simple référence). */
async function getOrderForUser(userId, reference, { allowGuest = false } = {}) {
  if (!userId && !allowGuest) {
    throw Object.assign(new Error('Authentification requise pour consulter cette commande.'), { status: 403 });
  }
  const where = { reference };
  if (userId) where.userId = userId;
  return Order.findOne({ where, include: [{ model: OrderItem, as: 'items' }] });
}

/** Fait avancer la commande d'un cran dans son cycle de vie. */
async function advanceStatus(order) {
  const index = ORDER_STATUSES.indexOf(order.status);
  if (index >= 0 && index < ORDER_STATUSES.length - 1) {
    order.status = ORDER_STATUSES[index + 1];
    await order.save();
  }
  return order;
}

/** Applique uniquement la transition immédiatement suivante. */
async function transitionStatus(order, status) {
  const currentIndex = ORDER_STATUSES.indexOf(order.status);
  const nextStatusValue = currentIndex >= 0 ? ORDER_STATUSES[currentIndex + 1] : null;
  if (!nextStatusValue || status !== nextStatusValue) {
    throw Object.assign(
      new Error(`Transition invalide : « ${order.status} » → « ${status} ».`),
      { status: 400 }
    );
  }
  order.status = status;
  await order.save();
  return order;
}

/** Retourne le statut suivant possible (ou null si le cycle est terminé). */
function nextStatus(order) {
  const index = ORDER_STATUSES.indexOf(order.status);
  return index >= 0 && index < ORDER_STATUSES.length - 1 ? ORDER_STATUSES[index + 1] : null;
}

/** Statuts à partir desquels une commande peut encore être annulée. */
const CANCELLABLE_STATUSES = ['créée', 'paiement_confirmé'];

/** Statuts considérés comme « historique » (supprimables par le client/l'admin). */
const HISTORY_STATUSES = ['terminée', 'annulée'];

/**
 * Supprime définitivement les commandes de l'historique (terminées ou annulées)
 * d'un client, avec leurs lignes et livraisons associées. Les commandes encore
 * actives ne sont jamais touchées.
*  Retourne le nombre de commandes supprimées.
 */
async function clearHistory(userId) {
  return sequelize.transaction(async (tx) => {
    const orders = await Order.findAll({
      where: { userId, status: HISTORY_STATUSES },
      attributes: ['id'],
      transaction: tx,
    });
    if (!orders.length) return 0;
    const ids = orders.map((o) => o.id);
    await Livraison.destroy({ where: { orderId: ids }, transaction: tx });
    await OrderItem.destroy({ where: { orderId: ids }, transaction: tx });
    return Order.destroy({ where: { id: ids }, transaction: tx });
  });
}

/**
 * Version administrateur : purge l'historique (commandes terminées/annulées)
 * de TOUS les clients. Retourne le nombre de commandes supprimées.
 */
async function clearHistoryAdmin() {
  return sequelize.transaction(async (tx) => {
    const orders = await Order.findAll({
      where: { status: HISTORY_STATUSES },
      attributes: ['id'],
      transaction: tx,
    });
    if (!orders.length) return 0;
    const ids = orders.map((o) => o.id);
    await Livraison.destroy({ where: { orderId: ids }, transaction: tx });
    await OrderItem.destroy({ where: { orderId: ids }, transaction: tx });
    return Order.destroy({ where: { id: ids }, transaction: tx });
  });
}

/**
 * Annule une commande (client ou admin) : restaure les stocks,
 * annule les livraisons associées encore en cours, fige le statut.
 * Hors transaction retour : interdit.
 */
async function cancelOrder(order, { by = 'client', transaction: externalTx } = {}) {
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw Object.assign(new Error('Cette commande ne peut plus être annulée (déjà prise en charge ou terminée).'), { status: 400 });
  }

  const run = async (tx) => {
    const items = await OrderItem.findAll({ where: { orderId: order.id }, transaction: tx });
    for (const it of items) {
      if (it.productId) {
        await Product.increment('stock', { by: it.quantity, where: { id: it.productId }, transaction: tx });
      }
    }
    await Livraison.update(
      { status: 'annulée', cancelledAt: new Date() },
      { where: { orderId: order.id, status: 'en_cours' }, transaction: tx }
    );
    await order.update({ status: 'annulée', cancelledAt: new Date() }, { transaction: tx });
    return order;
  };

  if (externalTx) return run(externalTx);
  return sequelize.transaction(run);
}

/**
 * Produits achetés par un client (avec quantités totales cumulées).
 * Retourne une liste dédupliquée par produit, classée par dernier achat.
 */
async function productsPurchased(userId) {
  const { ProductImage } = require('../models');
  const items = await OrderItem.findAll({
    where: { '$Order.userId$': userId },
    include: [
      { model: Order, as: 'Order', attributes: ['id', 'status', 'createdAt'], required: true },
      {
        model: Product,
        as: 'Product',
        attributes: ['id', 'name', 'slug', 'price', 'stock', 'active'],
        include: [{ model: ProductImage, as: 'images', attributes: ['url', 'position'] }],
      },
    ],
    order: [[{ model: Order, as: 'Order' }, 'createdAt', 'DESC']],
    raw: true,
  });

  // Regroupe les images par produit (l'include multi-alias produit des lignes plates).
  const imagesByProduct = new Map();
  for (const it of items) {
    if (!it['Product.id']) continue;
    const list = imagesByProduct.get(it['Product.id']) || [];
    if (it['Product.images.url']) list.push({ url: it['Product.images.url'], position: it['Product.images.position'] });
    imagesByProduct.set(it['Product.id'], list);
  }

  const map = new Map();
  for (const it of items) {
    if (it['Order.status'] === 'annulée') continue;
    if (!it['Product.id']) continue;
    const key = it['Product.id'];
    const existing = map.get(key);
    if (existing) existing.quantity += Number(it.quantity);
    else {
      const images = (imagesByProduct.get(key) || []).sort((a, b) => (a.position || 0) - (b.position || 0));
      map.set(key, {
        id: it['Product.id'],
        name: it['Product.name'],
        slug: it['Product.slug'],
        price: it['Product.price'],
        stock: it['Product.stock'],
        active: it['Product.active'],
        images,
        quantity: Number(it.quantity),
      });
    }
  }
  return [...map.values()];
}

module.exports = {
  ORDER_STATUSES,
  CANCELLABLE_STATUSES,
  HISTORY_STATUSES,
  DELIVERY_MODES,
  PAYMENT_METHODS,
  PAYMENT_METHOD_KEYS,
  normalizePaymentMethod,
  placeOrder,
  listOrders,
  getOrderForUser,
  advanceStatus,
  transitionStatus,
  nextStatus,
  cancelOrder,
  clearHistory,
  clearHistoryAdmin,
  productsPurchased,
};
