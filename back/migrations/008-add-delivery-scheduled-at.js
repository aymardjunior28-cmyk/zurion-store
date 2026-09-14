'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  name: '008-add-delivery-scheduled-at',

  async up({ sequelize }) {
    const queryInterface = sequelize.getQueryInterface();
    const existing = await sequelize.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'livraisons' AND column_name = 'scheduledAt' LIMIT 1",
      { plain: true }
    );
    if (!existing) {
      try {
        await queryInterface.addColumn('livraisons', 'scheduledAt', {
          type: DataTypes.DATE,
          allowNull: true,
        });
      } catch (error) {
        // Course entre processus (tests parallèles) : un autre a déjà créé la colonne.
        if (!/already exists|duplicate column|column named .* already/i.test(error.message)) throw error;
      }
    }
  },
};