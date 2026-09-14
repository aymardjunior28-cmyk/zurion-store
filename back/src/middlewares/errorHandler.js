'use strict';

/** Gestionnaire d'erreurs central (toujours en dernier middleware). */
/* ═══════════════════════════════════════════════════════════════════════════
 *  MIDDLEWARE D'ERREURS — 404 + gestionnaire central
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Réponse 404 pour les routes API inexistantes. */
/* ═══════════════════════════════════════════════════════════════════════════
 *  MIDDLEWARE D'ERREURS — 404 + gestionnaire central
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Réponse 404 pour les routes API inexistantes. */
function notFound(req, res) {
  return res.status(404).json({ error: 'Ressource introuvable.' });
}

/** Gestionnaire d'erreurs central (toujours en dernier middleware). */
/** Gestionnaire d'erreurs central (toujours en dernier middleware). */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`[error] ${req.method} ${req.originalUrl} →`, err.message);
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Un enregistrement existe déjà avec ces informations.' });
  }
  if (err.name === 'SequelizeValidationError') {
    // Pas de message interne (colonnes, contraintes…) renvoyé au client.
    return res.status(422).json({ error: 'Données invalides.' });
  }
  const status = err.status || 500;
  if (status >= 500) {
    return res.status(status).json({ error: 'Erreur interne du serveur.' });
  }
  // Les erreurs 4xx proviennent du code applicatif (messages explicites) :
  // on ne renvoie jamais un message non prévu au client.
  return res.status(status).json({ error: err.message });
}

module.exports = { notFound, errorHandler };