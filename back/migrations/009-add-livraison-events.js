'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  name: '009-add-livraison-events',

  async up({ sequelize }) {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await sequelize.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename = 'livraison_events'",
      { plain: true }
    );
    if (tables) return; // Déjà créée (course entre processus).

    await queryInterface.createTable('livraison_events', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      livraisonId: { type: DataTypes.INTEGER, allowNull: false },
      type: {
        type: DataTypes.ENUM('created', 'shipped', 'delivered', 'non_livree', 'cancelled', 'note'),
        allowNull: false,
      },
      message: { type: DataTypes.TEXT, allowNull: true },
      authorName: { type: DataTypes.STRING(80), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('livraison_events', ['livraisonId']);
    await queryInterface.addConstraint('livraison_events', {
      type: 'foreign key',
      name: 'livraison_events_livraisonId_fkey',
      fields: ['livraisonId'],
      references: { table: 'livraisons', field: 'id' },
      onDelete: 'CASCADE',
    });
  },
};