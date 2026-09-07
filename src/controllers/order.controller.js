'use strict';

const orderService = require('../services/order.service');
const cartService = require('../services/cart.service');
const { Review, Order } = require('../models');

const ORDER_STATUSES_LABELS = orderService.ORDER_STATUSES;

/** POST /api/orders { address, deliveryMode, paymentMethod } */
async function createOrder(req, res, next) {
  try {
    const ctx = req.user ? { userId: req.user.id, cartToken: null } : { userId: null, cartToken: req.headers['x-cart-token'] };
    const { address, deliveryMode, paymentMethod, couponCode } = req.body;
    const order = await orderService.placeOrder({ ...ctx, address, deliveryMode, paymentMethod, couponCode });
    return res.status(201).json(serializeOrder(order));
  } catch (err) {
    return next(err);
  }
}

/** GET /api/orders */
async function listOrders(req, res, next) {
  try {
    const orders = await orderService.listOrders(req.user.id);
    return res.json({ orders: orders.map(serializeOrder) });
  } catch (err) {
    return next(err);
  }
}

function serializeOrder(order) {
  if (!order) return null;
  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    total: order.total,
    shipping: order.shipping,
    discount: order.discount,
    couponCode: order.couponCode,
    paymentMethod: order.paymentMethod,
    deliveryMode: order.deliveryMode,
    address: order.addressSnapshot ? JSON.parse(order.addressSnapshot) : null,
    date: order.createdAt,
    items: (order.items || []).map((i) => ({
      name: i.nameSnapshot,
      price: i.priceSnapshot,
      priceFormatted: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(i.priceSnapshot),
      quantity: i.quantity,
    })),
  };
}

/** GET /api/orders/:reference */
async function getOrder(req, res, next) {
  try {
    const order = await orderService.getOrderForUser(req.user ? req.user.id : null, req.params.reference);
    if (!order) return res.status(404).json({ error: 'Commande introuvable.' });
    return res.json({ order: serializeOrder(order) });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/products/:slug/reviews — avis vérifié si le client a acheté */
async function addReview(req, res, next) {
  try {
    const { slug } = req.params;
    const { rating, comment } = req.body;

    const { Product } = require('../models');
    const product = await Product.findOne({ where: { slug } });
    if (!product) return res.status(404).json({ error: 'Produit introuvable.' });

    const existing = await Review.findOne({ where: { productId: product.id, userId: req.user.id } });
    if (existing) {
      return res.status(409).json({ error: 'Vous avez déjà publié un avis pour ce produit.' });
    }

    // Vérifie que le client a bien commandé ce produit (par ID produit)
    const { OrderItem } = require('../models');
    const purchased = await Order.findAll({
      where: { userId: req.user.id },
      include: [{ model: OrderItem, as: 'items' }],
    });
    const owns = purchased.some((o) => (o.items || []).some((it) => Number(it.productId) === Number(product.id)));

    const review = await Review.create({
      productId: product.id,
      userId: req.user.id,
      rating: Number(rating),
      comment: comment || null,
      verified: owns,
    });

    return res.status(201).json({
      review: { id: review.id, rating: review.rating, comment: review.comment, verified: review.verified },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { createOrder, listOrders, getOrder, addReview, ORDER_STATUSES_LABELS };