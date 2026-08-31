'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/** Avis / notation d'un produit par un client. */
const Review = sequelize.define(
  'Review',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    rating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    comment: { type: DataTypes.TEXT, allowNull: true },
    verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    tableName: 'reviews',
    indexes: [{ fields: ['productId'] }],
  }
);

module.exports = Review;