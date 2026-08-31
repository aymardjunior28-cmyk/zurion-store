'use strict';

/**
 * Helpers rendus disponibles dans TOUTES les vues EJS :
 * app.locals.xxx — accessible via process.env dans le template ou res.locals.
 */
const { money, discountPercent } = require('../utils/money');
const { esc, truncate } = require('../utils/esc');
const { DELIVERY_MODES, PAYMENT_METHODS, ORDER_STATUSES } = require('../services/order.service');

function viewsHelpers(app) {
  app.locals.money = money;
  app.locals.discountPercent = discountPercent;
  app.locals.esc = esc;
  app.locals.truncate = truncate;
  app.locals.deliveryModes = DELIVERY_MODES;
  app.locals.paymentMethods = PAYMENT_METHODS;
  app.locals.orderStatuses = ORDER_STATUSES;
  app.locals.appName = 'ZURION Store';
  app.locals.year = new Date().getFullYear();

  /**
   * Rendu de l'attribut <img> d'un produit (première image ou fallback).
   * Utilisé partout où une carte produit s'affiche.
   */
  app.locals.productImage = (product) => {
    if (!product) return '';
    if (product.images && product.images.length) return product.images[0].url;
    if (product.image) return product.image;
    return '/assets/images/demos/demo-3/products/product-1.jpg';
  };

  /** Classe CSS pour une carte produit selon son état de stock. */
  app.locals.stockLabel = (product) => {
    if (!product) return { text: 'Indisponible', cls: 'zurion-badge-danger' };
    if (product.stock <= 0) return { text: 'Rupture', cls: 'zurion-badge-danger' };
    if (product.stock < 5) return { text: `Plus que ${product.stock}`, cls: 'zurion-badge-warning' };
    return { text: 'En stock', cls: 'zurion-badge-success' };
  };
}

module.exports = { viewsHelpers };