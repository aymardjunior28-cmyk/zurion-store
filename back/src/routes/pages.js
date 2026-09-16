'use strict';

/**
 * Routeur des pages SSR (rendu EJS côté serveur).
 * Chaque page reçoit un contexte commun : currentUser, cartCount, categories,
 * currentPath et cartToken (panier invité).
 */
const express = require('express');
const jwt = require('jsonwebtoken');

const env = require('../config/env');
const { COOKIE_NAME, signToken, cookieOptions } = require('../middlewares/auth');
const { User, Address, Product, Review, Order, OrderItem, Category, Coupon, Livraison, LivraisonEvent, ProductImage, ProductSpec, Wishlist, ContactMessage, Notification, sequelize } = require('../models');
const catalogService = require('../services/catalog.service');
const cartService = require('../services/cart.service');
const orderService = require('../services/order.service');
const couponService = require('../services/coupon.service');
const deliveryService = require('../services/delivery.service');
const { saveUploadedImage, removeUploadedImage } = require('../utils/upload');
const { slugify } = require('../utils/slugify');
const { hashPassword, comparePassword } = require('../utils/password');
const adminService = require('../services/admin.service');

const router = express.Router();
const COUPON_COOKIE = 'zurion_coupon_code';
const SORTS_SET = new Set(['popular', 'price_asc', 'price_desc', 'newest', 'rating']);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const DEFAULT_DELIVERY = orderService.DELIVERY_MODES.standard;
const DEFAULT_DELIVERY_FEE = DEFAULT_DELIVERY.fee;
const DEFAULT_DELIVERY_LABEL = DEFAULT_DELIVERY.label;

/** Rend une vue dans le layout : body = HTML de la vue, layout autour.
 *  Anti-cache navigateurs/proxies sur les pages SSR (évite de revoir des
 *  icônes/contenus d'une session précédente après déconnexion). */
async function renderPage(req, res, view, locals = {}) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  const currentPath = (typeof res.locals?.currentPath !== 'undefined' && res.locals?.currentPath) ? res.locals.currentPath : req.originalUrl || '/';
  const body = await new Promise((resolve, reject) => {
    res.app.render(view, { ...res.locals, ...locals, currentPath }, (err, html) => (err ? reject(err) : resolve(html)));
  });
  res.render('layout', { ...res.locals, ...locals, body, currentPath });
}

/** Prévisualise une remise, sans jamais considérer le cookie comme fiable. */
async function previewCoupon(cart, rawCode) {
  if (!rawCode || !cart) return { code: null, discount: 0, error: null };
  const subtotal = cartService.cartTotals(cart).subtotal;
  try {
    const coupon = await couponService.validateCoupon(rawCode, subtotal);
    return { code: coupon.code, discount: couponService.applyDiscount(coupon, subtotal), error: null };
  } catch (err) {
    if (err.status === 400) return { code: String(rawCode).trim().toUpperCase(), discount: 0, error: err.message };
    throw err;
  }
}

/** Parse le snapshot de destination d'une livraison pour les vues SSR. */
function parseLivraisonDestinations(livraisons) {
  return livraisons.map((l) => {
    const plain = l.toJSON();
    if (plain.destinationSnapshot) {
      try { plain.destinationParsed = JSON.parse(plain.destinationSnapshot); } catch (_) { plain.destinationParsed = null; }
    } else {
      plain.destinationParsed = null;
    }
    return plain;
  });
}

/** Livraisons assignées à un compte livreur (vues SSR). */
function findLivreurLivraisons(userId) {
  return Livraison.findAll({
    where: { courierId: userId },
    include: [{
      model: Order, as: 'order',
      attributes: ['reference', 'total', 'status'],
      include: [{ model: OrderItem, as: 'items', attributes: ['nameSnapshot', 'priceSnapshot', 'quantity'] }],
    }],
    order: [['id', 'DESC']],
    limit: 50,
  });
}

/** Contexte partagé de toutes les pages. */
router.use(async (req, res, next) => {
  try {
    // Utilisateur courant (session cookie JWT, silencieux si absente/invalide)
    let currentUser = null;
    const raw = req.cookies[COOKIE_NAME];
    if (raw) {
      try {
        const payload = jwt.verify(raw, env.jwtSecret);
        const u = await User.findByPk(payload.sub);
        // Invalidation de session après changement de mot de passe.
        const changedAt = u && u.passwordChangedAt ? Math.floor(new Date(u.passwordChangedAt).getTime() / 1000) : null;
        if (u && (payload.pwc || null) === changedAt) {
          currentUser = u;
        }
      } catch (_) {
        currentUser = null;
      }
    }

    // Panier invité : token généré au premier passage.
    // Le cookie est httpOnly ; le MÊME token est rendu dans window.ZURION.cartToken
    // pour que le JS client l'utilise dans l'en-tête X-Cart-Token des appels API.
    let cartToken = req.cookies.zurion_cart;
    if (!currentUser) {
      if (!cartToken) {
        cartToken = cartService.newToken();
      }
      res.cookie('zurion_cart', cartToken, { ...cookieOptions(), maxAge: 30 * 24 * 60 * 60 * 1000 });
    }

    // Panier + compteur
    const cart = await cartService.getCart({
      userId: currentUser ? currentUser.id : null,
      token: currentUser ? null : cartToken,
    });
    const cartCount = cart ? cart.items.reduce((s, l) => s + l.quantity, 0) : 0;

    // Catégories actives (header + page d'accueil)
    const categories = await catalogService.listCategories();

    res.locals.currentUser = currentUser;
    // Les routes SSR protégées partagent les mêmes contrôleurs que l'API et
    // attendent `req.user`. Le contexte des vues reste la source d'affichage,
    // mais l'instance authentifiée doit aussi être disponible sur la requête.
    req.user = currentUser;
    res.locals.cartToken = cartToken || '';
    res.locals.cart = cart || null;
    res.locals.cartCount = cartCount;
    res.locals.categories = categories;
    res.locals.currentPath = req.path;
    return next();
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------------ */
/* Boutique                                                            */
/* ------------------------------------------------------------------ */

// Accueil : promotions + nouveautés
router.get('/', async (req, res, next) => {
  try {
    const [popular, newArrivals] = await Promise.all([
      catalogService.listProducts({ sort: 'popular', limit: 8 }),
      catalogService.getNewProducts(8),
    ]);
    const promos = popular.products.filter((p) => p.oldPrice && p.oldPrice > p.price).slice(0, 4);
    const heroPool = promos.length ? promos : newArrivals;
    return renderPage(req, res, 'home', {
      title: 'Accueil',
      promos: heroPool.length ? heroPool : [{ name: 'ZURION', images: [], slug: 'catalogue', category: null, stock: 1, price: 0, oldPrice: null }],
      newArrivals,
    });
  } catch (err) { return next(err); }
});

// Catalogue : recherche + filtres + tri + pagination
router.get('/catalogue', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const category = String(req.query.category || '').slice(0, 80);
    const sort = SORTS_SET.has(req.query.sort) ? String(req.query.sort) : 'popular';
    const page = Math.max(Number(req.query.page) || 1, 1);
    const max = /^\d+$/.test(String(req.query.max || '')) ? Number(req.query.max) : undefined;
    const inStock = req.query.inStock === '1';
    const { products, meta, allCategories } = await catalogService.listProducts({
      q: q || undefined, category, sort, page, limit: 12,
      max,
      inStock: inStock ? true : undefined,
    });
    const currentCategory = category || '';
    const currentSort = sort;
    const cat = currentCategory ? allCategories.find((c) => c.slug === currentCategory) : null;
    return renderPage(req, res, 'catalog', {
      title: cat ? cat.name : 'Catalogue',
      products, meta, categories: allCategories,
      currentCategory, currentSort,
      q,
      currentMax: max != null ? String(max) : '',
      inStock,
      categoryName: cat ? cat.name : '',
    });
  } catch (err) { return next(err); }
});

// Fiche produit
router.get('/produit/:slug', async (req, res, next) => {
  try {
    const product = await catalogService.getProductBySlug(req.params.slug);
    if (!product || !product.active) {
      return res.status(404).render('layout', {
        ...res.locals,
        title: 'Produit introuvable',
        body: '<div class="container"><div class="zurion-empty"><i class="icon-search" style="font-size:4rem"></i><h1>Produit introuvable</h1><p>Ce produit n’existe pas ou n’est plus disponible.</p><a class="btn btn-primary" href="/catalogue">Retour au catalogue</a></div></div>',
      });
    }
    const reviews = product.reviews || [];
    const reviewCount = reviews.length;
    const averageRating = reviewCount
      ? Math.round((reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviewCount) * 10) / 10
      : 0;
    return renderPage(req, res, 'product', { title: product.name, product, reviewCount, averageRating });
  } catch (err) { return next(err); }
});

// Publication d'un avis depuis la fiche produit SSR.
router.post('/produit/:slug/avis', async (req, res, next) => {
  try {
    const user = res.locals.currentUser;
    if (!user) return res.redirect('/connexion');
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 1000) {
      return res.redirect(`/produit/${encodeURIComponent(req.params.slug)}`);
    }
    const product = await Product.findOne({ where: { slug: req.params.slug, active: true } });
    if (!product) return res.redirect('/catalogue');
    const existing = await Review.findOne({ where: { productId: product.id, userId: user.id } });
    if (existing) return res.redirect(`/produit/${encodeURIComponent(product.slug)}#avis`);
    const purchased = await Order.findOne({
      where: { userId: user.id },
      include: [{ model: OrderItem, as: 'items', where: { productId: product.id }, required: true }],
    });
    await Review.create({ productId: product.id, userId: user.id, rating, comment: comment || null, verified: Boolean(purchased) });
    return res.redirect(`/produit/${encodeURIComponent(product.slug)}#avis`);
  } catch (err) { return next(err); }
});

