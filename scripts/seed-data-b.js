'use strict';

/**
 * Suite des données produits.
 */
const { IMG } = require('./seed-data');

const PRODUCTS_B = [
  {
    name: 'Casque studio ZURION One', categorySlug: 'audio', price: 45900, oldPrice: 54900, stock: 6, sku: 'AU-CS01',
    description: 'Casque circum-aural avec son neutre et confort longue session. Idéal studio et écoute nomade.',
    featured: true, images: [IMG + 'product-15.jpg'],
    specs: [
      { label: 'Type', value: 'Circum-aural' },
      { label: 'Fréquence', value: '20 Hz – 20 kHz' },
      { label: 'Connexion', value: '3,5 mm + Bluetooth' },
    ],
    reviews: [{ rating: 5, comment: 'Enfin un casque qui respecte le son.', verified: false }],
  },
  {
    name: 'Clavier compact sans fil', categorySlug: 'informatique', price: 27500, oldPrice: 31500, stock: 11, sku: 'IT-KB01',
    description: 'Clavier Bluetooth compact, frappe silencieuse et multi-appareils.',
    featured: true, images: [IMG + 'product-8.jpg'],
    specs: [
      { label: 'Connexion', value: 'Bluetooth 5.1' },
      { label: 'Appareils', value: 'Jusqu’à 3' },
      { label: 'Autonomie', value: '60 jours' },
    ],
    reviews: [{ rating: 5, comment: 'Frappe très agréable, parfait pour le télétravail.', verified: true }],
  },
  {
    name: 'Souris ZURION Silent Click', categorySlug: 'informatique', price: 12500, oldPrice: null, stock: 15, sku: 'IT-MS01',
    description: 'Souris silencieuse ergonomique, DPI ajustable et design compact.',
    featured: false, images: [IMG + 'product-9.jpg'],
    specs: [
      { label: 'DPI', value: '800–1600' },
      { label: 'Clic', value: 'Silencieux' },
    ],
    reviews: [],
  },
  {
    name: 'Sacoche câble & accessoires', categorySlug: 'smartphones-accessoires', price: 6900, oldPrice: null, stock: 22, sku: 'SP-CB01',
    description: 'Rangement organisé pour câbles, chargeurs et petits accessoires.',
    featured: false, images: [IMG + 'product-10.jpg'],
    specs: [{ label: 'Compartiments', value: '6' }],
    reviews: [],
  },
  {
    name: 'Lampe de chevet connectée', categorySlug: 'maison-connectee', price: 18900, oldPrice: null, stock: 14, sku: 'HC-LC01',
    description: 'Lampe de chevet pilotable, variateur intégré et fonction réveil lumineux.',
    featured: false, images: [IMG + 'product-11.jpg'],
    specs: [
      { label: 'Contrôle', value: 'Tactile + variateur' },
      { label: 'Intensité', value: 'Réglable' },
    ],
    reviews: [{ rating: 4, comment: 'Belle lumière chaude le soir.', verified: false }],
  },
  {
    name: 'Chargeur secteur 2 ports 30W', categorySlug: 'power-banks-chargeurs', price: 11500, oldPrice: 13900, stock: 40, sku: 'PW-CH30',
    description: 'Chargeur rapide double port USB-C + USB-A, 30 W au total.',
    featured: false, images: [IMG + 'product-12.jpg'],
    specs: [
      { label: 'Puissance', value: '30 W' },
      { label: 'Ports', value: '1×USB-C, 1×USB-A' },
      { label: 'Protection', value: 'Surcharge, surchauffe' },
    ],
    reviews: [],
  },
  {
    name: 'Bracelet connecté ZURION Band', categorySlug: 'montres-connectees', price: 16900, oldPrice: null, stock: 19, sku: 'MW-BB01',
    description: 'Suivi du sommeil, fréquence cardiaque et 20 modes sport. Étanche.',
    featured: false, images: [IMG + 'product-13.jpg'],
    specs: [
      { label: 'Écran', value: 'OLED 0,96"' },
      { label: 'Modes sport', value: '20' },
      { label: 'Étanchéité', value: 'IP67' },
    ],
    reviews: [{ rating: 4, comment: 'Très bien pour débuter.', verified: true }],
  },
  {
    name: 'Pack 2× câbles USB-C 60W', categorySlug: 'power-banks-chargeurs', price: 5900, oldPrice: 7500, stock: 60, sku: 'PW-CB2',
    description: 'Câbles USB-C tressés pour charge rapide jusqu’à 60 W.',
    featured: false, images: [IMG + 'product-14.jpg'],
    specs: [
      { label: 'Longueur', value: '1,2 m' },
      { label: 'Puissance', value: '60 W' },
    ],
    reviews: [],
  },
  {
    name: 'Chargeur voiture 30W USB-C', categorySlug: 'power-banks-chargeurs', price: 8900, oldPrice: null, stock: 18, sku: 'PW-CV30',
    description: 'Chargeur allume-cigare double sortie rapide 30 W pour vos trajets.',
    featured: false, images: [IMG + 'product-2-2.jpg'],
    specs: [
      { label: 'Sorties', value: '1×USB-C, 1×USB-A' },
      { label: 'Puissance', value: '30 W' },
    ],
    reviews: [],
  },
  {
    name: 'Barre de son ZURION Boom', categorySlug: 'audio', price: 54900, oldPrice: null, stock: 4, sku: 'AU-BB01',
    description: 'Barre de son 2.1 avec subwoofer intégré et connexion Bluetooth.',
    featured: false, images: [IMG + 'product-9.jpg', IMG + 'product-1.jpg'],
    specs: [
      { label: 'Puissance', value: '40 W RMS' },
      { label: 'Connexions', value: 'Bluetooth, AUX, USB' },
    ],
    reviews: [],
  },
];

module.exports = { PRODUCTS_B };