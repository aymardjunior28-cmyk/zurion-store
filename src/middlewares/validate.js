'use strict';

const { validationResult } = require('express-validator');

/** Middleware de validation : renvoie 422 avec la liste des erreurs. */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Données invalides.',
      fields: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  return next();
}

module.exports = { handleValidation };