// Panier
router.get('/panier', async (req, res, next) => {
  try {
    const cart = await cartService.getCart({
      userId: res.locals.currentUser ? res.locals.currentUser.id : null,
      token: res.locals.currentUser ? null : res.locals.cartToken,
    });
    const coupon = await previewCoupon(cart, req.cookies[COUPON_COOKIE]);
    return renderPage(req, res, 'cart', { title: 'Panier', cart: cart || null, totals: cartService.cartTotals(cart, DEFAULT_DELIVERY_FEE), coupon, deliveryLabel: DEFAULT_DELIVERY_LABEL });
  } catch (err) { return next(err); }
});

// Applique une promotion au panier. Elle sera toujours revérifiée à la commande.
router.post('/panier/code-promo', async (req, res, next) => {
  try {
    const cart = res.locals.cart;
    const coupon = await previewCoupon(cart, req.body.couponCode);
    if (coupon.error) {
      return renderPage(req, res, 'cart', {
        title: 'Panier',
        cart,
        totals: cartService.cartTotals(cart, DEFAULT_DELIVERY_FEE),
        coupon,
        deliveryLabel: DEFAULT_DELIVERY_LABEL,
      });
    }
    res.cookie(COUPON_COOKIE, coupon.code, { ...cookieOptions(), maxAge: 30 * 24 * 60 * 60 * 1000 });
    return res.redirect('/panier');
  } catch (err) { return next(err); }
});

router.post('/panier/code-promo/supprimer', (req, res) => {
  res.clearCookie(COUPON_COOKIE, cookieOptions());
  return res.redirect('/panier');
});

// Vider le panier : mutation uniquement par POST (jamais via un lien GET).
router.post('/panier/vider', async (req, res, next) => {
  try {
    const cart = await cartService.getCart({
      userId: res.locals.currentUser ? res.locals.currentUser.id : null,
      token: res.locals.currentUser ? null : res.locals.cartToken,
    });
    await cartService.clearCart(cart);
    return res.redirect('/panier');
  } catch (err) { return next(err); }
});

// Checkout (formulaire) — panier requis
router.get('/commande', async (req, res, next) => {
  try {
    const cart = await cartService.getCart({
      userId: res.locals.currentUser ? res.locals.currentUser.id : null,
      token: res.locals.currentUser ? null : res.locals.cartToken,
    });
    if (!cart || !cart.items.length) return res.redirect('/panier');
    const coupon = await previewCoupon(cart, req.cookies[COUPON_COOKIE]);
    return renderPage(req, res, 'checkout', { title: 'Commande', cart, totals: cartService.cartTotals(cart, DEFAULT_DELIVERY_FEE), coupon, error: null, values: { couponCode: coupon.code || '' }, deliveryLabel: DEFAULT_DELIVERY_LABEL, deliveryModes: orderService.DELIVERY_MODES, paymentMethods: orderService.PAYMENT_METHODS });
  } catch (err) { return next(err); }
});

// Checkout (soumission) — crée la commande puis redirige vers la confirmation
router.post('/commande', async (req, res, next) => {
  const { fullName, phone, line1, line2, city, region, deliveryMode, paymentMethod } = req.body;
  const couponCode = req.body.couponCode !== undefined ? req.body.couponCode : req.cookies[COUPON_COOKIE];
  try {
    const user = res.locals.currentUser;
    const order = await orderService.placeOrder({
      userId: user ? user.id : null,
      cartToken: user ? null : res.locals.cartToken,
      paymentMethod,
      deliveryMode,
      address: { fullName, phone, line1, line2, city, region },
      couponCode,
    });
    res.clearCookie(COUPON_COOKIE, cookieOptions());
    return res.redirect('/commande/confirmation/' + order.reference);
  } catch (err) {
    if (!err.status) return next(err);
    const cart = res.locals.cart;
    const coupon = await previewCoupon(cart, couponCode);
    return renderPage(req, res, 'checkout', {
      title: 'Commande',
      cart, totals: cartService.cartTotals(cart, DEFAULT_DELIVERY_FEE), coupon,
      error: err.message, values: req.body,
      deliveryLabel: DEFAULT_DELIVERY_LABEL, deliveryModes: orderService.DELIVERY_MODES, paymentMethods: orderService.PAYMENT_METHODS,
    });
  }
});

// Confirmation de commande
router.get('/commande/confirmation/:reference', async (req, res, next) => {
  try {
    const user = res.locals.currentUser;
    const order = await orderService.getOrderForUser(user ? user.id : null, req.params.reference, { allowGuest: true });
    if (!order) return res.redirect('/');
    return renderPage(req, res, 'confirmation', { title: 'Commande confirmée', order });
  } catch (err) { return next(err); }
});

/* ------------------------------------------------------------------ */
/* Authentification                                                    */
/* ------------------------------------------------------------------ */

router.get('/connexion', (req, res) => {
  if (res.locals.currentUser) return res.redirect('/compte');
  return renderPage(req, res, 'connexion', { title: 'Connexion', error: null, values: {} });
});

router.post('/connexion', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = email ? await User.findOne({ where: { email: String(email).toLowerCase().trim() } }) : null;
    const ok = user && (await comparePassword(password || '', user.passwordHash));
    if (!ok) {
      return renderPage(req, res, 'connexion', { title: 'Connexion', error: 'E-mail ou mot de passe incorrect.', values: { email } });
    }
    await cartService.mergeGuestIntoUser(res.locals.cartToken, user.id);
    res.cookie(COOKIE_NAME, signToken(user), cookieOptions());
    // Les livreurs arrivent directement sur leur tableau de bord (livraisons).
    return res.redirect(user.role === 'livreur' ? '/livreur' : '/compte');
  } catch (err) { return next(err); }
});

router.get('/inscription', (req, res) => {
  if (res.locals.currentUser) return res.redirect('/compte');
  return renderPage(req, res, 'inscription', { title: 'Inscription', error: null, values: {} });
});

