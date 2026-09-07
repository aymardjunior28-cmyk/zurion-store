'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');

const COOKIE_NAME = 'zurion_token';

/** Signe un JWT pour un utilisateur (sub = id, role, pwc = dernière date de MDP). */
function signToken(user) {
  const passwordChanged = user.passwordChangedAt ? Math.floor(new Date(user.passwordChangedAt).getTime() / 1000) : null;
  return jwt.sign({ sub: user.id, role: user.role, pwc: passwordChanged }, env.jwtSecret, {
    expiresIn: `${env.sessionMaxAgeDays}d`,
  });
}

/** Options du cookie de session (httpOnly, SameSite, Secure en prod). */
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: env.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

/**
 * Middleware : exige un utilisateur authentifié.
 * Ajoute req.user (instance User) sur succès.
 */
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

/** Middleware : exige le rôle admin (à placer APRÈS requireAuth). */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
  }
  return next();
}

module.exports = { signToken, cookieOptions, COOKIE_NAME, requireAuth, optionalAuth, requireAdmin };