'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/** Adresse de livraison rattachée à un utilisateur. */
const Address = sequelize.define(
  'Address',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    label: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'Domicile' },
    fullName: { type: DataTypes.STRING(120), allowNull: false },
    phone: { type: DataTypes.STRING(30), allowNull: false },
    line1: { type: DataTypes.STRING(180), allowNull: false },
    line2: { type: DataTypes.STRING(180), allowNull: true },
    city: { type: DataTypes.STRING(80), allowNull: false },
    region: { type: DataTypes.STRING(80), allowNull: false },
    isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    tableName: 'addresses',
    indexes: [{ fields: ['userId'] }],
  }
);

module.exports = Address;