router.post('/inscription', async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const values = { firstName, lastName, email };
    if (!firstName || !lastName || !email || !password || String(password).length < 8) {
      return renderPage(req, res, 'inscription', {
        title: 'Inscription',
        error: 'Tous les champs sont requis (mot de passe : 8 caractères minimum).',
        values,
      });
    }
    const exists = await User.findOne({ where: { email: String(email).toLowerCase().trim() } });
    if (exists) {
      return renderPage(req, res, 'inscription', { title: 'Inscription', error: 'Un compte existe déjà avec cet e-mail.', values });
    }
    const user = await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: String(email).toLowerCase().trim(),
      passwordHash: await hashPassword(String(password)),
      role: 'customer',
    });
    await cartService.mergeGuestIntoUser(res.locals.cartToken, user.id);
    res.cookie(COOKIE_NAME, signToken(user), cookieOptions());
    return res.redirect('/compte');
  } catch (err) { return next(err); }
});

router.post('/deconnexion', (req, res) => {
  // Déconnexion totale côté navigateur : session + CSRF + panier invité + coupon.
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.clearCookie('zurion_csrf', { path: '/' });
  res.clearCookie('zurion_cart', { path: '/' });
  res.clearCookie('zurion_coupon_code', { path: '/' });
  return res.redirect('/');
});

/* ------------------------------------------------------------------ */
/* Espace client & favoris                                             */
/* ------------------------------------------------------------------ */

router.get('/compte', async (req, res, next) => {
  try {
    const user = res.locals.currentUser;
    if (!user) return res.redirect('/connexion');
    const isLivreur = user.role === 'livreur';
    const [orders, addresses, purchased, ownedLivraisons] = await Promise.all([
      orderService.listOrders(user.id),
      Address.findAll({ where: { userId: user.id }, order: [['isDefault', 'DESC'], ['id', 'DESC']] }),
      orderService.productsPurchased(user.id),
      isLivreur ? findLivreurLivraisons(user.id) : Promise.resolve([]),
    ]);
    // Les comptes livreurs retrouvent ici leurs livraisons assignées (section Livraison).
    const livraisons = isLivreur ? parseLivraisonDestinations(ownedLivraisons || []) : [];
    return renderPage(req, res, 'compte', { title: 'Mon compte', orders, addresses, purchased, livraisons, okSaved: req.query.ok || false, historyClearedCount: Number(req.query.count) || 0 });
  } catch (err) { return next(err); }
});

// Annulation d'une commande par le client (uniquement avant expédition).
router.post('/compte/commandes/:reference/annuler', async (req, res, next) => {
  try {
    const user = res.locals.currentUser;
    if (!user) return res.redirect('/connexion');
    const order = await Order.findOne({ where: { reference: req.params.reference, userId: user.id } });
    if (!order) return res.redirect('/compte');
    await orderService.cancelOrder(order, { by: 'client' });
    return res.redirect('/compte');
  } catch (err) { return next(err); }
});

// Effacement de l'historique des commandes par le client
// (supprime uniquement ses commandes terminées ou annulées).
router.post('/compte/commandes/historique/effacer', async (req, res, next) => {
  try {
    const user = res.locals.currentUser;
    if (!user) return res.redirect('/connexion');
    const deletedCount = Number(await orderService.clearHistory(user.id)) || 0;
    return res.redirect(`/compte?ok=cleared&count=${deletedCount}`);
  } catch (err) { return next(err); }
});

router.post('/compte/profil', async (req, res, next) => {
  try {
    const user = res.locals.currentUser;
    if (!user) return res.redirect('/connexion');
    const firstName = String(req.body.firstName || '').trim();
    const lastName = String(req.body.lastName || '').trim();
    const phone = String(req.body.phone || '').trim();
    if (firstName.length < 2 || lastName.length < 2 || firstName.length > 80 || lastName.length > 80 || phone.length > 30) {
      return res.redirect('/compte');
    }
    await user.update({ firstName, lastName, phone: phone || null });
    return res.redirect('/compte');
  } catch (err) { return next(err); }
});

router.post('/compte/mot-de-passe', async (req, res, next) => {
  try {
    const user = res.locals.currentUser;
    if (!user) return res.redirect('/connexion');
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      return res.redirect('/compte');
    }
    const ok = await comparePassword(currentPassword, user.passwordHash);
    if (!ok) return res.redirect('/compte');
    await user.update({
      passwordHash: await hashPassword(newPassword),
      passwordChangedAt: new Date(),
    });
    // Re-signe immédiatement une session valide pour ne pas déconnecter l'utilisateur.
    res.cookie(COOKIE_NAME, signToken(user), cookieOptions());
    return res.redirect('/compte');
  } catch (err) { return next(err); }
});

router.post('/compte/adresses', async (req, res, next) => {
  try {
    const user = res.locals.currentUser;
    if (!user) return res.redirect('/connexion');
    const { label, fullName, phone, line1, line2, city, region } = req.body;
    const required = [fullName, phone, line1, city, region].map((v) => String(v || '').trim());
    if (required.some((v) => !v) || required.some((v) => v.length > 180)) return res.redirect('/compte');
    const makeDefault = req.body.isDefault === 'on' || !(await Address.count({ where: { userId: user.id } }));
    if (makeDefault) await Address.update({ isDefault: false }, { where: { userId: user.id } });
    await Address.create({ userId: user.id, label: String(label || 'Domicile').trim().slice(0, 60), fullName: required[0], phone: required[1], line1: required[2], line2: String(line2 || '').trim().slice(0, 180) || null, city: required[3], region: required[4], isDefault: makeDefault });
    return res.redirect('/compte');
  } catch (err) { return next(err); }
});

router.post('/compte/adresses/:id/supprimer', async (req, res, next) => {
  try {
    const user = res.locals.currentUser;
    if (!user) return res.redirect('/connexion');
    await Address.destroy({ where: { id: Number(req.params.id), userId: user.id } });
    return res.redirect('/compte');
  } catch (err) { return next(err); }
});

router.get('/favoris', async (req, res, next) => {
  try {
    const user = res.locals.currentUser;
    let products = [];
    if (user) {
      const rows = await Wishlist.findAll({ where: { userId: user.id } });
      const ids = rows.map((r) => r.productId);
      if (ids.length) {
        products = await Product.findAll({
          where: { id: ids, active: true },
          include: [
            { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
            { model: ProductImage, as: 'images', attributes: ['id', 'url', 'position'] },
          ],
        });
      }
    }
    return renderPage(req, res, 'favoris', { title: 'Mes favoris', products });
  } catch (err) { return next(err); }
});

/* ------------------------------------------------------------------ */
/* Pages institutionnelles : contact, livraison et retours             */
/* ------------------------------------------------------------------ */

router.get('/contact', (req, res) => {
  return renderPage(req, res, 'contact', { title: 'Contact', error: null, success: null, values: {} });
});

router.post('/contact', async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;
    const values = { name, email, subject, message };
    if (!name || !String(name).trim() || !email || !String(email).trim() || !subject || !String(subject).trim() || !message || !String(message).trim()) {
      return renderPage(req, res, 'contact', {
        title: 'Contact',
        error: 'Veuillez remplir tous les champs du formulaire.',
        success: null,
        values,
      });
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(String(email).trim())) {
      return renderPage(req, res, 'contact', {
        title: 'Contact',
        error: 'Veuillez saisir une adresse e-mail valide.',
        success: null,
        values,
      });
    }
    // Le message est enregistré en base pour suivi (table ContactMessage).
    await ContactMessage.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      subject: String(subject).trim(),
      message: String(message).trim(),
      userId: res.locals.currentUser ? res.locals.currentUser.id : null,
      status: 'nouveau',
    });
    return renderPage(req, res, 'contact', {
      title: 'Contact',
      error: null,
      success: 'Votre message a bien été envoyé. Notre équipe vous répondra sous 24 h ouvrées.',
      values: {},
    });
  } catch (err) { return next(err); }
});

router.get('/livraison', (req, res) => {
  return renderPage(req, res, 'livraison', { title: 'Livraison et retours' });
});

