'use strict';

const { Product, Wishlist } = require('../models');

/** GET /api/wishlist — liste les produits favoris du client connecté. */
/* ═══════════════════════════════════════════════════════════════════════════
 *  CONTRÔLEUR FAVORIS — liste, ajout, suppression (utilisateur connecté)
 * ═══════════════════════════════════════════════════════════════════════════ */

/** GET /api/wishlist — liste les produits favoris du client connecté. */
async function getWishlist(req, res, next) {
  try {
    const rows = await Wishlist.findAll({
      where: { userId: req.user.id },
      include: [{ model: Product, as: 'product' }],
      order: [['createdAt', 'DESC']],
    });
    const products = rows.map((r) => r.product).filter(Boolean);
    return res.json({ wishlist: products.map((p) => p.id), products });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/wishlist { productId } — ajoute un favori. */
/** POST /api/wishlist — ajoute un favori (idempotent). */
async function addWishlist(req, res, next) {
  try {
    const productId = Number(req.body.productId);
    const exists = await Product.findByPk(productId);
    if (!exists) return res.status(404).json({ error: 'Produit introuvable.' });

    const existing = await Wishlist.findOne({ where: { userId: req.user.id, productId } });
    if (!existing) await Wishlist.create({ userId: req.user.id, productId });

    return res.status(201).json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

/** DELETE /api/wishlist/:productId — retire un favori. */
async function removeWishlist(req, res, next) {
  try {
    await Wishlist.destroy({ where: { userId: req.user.id, productId: Number(req.params.productId) } });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getWishlist, addWishlist, removeWishlist };
