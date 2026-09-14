'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
 *  MODÈLE : Product (produit vendu sur la boutique)
 *  - price / oldPrice en FCFA (entiers, pas de décimale).
 *  - slug : identifiant URL unique (ex. "ecouteurs-zurion-air-buds").
 *  - featured : produit mis en avant sur l'accueil.
 *  - active : masqué du catalogue si false (jamais supprimé).
 * ═══════════════════════════════════════════════════════════════════════════ */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/** Produit vendu sur la boutique. */
const Product = sequelize.define(
  'Product',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(180), allowNull: false },
    slug: { type: DataTypes.STRING(200), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    price: { type: DataTypes.INTEGER, allowNull: false }, // en FCFA (entier, pas de décimale)
    oldPrice: { type: DataTypes.INTEGER, allowNull: true }, // prix barré avant promo
    stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    sku: { type: DataTypes.STRING(40), allowNull: true },
    featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: 'products',
    indexes: [{ fields: ['slug'] }, { fields: ['categoryId'] }],
  }
);

module.exports = Product;