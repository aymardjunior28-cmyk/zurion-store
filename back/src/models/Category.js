'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/** Catégorie de produits (Audio, Power, Montres connectées, …). */
const Category = sequelize.define(
  'Category',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    slug: { type: DataTypes.STRING(110), allowNull: false, unique: true },
    description: { type: DataTypes.STRING(300), allowNull: true },
    image: { type: DataTypes.STRING(300), allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: 'categories',
    indexes: [{ fields: ['slug'] }],
  }
);

module.exports = Category;