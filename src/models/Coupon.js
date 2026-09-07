'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * Code promo : remise en pourcentage ou montant fixe (FCFA),
 * avec période de validité et plafond d'utilisations.
 */
const Coupon = sequelize.define(
  'Coupon',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    type: { type: DataTypes.ENUM('percent', 'fixed'), allowNull: false, defaultValue: 'percent' },
    value: { type: DataTypes.INTEGER, allowNull: false }, // % (percent) ou FCFA (fixed)
    minAmount: { type: DataTypes.INTEGER, allowNull: true }, // total panier minimum (FCFA)
    maxUses: { type: DataTypes.INTEGER, allowNull: true }, // null = illimité
    usedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    validFrom: { type: DataTypes.DATE, allowNull: true },
    validUntil: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'coupons',
    indexes: [{ fields: ['code'] }],
  }
);

module.exports = Coupon;