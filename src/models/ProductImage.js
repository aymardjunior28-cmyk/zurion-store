'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/** Galerie d'images d'un produit. */
const ProductImage = sequelize.define(
  'ProductImage',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    url: { type: DataTypes.STRING(300), allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { tableName: 'product_images' }
);

module.exports = ProductImage;