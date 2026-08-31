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
const { User } = require('../models');
const catalogService = require('../services/catalog.service');
const cartService = require('../services/cart.service');
const orderService = require('../services/order.service');
const { slugify } = require('../utils/slugify');
const { hashPassword, comparePassword } = require('../utils/password');

const router = express.Router();

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Rend une vue dans le layout : body = HTML de la vue, layout autour. */
async function renderPage(req, res, view, locals = {}) {
  const body = await new Promise((resolve, reject) => {
    res.app.render(view, { ...res.locals, ...locals }, (err, html) => (err ? reject(err) : resolve(html)));
  });
  res.render('layout', { ...res.locals, ...locals, body });
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
        currentUser = await User.findByPk(payload.sub);
      } catch (_) {
        currentUser = null;
      }
    }

    // Panier invité : token généré au premier passage
    let cartToken = req.cookies.zurion_cart;
    if (!currentUser && !cartToken) {
      cartToken = cartService.newToken();
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
    const { q, category, sort, page, max, inStock } = req.query;
    const { products, meta, allCategories } = await catalogService.listProducts({
      q, category, sort, page, limit: 12,
      max: max || undefined,
      inStock: inStock === '1' ? true : undefined,
    });
    const currentCategory = category || '';
    const currentSort = sort || 'popular';
    const cat = currentCategory ? allCategories.find((c) => c.slug === currentCategory) : null;
    return renderPage(req, res, 'catalog', {
      title: cat ? cat.name : 'Catalogue',
      products, meta, categories: allCategories,
      currentCategory, currentSort,
      q: q || '',
      currentMax: max || '',
      inStock: inStock === '1',
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
    const related = await catalogService.getRelatedProducts(product, 4);
    const reviews = product.reviews || [];
    const reviewCount = reviews.length;
    const averageRating = reviewCount
      ? Math.round((reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviewCount) * 10) / 10
      : 0;
    return renderPage(req, res, 'product', { title: product.name, product, related, reviewCount, averageRating });
  } catch (err) { return next(err); }
});

// Panier
router.get('/panier', async (req, res, next) => {
  try {
    const cart = await cartService.getCart({
      userId: res.locals.currentUser ? res.locals.currentUser.id : null,
      token: res.locals.currentUser ? null : res.locals.cartToken,
    });
    return renderPage(req, res, 'cart', { title: 'Panier', cart: cart || null, totals: cartService.cartTotals(cart, 0) });
  } catch (err) { return next(err); }
});

// Vider le panier
router.get('/panier/vider', async (req, res, next) => {
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
    return renderPage(req, res, 'checkout', { title: 'Commande', cart, totals: cartService.cartTotals(cart, 0), error: null, values: {} });
  } catch (err) { return next(err); }
});

// Checkout (soumission) — crée la commande puis redirige vers la confirmation
router.post('/commande', async (req, res, next) => {
  try {
    const { fullName, phone, line1, line2, city, region, deliveryMode, paymentMethod } = req.body;
    const user = res.locals.currentUser;
    const order = await orderService.placeOrder({
      userId: user ? user.id : null,
      cartToken: user ? null : res.locals.cartToken,
      paymentMethod,
      deliveryMode,
      address: { fullName, phone, line1, line2, city, region },
    });
    return res.redirect('/commande/confirmation/' + order.reference);
  } catch (err) {
    if (!err.status) return next(err);
    const cart = res.locals.cart;
    return renderPage(req, res, 'checkout', {
      title: 'Commande',
      cart, totals: cartService.cartTotals(cart, 0),
      error: err.message, values: req.body,
    });
  }
});

