'use strict';

/**
 * Migration 007 — senderId ON DELETE SET NULL (suppression de compte
 * expéditeur : le message reste visible avec "Compte supprimé").
 */
module.exports = {
  name: '007-notifications-sender-set-null',

  async up({ sequelize }) {
    if (sequelize.getDialect() === 'postgres') {
      await sequelize.query('ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_senderId_fkey"');
      await sequelize.query(
        'ALTER TABLE "notifications" ADD CONSTRAINT "notifications_senderId_fkey" ' +
        'FOREIGN KEY ("senderId") REFERENCES "users" ("id") ON UPDATE CASCADE ON DELETE SET NULL'
      );
    } else {
      // SQLite : sync() recrée la contrainte via les associations.
    }
  },
};