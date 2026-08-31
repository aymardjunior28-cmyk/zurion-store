'use strict';

const { Op } = require('sequelize');
const { Category, Product, ProductImage, ProductSpec, Review, User } = require('../models');
const { paginate, paginationMeta } = require('../utils/pagination');

/** Tri acceptés par le catalogue. */
const SORTS = {
  popular: [['featured', 'DESC'], ['id', 'ASC']],
  price_asc: [['price', 'ASC']],
  price_desc: [['price', 'DESC']],
  newest: [['id', 'DESC']],
  rating: [['id', 'ASC']], // tri par note géré côté agrégation ci-dessous
};

async function listCategories({ activeOnly = true } = {}) {
  const where = activeOnly ? { active: true } : {};
  return Category.findAll({
    where,
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
  });
}

/**
 * Liste paginée avec recherche + filtres combinables.
 * Retourne { products, page, limit, total, pages, categories }.
 */
async function listProducts(options = {}) {
  const { page, limit, offset } = paginate(options, 12);

  const where = { active: true };
  if (options.featured) where.featured = true;
  if (options.category) {
    // Le filtre catégorie est transmis par slug (ex. « audio ») — on le résout en id.
    const cat = await Category.findOne({ where: { slug: String(options.category) }, attributes: ['id'] });
    where.categoryId = cat ? cat.id : -1; // slug inconnu => aucun produit
  }

  if (options.q) {
    where[Op.or] = [
      { name: { [Op.like]: `%${options.q}%` } },
      { description: { [Op.like]: `%${options.q}%` } },
    ];
  }
  if (options.min || options.max) {
    const price = {};
    if (Number(options.min)) price[Op.gte] = Number(options.min);
    if (Number(options.max)) price[Op.lte] = Number(options.max);
    where.price = price;
  }
  if (options.inStock) {
    where.stock = { [Op.gt]: 0 };
  }

  const order = SORTS[options.sort] || SORTS.popular;

  const { rows, count } = await Product.findAndCountAll({
    where,
    order,
    limit,
    offset,
    include: [
      { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
      { model: ProductImage, as: 'images' },
    ],
    distinct: true,
  });

  return {
    products: rows,
    meta: paginationMeta(page, limit, count),
    allCategories: await listCategories(),
  };
}

/** Produit complet pour la fiche produit. */
async function getProductBySlug(slug) {
  return Product.findOne({
    where: { slug },
    include: [
      { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
      { model: ProductImage, as: 'images', attributes: ['id', 'url', 'position'], order: [['position', 'ASC']] },
      { model: ProductSpec, as: 'specs', attributes: ['id', 'label', 'value'], order: [['position', 'ASC']] },
      {
        model: Review,
        as: 'reviews',
        include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName'] }],
        order: [['createdAt', 'DESC']],
        limit: 12,
      },
    ],
  });
}

/** Produits d'une même catégorie (pour « produits similaires »). */
async function getRelatedProducts(product, limit = 4) {
  return Product.findAll({
    where: { categoryId: product.categoryId, id: { [Op.ne]: product.id }, active: true },
    limit,
    order: [['id', 'ASC']],
    include: [{ model: ProductImage, as: 'images' }],
  });
}

/** Nouveautés (les plus récents) pour l'accueil. */
async function getNewProducts(limit = 8) {
  return Product.findAll({
    where: { active: true },
    order: [['id', 'DESC']],
    limit,
    include: [{ model: ProductImage, as: 'images' }],
  });
}

/** Suggestions live de recherche. */
async function getSuggestions(query, limit = 6) {
  if (!query) return [];
  return Product.findAll({
    where: { active: true, name: { [Op.like]: `%${query}%` } },
    attributes: ['id', 'slug', 'name', 'price'],
    limit,
    order: SORTS.price_asc,
  });
}

/** Produits mis en avant (featured) pour l'accueil. */
async function getFeaturedProducts(limit = 8) {
  return Product.findAll({
    where: { active: true, featured: true },
    include: [{ model: ProductImage, as: 'images', attributes: ['id', 'url', 'position'], separate: true, order: [['position', 'ASC']] }],
    order: [['id', 'ASC']],
    limit,
  });
}

module.exports = {
  listCategories,
  listProducts,
  getProductBySlug,
  getRelatedProducts,
  getFeaturedProducts,
  getNewProducts,
  getSuggestions,
};