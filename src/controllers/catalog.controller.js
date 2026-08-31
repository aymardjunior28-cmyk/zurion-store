'use strict';

const catalogService = require('../services/catalog.service');
const { money, discountPercent } = require('../utils/money');

/** GET /api/categories */
async function listCategories(req, res, next) {
  try {
    const categories = await catalogService.listCategories();
    return res.json({ categories });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/products */
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
async function getProduct(req, res, next) {
  try {
    const product = await catalogService.getProductBySlug(req.params.slug);
    if (!product) return res.status(404).json({ error: 'Produit introuvable.' });

    const related = await catalogService.getRelatedProducts(product);
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
      related: related.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        priceFormatted: money(p.price),
        image: null,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/suggestions?q= */
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

module.exports = { listCategories, listProducts, getProduct, suggestions };