'use strict';

/**
 * Seed : remplit la base avec les catégories, produits, images, specs,
 * avis et un compte admin de démonstration.
 * Usage : npm run seed   (détruit et reconstruit les données)
 */
const {
  sequelize,
  User,
  Category,
  Product,
  ProductImage,
  ProductSpec,
  Review,
  Coupon,
} = require('../back/src/models');
const { hashPassword } = require('../back/src/utils/password');
const { CATEGORIES, PRODUCTS } = require('./seed-data-index');
const { slugify } = require('../back/src/utils/slugify');

(async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      console.error('[seed] Refusé : ne jamais exécuter le seed en production.');
      process.exit(1);
    }
    await sequelize.authenticate();
    console.log(`[seed] Connexion OK (${sequelize.getDialect()})`);
    await sequelize.sync({ force: true });
    console.log('[seed] Base réinitialisée.');

    // ── Comptes de démonstration ─────────────────────────────────────
    await User.create({
      firstName: 'Admin',
      lastName: 'ZURION',
      email: 'admin@zurion.store',
      phone: '+237 000 000 000',
      passwordHash: await hashPassword('Admin1234!'),
      role: 'superadmin',
    });

    // Le compte client est créé AVANT les produits pour référencer ses avis.
    const clientUser = await User.create({
      firstName: 'Client',
      lastName: 'Démo',
      email: 'client@zurion.store',
      phone: '+237 000 000 001',
      passwordHash: await hashPassword('Client1234!'),
      role: 'customer',
    });

    // ── Catégories ───────────────────────────────────────────────────────
    const categoryBySlug = {};
    for (const c of CATEGORIES) {
      const category = await Category.create(c);
      categoryBySlug[c.slug] = category;
    }
    console.log(`[seed] ${CATEGORIES.length} catégories créées.`);

    // ── Produits ─────────────────────────────────────────────────────────
    for (const p of PRODUCTS) {
      const category = categoryBySlug[p.categorySlug];
      const product = await Product.create({
        name: p.name,
        slug: slugify(p.name),
        description: p.description,
        price: p.price,
        oldPrice: p.oldPrice,
        stock: p.stock,
        sku: p.sku,
        featured: p.featured,
        active: true,
        categoryId: category ? category.id : null,
      });

      for (const [i, url] of (p.images || []).entries()) {
        await ProductImage.create({ productId: product.id, url, position: i });
      }
      for (const [i, s] of (p.specs || []).entries()) {
        await ProductSpec.create({ productId: product.id, label: s.label, value: s.value, position: i });
      }
      for (const [i, r] of (p.reviews || []).entries()) {
        // Un seul avis par (produit, utilisateur) : on alterne entre le client
        // démo (2) et l'admin démo (1) pour les produits multi-avis.
        await Review.create({
          productId: product.id,
          userId: i % 2 === 0 ? clientUser.id : 1,
          rating: r.rating,
          comment: r.comment,
          verified: r.verified,
        });
      }
    }
    console.log(`[seed] ${PRODUCTS.length} produits créés.`);

    // ── Codes promo de démonstration ─────────────────────────────────────
    await Coupon.create({
      code: 'BIENVENUE10',
      type: 'percent',
      value: 10,
      minAmount: 10000,
      maxUses: 500,
      active: true,
    });
    await Coupon.create({
      code: '-FCFA3000',
      type: 'fixed',
      value: 3000,
      minAmount: 25000,
      maxUses: null,
      active: true,
    });
    console.log('[seed] 2 codes promo créés (BIENVENUE10, -FCFA3000).');

    console.log('[seed] Terminé. Comptes de démonstration créés (voir la documentation du projet).');
    console.log('[seed] Sensible aux conventions : les identifiants de démo ne sont pas affichés ici.');
    process.exit(0);
  } catch (err) {
    console.error('[seed] Erreur :', err);
    process.exit(1);
  }
})();