router.get('/faq', (req, res) => {
  return renderPage(req, res, 'faq', { title: 'FAQ' });
});

router.get('/mentions-legales', (req, res) => renderPage(req, res, 'legal', { title: 'Mentions légales', kind: 'legal' }));
router.get('/confidentialite', (req, res) => renderPage(req, res, 'legal', { title: 'Politique de confidentialité', kind: 'privacy' }));
router.get('/cookies', (req, res) => renderPage(req, res, 'legal', { title: 'Politique cookies', kind: 'cookies' }));
router.get('/cgu', (req, res) => renderPage(req, res, 'legal', { title: 'Conditions générales', kind: 'terms' }));

/* ------------------------------------------------------------------ */
/* Back-office (rôle admin requis)                                     */
/* ------------------------------------------------------------------ */

// Onglets du back-office accessibles aux administrateurs (hors super-admin) :
// gestion des produits, codes promo, livraisons et comptes livreurs.
const ADMIN_ALLOWED_TABS = new Set(['products', 'coupons', 'livraisons', 'couriers']);

function requireAdminPage(req, res, next) {
  const user = res.locals.currentUser;
  if (!user) return res.redirect('/connexion');
  if (!['admin', 'superadmin'].includes(user.role)) return res.redirect('/');
  res.locals.isSuperAdmin = user.role === 'superadmin';
  const tab = req.query.tab || 'overview';
  const isDashboardRoute = req.originalUrl.split('?')[0].replace(/\/$/, '') === '/admin';
  if (isDashboardRoute && user.role === 'admin' && !ADMIN_ALLOWED_TABS.has(tab)) return res.redirect('/admin?tab=livraisons');
  return next();
}

function requireSuperAdminPage(req, res, next) {
  if (!res.locals.currentUser || res.locals.currentUser.role !== 'superadmin') return res.redirect('/admin?tab=livraisons');
  return next();
}

/** Extrait et valide les identifiants cochés d'un formulaire « suppression multiple ». */
function bulkIds(body) {
  const raw = body.ids;
  const list = Array.isArray(raw) ? raw : (raw === undefined ? [] : [raw]);
  const ids = list.map((value) => Number(value)).filter((n) => Number.isInteger(n) && n >= 1);
  return [...new Set(ids)];
}

router.use('/admin', requireAdminPage);

router.get('/admin', async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    const deliveryService = require('../services/delivery.service');
    const [productCount, orderCount, revenue, allProducts, recentOrders, categories, coupons, couriers, livreurs, users, livraisons, assignableOrders] = await Promise.all([
      Product.count(),
      Order.count(),
      Order.sum('total'),
      Product.findAll({ order: [['id', 'ASC']] }),
      Order.findAll({ include: [{ model: OrderItem, as: 'items' }], order: [['createdAt', 'DESC']], limit: 60 }),
      Category.findAll({ order: [['sortOrder', 'ASC'], ['name', 'ASC']] }),
      Coupon.findAll({ order: [['id', 'DESC']] }),
      deliveryService.listCouriers(),
      deliveryService.listLivreurAccounts(),
      User.findAll({ attributes: { exclude: ['passwordHash'] }, order: [['createdAt', 'DESC']], limit: 100 }),
      deliveryService.listDeliveries({ limit: 200 }),
      deliveryService.listAssignableOrders(),
    ]);

    const lowStockProducts = allProducts.filter((p) => p.stock < 5).slice(0, 6);

    // ── Statistiques de ventes avancées ──
    const paidStatuses = ['paiement_confirmé', 'préparation', 'expédition', 'livraison', 'terminée'];
    const paidOrders = await Order.findAll({
      where: { status: { [Op.in]: paidStatuses } },
      attributes: ['total', 'createdAt', 'status'],
      raw: true,
    });

    // Chiffre d'affaires du mois en cours
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthOrders = paidOrders.filter((o) => new Date(o.createdAt) >= startOfMonth);
    const revenueMonth = monthOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const orderCountMonth = await Order.count({ where: { createdAt: { [Op.gte]: startOfMonth } } });

    // Chiffre d'affaires de la semaine
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const weekOrders = paidOrders.filter((o) => new Date(o.createdAt) >= startOfWeek);
    const revenueWeek = weekOrders.reduce((s, o) => s + Number(o.total || 0), 0);

    // Panier moyen
    const avgBasket = paidOrders.length ? Math.round(paidOrders.reduce((s, o) => s + Number(o.total || 0), 0) / paidOrders.length) : 0;

    // Répartition des commandes par statut
    const ordersByStatus = await Order.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true,
    });

    // Top 5 produits les plus vendus
    const topProducts = await OrderItem.findAll({
      attributes: ['productId', 'nameSnapshot', [sequelize.fn('SUM', sequelize.col('quantity')), 'totalSold'], [sequelize.fn('SUM', sequelize.col('priceSnapshot')), 'totalRevenue']],
      where: { productId: { [Op.not]: null } },
      group: ['productId', 'nameSnapshot'],
      order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']],
      limit: 5,
      raw: true,
    });

    // Livraisons en cours
    const activeDeliveries = livraisons.filter((l) => l.status === 'en_cours').length;
    const deliveredCount = livraisons.filter((l) => l.status === 'livrée').length;

    return renderPage(req, res, 'admin/dashboard', {
      title: 'Administration',
      stats: {
        productCount,
        orderCount,
        revenue: revenue || 0,
        lowStockCount: lowStockProducts.length,
        revenueMonth,
        revenueWeek,
        orderCountMonth,
        avgBasket,
        activeDeliveries,
        deliveredCount,
        totalDeliveries: livraisons.length,
      },
      ordersByStatus,
      topProducts,
      lowStockProducts,
      recentOrders,
      products: allProducts,
      categories,
      coupons,
      couriers,
      livreurs,
      users,
      livraisons,
      assignableOrders,
      error: req.query.err || null,
      activeTab: req.query.tab || 'overview',
      okSaved: req.query.ok || false,
      historyClearedCount: Number(req.query.count) || 0,
      bulkCount: Number(req.query.count) || 0,
    });
  } catch (err) { return next(err); }
});

// Les pages séparées redirigent vers le tableau de bord unique /admin (onglet actif).
router.get('/admin/produits', (req, res) => res.redirect('/admin?tab=products'));
router.get('/admin/categories', (req, res) => res.redirect('/admin?tab=categories'));
router.get('/admin/utilisateurs', (req, res) => res.redirect('/admin?tab=users'));

router.post('/admin/utilisateurs/admin', requireSuperAdminPage, async (req, res, next) => {
  try {
    await adminService.createAdmin(req.body);
    return res.redirect('/admin?tab=users&ok=1');
  } catch (err) {
    if (!err.status && err.name !== 'SequelizeUniqueConstraintError') return next(err);
    const message = err.name === 'SequelizeUniqueConstraintError' ? 'Un compte existe déjà avec cet e-mail.' : err.message;
    return res.redirect(`/admin?tab=users&err=${encodeURIComponent(message)}`);
  }
});

// Suppression d'un compte avec toutes ses données (réservée au super-admin).
router.post('/admin/utilisateurs/:id/supprimer', requireSuperAdminPage, async (req, res, next) => {
  try {
    const actor = res.locals.currentUser;
    await adminService.deleteUserAccount(req.params.id, actor ? actor.id : null);
    return res.redirect('/admin?tab=users&ok=deleted');
  } catch (err) {
    if (!err.status) return next(err);
    return res.redirect(`/admin?tab=users&err=${encodeURIComponent(err.message)}`);
  }
});

