'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');

const COOKIE_NAME = 'zurion_token';

/** Signe un JWT pour un utilisateur (sub = id, role). */
function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
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
    req.user = user;
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

module.exports = { signToken, cookieOptions, COOKIE_NAME, requireAuth, requireAdmin };