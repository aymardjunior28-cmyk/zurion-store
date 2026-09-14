'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * Ligne de commande. Des instantanés (nom/prix) sont conservés pour garder
 * l'historique fidèle même si le produit change ou est supprimé ensuite.
 */
const OrderItem = sequelize.define(
  'OrderItem',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nameSnapshot: { type: DataTypes.STRING(180), allowNull: false },
    priceSnapshot: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  },
  {
    tableName: 'order_items',
    indexes: [{ fields: ['orderId'] }],
  }
);

module.exports = OrderItem;