// Suppression multiple de comptes (réservée au super-admin ; son compte et les
// comptes super-admin sont exclus de la sélection).
router.post('/admin/utilisateurs/suppression-multiple', requireSuperAdminPage, async (req, res, next) => {
  try {
    const actor = res.locals.currentUser;
    const ids = bulkIds(req.body);
    if (!ids.length) throw Object.assign(new Error('Aucun compte sélectionné.'), { status: 400 });
    const excluded = new Set([Number(actor ? actor.id : 0)]);

    let deleted = 0;
    for (const id of ids) {
      if (excluded.has(id)) continue;
      try {
        await adminService.deleteUserAccount(id, actor ? actor.id : null);
        deleted += 1;
      } catch (err) {
        if (err.status === 403 || err.status === 404 || err.message.includes('super-administrateur')) continue;
        throw err;
      }
    }
    if (!deleted) throw Object.assign(new Error('Aucun compte supprimable parmi la sélection.'), { status: 400 });
    return res.redirect(`/admin?tab=users&ok=bulk-users&count=${deleted}`);
  } catch (err) {
    if (!err.status) return next(err);
    return res.redirect(`/admin?tab=users&err=${encodeURIComponent(err.message)}`);
  }
});

// POST — gestion des catégories (le GET redirige vers /admin?tab=categories).
router.post('/admin/categories', requireSuperAdminPage, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (name.length < 2 || name.length > 120) throw Object.assign(new Error('Nom de catégorie invalide.'), { status: 400 });
    await Category.create({ name, slug: slugify(name), description: String(req.body.description || '').trim() || null, active: req.body.active === 'on', sortOrder: Number.isInteger(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0 });
    return res.redirect('/admin?tab=categories');
  } catch (err) {
    if (!err.status && err.name !== 'SequelizeUniqueConstraintError') return next(err);
    return res.redirect(`/admin?tab=categories&err=${encodeURIComponent(err.name === 'SequelizeUniqueConstraintError' ? 'Cette catégorie existe déjà.' : err.message)}`);
  }
});

// Suppression multiple de catégories (les produits rattachés deviennent sans catégorie).
router.post('/admin/categories/suppression-multiple', requireSuperAdminPage, async (req, res, next) => {
  try {
    const ids = bulkIds(req.body);
    if (!ids.length) throw Object.assign(new Error('Aucune catégorie sélectionnée.'), { status: 400 });
    const destroyed = await Category.destroy({ where: { id: ids } });
    return res.redirect(`/admin?tab=categories&ok=bulk-categories&count=${destroyed}`);
  } catch (err) {
    if (!err.status) return next(err);
    return res.redirect(`/admin?tab=categories&err=${encodeURIComponent(err.message)}`);
  }
});

router.post('/admin/categories/:id', requireSuperAdminPage, async (req, res, next) => {
  try {
    const category = await Category.findByPk(Number(req.params.id));
    if (!category) return res.redirect('/admin?tab=categories');
    const name = String(req.body.name || '').trim();
    if (name.length < 2 || name.length > 120) return res.redirect('/admin?tab=categories');
    await category.update({ name, slug: slugify(name), active: req.body.active === 'on', sortOrder: Number(req.body.sortOrder) || 0 });
    return res.redirect('/admin?tab=categories');
  } catch (err) { return next(err); }
});

// Suppression d'une catégorie (les produits rattachés deviennent sans catégorie).
router.post('/admin/categories/:id/supprimer', requireSuperAdminPage, async (req, res, next) => {
  try {
    await Category.destroy({ where: { id: Number(req.params.id) } });
    return res.redirect('/admin?tab=categories');
  } catch (err) { return next(err); }
});

// POST — création de produit (le GET /admin/produits redirige vers /admin?tab=products).
router.post('/admin/produits', async (req, res, next) => {
  try {
    const { name, description, categoryId, price, oldPrice, stock, imageUrl, featured, active } = req.body;
    const cleanName = String(name || '').trim();
    const numPrice = Number(price);
    const numOldPrice = oldPrice !== undefined && oldPrice !== '' ? Number(oldPrice) : null;
    const numStock = stock !== undefined && stock !== '' ? Number(stock) : 0;
    if (!cleanName || cleanName.length > 180 || !Number.isFinite(numPrice) || numPrice < 0 || numOldPrice !== null && (!Number.isFinite(numOldPrice) || numOldPrice < 0) || !Number.isInteger(numStock) || numStock < 0) {
      throw Object.assign(new Error('Nom, prix et stock invalides (valeurs non négatives requises).'), { status: 400 });
    }
    const cleanImg = String(imageUrl || '').trim();
    if (cleanImg && !/^(https?:\/\/|\/)/i.test(cleanImg)) {
      throw Object.assign(new Error('URL d’image invalide.'), { status: 400 });
    }
    const base = slugify(cleanName);
    const exists = await Product.findOne({ where: { slug: base } });
    const slug = exists ? `${base}-${Date.now().toString().slice(-5)}` : base;
    const product = await Product.create({
      name: cleanName,
      slug,
      description: String(description || '').slice(0, 20000),
      categoryId: categoryId ? Number(categoryId) : null,
      price: numPrice,
      oldPrice: numOldPrice,
      stock: numStock,
      featured: featured === 'on',
      active: active !== undefined ? active === 'on' : true,
    });
    // Image : upload local prioritaire, sinon URL saisie.
    const file = (req.files || []).find((f) => f.fieldname === 'imageFile');
    const uploaded = file ? saveUploadedImage(file) : null;
    const finalImage = uploaded || cleanImg;
    if (finalImage) await ProductImage.create({ productId: product.id, url: finalImage, position: 0 });
    return res.redirect('/admin?tab=products');
  } catch (err) {
    if (!err.status) return next(err);
    return res.redirect(`/admin?tab=products&err=${encodeURIComponent(err.message)}`);
  }
});

// Suppression multiple de produits (images locales et spécifications incluses).
router.post('/admin/produits/suppression-multiple', async (req, res, next) => {
  try {
    const ids = bulkIds(req.body);
    if (!ids.length) throw Object.assign(new Error('Aucun produit sélectionné.'), { status: 400 });
    let deleted = 0;
    for (const id of ids) {
      const product = await Product.findByPk(id, { include: { model: ProductImage, as: 'images' } });
      if (!product) continue;
      if (product.images) product.images.forEach((img) => removeUploadedImage(img.url));
      await ProductImage.destroy({ where: { productId: product.id } });
      await ProductSpec.destroy({ where: { productId: product.id } });
      await product.destroy();
      deleted += 1;
    }
    return res.redirect(`/admin?tab=products&ok=bulk-products&count=${deleted}`);
  } catch (err) {
    if (!err.status) return next(err);
    return res.redirect(`/admin?tab=products&err=${encodeURIComponent(err.message)}`);
  }
});

// GET — fiche produit en édition (redirige vers l'onglet produits du dashboard).
router.get('/admin/produits/:id', async (req, res, next) => {
  try {
    const product = await Product.findByPk(Number(req.params.id), {
      include: [
        { model: ProductImage, as: 'images', separate: true, order: [['position', 'ASC']] },
        { model: ProductSpec, as: 'specs', separate: true, order: [['position', 'ASC']] },
      ],
    });
    if (!product) return res.redirect('/admin?tab=products');
    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    return renderPage(req, res, 'admin/product-edit', {
      title: `Modifier · ${product.name}`, product, categories, error: null, success: req.query.ok === '1',
    });
  } catch (err) { return next(err); }
});

