'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * Message envoyé via le formulaire de contact de la boutique.
 * Conservé en base pour suivi par l'équipe ZURION.
 */
const ContactMessage = sequelize.define(
  'ContactMessage',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(160), allowNull: false },
    subject: { type: DataTypes.STRING(200), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    status: {
      type: DataTypes.ENUM('nouveau', 'traite', 'archive'),
      allowNull: false,
      defaultValue: 'nouveau',
    },
    userId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
  },
  {
    tableName: 'contact_messages',
    timestamps: true,
    updatedAt: false,
  }
);

module.exports = ContactMessage;