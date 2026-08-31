'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * Commande avec cycle de vie :
 * créée → paiement_confirmé → préparation → expédition → livraison → terminée
 */
const Order = sequelize.define(
  'Order',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reference: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    status: {
      type: DataTypes.ENUM(
        'créée',
        'paiement_confirmé',
        'préparation',
        'expédition',
        'livraison',
        'terminée'
      ),
      allowNull: false,
      defaultValue: 'créée',
    },
    total: { type: DataTypes.INTEGER, allowNull: false },
    shipping: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    paymentMethod: { type: DataTypes.STRING(60), allowNull: false },
    deliveryMode: { type: DataTypes.STRING(60), allowNull: false },
    // Instantané des données de livraison au moment de la commande
    addressSnapshot: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    tableName: 'orders',
    indexes: [{ fields: ['reference'] }, { fields: ['userId'] }],
  }
);

module.exports = Order;