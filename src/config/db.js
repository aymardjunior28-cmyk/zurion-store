'use strict';

/**
 * Connexion Sequelize.
 * Dev    : SQLite (fichier local ./data/zurion.sqlite) — aucune installation.
 * Prod   : PostgreSQL via DATABASE_URL.
 */
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const env = require('./env');

function buildSequelize() {
  if (env.databaseUrl.startsWith('sqlite')) {
    // S'assure que le dossier de données existe
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const dbPath = env.databaseUrl.replace('sqlite://', '').replace('./', '');
    return new Sequelize({
      dialect: 'sqlite',
      storage: path.resolve(__dirname, '../../', dbPath),
      logging: false,
    });
  }
  return new Sequelize(env.databaseUrl, {
    dialect: 'postgres',
    logging: false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  });
}

const sequelize = buildSequelize();

async function connectDatabase() {
  await sequelize.authenticate();
  const dialect = sequelize.getDialect();
  console.log(`[db] Connexion OK (${dialect})`);
  if (dialect === 'postgres') {
    // En PostgreSQL, on utilise les vraies migrations (sequelize-cli) en prod.
    return;
  }
  // En dev (SQLite) : synchronisation automatique du schéma.
  await sequelize.sync();
  console.log('[db] Schéma synchronisé (SQLite)');
}

module.exports = { sequelize, connectDatabase };