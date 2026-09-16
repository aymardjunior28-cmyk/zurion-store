'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
 *  MODÈLE : LivraisonEvent (historique des actions sur une livraison)
 *  - Chaque action (attribution, expédition, livraison, non livré, annulation)
 *    est enregistrée ici pour constituer un journal chronologique affiché
 *    dans la page de détail livraison côté livreur.
 * ═══════════════════════════════════════════════════════════════════════════ */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const LivraisonEvent = sequelize.define(
  'LivraisonEvent',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    livraisonId: { type: DataTypes.INTEGER, allowNull: false },
    type: {
      type: DataTypes.ENUM('created', 'shipped', 'delivered', 'non_livree', 'cancelled', 'note'),
      allowNull: false,
    },
    message: { type: DataTypes.TEXT, allowNull: true },
    authorName: { type: DataTypes.STRING(80), allowNull: true },
  },
  {
    tableName: 'livraison_events',
    indexes: [{ fields: ['livraisonId'] }],
  }
);

module.exports = LivraisonEvent;
