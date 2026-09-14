'use strict';

const { requireAuth, requireAdmin, requireSuperAdmin, requireLivreur, requireNotCustomer } = require('./auth');

module.exports = { requireAuth, requireAdmin, requireSuperAdmin, requireLivreur, requireNotCustomer };