// Confirmation de commande
router.get('/commande/confirmation/:reference', async (req, res, next) => {
  try {
    const user = res.locals.currentUser;
    const order = await orderService.getOrderForUser(user ? user.id : null, req.params.reference);
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
    return res.redirect('/compte');
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
    if (!firstName || !lastName || !email || !password || String(password).length < 6) {
      return renderPage(req, res, 'inscription', {
        title: 'Inscription',
        error: 'Tous les champs sont requis (mot de passe : 6 caractères minimum).',
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
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.redirect('/');
});

/* ------------------------------------------------------------------ */
/* Espace client & favoris                                             */
/* ------------------------------------------------------------------ */

router.get('/compte', async (req, res, next) => {
  try {
    const user = res.locals.currentUser;
    if (!user) return res.redirect('/connexion');
    const orders = await orderService.listOrders(user.id);
    return renderPage(req, res, 'compte', { title: 'Mon compte', orders });
  } catch (err) { return next(err); }
});

router.get('/favoris', async (req, res, next) => {
  try {
    const user = res.locals.currentUser;
    let products = [];
    if (user) {
      const { Wishlist, Product } = require('../models');
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
/* Back-office (rôle admin requis)                                     */
/* ------------------------------------------------------------------ */

function requireAdminPage(req, res, next) {
  const user = res.locals.currentUser;
  if (!user) return res.redirect('/connexion');
  if (user.role !== 'admin') return res.status(403).redirect('/');
  return next();
}

router.use('/admin', requireAdminPage);

router.get('/admin', async (req, res, next) => {
  try {
    const { Product, Order } = require('../models');
    const [productCount, orderCount, revenue, allProducts, recentOrders] = await Promise.all([
      Product.count(),
      Order.count(),
      Order.sum('total'),
      Product.findAll({ where: { active: true } }),
      Order.findAll({ order: [['createdAt', 'DESC']], limit: 5 }),
    ]);
    const lowStockProducts = allProducts.filter((p) => p.stock < 5).slice(0, 6);
    return renderPage(req, res, 'admin/dashboard', {
      title: 'Administration',
      stats: { productCount, orderCount, revenue: revenue || 0, lowStockCount: lowStockProducts.length },
      lowStockProducts,
      recentOrders,
    });
  } catch (err) { return next(err); }
});

router.get('/admin/produits', async (req, res, next) => {
  try {
    const { Product } = require('../models');
    const products = await Product.findAll({ order: [['id', 'ASC']] });
    return renderPage(req, res, 'admin/products', { title: 'Produits · Admin', products, error: null });
  } catch (err) { return next(err); }
});

router.post('/admin/produits', async (req, res, next) => {
  try {
    const { Product, ProductImage } = require('../models');
    const { name, description, categoryId, price, oldPrice, stock, imageUrl, featured, active } = req.body;
    if (!name || !price) throw Object.assign(new Error('Nom et prix sont requis.'), { status: 400 });
    const base = slugify(String(name));
    const exists = await Product.findOne({ where: { slug: base } });
    const slug = exists ? `${base}-${Date.now().toString().slice(-5)}` : base;
    const product = await Product.create({
      name: String(name).trim(),
      slug,
      description: description || '',
      categoryId: categoryId ? Number(categoryId) : null,
      price: Number(price),
      oldPrice: oldPrice ? Number(oldPrice) : null,
      stock: stock ? Number(stock) : 0,
      featured: featured === 'on',
      active: active !== undefined ? active === 'on' : true,
    });
    if (imageUrl) await ProductImage.create({ productId: product.id, url: String(imageUrl).trim(), position: 0 });
    return res.redirect('/admin/produits');
  } catch (err) {
    if (!err.status) return next(err);
    const { Product } = require('../models');
    const products = await Product.findAll({ order: [['id', 'ASC']] });
    return renderPage(req, res, 'admin/products', { title: 'Produits · Admin', products, error: err.message });
  }
});

router.post('/admin/produits/:id', async (req, res, next) => {
  try {
    const { Product } = require('../models');
    const product = await Product.findByPk(Number(req.params.id));
    if (!product) return res.redirect('/admin/produits');
    const { name, price, oldPrice, stock, featured, active } = req.body;
    await product.update({
      name: name ? String(name).trim() : product.name,
      price: price !== undefined && price !== '' ? Number(price) : product.price,
      oldPrice: oldPrice !== undefined && oldPrice !== '' ? Number(oldPrice) : null,
      stock: stock !== undefined && stock !== '' ? Number(stock) : product.stock,
      featured: featured === 'on',
      active: active === 'on',
    });
    return res.redirect('/admin/produits');
  } catch (err) { return next(err); }
});

router.post('/admin/produits/:id/supprimer', async (req, res, next) => {
  try {
    const { Product, ProductImage, ProductSpec } = require('../models');
    const product = await Product.findByPk(Number(req.params.id));
    if (product) {
      await ProductImage.destroy({ where: { productId: product.id } });
      await ProductSpec.destroy({ where: { productId: product.id } });
      await product.destroy();
    }
    return res.redirect('/admin/produits');
  } catch (err) { return next(err); }
});

router.get('/admin/commandes', async (req, res, next) => {
  try {
    const { Order, OrderItem } = require('../models');
    const orders = await Order.findAll({
      include: [{ model: OrderItem, as: 'items' }],
      order: [['createdAt', 'DESC']],
      limit: 60,
    });
    return renderPage(req, res, 'admin/orders', { title: 'Commandes · Admin', orders, nextStatus: orderService.nextStatus });
  } catch (err) { return next(err); }
});

router.post('/admin/commandes/:reference/statut', async (req, res, next) => {
  try {
    const { Order } = require('../models');
    const order = await Order.findOne({ where: { reference: req.params.reference } });
    if (order) await orderService.advanceStatus(order);
    return res.redirect('/admin/commandes');
  } catch (err) { return next(err); }
});

module.exports = router;




