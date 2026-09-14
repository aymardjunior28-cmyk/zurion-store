'use strict';

/**
 * Utilitaires monétaires et de formatage.
 * La boutique opère en Francs CFA (XAF), montants entiers.
 */
const intl = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'XAF',
  maximumFractionDigits: 0,
});

function money(amount) {
  return intl.format(Number(amount) || 0);
}

/** Pourcentage de remise (arrondi) à partir du prix barré. */
function discountPercent(oldPrice, price) {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

module.exports = { money, discountPercent };