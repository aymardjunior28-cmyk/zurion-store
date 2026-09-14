'use strict';

/**
 * Migration 006 — Messagerie interne via le centre de notifications.
 * - Ajoute la valeur 'message' à l'ENUM notifications.type.
 * - Ajoute la colonne notifications.senderId (expéditeur, NULL si compte supprimé).
 */
module.exports = {
  name: '006-add-message-notifications',

  async up({ sequelize }) {
    const { DataTypes } = require('sequelize');
    const qi = sequelize.getQueryInterface();

    if (sequelize.getDialect() === 'postgres') {
      await sequelize.query(`ALTER TYPE "enum_notifications_type" ADD VALUE IF NOT EXISTS 'message'`);
      const table = await qi.describeTable('notifications');
      if (!table.senderId) {
        await qi.addColumn('notifications', 'senderId', {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' },
        });
      }
    } else {
      // SQLite : sync()/patchSchema gère la création des colonnes
    }
  },
};