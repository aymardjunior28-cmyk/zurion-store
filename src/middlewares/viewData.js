'use strict';

/**
 * Middleware de données de vue (SSR) :
 * injecte dans res.locals tout ce dont les pages et le layout ont besoin :
 * helpers EJS, utilisateur courant, panier + compteur, catégories.
 * Monté UNIQUEMENT sur le routeur de pages (pas sur l'API).
 */
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const { COOKIE_NAME } = require('./auth');
const cartService = require('../services/cart.service');
const { listCategories } = require('../services/catalog.service');
const { helpers } = require('../utils/views-helpers');

module.exports = async function viewData(req, res, next) {
  try {
    // Helpers EJS (money, esc, productImage, stockLabel, deliveryModes…)
    Object.assign(res.locals, helpers);
    res.locals.currentPath = (req.originalUrl || req.path).split('?')[0];
    res.locals.cartToken = req.cookies.zurion_cart_token || '';
    res.locals.currentUser = null;

    // Utilisateur courant (JWT en cookie httpOnly)
    const token = req.cookies[COOKIE_NAME];
    if (token) {
      try {
        const payload = jwt.verify(token, env.jwtSecret);
        const user = await User.findByPk(payload.sub);
        if (user) {
          req.user = user;
          res.locals.currentUser = user;
        }
      } catch (_) {
        /* session expirée ou invalide : visiteur anonyme */
      }
    }

    // Panier (connecté → userId, invité → cookie miroir du token JS)
    const cart = await cartService.getCart({
      userId: req.user ? req.user.id : null,
      token: req.user ? null : res.locals.cartToken || null,
    });
    res.locals.cart = cart;
    res.locals.cartCount = cartService.cartTotals(cart).count;

    // Catégories actives (navigation du header)
    res.locals.categories = await listCategories();

    return next();
  } catch (err) {
    return next(err);
  }
};