'use strict';

/**
 * Migrations/synchronisation du schéma.
 * - SQLite (dev) : sequelize.sync()
 * - PostgreSQL (prod) : commande sequelize-cli (db:migrate) à configurer.
 */
const { sequelize } = require('../src/config/db');
const env = require('../src/config/env');

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`[migrate] Connexion OK (${sequelize.getDialect()})`);
    if (sequelize.getDialect() === 'postgres') {
      // En production : utiliser sequelize-cli avec des migrations fichier.
      console.log('[migrate] PostgreSQL détecté — utilisez : npx sequelize-cli db:migrate');
    }
    await sequelize.sync({ alter: true });
    console.log('[migrate] Schéma synchronisé.');
    process.exit(0);
  } catch (err) {
    console.error('[migrate] Erreur :', err);
    process.exit(1);
  }
})();