'use strict';

const crypto = require('crypto');
const { sequelize, Livraison, Order, OrderItem, Courier, User } = require('../models');

/** Livreurs par défaut (seedés en base au premier démarrage, modifiables ensuite). */
/* ═══════════════════════════════════════════════════════════════════════════
 *  SERVICE LIVRAISONS — livreurs, affectation, suivi
 *  - seedCouriersIfEmpty : insère les livreurs par défaut au premier démarrage.
 *  - assignOrder : confie une commande à un livreur (crée la livraison).
 *  - autoCreateForOrder : crée automatiquement la livraison à l'expédition.
 *  - updateDeliveryStatus / cancelDelivery : suivi et annulation.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Livreurs par défaut (seedés en base au premier démarrage, modifiables ensuite). */
const DEFAULT_COURIERS = ['Daré Express', 'Coursier Express CI', 'Aglatel Delivery', 'Zurion Logistics'];

/** Compatibilité : constante historique. */
const COURIERS = DEFAULT_COURIERS;

/** Génère une référence unique de livraison (LIV-XXXX). */
function nextReference() {
  return `LIV-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

/**
 * Insère les livreurs par défaut si la table est vide (premier démarrage).
 * L'administrateur peut ensuite les modifier ou les supprimer depuis le
 * back-office.
 */
/** Insère les livreurs par défaut si la table est vide (premier démarrage). */
async function seedCouriersIfEmpty() {
  const count = await Courier.count();
  if (count > 0) return;
  await Courier.bulkCreate(DEFAULT_COURIERS.map((name) => ({ name, active: true })));
}

/** Liste de tous les livreurs (back-office). */
/** Liste tous les livreurs (back-office). */
async function listCouriers() {
  return Courier.findAll({ order: [['name', 'ASC']] });
}

/** Comptes livreurs pouvant se connecter et confirmer une livraison. */
async function listLivreurAccounts(transaction) {
  return User.findAll({
    where: { role: 'livreur' },
    attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
    order: [['firstName', 'ASC'], ['lastName', 'ASC']],
    transaction,
  });
}

/** Crée un livreur. */
/** Crée un livreur (vérifie l'unicité du nom). */
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

/** Compte livreur actuellement le moins chargé. */
async function leastBusyCourier(transaction) {
  const livreurs = await listLivreurAccounts(transaction);
  if (!livreurs.length) return null;
  const counts = await Promise.all(
    livreurs.map(async (livreur) => {
      const n = await Livraison.count({ where: { courierId: livreur.id, status: 'en_cours' }, transaction });
      return { livreur, n };
    })
  );
  counts.sort((a, b) => a.n - b.n);
  return counts[0].livreur;
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
    const courier = await leastBusyCourier(t);
    const livraison = await Livraison.create(
      {
        reference: nextReference(),
        orderId: order.id,
        courierId: courier ? courier.id : null,
        courierName: courier ? `${courier.firstName} ${courier.lastName}` : 'Non attribué',
        destinationSnapshot: order.addressSnapshot,
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

/** Commandes actives sans livraison, proposées pour une affectation manuelle. */
/** Commandes actives sans livraison encore affectée (prêtes à l'expédition). */
async function listAssignableOrders() {
  const orders = await Order.findAll({
    where: { status: ['créée', 'paiement_confirmé', 'préparation'] },
    include: [{ model: OrderItem, as: 'items' }],
    order: [['createdAt', 'ASC']],
  });
  const deliveries = await Livraison.findAll({ attributes: ['orderId'], raw: true });
  const assigned = new Set(deliveries.map((delivery) => delivery.orderId));
  return orders.filter((order) => !assigned.has(order.id));
}

/** Affecte manuellement une commande à un livreur et fixe sa destination. */
/** Analyse une date/heure de livraison prévue (YYYY-MM-DDTHH:mm) en Date locale. */
function parseScheduledAt(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error('Date/heure de livraison invalide.'), { status: 400 });
  }
  return date;
}

/** Confie une commande à un livreur : crée la livraison (en transaction). */
async function assignOrder({ orderId, courierId, destination, scheduledAt }) {
  const cleanDestination = {
    fullName: String(destination?.fullName || '').trim().slice(0, 120),
    phone: String(destination?.phone || '').trim().slice(0, 30),
    line1: String(destination?.line1 || '').trim().slice(0, 180),
    line2: String(destination?.line2 || '').trim().slice(0, 180),
    city: String(destination?.city || '').trim().slice(0, 80),
    region: String(destination?.region || '').trim().slice(0, 80),
  };
  if (cleanDestination.fullName.length < 2 || cleanDestination.phone.length < 5
    || cleanDestination.line1.length < 3 || cleanDestination.city.length < 2) {
    throw Object.assign(new Error('Destination incomplète ou invalide.'), { status: 400 });
  }

  return sequelize.transaction(async (transaction) => {
    const order = await Order.findByPk(Number(orderId), {
      include: [{ model: OrderItem, as: 'items' }],
      transaction,
    });
    if (!order || ['terminée', 'annulée', 'expédition', 'livraison'].includes(order.status)) {
      throw Object.assign(new Error('Cette commande ne peut pas être affectée.'), { status: 400 });
    }
    const courier = await User.findOne({ where: { id: Number(courierId), role: 'livreur' }, transaction });
    // Compatibilité avec les anciens partenaires sans compte : ils peuvent
    // encore recevoir une livraison, mais elle reste explicitement non
    // assignée à un compte et ne peut donc pas être confirmée depuis /livreur.
    const legacyCourier = courier ? null : await Courier.findOne({ where: { id: Number(courierId), active: true }, transaction });
    if (!courier && !legacyCourier) throw Object.assign(new Error('Livreur introuvable.'), { status: 404 });
    const existing = await Livraison.findOne({ where: { orderId: order.id }, transaction });
    if (existing) throw Object.assign(new Error('Cette commande est déjà affectée.'), { status: 409 });

    const quantity = await contentQuantity(order, transaction);
    const livraison = await Livraison.create({
      reference: nextReference(),
      orderId: order.id,
      courierId: courier ? courier.id : null,
      courierName: courier ? `${courier.firstName} ${courier.lastName}` : legacyCourier.name,
      destinationSnapshot: JSON.stringify(cleanDestination),
      quantity: Math.max(quantity, 1),
      price: Number(order.shipping || 0),
      status: 'en_cours',
      scheduledAt: parseScheduledAt(scheduledAt),
      shippedAt: new Date(),
    }, { transaction });
    await order.update({ status: 'expédition' }, { transaction });
    return livraison;
  });
}

/** Annule une livraison pour le moment non livrée. */
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
/** Liste complète des livraisons avec la commande associée. */
async function listDeliveries({ limit = 100 } = {}) {
  return Livraison.findAll({
    include: [{
      model: require('../models').Order,
      as: 'order',
      attributes: ['id', 'reference', 'status', 'addressSnapshot'],
      include: [{ model: OrderItem, as: 'items' }],
    }],
    order: [['id', 'DESC']],
    limit: Number(limit) || 100,
  });
}

module.exports = {
  COURIERS,
  DEFAULT_COURIERS,
  seedCouriersIfEmpty,
  listCouriers,
  listLivreurAccounts,
  createCourier,
  updateCourier,
  deleteCourier,
  listAssignableOrders,
  assignOrder,
  autoCreateForOrder,
  cancelDelivery,
  updateDeliveryStatus,
  listDeliveries,
  nextReference,
  parseScheduledAt,
  contentQuantity,
};
