'use strict';

/** Gestionnaire d'erreurs central (toujours en dernier middleware). */
function notFound(req, res) {
  return res.status(404).json({ error: 'Ressource introuvable.' });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`[error] ${req.method} ${req.originalUrl} →`, err.message);
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Un enregistrement existe déjà avec ces informations.' });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(422).json({ error: err.message });
  }
  const status = err.status || 500;
  if (status >= 500) {
    return res.status(status).json({ error: 'Erreur interne du serveur.' });
  }
  return res.status(status).json({ error: err.message });
}

module.exports = { notFound, errorHandler };