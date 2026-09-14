'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
 *  SERVICE NOTIFICATIONS — centre de notifications interne
 *  Destinataires : admin, superadmin, livreur (JAMAIS les customers).
 *  - notifyAdminsAndSuperAdmins : alerte tous les admins + superadmin (sauf l'auteur).
 *  - notifyLivreur : alerte un livreur spécifique.
 *  - createNotification : crée une notification pour un utilisateur.
 *  - getNotifications / getUnreadCount / markAsRead / markAllAsRead.
 * ═══════════════════════════════════════════════════════════════════════════ */
const { Op } = require('sequelize');
const { Notification, User } = require('../models');

/** Crée une notification pour un utilisateur donné. */
async function createNotification({ userId, type = 'info', title, message, link = null }) {
  if (!userId || !title || !message) {
    throw Object.assign(new Error('Données de notification incomplètes.'), { status: 400 });
  }
  return Notification.create({ userId, type, title, message, link });
}

/** Notifie tous les admins et le super-admin (sauf l'auteur du signalement). */
async function notifyAdminsAndSuperAdmins({ type, title, message, link }, { excludeUserId = null } = {}) {
  const recipients = await User.findAll({
    where: {
      role: { [Op.in]: ['admin', 'superadmin'] },
      ...(excludeUserId ? { id: { [Op.ne]: excludeUserId } } : {}),
    },
    attributes: ['id'],
  });
  await Promise.all(
    recipients.map((u) => createNotification({ userId: u.id, type, title, message, link }))
  );
  return recipients.length;
}

/** Notifie un livreur spécifique (ex. : livraison assignée). */
async function notifyLivreur(userId, { type, title, message, link }) {
  if (!userId) return 0;
  await createNotification({ userId, type, title, message, link });
  return 1;
}

/** Récupère les notifications d'un utilisateur (du plus récent au plus ancien). */
async function getNotifications(userId, { limit = 50, offset = 0 } = {}) {
  return Notification.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    limit: Number(limit) || 50,
    offset: Number(offset) || 0,
  });
}

/** Compte les notifications non lues d'un utilisateur. */
async function getUnreadCount(userId) {
  return Notification.count({ where: { userId, read: false } });
}

/** Marque une notification comme lue (vérifie qu'elle appartient à l'utilisateur). */
async function markAsRead(notificationId, userId) {
  const notification = await Notification.findOne({ where: { id: Number(notificationId), userId } });
  if (!notification) {
    throw Object.assign(new Error('Notification introuvable.'), { status: 404 });
  }
  await notification.update({ read: true });
  return notification;
}

/** Marque toutes les notifications d'un utilisateur comme lues. */
async function markAllAsRead(userId) {
  const [count] = await Notification.update({ read: true }, { where: { userId, read: false } });
  return count;
}

/** Supprime une notification (vérifie qu'elle appartient à l'utilisateur). */
async function deleteNotification(notificationId, userId) {
  const notification = await Notification.findOne({ where: { id: Number(notificationId), userId } });
  if (!notification) {
    throw Object.assign(new Error('Notification introuvable.'), { status: 404 });
  }
  await notification.destroy();
  return Number(notificationId);
}

/** Supprime toutes les notifications d'un utilisateur. */
async function deleteAllNotifications(userId) {
  return Notification.destroy({ where: { userId } });
}

/** Supprime une sélection de notifications (ne touche que celles de l'utilisateur). */
async function deleteSelectedNotifications(userId, ids) {
  const cleanIds = (Array.isArray(ids) ? ids : [ids])
    .map((value) => Number(value))
    .filter((n) => Number.isInteger(n) && n >= 1);
  if (!cleanIds.length) return 0;
  return Notification.destroy({ where: { id: { [Op.in]: cleanIds }, userId } });
}

module.exports = {
  createNotification,
  notifyAdminsAndSuperAdmins,
  notifyLivreur,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  deleteSelectedNotifications,
};