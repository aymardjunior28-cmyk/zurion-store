'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
 *  CONTRÔLEUR LIVREUR — espace livreur (tableau de bord + signalements)
 *  - getMesLivraisons : livraisons assignées au livreur connecté (API).
 *  - signalerLivraison : signale un colis LIVRÉ → statut 'livrée' + notif.
 *  - signalerNonLivre : signale NON LIVRÉ → statut reste 'en_cours' + notif + raison.
 *  - getNotifications / getUnreadCount / markAsRead / markAllAsRead : centre notif.
 * ═══════════════════════════════════════════════════════════════════════════ */
const { Livraison, Order } = require('../models');
const notificationService = require('../services/notification.service');

/** GET /api/livreur/livraisons — livraisons assignées au livreur connecté. */
async function getMesLivraisons(req, res, next) {
  try {
    const livraisons = await Livraison.findAll({
      where: { courierId: req.user.id },
      include: [{ model: Order, as: 'order', attributes: ['id', 'reference', 'status', 'addressSnapshot', 'total'] }],
      order: [['id', 'DESC']],
    });
    return res.json({
      livraisons: livraisons.map((l) => ({
        id: l.id,
        reference: l.reference,
        status: l.status,
        quantity: l.quantity,
        price: l.price,
        shippedAt: l.shippedAt,
        deliveredAt: l.deliveredAt,
        lastReportMessage: l.lastReportMessage,
        destination: l.destinationSnapshot ? JSON.parse(l.destinationSnapshot) : null,
        order: l.order ? {
          id: l.order.id,
          reference: l.order.reference,
          status: l.order.status,
          total: l.order.total,
          address: l.order.addressSnapshot ? JSON.parse(l.order.addressSnapshot) : null,
        } : null,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/livreur/livraisons/:id/livree — signale un colis LIVRÉ.
 *  Le livreur (ou admin) peut signaler qu'un colis a été livré.
 *  → statut 'livrée', notification marquée DANS LE COMPTE de l'auteur
 *    et message envoyé aux admins + superadmin + livreur assigné. */
async function signalerLivraison(req, res, next) {
  try {
    const livraison = await Livraison.findOne({
      where: { id: Number(req.params.id) },
      include: [{ model: Order, as: 'order' }],
    });
    if (!livraison) {
      return res.status(404).json({ error: 'Livraison introuvable.' });
    }
    if (req.user.role === 'livreur' && livraison.courierId !== req.user.id) {
      return res.status(404).json({ error: 'Livraison introuvable ou non assignée à votre compte.' });
    }
    if (livraison.status === 'livrée') {
      return res.status(409).json({ error: 'Cette livraison est déjà marquée comme livrée.' });
    }

    await livraison.update({ status: 'livrée', deliveredAt: new Date(), lastReportMessage: null });

    const ref = livraison.order ? livraison.order.reference : livraison.reference;
    const author = `${req.user.firstName} ${req.user.lastName}`;

    // 1) Marquée dans le compte de l'auteur (livreur ou admin).
    await notificationService.createNotification({
      userId: req.user.id,
      type: 'livree',
      title: 'Colis livré',
      message: `Vous avez confirmé la livraison du colis ${ref}.`,
      link: req.user.role === 'livreur' ? '/livreur' : '/admin/livraisons',
    });

    // 2) Message aux admins + superadmin (sauf l'auteur si admin/superadmin).
    const contactLivreur = req.user.phone || req.user.email || 'Non renseigné';
    const heureNotif = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    await notificationService.notifyAdminsAndSuperAdmins(
      {
        type: 'livree',
        title: 'Colis livré',
        message: `Livraison #${livraison.id} confirmée — Livreur : ${author} (${contactLivreur}) · Commande ${ref} · Notification reçue à ${heureNotif}.`,
        link: `/admin/livraisons`,
      },
      { excludeUserId: req.user.id }
    );

    // 3) Le livreur assigné (si différent de l'auteur) est aussi notifié.
    if (livraison.courierId && livraison.courierId !== req.user.id) {
      const dest = livraison.destinationSnapshot ? JSON.parse(livraison.destinationSnapshot) : null;
      const destParts = [];
      if (dest) {
        if (dest.phone) destParts.push(`Contact client : ${dest.phone}`);
        if (dest.line1 || dest.city) destParts.push(`Destination : ${[dest.line1, dest.city, dest.region].filter(Boolean).join(', ')}`);
      }
      await notificationService.notifyLivreur(livraison.courierId, {
        type: 'livree',
        title: 'Colis livré',
        message: `Votre colis ${ref} a été marqué comme livré par ${author}. Livraison #${livraison.id}${destParts.length ? ' · ' + destParts.join(' · ') : ''}.`,
        link: '/livreur',
      });
    }

    return res.json({ message: 'Livraison marquée comme livrée. Votre compte et les équipes ont été notifiés.' });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/livreur/livraisons/:id/non-livree — signale un colis NON LIVRÉ.
 *  → statut reste 'en_cours' (retente possible), lastReportMessage conservé,
 *    notifié dans le compte de l'auteur + aux admins/superadmin + livreur assigné. */
async function signalerNonLivre(req, res, next) {
  try {
    const reason = (req.body && req.body.reason) ? String(req.body.reason).trim().slice(0, 500) : null;
    const livraison = await Livraison.findOne({
      where: { id: Number(req.params.id) },
      include: [{ model: Order, as: 'order' }],
    });
    if (!livraison) {
      return res.status(404).json({ error: 'Livraison introuvable.' });
    }
    if (req.user.role === 'livreur' && livraison.courierId !== req.user.id) {
      return res.status(404).json({ error: 'Livraison introuvable ou non assignée à votre compte.' });
    }
    if (livraison.status === 'livrée') {
      return res.status(409).json({ error: 'Cette livraison est déjà marquée comme livrée.' });
    }

    // Le statut reste 'en_cours' (le livreur peut retenter plus tard).
    const report = reason || 'Non livré (raison non précisée).';
    await livraison.update({ lastReportMessage: report });

    const ref = livraison.order ? livraison.order.reference : livraison.reference;
    const author = `${req.user.firstName} ${req.user.lastName}`;

    // 1) Marquée dans le compte de l'auteur.
    await notificationService.createNotification({
      userId: req.user.id,
      type: 'non_livree',
      title: 'Colis non livré',
      message: `Vous avez signalé la non-livraison du colis ${ref}. Raison : ${report}`,
      link: req.user.role === 'livreur' ? '/livreur' : '/admin/livraisons',
    });

    // 2) Message aux admins + superadmin.
    await notificationService.notifyAdminsAndSuperAdmins(
      {
        type: 'non_livree',
        title: 'Colis non livré',
        message: `Colis non livré pour la commande ${ref} (signalé par ${author}) — Raison : ${report}`,
        link: `/admin/livraisons`,
      },
      { excludeUserId: req.user.id }
    );

    // 3) Le livreur assigné (si différent de l'auteur).
    if (livraison.courierId && livraison.courierId !== req.user.id) {
      await notificationService.notifyLivreur(livraison.courierId, {
        type: 'non_livree',
        title: 'Colis non livré',
        message: `Le colis ${ref} de votre tournée a été signalé non livré. Raison : ${report}`,
        link: '/livreur',
      });
    }

    return res.json({ message: 'Signalement enregistré. Votre compte et les équipes ont été notifiés.' });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/notifications — centre de notifications de l'utilisateur connecté. */
async function getNotifications(req, res, next) {
  try {
    const { Notification, User } = require('../models');
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      include: [{ model: User, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email', 'role'] }],
      order: [['createdAt', 'DESC']],
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });
    return res.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link,
        read: n.read,
        createdAt: n.createdAt,
        sender: n.sender ? {
          id: n.sender.id,
          firstName: n.sender.firstName,
          lastName: n.sender.lastName,
          email: n.sender.email,
          role: n.sender.role,
        } : null,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/notifications/unread-count — compteur de notifications non lues. */
async function getUnreadCount(req, res, next) {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    return res.json({ unreadCount: count });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/notifications/:id/read — marque une notification comme lue. */
async function markAsRead(req, res, next) {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user.id);
    return res.json({ notification });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/notifications/read-all — marque toutes les notifications comme lues. */
async function markAllAsRead(req, res, next) {
  try {
    const count = await notificationService.markAllAsRead(req.user.id);
    return res.json({ markedAsRead: count });
  } catch (err) {
    return next(err);
  }
}

/** DELETE /api/notifications/:id — supprime une notification du centre. */
async function deleteNotification(req, res, next) {
  try {
    const id = await notificationService.deleteNotification(req.params.id, req.user.id);
    return res.json({ ok: true, id });
  } catch (err) {
    return next(err);
  }
}

/** DELETE /api/notifications — supprime toutes les notifications. */
async function deleteAllNotifications(req, res, next) {
  try {
    const count = await notificationService.deleteAllNotifications(req.user.id);
    return res.json({ ok: true, deleted: count });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/notifications/bulk-delete — supprime une sélection (cases cochées). */
async function bulkDeleteNotifications(req, res, next) {
  try {
    const count = await notificationService.deleteSelectedNotifications(req.user.id, req.body.ids);
    return res.json({ ok: true, deleted: count });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getMesLivraisons,
  signalerLivraison,
  signalerNonLivre,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  bulkDeleteNotifications,
};