// POST — enregistre la fiche produit complète (y compris upload d'images).
router.post('/admin/produits/:id', async (req, res, next) => {
  try {
    const product = await Product.findByPk(Number(req.params.id), {
      include: [{ model: ProductImage, as: 'images' }],
    });
    if (!product) return res.redirect('/admin?tab=products');

    const { name, description, categoryId, price, oldPrice, stock, sku, featured, active, specs } = req.body;
    const cleanName = String(name || '').trim();
    const numPrice = Number(price);
    const numOldPrice = oldPrice !== undefined && oldPrice !== '' ? Number(oldPrice) : null;
    const numStock = stock !== undefined && stock !== '' ? Number(stock) : 0;
    if (!cleanName || cleanName.length > 180 || !Number.isFinite(numPrice) || numPrice < 0 || (numOldPrice !== null && (!Number.isFinite(numOldPrice) || numOldPrice < 0)) || !Number.isInteger(numStock) || numStock < 0) {
      throw Object.assign(new Error('Nom, prix et stock invalides (valeurs non négatives requises).'), { status: 400 });
    }
    if (categoryId && !(await Category.findByPk(categoryId))) throw Object.assign(new Error('Catégorie invalide.'), { status: 400 });

    await product.update({
      name: cleanName,
      slug: slugify(cleanName),
      description: String(description || '').slice(0, 20000) || null,
      categoryId: categoryId ? Number(categoryId) : null,
      price: numPrice,
      oldPrice: numOldPrice,
      stock: numStock,
      sku: String(sku || '').trim().slice(0, 40) || null,
      featured: featured === 'on',
      active: active === 'on',
    });

    // Galerie : un fichier uploadé remplace l'image principale (position 0).
    const file = (req.files || []).find((f) => f.fieldname === 'imageFile');
    if (file) {
      const url = saveUploadedImage(file);
      if (url) {
        const main = product.images.find((img) => img.position === 0);
        if (main) {
          removeUploadedImage(main.url);
          await main.update({ url, position: 0 });
        } else {
          await ProductImage.create({ productId: product.id, url, position: 0 });
        }
      }
    }

    // Spécifications : une ligne « Label: valeur » par entrée.
    await ProductSpec.destroy({ where: { productId: product.id } });
    const parsedSpecs = [];
    for (const raw of String(specs || '').split('\n')) {
      const idx = raw.indexOf(':');
      const label = idx >= 0 ? raw.slice(0, idx).trim() : '';
      const value = idx >= 0 ? raw.slice(idx + 1).trim() : raw.trim();
      if (label) parsedSpecs.push({ label: label.slice(0, 60), value: value.slice(0, 200) });
    }
    await Promise.all(
      parsedSpecs
        .slice(0, 20)
        .map((s, i) => ProductSpec.create({ productId: product.id, label: s.label, value: s.value, position: i }))
    );

    return res.redirect('/admin?tab=products&ok=1');
  } catch (err) {
    if (!err.status) return next(err);
    return res.redirect(`/admin?tab=products&err=${encodeURIComponent(err.message)}`);
  }
});

// POST — remplace l'image principale (position 0) depuis l'éditeur en ligne.
router.post('/admin/produits/:id/image', async (req, res, next) => {
  try {
    const product = await Product.findByPk(Number(req.params.id), { include: [{ model: ProductImage, as: 'images' }] });
    if (!product) return res.redirect('/admin?tab=products');
    const file = (req.files || []).find((f) => f.fieldname === 'imageFile');
    const url = file ? saveUploadedImage(file) : null;
    if (url && product.images && product.images.length) {
      const main = product.images.find((img) => img.position === 0) || product.images[0];
      removeUploadedImage(main.url);
      await main.update({ url, position: 0 });
    }
    return res.redirect('/admin?tab=products');
  } catch (err) { return next(err); }
});

// POST — supprime une image de la galerie (fichier local inclus).
router.post('/admin/produits/:id/delete-image/:imageId', async (req, res, next) => {
  try {
    const image = await ProductImage.findOne({
      where: { id: Number(req.params.imageId), productId: Number(req.params.id) },
    });
    if (image) {
      removeUploadedImage(image.url);
      await image.destroy();
    }
    return res.redirect('/admin?tab=products');
  } catch (err) { return next(err); }
});

router.post('/admin/produits/:id/supprimer', async (req, res, next) => {
  try {
    const product = await Product.findByPk(Number(req.params.id), { include: { model: ProductImage, as: 'images' } });
    if (product) {
      if (product.images) product.images.forEach((img) => removeUploadedImage(img.url));
      await ProductImage.destroy({ where: { productId: product.id } });
      await ProductSpec.destroy({ where: { productId: product.id } });
      await product.destroy();
    }
    return res.redirect('/admin?tab=products');
  } catch (err) { return next(err); }
});

// ── Codes promo (back-office) ─────────────────────────────────────────────────

router.get('/admin/codes-promo', async (req, res, next) => {
  try {
    const coupons = await Coupon.findAll({ order: [['id', 'DESC']] });
    return renderPage(req, res, 'admin/coupons', { title: 'Codes promo · Admin', coupons, success: req.query.ok === 'bulk-coupons' ? Number(req.query.count) || 0 : 0, error: req.query.err || null });
  } catch (err) { return next(err); }
});

router.post('/admin/codes-promo', async (req, res, next) => {
  try {
    const code = couponService.normalizeCode(req.body.code);
    const type = req.body.type === 'fixed' ? 'fixed' : 'percent';
    const value = Number(req.body.value);
    const minAmount = req.body.minAmount !== undefined && req.body.minAmount !== '' ? Number(req.body.minAmount) : null;
    const maxUses = req.body.maxUses !== undefined && req.body.maxUses !== '' ? Number(req.body.maxUses) : null;
    if (!code || code.length < 2) throw Object.assign(new Error('Code promo invalide (2 caractères minimum).'), { status: 400 });
    if (!Number.isInteger(value) || value < 1 || value > (type === 'percent' ? 100 : 10_000_000)) {
      throw Object.assign(new Error('Valeur invalide (pourcentage ≤ 100, montant ≥ 1).'), { status: 400 });
    }
    if (minAmount !== null && (!Number.isInteger(minAmount) || minAmount < 0)) throw Object.assign(new Error('Montant minimum invalide.'), { status: 400 });
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) throw Object.assign(new Error('Nombre d’utilisations invalide.'), { status: 400 });
    await Coupon.create({
      code, type, value,
      minAmount, maxUses,
      validFrom: req.body.validFrom || null,
      validUntil: req.body.validUntil || null,
      active: req.body.active === 'on',
    });
    return res.redirect('/admin?tab=coupons');
  } catch (err) {
    if (!err.status && err.name !== 'SequelizeUniqueConstraintError') return next(err);
    return res.redirect(`/admin?tab=coupons&err=${encodeURIComponent(err.name === 'SequelizeUniqueConstraintError' ? 'Ce code existe déjà.' : err.message)}`);
  }
});

// Suppression multiple de codes promo.
router.post('/admin/codes-promo/suppression-multiple', async (req, res, next) => {
  try {
    const ids = bulkIds(req.body);
    if (!ids.length) throw Object.assign(new Error('Aucun code promo sélectionné.'), { status: 400 });
    const destroyed = await Coupon.destroy({ where: { id: ids } });
    return res.redirect(`/admin?tab=coupons&ok=bulk-coupons&count=${destroyed}`);
  } catch (err) {
    if (!err.status) return next(err);
    return res.redirect(`/admin?tab=coupons&err=${encodeURIComponent(err.message)}`);
  }
});

// Basculer actif/inactif d'un code promo.
router.post('/admin/codes-promo/:id/toggle', async (req, res, next) => {
  try {
    const coupon = await Coupon.findByPk(Number(req.params.id));
    if (coupon) await coupon.update({ active: !coupon.active });
    return res.redirect('/admin?tab=coupons');
  } catch (err) { return next(err); }
});

router.post('/admin/codes-promo/:id/supprimer', async (req, res, next) => {
  try {
    await Coupon.destroy({ where: { id: Number(req.params.id) } });
    return res.redirect('/admin?tab=coupons');
  } catch (err) { return next(err); }
});

// ── Livraisons & livreurs (back-office) ───────────────────────────────────────

router.get('/admin/livraisons', async (req, res, next) => {
  try {
    const livraisons = await deliveryService.listDeliveries({ limit: 200 });
    const couriers = await deliveryService.listCouriers();
    const livreurs = await deliveryService.listLivreurAccounts();
    const assignableOrders = await deliveryService.listAssignableOrders();
    return renderPage(req, res, 'admin/livraisons', {
      title: 'Livraisons · Admin',
      livraisons,
      couriers,
      livreurs,
      assignableOrders,
      error: req.query.err || null,
    });
  } catch (err) { return next(err); }
});

