'use strict';

/**
 * Données initiales (seed) du catalogue ZURION.
 * Images produits : URLs Unsplash d'origine.
 */
const u = (id, w = 800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;
const img = (id) => u(id);
const catImg = (slug) => u({
  audio: 'photo-1546435770-a3e426bf472b',
  'smartphones-accessoires': 'photo-1511707171634-5f897ff02aa9',
  'power-banks-chargeurs': 'photo-1583863788434-e58a36330cf0',
  'montres-connectees': 'photo-1523275335684-37898b6baf30',
  eclairage: 'photo-1507473885765-e6ed057f782c',
  informatique: 'photo-1498050108023-c5249f4df085',
  'maison-connectee': 'photo-1558089687-f282ffcbc126',
  gaming: 'photo-1552820728-8b83bb6b773f',
}[slug]);

// URLs produits (Unsplash)
const P_IMG = {
  'AU-AB01': ['photo-1590658268037-6bf12165a8df', 'photo-1572569511254-d8f925fe2cbb'],
  'PW-PB20': ['photo-1609081219090-a6d81d3085bf', 'photo-1609091839311-d5365f9ff1c5', 'photo-1583863788434-e58a36330cf0'],
  'MW-FW01': ['photo-1523275335684-37898b6baf30', 'photo-1524805444758-089113d48a6d'],
  'AU-SP01': ['photo-1608043152269-423dbba4e7e1', 'photo-1589003077984-894e133dabab'],
  'LG-LD01': ['photo-1507473885765-e6ed057f782c'],
  'GM-MG01': ['photo-1592840496694-26d035b52b48', 'photo-1600271886742-f049cd451bba'],
  'SP-SS01': ['photo-1610792516307-ea5acd9c3b00'],
  'AU-CS01': ['photo-1505740420928-5e560c06d30e'],
  'IT-KB01': ['photo-1587829741301-dc798b83add3'],
  'IT-MS01': ['photo-1527864550417-7fd91fc51a46'],
  'SP-CB01': ['photo-1547949003-9792a18a2601'],
  'HC-LC01': ['photo-1513506003901-1e6a229e2d15'],
  'PW-CH30': ['photo-1583863788434-e58a36330cf0'],
  'MW-BB01': ['photo-1575311373937-040b8e1fd5b6'],
  'PW-CB2': ['photo-1526406915894-7bcd65f60845'],
  'PW-CV30': ['photo-1601679667371-ca57df10a463'],
  'AU-BB01': ['photo-1545454675-3531b543be5d', 'photo-1605733513597-a8f8341084e6'],
};
const productImg = (sku, num = 1) => u((P_IMG[sku] || [])[num - 1]);

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

const PRODUCTS_A = [
  {
    name: 'Écouteurs ZURION Air Buds', categorySlug: 'audio', price: 18900, oldPrice: 22900, stock: 18, sku: 'AU-AB01',
    description: 'Écouteurs sans fil avec réduction de bruit et autonomie longue durée. Bluetooth 5.3, étui de charge USB-C.',
    featured: true, images: [productImg('AU-AB01', 1), productImg('AU-AB01', 2)],
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
    featured: true, images: [productImg('PW-PB20', 1), productImg('PW-PB20', 2), productImg('PW-PB20', 3)],
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
    featured: true, images: [productImg('MW-FW01', 1), productImg('MW-FW01', 2)],
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
    featured: false, images: [productImg('AU-SP01', 1), productImg('AU-SP01', 2)],
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
    featured: false, images: [productImg('LG-LD01', 1)],
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
    featured: true, images: [productImg('GM-MG01', 1), productImg('GM-MG01', 2)],
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
    featured: false, images: [productImg('SP-SS01', 1)],
    specs: [
      { label: 'Matériau', value: 'Aluminium' },
      { label: 'Ajustement', value: 'Hauteur et angle' },
    ],
    reviews: [],
  },
];
module.exports = { PRODUCTS_A, catImg };