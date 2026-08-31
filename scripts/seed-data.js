'use strict';

/**
 * Données initiales (seed) du catalogue ZURION.
 * Images issues du thème existant : assets/images/demos/demo-3/products/
 */
const IMG = '/assets/images/demos/demo-3/products/';

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

const PRODUCTS_A = [
  {
    name: 'Écouteurs ZURION Air Buds', categorySlug: 'audio', price: 18900, oldPrice: 22900, stock: 18, sku: 'AU-AB01',
    description: 'Écouteurs sans fil avec réduction de bruit et autonomie longue durée. Bluetooth 5.3, étui de charge USB-C.',
    featured: true, images: [IMG + 'product-1.jpg', IMG + 'product-2.jpg'],
    specs: [
      { label: 'Bluetooth', value: '5.3' },
      { label: 'Réduction de bruit', value: 'ANC 30 dB' },
      { label: 'Autonomie', value: 'Jusqu’à 28 h avec l’étui' },
      { label: 'Charge', value: 'USB-C' },
    ],
    reviews: [
      { rating: 5, comment: 'Excellent son et très bonne autonomie. Je recommande.', verified: true },
      { rating: 4, comment: 'Très bons écouteurs pour le prix.', verified: false },
    ],
  },
  {
    name: 'Power bank ZURION 20 000 mAh', categorySlug: 'power-banks-chargeurs', price: 24900, oldPrice: 29900, stock: 12, sku: 'PW-PB20',
    description: 'Recharge rapide USB-C 22,5 W pour vos appareils. Double sortie et indicateur LED.',
    featured: true, images: [IMG + 'product-2.jpg', IMG + 'product-2-2.jpg', IMG + 'product-4.jpg'],
    specs: [
      { label: 'Capacité', value: '20 000 mAh' },
      { label: 'Sortie USB-C', value: '22,5 W max' },
      { label: 'Indicateur', value: 'LED 4 niveaux' },
    ],
    reviews: [{ rating: 5, comment: 'Recharge mon téléphone plusieurs fois, très solide.', verified: true }],
  },
  {
    name: 'ZURION Fit Watch', categorySlug: 'montres-connectees', price: 32900, oldPrice: null, stock: 9, sku: 'MW-FW01',
    description: 'Suivi d’activité, appels Bluetooth et notifications intelligentes. Écran AMOLED 1,43".',
    featured: true, images: [IMG + 'product-3.jpg', IMG + 'product-13.jpg'],
    specs: [
      { label: 'Écran', value: 'AMOLED 1,43"' },
      { label: 'Appels', value: 'Bluetooth' },
      { label: 'Autonomie', value: 'Jusqu’à 7 jours' },
      { label: 'Étanchéité', value: 'IP68' },
    ],
    reviews: [
      { rating: 4, comment: 'Très belle montre, l’autonomie est appréciable.', verified: true },
      { rating: 5, comment: 'Parfait suivi sportif.', verified: false },
    ],
  },
  {
    name: 'Enceinte Bluetooth Mini', categorySlug: 'audio', price: 15900, oldPrice: 18900, stock: 24, sku: 'AU-SP01',
    description: 'Un son puissant dans un format nomade. Autonomie 12 h et résistance aux éclaboussures.',
    featured: false, images: [IMG + 'product-4.jpg', IMG + 'product-9.jpg'],
    specs: [
      { label: 'Puissance', value: '10 W' },
      { label: 'Autonomie', value: '12 h' },
      { label: 'Résistance', value: 'IPX5' },
    ],
    reviews: [{ rating: 4, comment: 'Son surprenant pour sa taille.', verified: false }],
  },
  {
    name: 'Lampe LED Smart Desk', categorySlug: 'eclairage', price: 21900, oldPrice: null, stock: 7, sku: 'LG-LD01',
    description: 'Éclairage ajustable et contrôle tactile. Température de couleur réglable et mémoire.',
    featured: false, images: [IMG + 'product-5.jpg'],
    specs: [
      { label: 'Contrôle', value: 'Tactile' },
      { label: 'Couleurs', value: '3 températures' },
      { label: 'Usage', value: 'Bureau' },
    ],
    reviews: [{ rating: 5, comment: 'Parfaite pour le bureau, éclairage très doux.', verified: true }],
  },
  {
    name: 'Manette Gaming Pro', categorySlug: 'gaming', price: 28900, oldPrice: null, stock: 5, sku: 'GM-MG01',
    description: 'Manette ergonomique compatible smartphone, PC et consoles. Joysticks précis et retour vibratoire.',
    featured: true, images: [IMG + 'product-6.jpg', IMG + 'product-14.jpg'],
    specs: [
      { label: 'Compatibilité', value: 'Android, PC, Switch' },
      { label: 'Connexion', value: 'Bluetooth / USB-C' },
      { label: 'Vibration', value: 'Oui' },
    ],
    reviews: [{ rating: 4, comment: 'Très réactive, bon grip.', verified: false }],
  },
  {
    name: 'Support smartphone aluminium', categorySlug: 'smartphones-accessoires', price: 8500, oldPrice: null, stock: 30, sku: 'SP-SS01',
    description: 'Support réglable en aluminium pour bureau et visioconférences. Rotation 360°.',
    featured: false, images: [IMG + 'product-7.jpg'],
    specs: [
      { label: 'Matériau', value: 'Aluminium' },
      { label: 'Ajustement', value: 'Hauteur et angle' },
    ],
    reviews: [],
  },
];
module.exports = { PRODUCTS_A, IMG };