// Affectation manuelle d'une commande à un livreur avec sa destination
// et la date/heure de remise prévue au client.
router.post('/admin/livraisons/attribuer', async (req, res, next) => {
  try {
    const scheduledAt = req.body.date && req.body.time
      ? `${String(req.body.date).slice(0, 10)}T${String(req.body.time).slice(0, 5)}`
      : null;
    await deliveryService.assignOrder({
      orderId: req.body.orderId,
      courierId: req.body.courierId,
      destination: req.body,
      scheduledAt,
    });
    return res.redirect('/admin?tab=livraisons');
  } catch (err) {
    if (!err.status) return next(err);
    return res.redirect(`/admin?tab=livraisons&err=${encodeURIComponent(err.message)}`);
  }
});

// Annulation d'une livraison (admin).
router.post('/admin/livraisons/:id/annuler', async (req, res, next) => {
  try {
    const livraison = await Livraison.findByPk(Number(req.params.id));
    if (!livraison) return res.redirect('/admin?tab=livraisons');
    const author = `${res.locals.currentUser.firstName} ${res.locals.currentUser.lastName}`.trim();
    await deliveryService.cancelDelivery(livraison, author);
    return res.redirect('/admin?tab=livraisons');
  } catch (err) {
    if (!err.status) return next(err);
    return res.redirect(`/admin?tab=livraisons&err=${encodeURIComponent(err.message)}`);
  }
});

// Changement de statut d'une livraison (admin).
router.post('/admin/livraisons/:id/statut', async (req, res, next) => {
  try {
    const livraison = await Livraison.findByPk(Number(req.params.id));
    if (!livraison) return res.redirect('/admin?tab=livraisons');
    const author = `${res.locals.currentUser.firstName} ${res.locals.currentUser.lastName}`.trim();
    await deliveryService.updateDeliveryStatus(livraison, String(req.body.status || '').trim(), author);
    return res.redirect('/admin?tab=livraisons');
  } catch (err) {
    if (!err.status) return next(err);
    return res.redirect(`/admin?tab=livraisons&err=${encodeURIComponent(err.message)}`);
  }
});

// ── Livreurs partenaires (back-office) ───────────────────────────────────────

// GET — tableau de gestion des livreurs (créer / modifier / supprimer).
router.get('/admin/livreurs', async (req, res, next) => {
  try {
    const [couriers, livreurs] = await Promise.all([
      deliveryService.listCouriers(),
      deliveryService.listLivreurAccounts(),
    ]);
    return renderPage(req, res, 'admin/couriers', {
      title: 'Livreurs · Admin',
      couriers,
      livreurs,
      error: req.query.err || null,
      okSaved: req.query.ok || false,
      bulkCount: Number(req.query.count) || 0,
    });
  } catch (err) { return next(err); }
});

// POST — création d'un livreur (nom + téléphone remplis par l'admin).
router.post('/admin/livreurs', async (req, res, next) => {
  try {
    await deliveryService.createCourier({ name: req.body.name, phone: req.body.phone });
    return res.redirect('/admin?tab=couriers');
  } catch (err) {
    if (!err.status && err.name !== 'SequelizeUniqueConstraintError') return next(err);
    return res.redirect(`/admin?tab=couriers&err=${encodeURIComponent(err.name === 'SequelizeUniqueConstraintError' ? 'Ce livreur existe déjà.' : err.message)}`);
  }
});

// POST — modification d'un livreur existant.
router.post('/admin/livreurs/:id', async (req, res, next) => {
  try {
    await deliveryService.updateCourier(Number(req.params.id), {
      name: req.body.name,
      phone: req.body.phone,
      active: req.body.active === 'on',
    });
    return res.redirect('/admin?tab=couriers');
  } catch (err) {
    if (!err.status && err.name !== 'SequelizeUniqueConstraintError') return next(err);
    return res.redirect(`/admin?tab=couriers&err=${encodeURIComponent(err.name === 'SequelizeUniqueConstraintError' ? 'Ce livreur existe déjà.' : err.message)}`);
  }
});

// POST — suppression d'un livreur (les livraisons passées conservent leur nom).
router.post('/admin/livreurs/:id/supprimer', async (req, res, next) => {
  try {
    await deliveryService.deleteCourier(Number(req.params.id));
    return res.redirect('/admin?tab=couriers');
  } catch (err) { return next(err); }
});

// ── Comptes livreurs (connexion avec identifiants) ───────────────────────────

// POST — création d'un compte livreur (email + mot de passe, accès /livreur).
router.post('/admin/livreur-comptes', async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    const cleanFirst = String(firstName || '').trim();
    const cleanLast = String(lastName || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim();
    const cleanPassword = String(password || '');
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (cleanFirst.length < 2 || cleanFirst.length > 80) throw Object.assign(new Error('Prénom invalide (2 caractères minimum).'), { status: 400 });
    if (cleanLast.length < 2 || cleanLast.length > 80) throw Object.assign(new Error('Nom invalide (2 caractères minimum).'), { status: 400 });
    if (!emailPattern.test(cleanEmail) || cleanEmail.length > 160) throw Object.assign(new Error('Adresse e-mail invalide.'), { status: 400 });
    if (cleanPhone.length > 30) throw Object.assign(new Error('Téléphone invalide.'), { status: 400 });
    if (cleanPassword.length < 8) throw Object.assign(new Error('Mot de passe : 8 caractères minimum.'), { status: 400 });
    const exists = await User.findOne({ where: { email: cleanEmail } });
    if (exists) return res.redirect(`/admin?tab=couriers&err=${encodeURIComponent('Un compte existe déjà avec cet e-mail.')}`);
    await User.create({
      firstName: cleanFirst,
      lastName: cleanLast,
      email: cleanEmail,
      phone: cleanPhone || null,
      passwordHash: await hashPassword(cleanPassword),
      role: 'livreur',
    });
    return res.redirect('/admin?tab=couriers&ok=livreur');
  } catch (err) {
    if (!err.status && err.name !== 'SequelizeUniqueConstraintError') return next(err);
    const message = err.name === 'SequelizeUniqueConstraintError' ? 'Un compte existe déjà avec cet e-mail.' : err.message;
    return res.redirect(`/admin?tab=couriers&err=${encodeURIComponent(message)}`);
  }
});

// POST — suppression d'un compte livreur (réservée au super-admin).
router.post('/admin/livreur-comptes/:id/supprimer', requireSuperAdminPage, async (req, res, next) => {
  try {
    const livreur = await User.findOne({ where: { id: Number(req.params.id), role: 'livreur' } });
    if (!livreur) return res.redirect('/admin?tab=couriers');
    await Livraison.update(
      { courierId: null, status: 'annulée', cancelledAt: new Date() },
      { where: { courierId: livreur.id, status: 'en_cours' } }
    );
    await Notification.destroy({ where: { userId: livreur.id } });
    await Notification.update({ senderId: null }, { where: { senderId: livreur.id } });
    await ContactMessage.update({ userId: null }, { where: { userId: livreur.id } });
    await livreur.destroy();
    return res.redirect('/admin?tab=couriers&ok=livreur-deleted');
  } catch (err) { return next(err); }
});

// Suppression multiple de comptes livreurs (réservée au super-admin).
router.post('/admin/livreur-comptes/suppression-multiple', requireSuperAdminPage, async (req, res, next) => {
  try {
    const ids = bulkIds(req.body);
    if (!ids.length) throw Object.assign(new Error('Aucun compte livreur sélectionné.'), { status: 400 });
    let deleted = 0;
    for (const id of ids) {
      const livreur = await User.findOne({ where: { id: Number(id), role: 'livreur' } });
      if (!livreur) continue;
      await Livraison.update(
        { courierId: null, status: 'annulée', cancelledAt: new Date() },
        { where: { courierId: livreur.id, status: 'en_cours' } }
      );
      await Notification.destroy({ where: { userId: livreur.id } });
      await Notification.update({ senderId: null }, { where: { senderId: livreur.id } });
      await ContactMessage.update({ userId: null }, { where: { userId: livreur.id } });
      await livreur.destroy();
      deleted += 1;
    }
    return res.redirect(`/admin?tab=couriers&ok=bulk-livreurs&count=${deleted}`);
  } catch (err) { return next(err); }
});

