'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * Livraison rattachée à une commande, confiée à un livreur.
 * Liste au back-office : ID, livreur (nom), quantité de colis, prix,
 * statut et possibilité d'annulation.
 */
const Livraison = sequelize.define(
  'Livraison',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reference: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    orderId: { type: DataTypes.INTEGER, allowNull: false },
    courierName: { type: DataTypes.STRING(80), allowNull: false }, // nom du livreur
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }, // nb de colis/articles
    price: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // frais facturés (FCFA)
    status: {
      type: DataTypes.ENUM('en_cours', 'livrée', 'annulée'),
      allowNull: false,
      defaultValue: 'en_cours',
    },
    shippedAt: { type: DataTypes.DATE, allowNull: true },
    deliveredAt: { type: DataTypes.DATE, allowNull: true },
    cancelledAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'livraisons',
    indexes: [{ fields: ['orderId'] }, { fields: ['status'] }],
  }
);

module.exports = Livraison;