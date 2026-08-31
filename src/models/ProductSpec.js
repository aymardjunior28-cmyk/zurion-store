'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/** Caractéristique technique (label/valeur) d'un produit. */
const ProductSpec = sequelize.define(
  'ProductSpec',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    label: { type: DataTypes.STRING(120), allowNull: false },
    value: { type: DataTypes.STRING(200), allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { tableName: 'product_specs' }
);

module.exports = ProductSpec;