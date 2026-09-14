'use strict';

const env = require('../config/env');

/**
 * Contrôle global du trafic pour limiter les abus (bruteforce, spam).
 * En production on s'appuie sur l'IP ; en local le proxy éventuel est ignoré.
 */
/* ═══════════════════════════════════════════════════════════════════════════
 *  MIDDLEWARE RATE LIMITING — contrôle global du trafic (bruteforce, spam)
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Limiteur appliqué aux routes d'authentification et à l'API. */
/* ═══════════════════════════════════════════════════════════════════════════
 *  MIDDLEWARE RATE LIMITING — contrôle global du trafic (bruteforce, spam)
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Limiteur appliqué aux routes d'authentification et à l'API. */
const authLimiter = {
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans quelques minutes.' },
};

module.exports = { authLimiter };