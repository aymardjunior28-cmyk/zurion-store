'use strict';

/* Messagerie interne superadmin/admin/livreur via Notification type message. */
const { Op } = require('sequelize');
const { Notification, User } = require('../models');

const MESSAGE_MAX_LENGTH = 2000;

function displayName(user) {
  if (!user) return 'Compte supprimé';
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Utilisateur';
}

async function getContacts(user) {
  if (!user || user.role === 'customer') {
    throw Object.assign(new Error('Accès réservé.'), { status: 403 });
  }
  if (user.role === 'livreur') {
    // Livreurs -> admins uniquement (jamais super-admin).
    return User.findAll({
      where: { role: 'admin' },
      attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
      order: [['firstName', 'ASC'], ['lastName', 'ASC']],
    });
  }
  if (user.role === 'admin') {
    // Admins -> autres admins uniquement (jamais super-admin ni livreurs).
    return User.findAll({
      where: { role: 'admin', id: { [Op.ne]: user.id } },
      attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
      order: [['firstName', 'ASC'], ['lastName', 'ASC']],
    });
  }
  // Super-admin -> admins + livreurs (l'un, l'autre ou les deux).
  return User.findAll({
    where: { role: { [Op.in]: ['admin', 'livreur'] } },
    attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
    order: [['role', 'ASC'], ['firstName', 'ASC']],
  });
}

function assertCanSend(sender, recipient) {
  if (!recipient) throw Object.assign(new Error('Destinataire introuvable.'), { status: 404 });
  if (Number(recipient.id) === Number(sender.id)) {
    throw Object.assign(new Error('Vous ne pouvez pas vous envoyer un message.'), { status: 400 });
  }
  // Matrice : superadmin -> admin|livreur ; admin -> superadmin|livreur ; livreur -> admin.
  if (sender.role === 'superadmin' && !['admin', 'livreur'].includes(recipient.role)) {
    throw Object.assign(new Error('Le super-admin ne peut ecrire qu’aux admins et livreurs.'), { status: 403 });
  }
  if (sender.role === 'admin' && recipient.role !== 'admin') {
    throw Object.assign(new Error("Les administrateurs ne peuvent ecrire qu'aux autres administrateurs."), { status: 403 });
  }
  if (sender.role === 'livreur' && recipient.role !== 'admin') {
    throw Object.assign(new Error('Les livreurs ne peuvent ecrire qu’aux administrateurs.'), { status: 403 });
  }
  if (recipient.role === 'customer') {
    throw Object.assign(new Error('Destinataire non autorise.'), { status: 403 });
  }
}

async function sendMessage(sender, recipientIdOrIds, rawText) {
  const text = String(rawText || '').trim();
  if (!text) throw Object.assign(new Error('Le message est vide.'), { status: 400 });
  if (text.length > MESSAGE_MAX_LENGTH) {
    throw Object.assign(new Error('Message trop long (2000 caracteres max).'), { status: 400 });
  }
  // Accepte un id unique (retro-compat) ou un tableau d'ids (multi-destinataires).
  const rawIds = Array.isArray(recipientIdOrIds) ? recipientIdOrIds : [recipientIdOrIds];
  const ids = [...new Set(rawIds.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0))];
  if (!ids.length) throw Object.assign(new Error('Aucun destinataire valide.'), { status: 400 });
  if (ids.length > 50) throw Object.assign(new Error('Trop de destinataires (50 maximum).'), { status: 400 });
  const recipients = await User.findAll({ where: { id: ids } });
  if (recipients.length !== ids.length) {
    throw Object.assign(new Error('Destinataire introuvable.'), { status: 404 });
  }
  // Confidentialite : une notification par destinataire (chacun ne voit que la sienne).
  const created = [];
  for (const recipient of recipients) {
    assertCanSend(sender, recipient);
    created.push(await Notification.create({
      userId: recipient.id,
      senderId: sender.id,
      type: 'message',
      title: `Message de ${displayName(sender)}`,
      message: text.slice(0, MESSAGE_MAX_LENGTH),
      link: '/messages',
    }));
  }
  return created;
}

async function listMessages(user, { limit = 100 } = {}) {
  const received = await Notification.findAll({
    where: { userId: user.id, type: 'message' },
    include: [{ model: User, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email', 'role'] }],
    order: [['createdAt', 'DESC']],
    limit: Number(limit) || 100,
  });
  const sent = await Notification.findAll({
    where: { senderId: user.id, type: 'message' },
    include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'role'] }],
    order: [['createdAt', 'DESC']],
    limit: Number(limit) || 100,
  });
  return { received, sent };
}

async function deleteSentMessage(sender, notificationId) {
  const notification = await Notification.findOne({
    where: { id: Number(notificationId), senderId: sender.id, type: 'message' },
  });
  if (!notification) {
    throw Object.assign(new Error('Message envoyé introuvable.'), { status: 404 });
  }
  await notification.destroy();
  return Number(notificationId);
}

module.exports = { MESSAGE_MAX_LENGTH, displayName, getContacts, sendMessage, listMessages, deleteSentMessage };