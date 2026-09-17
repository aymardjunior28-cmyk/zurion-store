'use strict';

const env = require('../config/env');

const SIMULATED_METHODS = new Set([
  'Mobile Money (simulation)',
  'Carte bancaire (simulation)',
]);

/* ═══════════════════════════════════════════════════════════════════════════
 *  SERVICE PAIEMENT — contrôle des moyens de paiement
 *  Les paiements opérateurs nécessitent un contrat marchand et des secrets
 *  propres à l'environnement. Tant que l'adaptateur n'est pas configuré, le
 *  serveur ne doit pas présenter une simulation comme un paiement réel.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Refuse les moyens de paiement simulés en production (503) tant qu'aucun
 *  adaptateur MTN/Orange Cameroun n'est configuré. */
function assertPaymentMethodAllowed(paymentMethod) {
  if (env.isProd && SIMULATED_METHODS.has(paymentMethod) && !env.allowSimulatedPayments) {
    throw Object.assign(
      new Error('Ce moyen de paiement simulé est désactivé en production. Configurez l’adaptateur MTN/Orange Cameroun.'),
      { status: 503 }
    );
  }
}

module.exports = { assertPaymentMethodAllowed };
