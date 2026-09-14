'use strict';

/**
 * Migration 005 — Ajoute le rôle 'livreur' et les colonnes de liaison
 * vers les comptes livreurs sur la table livraisons.
 */
module.exports = {
  name: '005-add-livreur-role',

  async up({ sequelize }) {
    const { QueryInterface, DataTypes } = require('sequelize');

    if (sequelize.getDialect() === 'postgres') {
      // PostgreSQL : ajoute la valeur au ENUM existant (idempotent)
      await sequelize.query("ALTER TYPE \"enum_users_role\" ADD VALUE IF NOT EXISTS 'livreur'");

      // Ajoute les colonnes (idempotent grâce aux fonctions d'agrégation)
      const table = await sequelize.getQueryInterface().describeTable('livraisons');
      if (!table.courierId) {
        await sequelize.getQueryInterface().addColumn('livraisons', 'courierId', {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' },
        });
      }
      if (!table.lastReportMessage) {
        await sequelize.getQueryInterface().addColumn('livraisons', 'lastReportMessage', {
          type: DataTypes.TEXT,
          allowNull: true,
        });
      }
    } else {
      // SQLite : sync()/patchSchema gère la création des colonnes
    }
  },
};