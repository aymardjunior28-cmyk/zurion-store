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
} = require('../src/models');
const { hashPassword } = require('../src/utils/password');
const { CATEGORIES, PRODUCTS } = require('./seed-data-index');
const { slugify } = require('../src/utils/slugify');

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`[seed] Connexion OK (${sequelize.getDialect()})`);
    await sequelize.sync({ force: true });
    console.log('[seed] Base réinitialisée.');

    // ── Compte admin de démonstration ────────────────────────────────────
    await User.create({
      firstName: 'Admin',
      lastName: 'ZURION',
      email: 'admin@zurion.store',
      phone: '+237 000 000 000',
      passwordHash: hashPassword('Admin1234!'),
      role: 'admin',
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
      for (const r of p.reviews || []) {
        await Review.create({
          productId: product.id,
          userId: 1,
          rating: r.rating,
          comment: r.comment,
          verified: r.verified,
        });
      }
    }
    console.log(`[seed] ${PRODUCTS.length} produits créés.`);

    // ── Compte client de démonstration ───────────────────────────────────
    await User.create({
      firstName: 'Client',
      lastName: 'Démo',
      email: 'client@zurion.store',
      phone: '+237 000 000 001',
      passwordHash: hashPassword('Client1234!'),
      role: 'customer',
    });

    console.log('[seed] Terminé. Comptes de démo :');
    console.log('  admin  → admin@zurion.store  / Admin1234!');
    console.log('  client → client@zurion.store / Client1234!');
    process.exit(0);
  } catch (err) {
    console.error('[seed] Erreur :', err);
    process.exit(1);
  }
})();