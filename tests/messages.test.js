'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../back/src/app');
const { connectDatabase, sequelize } = require('../back/src/config/db');
const { User } = require('../back/src/models');
const { hashPassword } = require('../back/src/utils/password');

function csrfTokenFrom(res) {
  const raw = (res.headers['set-cookie'] || []).find((c) => c.startsWith('zurion_csrf='));
  return raw ? decodeURIComponent(raw.split(';')[0].split('=').slice(1).join('=')) : null;
}

async function loginAs(email, password) {
  const agent = request.agent(app);
  const pre = await agent.get('/api/health');
  const csrf = csrfTokenFrom(pre);
  const res = await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password });
  assert.equal(res.status, 200, `login ${email} : ${JSON.stringify(res.body)}`);
  return { agent, csrf };
}

test.before(async () => {
  await connectDatabase();
  const { Notification } = require('../back/src/models');
  // Nettoie d'éventuels résidus d'un run précédent (idempotent).
  for (const email of ['msg.super@zurion.test', 'msg.admin@zurion.test', 'msg.admin2@zurion.test', 'msg.livreur@zurion.test']) {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      await Notification.destroy({ where: { userId: existing.id } });
      await Notification.update({ senderId: null }, { where: { senderId: existing.id } });
      await existing.destroy();
    }
  }
  const mk = async (email, role, fn, ln) => {
    let u = await User.findOne({ where: { email } });
    if (!u) {
      u = await User.create({ firstName: fn, lastName: ln, email, passwordHash: await hashPassword('Test12345!'), role });
    } else if (u.role !== role) {
      await u.update({ role });
    }
    return u;
  };
  await mk('msg.super@zurion.test', 'superadmin', 'Super', 'Msg');
  await mk('msg.admin@zurion.test', 'admin', 'Admin', 'Msg');
  await mk('msg.admin2@zurion.test', 'admin', 'Admin', 'Deux');
  await mk('msg.livreur@zurion.test', 'livreur', 'Livreur', 'Msg');
});

test.after(async () => {
  // Nettoyage : supprime les comptes/notifications créés par ce test.
  const { Notification } = require('../back/src/models');
  for (const email of ['msg.livreur@zurion.test', 'msg.admin@zurion.test', 'msg.admin2@zurion.test', 'msg.super@zurion.test']) {
    const u = await User.findOne({ where: { email } });
    if (u) {
      await Notification.destroy({ where: { userId: u.id } });
      await Notification.update({ senderId: null }, { where: { senderId: u.id } });
      await u.destroy();
    }
  }
  await sequelize.close();
});

