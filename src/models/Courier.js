'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * Livreur partenaire géré depuis le back-office.
 * L'administrateur crée, modifie et supprime lui-même les livreurs ;
 * les livraisons conservent un instantané du nom (courierName).
 */
const Courier = sequelize.define(
  'Courier',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    phone: { type: DataTypes.STRING(30), allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: 'couriers',
    timestamps: true,
    updatedAt: false,
  }
);

module.exports = Courier;