// Annulation d'une commande (admin, avant expédition).
router.post('/admin/commandes/:reference/annuler', requireSuperAdminPage, async (req, res, next) => {
  try {
    const order = await Order.findOne({ where: { reference: req.params.reference } });
    if (!order) return res.redirect('/admin?tab=orders');
    await orderService.cancelOrder(order, { by: 'admin' });
    return res.redirect('/admin?tab=orders');
  } catch (err) { return next(err); }
});

// Suppression définitive d'une commande + livraison associée (super-admin).
router.post('/admin/commandes/:reference/supprimer', requireSuperAdminPage, async (req, res, next) => {
  try {
    const order = await Order.findOne({ where: { reference: req.params.reference } });
    if (order) {
      await Livraison.destroy({ where: { orderId: order.id } });
      await OrderItem.destroy({ where: { orderId: order.id } });
      await order.destroy();
    }
    return res.redirect('/admin?tab=orders&ok=1');
  } catch (err) { return next(err); }
});

// Passage en « expédition » : crée automatiquement la livraison (livreur).
router.post('/admin/commandes/:reference/statut', requireSuperAdminPage, async (req, res, next) => {
  try {
    const order = await Order.findOne({ where: { reference: req.params.reference } });
    if (order) {
      await sequelize.transaction(async (tx) => {
        await orderService.advanceStatus(order);
        if (order.status === 'expédition') {
          await deliveryService.autoCreateForOrder(order, tx);
        }
      });
    }
    return res.redirect('/admin?tab=orders');
  } catch (err) { return next(err); }
});

router.get('/admin/commandes', requireSuperAdminPage, async (req, res, next) => {
  try {
    const orders = await Order.findAll({
    include: [
      { model: OrderItem, as: 'items' },
      { model: User, as: 'user', attributes: ['firstName', 'lastName', 'email', 'phone'] },
    ],
    order: [['createdAt', 'DESC']],
    limit: 60,
  });
  const orderRows = orders.map((order) => {
    let address = {};
    try { address = JSON.parse(order.addressSnapshot); } catch (_) { /* snapshot corrompu */ }
    const row = order.toJSON();
    row.customerName = order.user
      ? `${order.user.firstName} ${order.user.lastName}`.trim()
      : (address.fullName || 'N/A');
    row.customerPhone = address.phone || (order.user && order.user.phone) || '';
    return row;
  });
  return renderPage(req, res, 'admin/orders', { title: 'Commandes · Admin', orders: orderRows, nextStatus: orderService.nextStatus, okSaved: req.query.ok || false, historyClearedCount: Number(req.query.count) || 0 });
} catch (err) { return next(err); }
});

// Effacement de l'historique des commandes par l'admin
// (purge toutes les commandes terminées ou annulées, tous clients confondus).
router.post('/admin/commandes/historique/effacer', requireSuperAdminPage, async (req, res, next) => {
  try {
    const deletedCount = Number(await orderService.clearHistoryAdmin()) || 0;
    return res.redirect(`/admin?tab=orders&ok=cleared&count=${deletedCount}`);
  } catch (err) { return next(err); }
});

/* ═══════════════════════════════════════════════════════════════════════
 * Espace Livreur — route SSR uniquement accessible aux comptes 'livreur'.
 * ═══════════════════════════════════════════════════════════════════════ */

/** requireLivreurPage — middleware de protection pour le dashboard livreur.
 *  Redirige vers /connexion si non authentifié, ou / (accueil) si rôle incorrect. */
function requireLivreurPage(req, res, next) {
  const user = res.locals.currentUser;
  if (!user) return res.redirect('/connexion');
  if (user.role !== 'livreur') return res.redirect('/');
  return next();
}

/** requireNotCustomerPage — protège les pages internes. */
function requireNotCustomerPage(req, res, next) {
  const user = res.locals.currentUser;
  if (!user) return res.redirect('/connexion');
  if (user.role === 'customer') return res.redirect('/');
  return next();
}

/** GET /livreur — tableau de bord livreur (page SSR). */
router.get('/livreur', requireLivreurPage, async (req, res, next) => {
  try {
    const livraisonsParsed = parseLivraisonDestinations(await findLivreurLivraisons(req.user.id));
    return renderPage(req, res, 'livreur/dashboard', {
      title: 'Espace Livreur · Zurion',
      livraisons: livraisonsParsed,
    });
  } catch (err) {
    return next(err);
  }
});

/** GET /livreur/livraisons/:id — page détail d'une livraison assignée. */
router.get('/livreur/livraisons/:id(\\d+)', requireLivreurPage, async (req, res, next) => {
  try {
    const livraison = await Livraison.findOne({
      where: { id: Number(req.params.id), courierId: req.user.id },
      include: [{
        model: Order, as: 'order',
        include: [{ model: OrderItem, as: 'items', attributes: ['nameSnapshot', 'priceSnapshot', 'quantity'] }],
      }, {
        model: LivraisonEvent,
        as: 'events',
        separate: true,
        order: [['createdAt', 'ASC']],
      }],
    });
    if (!livraison) return res.redirect('/livreur');
    const plain = livraison.toJSON();
    if (plain.destinationSnapshot) {
      try { plain.destinationParsed = JSON.parse(plain.destinationSnapshot); } catch (_) { plain.destinationParsed = null; }
    } else {
      plain.destinationParsed = plain.order && plain.order.addressSnapshot
        ? (() => { try { return JSON.parse(plain.order.addressSnapshot); } catch (_) { return null; } })()
        : null;
    }
    return renderPage(req, res, 'livreur/livraison-detail', {
      title: `${plain.reference} · Espace Livreur`,
      livraison: plain,
      backHref: '/livreur',
    });
  } catch (err) {
    return next(err);
  }
});

/** GET /notifications — centre de notifications interne. */
router.get('/notifications', requireNotCustomerPage, async (req, res, next) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      include: [{ model: User, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email', 'role'] }],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    return renderPage(req, res, 'notifications', {
      title: 'Notifications · Zurion',
      notifications,
      backHref: req.user.role === 'admin' ? '/admin?tab=livraisons' : '/admin?tab=overview',
    });
  } catch (err) {
    return next(err);
  }
});

/** GET /messages — section messages internes (superadmin / admin / livreur). */
router.get('/messages', requireNotCustomerPage, async (req, res, next) => {
  try {
    const messageService = require('../services/message.service');
    const contacts = await messageService.getContacts(req.user);
    const { received, sent } = await messageService.listMessages(req.user);
    const fmtReceived = received.map((n) => ({
      id: n.id, title: n.title, message: n.message, read: n.read, createdAt: n.createdAt,
      sender: n.sender ? { id: n.sender.id, firstName: n.sender.firstName, lastName: n.sender.lastName, email: n.sender.email, role: n.sender.role } : null,
    }));
    const fmtSent = sent.map((n) => ({
      id: n.id, title: n.title, message: n.message, read: n.read, createdAt: n.createdAt,
      recipient: n.user ? { id: n.user.id, firstName: n.user.firstName, lastName: n.user.lastName, email: n.user.email, role: n.user.role } : null,
    }));
    const plainContacts = contacts.map((c) => ({
      id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email, role: c.role,
    }));
    return renderPage(req, res, 'messages', {
      title: 'Messages · Zurion',
      contacts: plainContacts,
      received: fmtReceived,
      sent: fmtSent,
      canSend: ['livreur', 'admin', 'superadmin'].includes(req.user.role),
      backHref: req.user.role === 'admin' ? '/admin?tab=livraisons' : '/admin?tab=overview',
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