test('messagerie : livreur -> admin, admin -> admins uniquement + suppression notif', async () => {
  const liv = await loginAs('msg.livreur@zurion.test', 'Test12345!');
  const adm = await loginAs('msg.admin@zurion.test', 'Test12345!');
  const adm2 = await loginAs('msg.admin2@zurion.test', 'Test12345!');
  const sup = await loginAs('msg.super@zurion.test', 'Test12345!');

  const superUser = await User.findOne({ where: { email: 'msg.super@zurion.test' } });
  const adminUser = await User.findOne({ where: { email: 'msg.admin@zurion.test' } });
  const admin2User = await User.findOne({ where: { email: 'msg.admin2@zurion.test' } });
  const livUser = await User.findOne({ where: { email: 'msg.livreur@zurion.test' } });

  // Contacts : livreur = admins uniquement ; admin = autres admins uniquement ; super = admins + livreurs
  const contactsLiv = await liv.agent.get('/api/messages/contacts');
  assert.equal(contactsLiv.status, 200);
  assert.ok(contactsLiv.body.contacts.some((c) => c.email === 'msg.admin@zurion.test' && c.role === 'admin'));
  assert.ok(!contactsLiv.body.contacts.some((c) => c.email === 'msg.super@zurion.test'));

  const contactsAdm = await adm.agent.get('/api/messages/contacts');
  assert.equal(contactsAdm.status, 200);
  assert.ok(contactsAdm.body.contacts.some((c) => c.email === 'msg.admin2@zurion.test' && c.role === 'admin'), 'admin doit voir les autres admins');
  assert.ok(!contactsAdm.body.contacts.some((c) => c.role === 'superadmin'), 'admin ne doit pas voir le super-admin');
  assert.ok(!contactsAdm.body.contacts.some((c) => c.role === 'livreur'), 'admin ne doit pas voir les livreurs');
  assert.ok(!contactsAdm.body.contacts.some((c) => c.id === adminUser.id), 'admin ne doit pas voir son propre compte');

  const contactsSup = await sup.agent.get('/api/messages/contacts');
  assert.equal(contactsSup.status, 200);
  assert.ok(contactsSup.body.contacts.some((c) => c.role === 'admin'));
  assert.ok(contactsSup.body.contacts.some((c) => c.role === 'livreur'));

  // Livreur -> superadmin REFUSE ; livreur -> admin OK
  const refused = await liv.agent.post('/api/messages').set('X-CSRF-Token', liv.csrf)
    .send({ recipientId: superUser.id, message: 'hello super' });
  assert.equal(refused.status, 403);

  const sent = await liv.agent.post('/api/messages').set('X-CSRF-Token', liv.csrf)
    .send({ recipientId: adminUser.id, message: 'Colis pret pour ramassage.' });
  assert.equal(sent.status, 201);

  // Admin voit le message
  const admMsgs = await adm.agent.get('/api/messages');
  assert.equal(admMsgs.status, 200);
  const incoming = admMsgs.body.received.find((m) => m.sender && m.sender.email === 'msg.livreur@zurion.test');
  assert.ok(incoming, 'admin doit recevoir le message livreur');

  // Admin -> livreur REFUSE ; admin -> superadmin REFUSE ; admin -> admin OK
  const toLiv = await adm.agent.post('/api/messages').set('X-CSRF-Token', adm.csrf)
    .send({ recipientIds: [livUser.id], message: 'Bien recu, merci.' });
  assert.equal(toLiv.status, 403, 'admin ne peut pas ecrire a un livreur');

  const toSuper = await adm.agent.post('/api/messages').set('X-CSRF-Token', adm.csrf)
    .send({ recipientId: superUser.id, message: 'Rapport du jour.' });
  assert.equal(toSuper.status, 403, 'admin ne peut pas ecrire au super-admin');

  const toAdmin = await adm.agent.post('/api/messages').set('X-CSRF-Token', adm.csrf)
    .send({ recipientIds: [admin2User.id], message: 'Coordinations equipe.' });
  assert.equal(toAdmin.status, 201);

  // L'autre admin recoit le message
  const adm2Msgs = await adm2.agent.get('/api/messages');
  assert.ok(adm2Msgs.body.received.some((m) => m.message === 'Coordinations equipe.'), 'admin2 doit recevoir le message admin');

  // Superadmin -> admin + livreur en meme temps (multi-destinataires)
  const supMulti = await sup.agent.post('/api/messages').set('X-CSRF-Token', sup.csrf)
    .send({ recipientIds: [adminUser.id, livUser.id], message: 'Info a tous.' });
  assert.equal(supMulti.status, 201);
  assert.equal(supMulti.body.sent, 2);

  // Confidentialite : le livreur ne voit PAS le message superadmin -> admin seul
  const supSolo = await sup.agent.post('/api/messages').set('X-CSRF-Token', sup.csrf)
    .send({ recipientIds: [adminUser.id], message: 'Confidentiel admin.' });
  assert.equal(supSolo.status, 201);
  const livMsgs = await liv.agent.get('/api/messages');
  assert.ok(!livMsgs.body.received.some((m) => m.message === 'Confidentiel admin.'), 'livreur ne doit pas voir le message admin-only');
  const admMsgs2 = await adm.agent.get('/api/messages');
  assert.ok(admMsgs2.body.received.some((m) => m.message === 'Confidentiel admin.'));

  // Admin supprime une notification reque (message du superadmin)
  const admNotifs = await adm.agent.get('/api/notifications?limit=50');
  assert.equal(admNotifs.status, 200);
  const toDelete = admNotifs.body.notifications.find((n) => n.message === 'Confidentiel admin.');
  assert.ok(toDelete, 'admin doit avoir recu le message "Confidentiel admin."');
  const del = await adm.agent.delete(`/api/notifications/${toDelete.id}`).set('X-CSRF-Token', adm.csrf);
  assert.equal(del.status, 200);

  // Pages SSR accessibles
  for (const a of [liv.agent, adm.agent, sup.agent]) {
    const page = await a.get('/messages');
    assert.equal(page.status, 200);
    const notifPage = await a.get('/notifications');
    assert.equal(notifPage.status, 200);
  }
});