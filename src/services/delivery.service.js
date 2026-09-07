'use strict';

const crypto = require('crypto');
const { sequelize, Livraison, OrderItem, Courier } = require('../models');

/** Livreurs par défaut (seedés en base au premier démarrage, modifiables ensuite). */
const DEFAULT_COURIERS = ['Daré Express', 'Coursier Express CI', 'Aglatel Delivery', 'Zurion Logistics'];

/** Compatibilité : constante historique. */
const COURIERS = DEFAULT_COURIERS;

function nextReference() {
  return `LIV-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

/**
 * Insère les livreurs par défaut si la table est vide (premier démarrage).
 * L'administrateur peut ensuite les modifier ou les supprimer depuis le
 * back-office.
 */
async function seedCouriersIfEmpty() {
  const count = await Courier.count();
  if (count > 0) return;
  await Courier.bulkCreate(DEFAULT_COURIERS.map((name) => ({ name, active: true })));
}

/** Liste de tous les livreurs (back-office). */
async function listCouriers() {
  return Courier.findAll({ order: [['name', 'ASC']] });
}

/** Crée un livreur. */
async function createCourier({ name, phone }) {
  const cleanName = String(name || '').trim().slice(0, 80);
  if (cleanName.length < 2) {
    throw Object.assign(new Error('Nom du livreur invalide (2 caractères minimum).'), { status: 400 });
  }
  const cleanPhone = String(phone || '').trim().slice(0, 30) || null;
  try {
    return await Courier.create({ name: cleanName, phone: cleanPhone, active: true });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      throw Object.assign(new Error('Ce livreur existe déjà.'), { status: 400 });
    }
    throw err;
  }
}

/** Modifie un livreur (nom, téléphone, actif). */
async function updateCourier(id, { name, phone, active }) {
  const courier = await Courier.findByPk(Number(id));
  if (!courier) throw Object.assign(new Error('Livreur introuvable.'), { status: 404 });
  const cleanName = String(name || '').trim().slice(0, 80);
  if (cleanName.length < 2) {
    throw Object.assign(new Error('Nom du livreur invalide (2 caractères minimum).'), { status: 400 });
  }
  const cleanPhone = String(phone || '').trim().slice(0, 30) || null;
  try {
    await courier.update({ name: cleanName, phone: cleanPhone, active: Boolean(active) });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      throw Object.assign(new Error('Ce livreur existe déjà.'), { status: 400 });
    }
    throw err;
  }
  return courier;
}

/** Supprime un livreur (les livraisons passées conservent leur nom en instantané). */
async function deleteCourier(id) {
  const courier = await Courier.findByPk(Number(id));
  if (!courier) throw Object.assign(new Error('Livreur introuvable.'), { status: 404 });
  await courier.destroy();
}

/** Nombre d'articles dans une commande (somme des quantités des lignes). */
async function contentQuantity(order, transaction) {
  const items = Array.isArray(order.items)
    ? order.items
    : await OrderItem.findAll({ where: { orderId: order.id }, transaction });
  return items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
}

/** Livreur actif actuellement le moins chargé (retour du nom). */
async function leastBusyCourier(transaction) {
  const couriers = await Courier.findAll({ where: { active: true }, transaction });
  const names = couriers.length ? couriers.map((c) => c.name) : DEFAULT_COURIERS;
  const counts = await Promise.all(
    names.map(async (name) => {
      const n = await Livraison.count({ where: { courierName: name, status: 'en_cours' }, transaction });
      return { name, n };
    })
  );
  counts.sort((a, b) => a.n - b.n);
  return counts[0].name;
}

/**
 * Crée la livraison d'une commande (appelé au passage en « expédition »).
 * Si une livraison existe déjà pour cette commande, ne fait rien.
 */
async function autoCreateForOrder(order, transaction) {
  const t = transaction || await sequelize.transaction();
  try {
    const existing = await Livraison.findOne({ where: { orderId: order.id }, transaction: t });
    if (existing) return existing;
    const quantity = await contentQuantity(order, t);
    const courierName = await leastBusyCourier(t);
    const livraison = await Livraison.create(
      {
        reference: nextReference(),
        orderId: order.id,
        courierName,
        quantity: Math.max(quantity, 1),
        price: Number(order.shipping || 0),
        status: 'en_cours',
        shippedAt: new Date(),
      },
      { transaction: t }
    );
    if (!transaction) await t.commit();
    return livraison;
  } catch (err) {
    if (!transaction) await t.rollback();
    throw err;
  }
}

/** Annule une livraison pour le moment non livrée. */
async function cancelDelivery(livraison) {
  if (livraison.status === 'livrée') {
    throw Object.assign(new Error('Une livraison déjà effectuée ne peut pas être annulée.'), { status: 400 });
  }
  livraison.status = 'annulée';
  livraison.cancelledAt = new Date();
  await livraison.save();
  return livraison;
}

/** Met à jour le statut d'une livraison avec les transitions autorisées. */
async function updateDeliveryStatus(livraison, status) {
  if (!['en_cours', 'livrée', 'annulée'].includes(status)) {
    throw Object.assign(new Error('Statut de livraison invalide.'), { status: 400 });
  }
  if (livraison.status === 'annulée' && status !== 'annulée') {
    throw Object.assign(new Error('Une livraison annulée ne peut pas reprendre.'), { status: 400 });
  }
  if (livraison.status === 'livrée' && status !== 'livrée') {
    throw Object.assign(new Error('Une livraison déjà effectuée ne peut pas revenir en arrière.'), { status: 400 });
  }
  livraison.status = status;
  if (status === 'livrée') livraison.deliveredAt = livraison.deliveredAt || new Date();
  if (status === 'annulée') livraison.cancelledAt = livraison.cancelledAt || new Date();
  await livraison.save();
  return livraison;
}

/** Liste complète des livraisons avec la référence de commande associée. */
async function listDeliveries({ limit = 100 } = {}) {
  return Livraison.findAll({
    include: [{ model: require('../models').Order, as: 'order', attributes: ['id', 'reference', 'status'] }],
    order: [['id', 'DESC']],
    limit: Number(limit) || 100,
  });
}

module.exports = {
  COURIERS,
  DEFAULT_COURIERS,
  seedCouriersIfEmpty,
  listCouriers,
  createCourier,
  updateCourier,
  deleteCourier,
  autoCreateForOrder,
  cancelDelivery,
  updateDeliveryStatus,
  listDeliveries,
  nextReference,
  contentQuantity,
};