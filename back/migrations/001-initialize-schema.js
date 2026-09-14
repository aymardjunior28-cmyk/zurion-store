'use strict';

/**
 * Initialisation versionnée du schéma.
 *
 * Les modèles Sequelize restent la source de vérité des colonnes et des
 * associations. La migration est volontairement non destructive : elle crée
 * les tables manquantes sans modifier ni supprimer les données existantes.
 */
module.exports = {
  name: '001-initialize-schema',

  async up({ sequelize }) {
    await sequelize.sync();
  },
};
