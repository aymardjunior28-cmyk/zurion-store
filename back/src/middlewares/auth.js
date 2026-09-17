'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');

const COOKIE_NAME = env.cookieName;

/* ═══════════════════════════════════════════════════════════════════════════
 *  MIDDLEWARE AUTH — JWT, cookies de session, rôles
 *  - signToken : signe un JWT (sub=id, role, pwc=date du dernier MDP).
 *  - cookieOptions : options du cookie de session (httpOnly, SameSite, Secure).
 *  - requireAuth : exige un utilisateur authentifié (ajoute req.user).
 *  - optionalAuth : charge l'utilisateur si le cookie est valide (sinon invité).
 *  - requireAdmin / requireSuperAdmin : contrôle d'accès par rôle.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Signe un JWT pour un utilisateur (sub = id, role, pwc = dernière date de MDP). */
function signToken(user) {
  const passwordChanged = user.passwordChangedAt ? Math.floor(new Date(user.passwordChangedAt).getTime() / 1000) : null;
  return jwt.sign({ sub: user.id, role: user.role, pwc: passwordChanged }, env.jwtSecret, {
    expiresIn: `${env.sessionMaxAgeDays}d`,
  });
}

/** Options du cookie de session (httpOnly, SameSite, Secure en production). */
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: env.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

/** Middleware : exige un utilisateur authentifié (ajoute req.user).
 *  Invalide la session si le mot de passe a changé depuis l'émission du token. */
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch (err) {
      return res.status(401).json({ error: 'Session expirée ou invalide.' });
    }
    const user = await User.findByPk(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Compte introuvable.' });
    }
    // Invalidation de session : un token signé AVANT un changement de mot de passe
    // (même utilisateur, même secret) est refusé.
    const changedAt = user.passwordChangedAt ? Math.floor(new Date(user.passwordChangedAt).getTime() / 1000) : null;
    if ((payload.pwc || null) !== changedAt) {
      return res.status(401).json({ error: 'Session expirée ou invalide.' });
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Charge l'utilisateur si le cookie de session est valide, sans bloquer un invité. */
async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return next();
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch (_) {
      return next();
    }
    const user = await User.findByPk(payload.sub);
    if (!user) return next();
    const changedAt = user.passwordChangedAt ? Math.floor(new Date(user.passwordChangedAt).getTime() / 1000) : null;
    if ((payload.pwc || null) === changedAt) req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
  }
  return next();
}

/** Middleware réservé au compte super-admin. */
function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Accès réservé au super-administrateur.' });
  }
  return next();
}

/** Middleware : exige le rôle livreur (accès à l'espace livreur). */
function requireLivreur(req, res, next) {
  if (!req.user || req.user.role !== 'livreur') {
    return res.status(403).json({ error: 'Accès réservé aux livreurs.' });
  }
  return next();
}

/** Middleware : exige un compte interne (admin, superadmin ou livreur).
 *  Les customers sont exclus — utilisé pour le centre de notifications. */
function requireNotCustomer(req, res, next) {
  if (!req.user || req.user.role === 'customer') {
    return res.status(403).json({ error: 'Accès réservé.' });
  }
  return next();
}

module.exports = { signToken, cookieOptions, COOKIE_NAME, requireAuth, optionalAuth, requireAdmin, requireSuperAdmin, requireLivreur, requireNotCustomer };