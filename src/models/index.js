'use strict';

/**
 * Agrégateur des modèles Sequelize + associations.
 * Tous les modèles sont importés ici pour garantir un ordre d'initialisation unique.
 */
const { sequelize } = require('../config/db');

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

// ── Associations ──────────────────────────────────────────────────────────

// Catégories ↔ Produits
Category.hasMany(Product, { as: 'products', foreignKey: 'categoryId', onDelete: 'SET NULL' });
Product.belongsTo(Category, { as: 'category', foreignKey: 'categoryId' });

// Produit → galerie, specs, avis
Product.hasMany(ProductImage, { as: 'images', foreignKey: 'productId', onDelete: 'CASCADE' });
ProductImage.belongsTo(Product, { foreignKey: 'productId' });
Product.hasMany(ProductSpec, { as: 'specs', foreignKey: 'productId', onDelete: 'CASCADE' });
ProductSpec.belongsTo(Product, { foreignKey: 'productId' });
Product.hasMany(Review, { as: 'reviews', foreignKey: 'productId', onDelete: 'CASCADE' });
Review.belongsTo(Product, { foreignKey: 'productId' });

// Utilisateur → adresses, avis, commandes, favoris
User.hasMany(Address, { as: 'addresses', foreignKey: 'userId', onDelete: 'CASCADE' });
Address.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Review, { as: 'reviews', foreignKey: 'userId', onDelete: 'CASCADE' });
Review.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasMany(Order, { as: 'orders', foreignKey: 'userId', onDelete: 'CASCADE' });
Order.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// Panier (connecté ou invité)
User.hasOne(Cart, { as: 'cart', foreignKey: 'userId', onDelete: 'CASCADE' });
Cart.belongsTo(User, { foreignKey: 'userId' });
Cart.hasMany(CartItem, { as: 'items', foreignKey: 'cartId', onDelete: 'CASCADE' });
CartItem.belongsTo(Cart, { foreignKey: 'cartId' });
CartItem.belongsTo(Product, { as: 'product', foreignKey: 'productId' });
Product.hasMany(CartItem, { as: 'cartItems', foreignKey: 'productId', onDelete: 'CASCADE' });

// Commande → lignes
Order.hasMany(OrderItem, { as: 'items', foreignKey: 'orderId', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', onDelete: 'SET NULL' });

// Commande → livraisons (livreurs)
Order.hasMany(Livraison, { as: 'livraisons', foreignKey: 'orderId', onDelete: 'CASCADE' });
Livraison.belongsTo(Order, { as: 'order', foreignKey: 'orderId' });

// Coupon → commandes (aucune FK : historique de code conservé sur la commande)

// Favoris (unique par couple)
User.belongsToMany(Product, { through: Wishlist, as: 'wishlistProducts', foreignKey: 'userId', otherKey: 'productId' });
Product.belongsToMany(User, { through: Wishlist, as: 'usersWhoWishlist', foreignKey: 'productId', otherKey: 'userId' });
// Associations directes (requêtes Wishlist.findAll + include Product)
Wishlist.belongsTo(User, { as: 'user', foreignKey: 'userId' });
Wishlist.belongsTo(Product, { as: 'product', foreignKey: 'productId' });

// Messages de contact (utilisateur optionnel — conservé si connecté)
User.hasMany(ContactMessage, { as: 'contactMessages', foreignKey: 'userId', onDelete: 'SET NULL' });
ContactMessage.belongsTo(User, { as: 'user', foreignKey: 'userId' });

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
};