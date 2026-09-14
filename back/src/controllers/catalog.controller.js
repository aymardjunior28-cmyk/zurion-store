'use strict';

const catalogService = require('../services/catalog.service');
const { money, discountPercent } = require('../utils/money');
const { Product, ProductImage } = require('../models');

/** GET /api/categories */
/* ═══════════════════════════════════════════════════════════════════════════
 *  CONTRÔLEUR CATALOGUE — endpoints JSON publics
 *  Enrichit chaque produit avec les prix formatés et le % de remise.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** GET /api/categories — liste des catégories actives. */
async function listCategories(req, res, next) {
  try {
    const categories = await catalogService.listCategories();
    return res.json({ categories });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/products */
/** GET /api/products — liste paginée avec recherche, filtres et tri. */
async function listProducts(req, res, next) {
  try {
    const data = await catalogService.listProducts(req.query);
    // Enrichit chaque produit avec le prix formaté pour un affichage direct
    return res.json({
      products: data.products.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        priceFormatted: money(p.price),
        oldPrice: p.oldPrice,
        oldPriceFormatted: p.oldPrice ? money(p.oldPrice) : null,
        discount: p.oldPrice ? discountPercent(p.oldPrice, p.price) : 0,
        stock: p.stock,
        featured: p.featured,
        image: (p.images && p.images[0] ? p.images[0].url : null),
        category: p.category ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : null,
      })),
      meta: data.meta,
      categories: data.allCategories,
    });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/products/:slug */
/** GET /api/products/:slug — fiche produit complète (galerie, specs, avis). */
async function getProduct(req, res, next) {
  try {
    const product = await catalogService.getProductBySlug(req.params.slug);
    if (!product) return res.status(404).json({ error: 'Produit introuvable.' });

    const average = product.reviews && product.reviews.length
      ? product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length
      : 0;

    return res.json({
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        price: product.price,
        priceFormatted: money(product.price),
        oldPrice: product.oldPrice,
        oldPriceFormatted: product.oldPrice ? money(product.oldPrice) : null,
        discount: product.oldPrice ? discountPercent(product.oldPrice, product.price) : 0,
        stock: product.stock,
        sku: product.sku,
        category: product.category ? { id: product.category.id, name: product.category.name, slug: product.category.slug } : null,
        images: (product.images || []).map((i) => i.url),
        specs: (product.specs || []).map((s) => ({ label: s.label, value: s.value })),
        reviews: (product.reviews || []).map((r) => ({
          rating: r.rating,
          comment: r.comment,
          userName: r.user ? `${r.user.firstName} ${r.user.lastName.charAt(0)}.` : 'Client',
          verified: r.verified,
          date: r.createdAt,
        })),
        averageRating: Math.round(average * 10) / 10,
        reviewCount: product.reviews ? product.reviews.length : 0,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/suggestions?q= */
/** GET /api/suggestions — autocomplétion live (max 6 résultats). */
async function suggestions(req, res, next) {
  try {
    const items = await catalogService.getSuggestions(req.query.q || '');
    return res.json({
      items: items.map((p) => ({ slug: p.slug, name: p.name, priceFormatted: money(p.price) })),
    });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/product-images?slug=... ou ?productId=... */
/** GET /api/product-images — galerie d'un produit (par slug ou productId). */
async function listProductImages(req, res, next) {
  try {
    const where = {};
    if (req.query.productId) {
      const productId = Number(req.query.productId);
      if (!Number.isInteger(productId) || productId < 1) return res.status(400).json({ error: 'Identifiant produit invalide.' });
      where.id = productId;
    } else if (req.query.slug) {
      where.slug = String(req.query.slug).trim();
    } else {
      return res.status(400).json({ error: 'Le slug ou productId est requis.' });
    }

    const product = await Product.findOne({
      where: { ...where, active: true },
      include: [{ model: ProductImage, as: 'images', separate: true, order: [['position', 'ASC']] }],
    });
    if (!product) return res.status(404).json({ error: 'Produit introuvable.' });
    return res.json({
      productId: product.id,
      slug: product.slug,
      images: (product.images || []).map((image) => ({
        id: image.id,
        url: image.url,
        position: image.position,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listCategories, listProducts, getProduct, suggestions, listProductImages };