'use strict';

const { Coupon } = require('../models');

/** Normalise un code saisi par le client (majuscules, sans espaces). */
/* ═══════════════════════════════════════════════════════════════════════════
 *  SERVICE COUPONS — validation et application des codes promo
 *  - validateCoupon : existence, période, plafond, montant minimum.
 *  - applyDiscount : calcule la remise (pourcentage ou fixe).
 *  - consumeCoupon : incrémente le compteur d'utilisation.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Normalise un code saisi (majuscules, sans espaces, borné à 40 car.). */
function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 40);
}

/**
 * Valide un code promo : existence, période, plafond d'utilisation,
 * montant minimum de panier. Lève une erreur 400 si invalide.
 */
/** Valide un code promo : existence, période, plafond d'utilisation, montant minimum.
 *  Lance une 400 avec message explicite si invalide. */
async function validateCoupon(rawCode, subtotal) {
  const code = normalizeCode(rawCode);
  if (!code) {
    throw Object.assign(new Error('Code promo manquant.'), { status: 400 });
  }
  const coupon = await Coupon.findOne({ where: { code } });
  if (!coupon || !coupon.active) {
    throw Object.assign(new Error('Ce code promo est inconnu ou inactif.'), { status: 400 });
  }
  if (coupon.validFrom && new Date(coupon.validFrom) > new Date()) {
    throw Object.assign(new Error('Ce code promo n’est pas encore actif.'), { status: 400 });
  }
  if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) {
    throw Object.assign(new Error('Ce code promo a expiré.'), { status: 400 });
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    throw Object.assign(new Error('Ce code promo a atteint sa limite d’utilisations.'), { status: 400 });
  }
  if (coupon.minAmount && subtotal < coupon.minAmount) {
    throw Object.assign(new Error(`Ce code promo n’est valable qu’à partir de ${coupon.minAmount} FCFA d’achat.`), { status: 400 });
  }
  return coupon;
}

/** Remise calculée à partir du sous-total (ne dépasse jamais la commande). */
/** Calcule la remise à partir du sous-total (ne dépasse jamais la commande). */
function applyDiscount(coupon, subtotal) {
  if (coupon.type === 'percent') {
    return Math.min(Math.round((subtotal * Number(coupon.value)) / 100), subtotal);
  }
  return Math.min(Number(coupon.value), subtotal);
}

/** Incrémente le compteur d'utilisation du code (dans la transaction). */
async function consumeCoupon(coupon, transaction) {
  await coupon.increment('usedCount', { by: 1, transaction });
}

module.exports = { normalizeCode, validateCoupon, applyDiscount, consumeCoupon };
