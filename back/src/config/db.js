'use strict';

/**
 * Connexion Sequelize.
 * Dev    : SQLite (fichier local ./data/zurion.sqlite) — aucune installation.
 * Prod   : PostgreSQL via DATABASE_URL.
 */
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const fs = require('fs');
const env = require('./env');
const { runMigrations } = require('./migrations');

/**
 * SQLite : sync() crée les tables manquantes mais ne modifie PAS les tables
 * existantes. Ce patch ciblé ajoute les colonnes introduites par de nouvelles
 * versions du modèle (ex. Order.couponCode) sans toucher aux autres colonnes.
 */
async function patchSchema(sequelize) {
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable('orders');
  const add = async (column, def) => {
    if (!table[column]) await qi.addColumn('orders', column, def);
  };
  await add('couponCode', { type: DataTypes.STRING(40), allowNull: true });
  await add('discount', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
  await add('cancelledAt', { type: DataTypes.DATE, allowNull: true });
  const livraisonTable = await qi.describeTable('livraisons');
  if (!livraisonTable.destinationSnapshot) {
    await qi.addColumn('livraisons', 'destinationSnapshot', { type: DataTypes.TEXT, allowNull: true });
  }
  if (!livraisonTable.courierId) {
    await qi.addColumn('livraisons', 'courierId', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    });
  }
  if (!livraisonTable.lastReportMessage) {
    await qi.addColumn('livraisons', 'lastReportMessage', { type: DataTypes.TEXT, allowNull: true });
  }
  // Messagerie interne : colonne expéditeur sur les notifications (SQLite dev).
  try {
    const notifTable = await qi.describeTable('notifications');
    if (notifTable && !notifTable.senderId) {
      await qi.addColumn('notifications', 'senderId', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      });
    }
  } catch (_) {
    // Table absente au tout premier sync : sync() la créera avec senderId.
  }
  // Promotion idempotente du premier admin en superadmin :
  // n'a lieu qu'UNE fois (aucun superadmin présent) et n'écrase jamais une
  // promotion existante (un superadmin dimotionné ne sera pas re-promu).
  const promoteFirstAdmin = async () => {
    await sequelize.query(`
      UPDATE users
      SET role = 'superadmin'
      WHERE role = 'admin'
        AND id = (
          SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1
        )
        AND (SELECT COUNT(*) FROM users WHERE role = 'superadmin') = 0
    `);
  };
  try {
    await promoteFirstAdmin();
  } catch (error) {
    await qi.changeColumn('users', 'role', {
      type: DataTypes.ENUM('customer', 'admin', 'superadmin', 'livreur'),
      allowNull: false,
      defaultValue: 'customer',
    });
    await promoteFirstAdmin();
  }
}

function buildSequelize() {
  if (env.databaseUrl.startsWith('sqlite')) {
    // S'assure que le dossier de données existe
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const dbPath = env.databaseUrl.replace('sqlite://', '').replace('./', '');
    const storage = path.resolve(__dirname, '../../', dbPath);

    // Le dialect SQLite de Sequelize charge `sqlite3` au runtime, s'il est installé
    return new Sequelize({
      dialect: 'sqlite',
      storage,
      logging: false,
    });
  }
  return new Sequelize(env.databaseUrl, {
    dialect: 'postgres',
    logging: false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    // En production, chiffre la connexion et vérifie le certificat par défaut.
    // Les hébergeurs utilisant un certificat privé peuvent désactiver cette
    // vérification explicitement avec DB_SSL_REJECT_UNAUTHORIZED=false.
    dialectOptions: env.isProd && env.dbSslEnabled
      ? { ssl: { require: true, rejectUnauthorized: env.dbSslRejectUnauthorized } }
      : undefined,
  });
}

const sequelize = buildSequelize();

async function connectDatabase() {
  await sequelize.authenticate();
  const dialect = sequelize.getDialect();
  console.log(`[db] Connexion OK (${dialect})`);
  if (dialect === 'postgres') {
    // En PostgreSQL, seules les migrations versionnées créent/évoluent le schéma.
    await runMigrations(sequelize);
    return;
  }
  // En dev (SQLite) : synchronisation automatique du schéma.
  await sequelize.sync();
  await patchSchema(sequelize);
  console.log('[db] Schéma synchronisé (SQLite)');
}

module.exports = { sequelize, connectDatabase };