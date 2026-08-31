'use strict';

const { Op } = require('sequelize');
const { sequelize, User, Category, Product, ProductImage, ProductSpec, Order } = require('../models');
const { slugify } = require('../utils/slugify');

/** Statuts autorisés pour le suivi de commande (cycle de vie complet). */
const ORDER_STATUSES = [
  'créée',
  'paiement_confirmé',
  'préparation',
  'expédition',
  'livraison',
  'terminée',
];

// ── Tableau de bord ──────────────────────────────────────────────────────────

/** GET /api/admin/stats — indicateurs clés du back-office. */
async function dashboardStats(req, res, next) {
  try {
    const [ordersCount, usersCount, productsCount, lowStock] = await Promise.all([
      Order.count(),
      User.count({ where: { role: 'customer' } }),
      Product.count(),
      Product.count({ where: { stock: { [Op.lte]: 5 }, active: true } }),
    ]);

    // Chiffre d'affaires = somme des totaux des commandes payées ou au-delà
    const paidOrders = await Order.findAll({
      where: { status: { [Op.in]: ['paiement_confirmé', 'préparation', 'expédition', 'livraison', 'terminée'] } },
      attributes: ['total'],
      raw: true,
    });
    const revenue = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    // Répartition des commandes par statut
    const byStatus = await Order.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true,
    });

    // Dernières commandes pour le tableau de bord
    const latestOrders = await Order.findAll({
      order: [['id', 'DESC']],
      limit: 8,
      attributes: ['id', 'reference', 'status', 'total', 'createdAt'],
    });

    return res.json({
      stats: {
        ordersCount,
        usersCount,
        productsCount,
        lowStock,
        revenue,
        byStatus: byStatus.map((s) => ({ status: s.status, count: Number(s.count) })),
      },
      latestOrders,
    });
  } catch (err) {
    return next(err);
  }
}

// ── Produits ─────────────────────────────────────────────────────────────────

/** POST /api/admin/products — crée un produit (galerie et specs incluses). */
async function createProduct(req, res, next) {
  try {
    const { name, description, price, oldPrice, stock, sku, featured, active, categoryId, images, specs } = req.body;

    if (!categoryId || !(await Category.findByPk(categoryId))) {
      return res.status(400).json({ error: 'Catégorie invalide.' });
    }

    const product = await sequelize.transaction(async (t) => {
      const created = await Product.create(
        {
          name,
          slug: slugify(name),
          description: description || null,
          price: Number(price),
          oldPrice: oldPrice ? Number(oldPrice) : null,
          stock: Number.isFinite(Number(stock)) ? Number(stock) : 0,
          sku: sku || null,
          featured: Boolean(featured),
          active: active === undefined ? true : Boolean(active),
          categoryId: Number(categoryId),
        },
        { transaction: t }
      );

      if (Array.isArray(images) && images.length) {
        await Promise.all(
          images
            .filter(Boolean)
            .slice(0, 6)
            .map((url, i) => ProductImage.create({ productId: created.id, url, position: i }, { transaction: t }))
        );
      }
      if (Array.isArray(specs) && specs.length) {
        await Promise.all(
          specs
            .filter((s) => s && s.label)
            .slice(0, 20)
            .map((s, i) => ProductSpec.create({ productId: created.id, label: s.label, value: s.value || '', position: i }, { transaction: t }))
        );
      }
      return created;
    });

    const full = await Product.findByPk(product.id, {
      include: [
        { model: Category, as: 'category' },
        { model: ProductImage, as: 'images' },
        { model: ProductSpec, as: 'specs' },
      ],
    });
    return res.status(201).json({ product: full });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Un produit avec ce slug existe déjà.' });
    }
    return next(err);
  }
}

