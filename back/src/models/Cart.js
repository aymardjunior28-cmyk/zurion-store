'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * Panier.
 * - connecté : rattaché à l'utilisateur (userId)
 * - invité : identifié par token stocké côté navigateur (coexists avec l'auth)
 */
const Cart = sequelize.define(
  'Cart',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    token: { type: DataTypes.STRING(64), allowNull: true, unique: true },
  },
  {
    tableName: 'carts',
    indexes: [{ fields: ['userId'] }],
  }
);

module.exports = Cart;