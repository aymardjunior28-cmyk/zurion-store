'use strict';

/**
 * Agrégateur des données initiales (seed) du catalogue ZURION.
 * Consulte la catégorie via son slug (résolu au moment du seed).
 */
const { PRODUCTS_A, catImg } = require('./seed-data');
const { PRODUCTS_B } = require('./seed-data-b');

const CATEGORIES = [
  { name: 'Audio', slug: 'audio', description: 'Écouteurs, casques et enceintes.', image: catImg('audio'), sortOrder: 1 },
  { name: 'Smartphones & accessoires', slug: 'smartphones-accessoires', description: 'Accessoires et supports pour smartphones.', image: catImg('smartphones-accessoires'), sortOrder: 2 },
  { name: 'Power banks & chargeurs', slug: 'power-banks-chargeurs', description: 'Power banks, chargeurs rapides et câbles.', image: catImg('power-banks-chargeurs'), sortOrder: 3 },
  { name: 'Montres connectées', slug: 'montres-connectees', description: 'Montres et bracelets connectés.', image: catImg('montres-connectees'), sortOrder: 4 },
  { name: 'Éclairage', slug: 'eclairage', description: 'Lampes et éclairage intelligent.', image: catImg('eclairage'), sortOrder: 5 },
  { name: 'Informatique', slug: 'informatique', description: 'Claviers, souris et périphériques.', image: catImg('informatique'), sortOrder: 6 },
  { name: 'Maison connectée', slug: 'maison-connectee', description: 'Objets connectés pour le quotidien.', image: catImg('maison-connectee'), sortOrder: 7 },
  { name: 'Gaming', slug: 'gaming', description: 'Manettes et accessoires gaming.', image: catImg('gaming'), sortOrder: 8 },
];

const PRODUCTS = [...PRODUCTS_A, ...PRODUCTS_B];

module.exports = { CATEGORIES, PRODUCTS };