/** PUT /api/admin/products/:id — met à jour un produit existant. */
async function updateProduct(req, res, next) {
  try {
    const product = await Product.findByPk(Number(req.params.id));
    if (!product) return res.status(404).json({ error: 'Produit introuvable.' });

    const { name, description, price, oldPrice, stock, sku, featured, active, categoryId } = req.body;
    const patch = {};
    if (name !== undefined) {
      patch.name = name;
      patch.slug = slugify(name);
    }
    if (description !== undefined) patch.description = description;
    if (price !== undefined) patch.price = Number(price);
    if (oldPrice !== undefined) patch.oldPrice = oldPrice ? Number(oldPrice) : null;
    if (stock !== undefined) patch.stock = Number(stock);
    if (sku !== undefined) patch.sku = sku;
    if (featured !== undefined) patch.featured = Boolean(featured);
    if (active !== undefined) patch.active = Boolean(active);
    if (categoryId !== undefined) {
      if (!(await Category.findByPk(categoryId))) return res.status(400).json({ error: 'Catégorie invalide.' });
      patch.categoryId = Number(categoryId);
    }

    await product.update(patch);
    const full = await Product.findByPk(product.id, { include: [{ model: Category, as: 'category' }] });
    return res.json({ product: full });
  } catch (err) {
    return next(err);
  }
}

/** DELETE /api/admin/products/:id — supprime un produit (cascades gérées par la BDD). */
async function deleteProduct(req, res, next) {
  try {
    const deleted = await Product.destroy({ where: { id: Number(req.params.id) } });
    if (!deleted) return res.status(404).json({ error: 'Produit introuvable.' });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

// ── Catégories ───────────────────────────────────────────────────────────────

/** POST /api/admin/categories — crée une catégorie. */
async function createCategory(req, res, next) {
  try {
    const { name, description, image, active, sortOrder } = req.body;
    const category = await Category.create({
      name,
      slug: slugify(name),
      description: description || null,
      image: image || null,
      active: active === undefined ? true : Boolean(active),
      sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    });
    return res.status(201).json({ category });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Une catégorie avec ce slug existe déjà.' });
    }
    return next(err);
  }
}

/** PUT /api/admin/categories/:id — met à jour une catégorie. */
async function updateCategory(req, res, next) {
  try {
    const category = await Category.findByPk(Number(req.params.id));
    if (!category) return res.status(404).json({ error: 'Catégorie introuvable.' });

    const { name, description, image, active, sortOrder } = req.body;
    const patch = {};
    if (name !== undefined) {
      patch.name = name;
      patch.slug = slugify(name);
    }
    if (description !== undefined) patch.description = description;
    if (image !== undefined) patch.image = image;
    if (active !== undefined) patch.active = Boolean(active);
    if (sortOrder !== undefined) patch.sortOrder = Number(sortOrder);

    await category.update(patch);
    return res.json({ category });
  } catch (err) {
    return next(err);
  }
}

/** DELETE /api/admin/categories/:id — supprime une catégorie (produits → categoryId NULL). */
async function deleteCategory(req, res, next) {
  try {
    const deleted = await Category.destroy({ where: { id: Number(req.params.id) } });
    if (!deleted) return res.status(404).json({ error: 'Catégorie introuvable.' });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

// ── Commandes ────────────────────────────────────────────────────────────────

/** GET /api/admin/orders — toutes les commandes avec client et lignes. */
async function adminOrders(req, res, next) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status && ORDER_STATUSES.includes(status)) where.status = status;

    const { rows, count } = await Order.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { association: 'items' },
      ],
      order: [['id', 'DESC']],
      limit: Math.min(Number(limit) || 20, 100),
      offset: (Math.max(Number(page) || 1, 1) - 1) * Math.min(Number(limit) || 20, 100),
      distinct: true,
    });

    return res.json({ orders: rows, total: count, statuses: ORDER_STATUSES });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/admin/orders/:id/status — fait évoluer le statut d'une commande. */
async function setOrderStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Statut invalide. Autorisés : ${ORDER_STATUSES.join(', ')}` });
    }

    const order = await Order.findByPk(Number(req.params.id));
    if (!order) return res.status(404).json({ error: 'Commande introuvable.' });

    await order.update({ status });
    return res.json({ order });
  } catch (err) {
    return next(err);
  }
}

// ── Utilisateurs ─────────────────────────────────────────────────────────────

/** GET /api/admin/users — liste des comptes (sans hash de mot de passe). */
async function adminUsers(req, res, next) {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['passwordHash'] },
      order: [['id', 'DESC']],
    });
    return res.json({ users });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  dashboardStats,
  createProduct,
  updateProduct,
  deleteProduct,
  createCategory,
  updateCategory,
  deleteCategory,
  adminOrders,
  setOrderStatus,
  adminUsers,
};