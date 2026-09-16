'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
 *  AGRÉGATEUR DES MODÈLES SEQUELIZE + ASSOCIATIONS
 *  - Import unique de tous les modèles (ordre d'initialisation garanti).
 *  - Déclare TOUTES les associations ici (pas dans les fichiers de modèle).
 *  - Exporte chaque modèle + l'instance sequelize pour les contrôleurs.
 * ═══════════════════════════════════════════════════════════════════════════ */
const { sequelize } = require('../config/db');

/* ── Imports des modèles ─────────────────────────────────────────────────── */
const User = require('./User');
const Address = require('./Address');
const Category = require('./Category');
const Product = require('./Product');
const ProductImage = require('./ProductImage');
const ProductSpec = require('./ProductSpec');
const Review = require('./Review');
const Cart = require('./Cart');
const CartItem = require('./CartItem');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Coupon = require('./Coupon');
const Livraison = require('./Livraison');
const Wishlist = require('./Wishlist');
const Courier = require('./Courier');
const ContactMessage = require('./ContactMessage');
const Notification = require('./Notification');
const LivraisonEvent = require('./LivraisonEvent');

// ── Associations ──────────────────────────────────────────────────────────

/* ── Catégories ↔ Produits ───────────────────────────────────────────────── */
Category.hasMany(Product, { as: 'products', foreignKey: 'categoryId', onDelete: 'SET NULL' });
Product.belongsTo(Category, { as: 'category', foreignKey: 'categoryId' });

/* ── Produit → galerie d'images, spécifications techniques, avis ──────────── */
Product.hasMany(ProductImage, { as: 'images', foreignKey: 'productId', onDelete: 'CASCADE' });
ProductImage.belongsTo(Product, { foreignKey: 'productId' });
Product.hasMany(ProductSpec, { as: 'specs', foreignKey: 'productId', onDelete: 'CASCADE' });
ProductSpec.belongsTo(Product, { foreignKey: 'productId' });
Product.hasMany(Review, { as: 'reviews', foreignKey: 'productId', onDelete: 'CASCADE' });
Review.belongsTo(Product, { foreignKey: 'productId' });

/* ── Utilisateur → adresses, avis, commandes, favoris ─────────────────────── */
User.hasMany(Address, { as: 'addresses', foreignKey: 'userId', onDelete: 'CASCADE' });
Address.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Review, { as: 'reviews', foreignKey: 'userId', onDelete: 'CASCADE' });
Review.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasMany(Order, { as: 'orders', foreignKey: 'userId', onDelete: 'CASCADE' });
Order.belongsTo(User, { as: 'user', foreignKey: 'userId' });

/* ── Panier (connecté via userId OU invité via token) ────────────────────── */
User.hasOne(Cart, { as: 'cart', foreignKey: 'userId', onDelete: 'CASCADE' });
Cart.belongsTo(User, { foreignKey: 'userId' });
Cart.hasMany(CartItem, { as: 'items', foreignKey: 'cartId', onDelete: 'CASCADE' });
CartItem.belongsTo(Cart, { foreignKey: 'cartId' });
CartItem.belongsTo(Product, { as: 'product', foreignKey: 'productId' });
Product.hasMany(CartItem, { as: 'cartItems', foreignKey: 'productId', onDelete: 'CASCADE' });

/* ── Commande → lignes de commande (instantanés nom/prix) ─────────────────── */
Order.hasMany(OrderItem, { as: 'items', foreignKey: 'orderId', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', onDelete: 'SET NULL' });

/* ── Commande → livraisons confiées aux livreurs ──────────────────────────── */
Order.hasMany(Livraison, { as: 'livraisons', foreignKey: 'orderId', onDelete: 'CASCADE' });
Livraison.belongsTo(Order, { as: 'order', foreignKey: 'orderId' });

/* ── Compte livreur → livraisons assignées (le livreur voit ses colis) ─────── */
User.hasMany(Livraison, { as: 'livraisonsAssignees', foreignKey: 'courierId' });
Livraison.belongsTo(User, { as: 'courier', foreignKey: 'courierId' });

/* ── Livraison → historique des actions (journal timeliné) ─────────────────── */
Livraison.hasMany(LivraisonEvent, { as: 'events', foreignKey: 'livraisonId', onDelete: 'CASCADE' });
LivraisonEvent.belongsTo(Livraison, { foreignKey: 'livraisonId' });

/* ── Coupon → commandes : aucune FK, code conservé en dur sur la commande ──── */

/* ── Favoris : table de jointure Wishlist (userId, productId) ────────────── */
User.belongsToMany(Product, { through: Wishlist, as: 'wishlistProducts', foreignKey: 'userId', otherKey: 'productId' });
Product.belongsToMany(User, { through: Wishlist, as: 'usersWhoWishlist', foreignKey: 'productId', otherKey: 'userId' });
// Associations directes pour Wishlist.findAll + include Product
Wishlist.belongsTo(User, { as: 'user', foreignKey: 'userId' });
Wishlist.belongsTo(Product, { as: 'product', foreignKey: 'productId' });

/* ── Messages de contact (userId optionnel, conservé si compte supprimé) ───── */
User.hasMany(ContactMessage, { as: 'contactMessages', foreignKey: 'userId', onDelete: 'SET NULL' });
ContactMessage.belongsTo(User, { as: 'user', foreignKey: 'userId' });

/* ── Notifications internes (admin / superadmin / livreur) ────────────────── */
User.hasMany(Notification, { as: 'notifications', foreignKey: 'userId', onDelete: 'CASCADE' });
Notification.belongsTo(User, { as: 'user', foreignKey: 'userId' });
// Expéditeur d'un message interne (type='message') — conservé NULL si compte supprimé.
User.hasMany(Notification, { as: 'sentNotifications', foreignKey: 'senderId', onDelete: 'SET NULL' });
Notification.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });

/* ═══════════════════════════════════════════════════════════════════════════
 *  EXPORTS
 * ═══════════════════════════════════════════════════════════════════════════ */
module.exports = {
  sequelize,
  User,
  Address,
  Category,
  Product,
  ProductImage,
  ProductSpec,
  Review,
  Cart,
  CartItem,
  Order,
  OrderItem,
  Coupon,
  Livraison,
  Wishlist,
  Courier,
  ContactMessage,
  Notification,
  LivraisonEvent,
};