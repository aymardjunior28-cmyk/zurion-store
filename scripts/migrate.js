'use strict';

/**
 * Exécute les migrations versionnées sur la base configurée.
 */
const { sequelize } = require('../back/src/config/db');
const { runMigrations } = require('../back/src/config/migrations');

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`[migrate] Connexion OK (${sequelize.getDialect()})`);
    require('../back/src/models');
    await runMigrations(sequelize);
    console.log('[migrate] Schéma à jour.');
    process.exit(0);
  } catch (err) {
    console.error('[migrate] Erreur :', err);
    process.exit(1);
  }
})();