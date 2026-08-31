'use strict';

/**
 * Agrégateur des données initiales (seed) du catalogue ZURION.
 * Consulte la catégorie via son slug (résolu au moment du seed).
 */
const { PRODUCTS_A, IMG } = require('./seed-data');
const { PRODUCTS_B } = require('./seed-data-b');

const CATEGORIES = [
  { name: 'Audio', slug: 'audio', description: 'Écouteurs, casques et enceintes.', image: IMG + 'product-1.jpg', sortOrder: 1 },
  { name: 'Smartphones & accessoires', slug: 'smartphones-accessoires', description: 'Accessoires et supports pour smartphones.', image: IMG + 'product-7.jpg', sortOrder: 2 },
  { name: 'Power banks & chargeurs', slug: 'power-banks-chargeurs', description: 'Power banks, chargeurs rapides et câbles.', image: IMG + 'product-2.jpg', sortOrder: 3 },
  { name: 'Montres connectées', slug: 'montres-connectees', description: 'Montres et bracelets connectés.', image: IMG + 'product-3.jpg', sortOrder: 4 },
  { name: 'Éclairage', slug: 'eclairage', description: 'Lampes et éclairage intelligent.', image: IMG + 'product-5.jpg', sortOrder: 5 },
  { name: 'Informatique', slug: 'informatique', description: 'Claviers, souris et périphériques.', image: IMG + 'product-8.jpg', sortOrder: 6 },
  { name: 'Maison connectée', slug: 'maison-connectee', description: 'Objets connectés pour le quotidien.', image: IMG + 'product-11.jpg', sortOrder: 7 },
  { name: 'Gaming', slug: 'gaming', description: 'Manettes et accessoires gaming.', image: IMG + 'product-6.jpg', sortOrder: 8 },
];

const PRODUCTS = [...PRODUCTS_A, ...PRODUCTS_B];

module.exports = { CATEGORIES, PRODUCTS };