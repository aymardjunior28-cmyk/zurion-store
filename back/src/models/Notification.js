'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
 *  MODÈLE : Notification (centre de notifications interne)
 *  Destinataires : uniquement les comptes admin, superadmin et livreur.
 *  Les customers n'ont JAMAIS accès aux notifications.
 *  Types : livree | non_livree | assignation | info
 * ═══════════════════════════════════════════════════════════════════════════ */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/** Notification interne (admin / superadmin / livreur uniquement — jamais les customers). */
const Notification = sequelize.define(
  'Notification',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false }, // destinataire
    type: {
      type: DataTypes.ENUM('livree', 'non_livree', 'assignation', 'info', 'message'),
      allowNull: false,
      defaultValue: 'info',
    },
    title: { type: DataTypes.STRING(180), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    link: { type: DataTypes.STRING(300), allowNull: true }, // route vers la livraison/commande
    // Expéditeur du message (uniquement pour type='message', NULL sinon ou si compte supprimé).
    senderId: { type: DataTypes.INTEGER, allowNull: true },
    read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    tableName: 'notifications',
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ['userId'] }, { fields: ['userId', 'read'] }],
  }
);

module.exports = Notification;