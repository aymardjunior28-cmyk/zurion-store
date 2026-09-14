'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  name: '002-add-delivery-destination',

  async up({ sequelize }) {
    const queryInterface = sequelize.getQueryInterface();
    const table = await queryInterface.describeTable('livraisons');
    if (!table.destinationSnapshot) {
      await queryInterface.addColumn('livraisons', 'destinationSnapshot', {
        type: DataTypes.TEXT,
        allowNull: true,
      });
    }
  },
};