'use strict';

const { User } = require('../models');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken, cookieOptions, COOKIE_NAME } = require('../middlewares/auth');
const cartService = require('../services/cart.service');

/** POST /api/auth/register */
async function register(req, res, next) {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail.' });

    const user = await User.create({
      firstName,
      lastName,
      email,
      phone: phone || null,
      passwordHash: hashPassword(password),
      role: 'customer',
    });

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, cookieOptions());

    // Fusion du panier invité au compte
    await cartService.mergeGuestIntoUser(req.headers['x-cart-token'], user.id);

    return res.status(201).json({
      user: { id: user.id, firstName, lastName, email, role: user.role },
    });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/auth/login */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    // Message générique pour ne pas révéler si l'adresse existe
    if (!user || !comparePassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }
    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, cookieOptions());

    await cartService.mergeGuestIntoUser(req.headers['x-cart-token'], user.id);

    return res.json({
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
    });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/auth/logout */
function logout(req, res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.json({ ok: true });
}

/** GET /api/auth/me */
async function me(req, res) {
  const u = req.user;
  return res.json({
    user: {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      role: u.role,
    },
  });
}

module.exports = { register, login, logout, me };