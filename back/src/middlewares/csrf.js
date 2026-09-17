'use strict';

const crypto = require('crypto');
const env = require('../config/env');

const CSRF_COOKIE = 'zurion_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/* ═══════════════════════════════════════════════════════════════════════════
 *  MIDDLEWARE CSRF — protection « double soumission » :
 *  - un cookie HTTP-only `zurion_csrf` est posé au premier passage ;
 *  - la même valeur est exposée à la vue via res.locals.csrfToken
 *    (rendue dans window.ZURION.csrfToken et dans les champs cachés des formulaires) ;
 *  - toute requête de mutation doit joindre X-CSRF-Token (API) ou _csrf (formulaire),
 *    sinon elle est rejetée. Un attaquant cross-site ne peut ni lire le token
 *    (httpOnly + SameSite=Lax) ni envoyer de cookie de sa façon.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Protection CSRF en pattern « double soumission ». */
function csrfProtection(req, res, next) {
  let token = req.cookies[CSRF_COOKIE];
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProd,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
  res.locals.csrfToken = token;

  if (SAFE_METHODS.has(req.method)) return next();

  const submitted = req.get('X-CSRF-Token') || (req.body && req.body._csrf);
  if (!submitted || !safeEqual(submitted, token)) {
    if (req.accepts('html')) {
      return res.status(403).redirect(req.get('Referer') || '/');
    }
    return res.status(403).json({ error: 'Jeton de sécurité invalide (CSRF). Rechargez la page.' });
  }
  return next();
}

/** Comparaison en temps constant (résiste aux side-channels de timing). */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = { csrfProtection, CSRF_COOKIE };