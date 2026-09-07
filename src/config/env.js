'use strict';

/**
 * Variables d'environnement centralisées et validées.
 * Rien de sensible n'est versionné : tout passe par .env / process.env.
 */
require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4173,
  databaseUrl: process.env.DATABASE_URL || 'sqlite://./data/zurion.sqlite',
  jwtSecret: process.env.JWT_SECRET || null,
  sessionMaxAgeDays: Number(process.env.SESSION_MAX_AGE_DAYS) || 7,
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 200,
  dbSslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  dbSslEnabled: process.env.DB_SSL_ENABLED !== 'false',
  allowSimulatedPayments: process.env.ALLOW_SIMULATED_PAYMENTS === 'true',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
};

// En production, JWT_SECRET est OBLIGATOIRE : un secret de secours codé en dur
// permettrait de forger des sessions admin. Aucun fallback n'est autorisé ici.
if (env.isProd && !env.jwtSecret) {
  throw new Error('JWT_SECRET est obligatoire en production (variable d’environnement non définie).');
}
// Fallback UNIQUEMENT hors production (développement) : jamais utilisable en prod.
if (!env.jwtSecret) {
  env.jwtSecret = 'dev-secret-change-me-a-very-long-random-value-0123456789';
}

module.exports = env;