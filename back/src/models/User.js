'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
 *  MODÈLE : User (utilisateur client, administrateur, super-admin ou livreur)
 *  - Mot de passe JAMAIS stocké en clair (passwordHash bcrypt).
 *  - passwordChangedAt permet d'invalider les sessions JWT après un
 *    changement de mot de passe (sécurité).
 *  - role : customer | admin | superadmin | livreur (ENUM).
 *    • customer    : acheteur sur la boutique.
 *    • admin       : gère produits, catégories, livreurs, livraisons, coupons.
 *    • superadmin  : accès total (stats, commandes, suppression de comptes).
 *    • livreur     : voit uniquement ses livraisons assignées + signale l'état.
 * ═══════════════════════════════════════════════════════════════════════════ */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/** Utilisateur de la boutique (client, admin, superadmin ou livreur). */
const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    firstName: { type: DataTypes.STRING(80), allowNull: false },
    lastName: { type: DataTypes.STRING(80), allowNull: false },
    email: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    phone: { type: DataTypes.STRING(30), allowNull: true },
    passwordHash: { type: DataTypes.STRING(100), allowNull: false },
    // Date du dernier changement de mot de passe : permet d'invalider
    // les sessions JWT antérieures au changement.
    passwordChangedAt: { type: DataTypes.DATE, allowNull: true },
    role: {
      type: DataTypes.ENUM('customer', 'admin', 'superadmin', 'livreur'),
      allowNull: false,
      defaultValue: 'customer',
    },
  },
  {
    tableName: 'users',
    indexes: [{ fields: ['email'] }, { fields: ['role'] }],
  }
);

module.exports = User;