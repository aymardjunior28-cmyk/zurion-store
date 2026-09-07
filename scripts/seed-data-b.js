'use strict';

/**
 * Suite des données produits.
 * Images produits : URLs Unsplash d'origine.
 */
const u = (id, w = 800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;
const P_IMG = {
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

const PRODUCTS_B = [
  {
    name: 'Casque studio ZURION One', categorySlug: 'audio', price: 45900, oldPrice: 54900, stock: 6, sku: 'AU-CS01',
    description: 'Casque circum-aural avec son neutre et confort longue session. Idéal studio et écoute nomade.',
    featured: true, images: [productImg('AU-CS01', 1)],
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
    featured: true, images: [productImg('IT-KB01', 1)],
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
    featured: false, images: [productImg('IT-MS01', 1)],
    specs: [
      { label: 'DPI', value: '800–1600' },
      { label: 'Clic', value: 'Silencieux' },
    ],
    reviews: [],
  },
  {
    name: 'Sacoche câble & accessoires', categorySlug: 'smartphones-accessoires', price: 6900, oldPrice: null, stock: 22, sku: 'SP-CB01',
    description: 'Rangement organisé pour câbles, chargeurs et petits accessoires.',
    featured: false, images: [productImg('SP-CB01', 1)],
    specs: [{ label: 'Compartiments', value: '6' }],
    reviews: [],
  },
  {
    name: 'Lampe de chevet connectée', categorySlug: 'maison-connectee', price: 18900, oldPrice: null, stock: 14, sku: 'HC-LC01',
    description: 'Lampe de chevet pilotable, variateur intégré et fonction réveil lumineux.',
    featured: false, images: [productImg('HC-LC01', 1)],
    specs: [
      { label: 'Contrôle', value: 'Tactile + variateur' },
      { label: 'Intensité', value: 'Réglable' },
    ],
    reviews: [{ rating: 4, comment: 'Belle lumière chaude le soir.', verified: false }],
  },
  {
    name: 'Chargeur secteur 2 ports 30W', categorySlug: 'power-banks-chargeurs', price: 11500, oldPrice: 13900, stock: 40, sku: 'PW-CH30',
    description: 'Chargeur rapide double port USB-C + USB-A, 30 W au total.',
    featured: false, images: [productImg('PW-CH30', 1)],
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
    featured: false, images: [productImg('MW-BB01', 1)],
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
    featured: false, images: [productImg('PW-CB2', 1)],
    specs: [
      { label: 'Longueur', value: '1,2 m' },
      { label: 'Puissance', value: '60 W' },
    ],
    reviews: [],
  },
  {
    name: 'Chargeur voiture 30W USB-C', categorySlug: 'power-banks-chargeurs', price: 8900, oldPrice: null, stock: 18, sku: 'PW-CV30',
    description: 'Chargeur allume-cigare double sortie rapide 30 W pour vos trajets.',
    featured: false, images: [productImg('PW-CV30', 1)],
    specs: [
      { label: 'Sorties', value: '1×USB-C, 1×USB-A' },
      { label: 'Puissance', value: '30 W' },
    ],
    reviews: [],
  },
  {
    name: 'Barre de son ZURION Boom', categorySlug: 'audio', price: 54900, oldPrice: null, stock: 4, sku: 'AU-BB01',
    description: 'Barre de son 2.1 avec subwoofer intégré et connexion Bluetooth.',
    featured: false, images: [productImg('AU-BB01', 1), productImg('AU-BB01', 2)],
    specs: [
      { label: 'Puissance', value: '40 W RMS' },
      { label: 'Connexions', value: 'Bluetooth, AUX, USB' },
    ],
    reviews: [],
  },
];

module.exports = { PRODUCTS_B };