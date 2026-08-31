'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/** Favoris : association (userId, productId) unique. */
const Wishlist = sequelize.define(
  'Wishlist',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  },
  {
    tableName: 'wishlist',
    indexes: [{ fields: ['userId'], unique: false }],
  }
);

module.exports = Wishlist;