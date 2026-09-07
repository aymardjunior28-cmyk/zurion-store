'use strict';

const bcrypt = require('bcryptjs');

// 12 rounds : compromis raisonnable entre sécurité et perf
// (le coût CPU est déporté hors de l'event loop grâce aux versions async).
const SALT_ROUNDS = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function comparePassword(plain, hash) {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, comparePassword };