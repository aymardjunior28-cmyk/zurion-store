'use strict';

const fs = require('fs');
const path = require('path');
const { DataTypes } = require('sequelize');

const migrationsDirectory = path.resolve(__dirname, '../../migrations');

async function ensureMigrationsTable(sequelize) {
  await sequelize.getQueryInterface().createTable('SequelizeMeta', {
    name: { type: DataTypes.STRING(255), allowNull: false, primaryKey: true },
    executedAt: { type: DataTypes.DATE, allowNull: false },
  }).catch((error) => {
    if (!/already exists|duplicate table|relation .* exists/i.test(error.message)) throw error;
  });
}

async function runMigrations(sequelize) {
  await ensureMigrationsTable(sequelize);
  const [executed] = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
  const completed = new Set(executed.map((migration) => migration.name));
  const files = fs.readdirSync(migrationsDirectory)
    .filter((file) => /^\d+-.+\.js$/.test(file))
    .sort();

  for (const file of files) {
    const migration = require(path.join(migrationsDirectory, file));
    if (!migration || typeof migration.up !== 'function' || !migration.name) {
      throw new Error(`Migration invalide: ${file}`);
    }
    if (completed.has(migration.name)) continue;

    await migration.up({ sequelize });
    await sequelize.getQueryInterface().bulkInsert('SequelizeMeta', [{
      name: migration.name,
      executedAt: new Date(),
    }]);
    console.log(`[migrate] ${migration.name} appliquée.`);
  }
}

module.exports = { runMigrations };
