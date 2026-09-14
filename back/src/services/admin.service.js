'use strict';

const {
  sequelize,
  User,
  Address,
  Review,
  Order,
  OrderItem,
  Livraison,
  Cart,
  CartItem,
  Wishlist,
  ContactMessage,
  Notification,
} = require('../models');
const { hashPassword } = require('../utils/password');

/* ═══════════════════════════════════════════════════════════════════════════
 *  SERVICE ADMIN — gestion des comptes et suppression de données
 *  - createAdmin : crée un compte administrateur secondaire.
 *  - deleteUserAccount : supprime un compte et TOUTES ses données (transaction).
 *    Refuse l'auto-suppression et la suppression d'un super-admin.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Crée un compte administrateur secondaire (validé, mot de passe hashé). */
async function createAdmin({ firstName, lastName, email, phone, password }) {
  const clean = {
    firstName: String(firstName || '').trim().slice(0, 80),
    lastName: String(lastName || '').trim().slice(0, 80),
    email: String(email || '').trim().toLowerCase(),
    phone: String(phone || '').trim().slice(0, 30) || null,
  };
  if (clean.firstName.length < 2 || clean.lastName.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean.email)) {
    throw Object.assign(new Error('Informations du compte admin invalides.'), { status: 400 });
  }
  if (String(password || '').length < 8) {
    throw Object.assign(new Error('Le mot de passe doit contenir au moins 8 caractères.'), { status: 400 });
  }
  return User.create({
    ...clean,
    passwordHash: await hashPassword(password),
    role: 'admin',
  });
}

/**
 * Supprime un compte et toutes ses données métier dans une transaction.
 * Les produits, coupons et livreurs ne sont pas rattachés à un utilisateur.
 */
/** Supprime un compte et toutes ses données métier dans une transaction.
 *  Les produits, coupons et livreurs ne sont pas rattachés à un utilisateur.
 *  Refuse : auto-suppression, suppression d'un super-admin. */
async function deleteUserAccount(userId, actorId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id < 1) {
    throw Object.assign(new Error('Identifiant utilisateur invalide.'), { status: 400 });
  }
  if (id === Number(actorId)) {
    throw Object.assign(new Error('Le super-administrateur ne peut pas supprimer son propre compte.'), { status: 400 });
  }

  return sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(id, { transaction });
    if (!user) throw Object.assign(new Error('Utilisateur introuvable.'), { status: 404 });
    if (user.role === 'superadmin') {
      throw Object.assign(new Error('Un compte super-administrateur ne peut pas être supprimé.'), { status: 403 });
    }

    const orders = await Order.findAll({ attributes: ['id'], where: { userId: id }, transaction, raw: true });
    const orderIds = orders.map((order) => order.id);
    if (orderIds.length) {
      await Livraison.destroy({ where: { orderId: orderIds }, transaction });
      await OrderItem.destroy({ where: { orderId: orderIds }, transaction });
      await Order.destroy({ where: { id: orderIds }, transaction });
    }

    const carts = await Cart.findAll({ attributes: ['id'], where: { userId: id }, transaction, raw: true });
    const cartIds = carts.map((cart) => cart.id);
    if (cartIds.length) await CartItem.destroy({ where: { cartId: cartIds }, transaction });
    await Cart.destroy({ where: { userId: id }, transaction });
    await Wishlist.destroy({ where: { userId: id }, transaction });
    await Address.destroy({ where: { userId: id }, transaction });
    await Review.destroy({ where: { userId: id }, transaction });
    await ContactMessage.update({ userId: null }, { where: { userId: id }, transaction });
    await Notification.destroy({ where: { userId: id }, transaction });
    await Notification.update({ senderId: null }, { where: { senderId: id }, transaction });
    await Livraison.update({ courierId: null }, { where: { courierId: id }, transaction });
    await user.destroy({ transaction });

    return { id, email: user.email };
  });
}

module.exports = { createAdmin, deleteUserAccount };