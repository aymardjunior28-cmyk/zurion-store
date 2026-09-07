'use strict';

/**
 * Exécute les migrations versionnées sur la base configurée.
 */
const { sequelize } = require('../src/config/db');
const { runMigrations } = require('../src/config/migrations');

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`[migrate] Connexion OK (${sequelize.getDialect()})`);
    require('../src/models');
    await runMigrations(sequelize);
    console.log('[migrate] Schéma à jour.');
    process.exit(0);
  } catch (err) {
    console.error('[migrate] Erreur :', err);
    process.exit(1);
  }
})();