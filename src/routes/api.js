'use strict';

const { Router } = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

const auth = require('../middlewares/auth');
const { handleValidation } = require('../middlewares/validate');
const { authLimiter } = require('../middlewares/rateLimit');

const authController = require('../controllers/auth.controller');
const catalogController = require('../controllers/catalog.controller');
const cartController = require('../controllers/cart.controller');
const orderController = require('../controllers/order.controller');
const wishlistController = require('../controllers/wishlist.controller');
const adminController = require('../controllers/admin.controller');

const router = Router();

// ── Healthcheck (déploiement) ─────────────────────────────────────────────
router.get('/health', (req, res) => res.json({ ok: true, service: 'zurion-api', time: new Date().toISOString() }));

// ── Authentification ──────────────────────────────────────────────────────
router.post(
  '/auth/register',
  [
    body('firstName').trim().isLength({ min: 2, max: 80 }),
    body('lastName').trim().isLength({ min: 2, max: 80 }),
    body('email').trim().isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
  ],
  handleValidation,
  authController.register
);

router.post('/auth/login', rateLimit({ ...authLimiter, message: { error: 'Trop de tentatives. Réessayez plus tard.' } }), [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], handleValidation, authController.login);

router.post('/auth/logout', authController.logout);
router.get('/auth/me', auth.requireAuth, authController.me);
router.get('/auth/me/cart', auth.requireAuth, authController.me);

// ── Catalogue public ──────────────────────────────────────────────────────
router.get('/categories', catalogController.listCategories);
router.get('/suggestions', catalogController.suggestions);
router.get('/products', catalogController.listProducts);
router.get('/products/:slug', catalogController.getProduct);
router.get('/product-images', (req, res) => res.status(404).json({ error: 'inconnu' }));

// ── Avis (authentifié) ────────────────────────────────────────────────────
router.post(
  '/products/:slug/reviews',
  auth.requireAuth,
  [body('rating').isInt({ min: 1, max: 5 }), body('comment').optional({ nullable: true }).isLength({ max: 1000 })],
  handleValidation,
  orderController.addReview
);

// ── Panier (invité via X-Cart-Token, connecté via cookie) ────────────────
router.get('/cart', cartController.getCart);
router.post('/cart/items', [
  body('productId').isInt(),
  body('quantity').optional().isInt({ min: 1 }),
], handleValidation, cartController.addItem);
router.put('/cart/items/:productId(\\d+)', [
  body('quantity').isInt({ min: 1 }),
], handleValidation, cartController.updateItem);
router.delete('/cart/items/:productId(\\d+)', cartController.removeItem);

// ── Commandes ─────────────────────────────────────────────────────────────
router.post('/orders', [
  body('paymentMethod').isString().notEmpty(),
  body('deliveryMode').isString().notEmpty(),
  body('address').isObject(),
], handleValidation, orderController.createOrder);
router.get('/orders', auth.requireAuth, orderController.listOrders);
router.get('/orders/:reference', auth.requireAuth, orderController.getOrder);

// ── Favoris (nécessite un compte) ─────────────────────────────────────────
router.get('/wishlist', auth.requireAuth, wishlistController.getWishlist);
router.post('/wishlist', auth.requireAuth, wishlistController.addWishlist);
router.delete('/wishlist/:productId(\\d+)', auth.requireAuth, wishlistController.removeWishlist);

// ── Admin (auth + rôle) ───────────────────────────────────────────────────
const adminRouter = Router();
adminRouter.use(auth.requireAuth, auth.requireAdmin);

adminRouter.get('/stats', adminController.dashboardStats);
adminRouter.get('/products', (req, res, next) =>
  require('../models').Product.findAll({ include: [{ model: require('../models').Category, as: 'category' }] }).then((products) => res.json({ products })).catch(next)
);
adminRouter.post('/products', [
  body('name').isLength({ min: 2 }),
  body('price').isInt({ min: 0 }),
  body('stock').optional().isInt({ min: 0 }),
], handleValidation, adminController.createProduct);
adminRouter.put('/products/:id(\\d+)', adminController.updateProduct);
adminRouter.delete('/products/:id(\\d+)', adminController.deleteProduct);

adminRouter.post('/categories', [body('name').isLength({ min: 2 })], handleValidation, adminController.createCategory);
adminRouter.put('/categories/:id(\\d+)', adminController.updateCategory);
adminRouter.delete('/categories/:id(\\d+)', adminController.deleteCategory);

adminRouter.get('/orders', adminController.adminOrders);
adminRouter.patch('/orders/:id(\\d+)/status', [body('status').isString()], handleValidation, adminController.setOrderStatus);
adminRouter.get('/users', adminController.adminUsers);

router.use('/admin', adminRouter);

module.exports = router;