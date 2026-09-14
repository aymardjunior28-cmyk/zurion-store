'use strict';

const messageService = require('../services/message.service');

/** GET /api/messages/contacts — destinataires autorisés selon le rôle. */
async function getContacts(req, res, next) {
  try {
    const contacts = await messageService.getContacts(req.user);
    return res.json({ contacts });
  } catch (err) { return next(err); }
}

/** GET /api/messages — messages reçus + envoyés (type 'message'). */
async function getMessages(req, res, next) {
  try {
    const { received, sent } = await messageService.listMessages(req.user);
    const fmt = (n, withPeer) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt,
      sender: n.sender ? { id: n.sender.id, firstName: n.sender.firstName, lastName: n.sender.lastName, email: n.sender.email, role: n.sender.role } : null,
      recipient: withPeer && n.user ? { id: n.user.id, firstName: n.user.firstName, lastName: n.user.lastName, email: n.user.email, role: n.user.role } : undefined,
    });
    return res.json({
      canSend: ['livreur', 'admin', 'superadmin'].includes(req.user.role),
      received: received.map((n) => fmt(n, false)),
      sent: sent.map((n) => fmt(n, true)),
    });
  } catch (err) { return next(err); }
}

/** POST /api/messages — envoie un message interne (1 ou N destinataires). */
async function sendMessage(req, res, next) {
  try {
    const ids = Array.isArray(req.body.recipientIds) ? req.body.recipientIds
      : (req.body.recipientId !== undefined ? [req.body.recipientId] : []);
    const created = await messageService.sendMessage(req.user, ids, req.body.message);
    return res.status(201).json({ ok: true, sent: created.length, ids: created.map((n) => ({ id: n.id, userId: n.userId })) });
  } catch (err) { return next(err); }
}

/** DELETE /api/messages/:id — l'expéditeur supprime un de ses messages envoyés. */
async function deleteSentMessage(req, res, next) {
  try {
    const id = await messageService.deleteSentMessage(req.user, req.params.id);
    return res.json({ ok: true, id });
  } catch (err) { return next(err); }
}

module.exports = { getContacts, getMessages, sendMessage, deleteSentMessage };