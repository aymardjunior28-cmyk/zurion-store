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
  jwtSecret:
    process.env.JWT_SECRET ||
    'dev-secret-change-me-a-very-long-random-value-0123456789',
  sessionMaxAgeDays: Number(process.env.SESSION_MAX_AGE_DAYS) || 7,
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 200,
  isProd: (process.env.NODE_ENV || 'development') === 'production',
};

module.exports = env;