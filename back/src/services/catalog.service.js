'use strict';

const { Op } = require('sequelize');
const { Category, Product, ProductImage, ProductSpec, Review, User } = require('../models');
const { paginate, paginationMeta } = require('../utils/pagination');

/** Échappe les wildcards LIKE (% et _) d'une entrée utilisateur. */
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** Tri acceptés par le catalogue. */
/* ═══════════════════════════════════════════════════════════════════════════
 *  SERVICE CATALOGUE — liste, recherche, filtres, tri, pagination
 *  - listProducts : recherche full-text + filtres (catégorie, prix, stock, vedette).
 *  - getProductBySlug : fiche complète (galerie, specs, avis).
 *  - getFeaturedProducts / getNewProducts : sélections pour l'accueil.
 *  - getSuggestions : autocomplétion live.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Tri acceptés par le catalogue (clé de query → ordre Sequelize). */
const SORTS = {
  popular: [['featured', 'DESC'], ['id', 'ASC']],
  price_asc: [['price', 'ASC']],
  price_desc: [['price', 'DESC']],
  newest: [['id', 'DESC']],
  rating: [['id', 'ASC']], // tri par note géré côté agrégation ci-dessous
};

/** Liste les catégories (actives par défaut), triées par sortOrder puis nom. */
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
/** Liste paginée avec recherche + filtres combinables.
 *  Retourne { products, meta(page/limit/total/pages), allCategories }. */
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
    const q = escapeLike(options.q);
    where[Op.or] = [
      { name: { [Op.like]: `%${q}%`, [Op.escape]: '\\' } },
      { description: { [Op.like]: `%${q}%`, [Op.escape]: '\\' } },
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
      { model: ProductImage, as: 'images', separate: true, order: [['position', 'ASC']] },
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
/** Produit complet pour la fiche (galerie, specs, avis avec auteur). */
async function getProductBySlug(slug) {
  return Product.findOne({
    where: { slug },
    include: [
      { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
      { model: ProductImage, as: 'images', attributes: ['id', 'url', 'position'], separate: true, order: [['position', 'ASC']] },
      { model: ProductSpec, as: 'specs', attributes: ['id', 'label', 'value'], separate: true, order: [['position', 'ASC']] },
      {
        model: Review,
        as: 'reviews',
        include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName'] }],
        separate: true,
        order: [['createdAt', 'DESC']],
        limit: 12,
      },
    ],
  });
}

/** Nouveautés (les plus récents) pour l'accueil. */
/** Nouveautés (les plus récents) pour l'accueil. */
async function getNewProducts(limit = 8) {
  return Product.findAll({
    where: { active: true },
    order: [['id', 'DESC']],
    limit,
    include: [{ model: ProductImage, as: 'images', separate: true, order: [['position', 'ASC']] }],
  });
}

/** Suggestions live de recherche. */
/** Suggestions live de recherche (autocomplétion). */
async function getSuggestions(query, limit = 6) {
  if (!query) return [];
  const q = escapeLike(query);
  return Product.findAll({
    where: { active: true, name: { [Op.like]: `%${q}%`, [Op.escape]: '\\' } },
    attributes: ['id', 'slug', 'name', 'price'],
    limit,
    order: SORTS.price_asc,
  });
}

/** Produits mis en avant (featured) pour l'accueil. */
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
  getFeaturedProducts,
  getNewProducts,
  getSuggestions,
};