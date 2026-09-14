'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
 *  MODÈLE : Livraison (colis confié à un livreur)
 *  - courierId : lien vers le compte livreur (User) assigné — le livreur voit
 *    cette livraison dans son tableau de bord et peut signaler son état.
 *  - courierName : instantané du nom (historique, conservé si le compte est supprimé).
 *  - lastReportMessage : raison du dernier signalement "non livré".
 *  - status : en_cours | livrée | annulée.
 * ═══════════════════════════════════════════════════════════════════════════ */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/** Livraison rattachée à une commande, confiée à un livreur (compte ou nom). */
const Livraison = sequelize.define(
  'Livraison',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reference: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    orderId: { type: DataTypes.INTEGER, allowNull: false },
    // Lien vers le compte livreur assigné (le livreur voit cette livraison chez lui).
    courierId: { type: DataTypes.INTEGER, allowNull: true },
    // Instantané du nom du livreur (historique, conservé si le compte est supprimé).
    courierName: { type: DataTypes.STRING(80), allowNull: false },
    destinationSnapshot: { type: DataTypes.TEXT, allowNull: true },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    price: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    status: {
      type: DataTypes.ENUM('en_cours', 'livrée', 'annulée'),
      allowNull: false,
      defaultValue: 'en_cours',
    },
    // Date/heure prévue de remise au client (renseignée à l'attribution).
    scheduledAt: { type: DataTypes.DATE, allowNull: true },
    shippedAt: { type: DataTypes.DATE, allowNull: true },
    deliveredAt: { type: DataTypes.DATE, allowNull: true },
    cancelledAt: { type: DataTypes.DATE, allowNull: true },
    // Raison du dernier signalement "non livré" (le colis reste en_cours).
    lastReportMessage: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'livraisons',
    // `courierId` est ajouté après sync() pour les anciennes bases SQLite ;
    // le déclarer ici ferait créer son index avant la colonne et empêcherait
    // tout démarrage sur ces bases existantes.
    indexes: [{ fields: ['orderId'] }, { fields: ['status'] }],
  }
);

module.exports = Livraison;
