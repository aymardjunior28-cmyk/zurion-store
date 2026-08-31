'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/** Ligne de panier : un produit + une quantité. */
const CartItem = sequelize.define(
  'CartItem',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: { min: 1 },
    },
  },
  {
    tableName: 'cart_items',
    indexes: [{ fields: ['cartId'], unique: false }, { fields: ['productId'] }],
  }
);

module.exports = CartItem;