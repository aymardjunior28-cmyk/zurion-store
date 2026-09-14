'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../back/src/app');
const { connectDatabase, sequelize } = require('../back/src/config/db');

test.before(async () => { await connectDatabase(); });
test.after(async () => { await sequelize.close(); });

test('visibilite : invite et client ne voient ni icones ni messages', async () => {
  // Invite : accueil sans icones internes
  const home = await request(app).get('/');
  assert.equal(home.status, 200);
  assert.ok(!home.text.includes('/messages'), 'invite : aucun lien /messages');
  assert.ok(!home.text.includes('fa-envelope'), 'invite : aucune icone message');
  assert.ok(!home.text.includes('notif-badge'), 'invite : aucune cloche interne');

  // Invite : pages protegees redirigent vers /connexion
  assert.equal((await request(app).get('/messages')).status, 302);
  assert.equal((await request(app).get('/notifications')).status, 302);

  // Invite : API bloquees (401)
  assert.equal((await request(app).get('/api/messages')).status, 401);
  assert.equal((await request(app).get('/api/messages/contacts')).status, 401);
  assert.equal((await request(app).get('/api/notifications')).status, 401);

  // Client : accueil sans icones internes
  const client = request.agent(app);
  const pre = await client.get('/api/health');
  const csrf = (pre.headers['set-cookie'] || []).find((c) => c.startsWith('zurion_csrf='))
    ?.split(';')[0].split('=').slice(1).join('=');
  const login = await client.post('/api/auth/login').set('X-CSRF-Token', csrf)
    .send({ email: 'client@zurion.store', password: 'Client1234!' });
  assert.equal(login.status, 200);
  const homeClient = await client.get('/');
  assert.equal(homeClient.status, 200);
  assert.ok(!homeClient.text.includes('/messages'), 'client : aucun lien /messages');
  assert.ok(!homeClient.text.includes('fa-envelope'), 'client : aucune icone message');
  assert.ok(!homeClient.text.includes('notif-badge'), 'client : aucune cloche interne');

  // Client : pages redirigent vers / (pas /messages)
  const msgPage = await client.get('/messages');
  assert.equal(msgPage.status, 302);
  assert.match(msgPage.headers.location, /\/$/);
  const notifPage = await client.get('/notifications');
  assert.equal(notifPage.status, 302);

  // Client : API 403
  assert.equal((await client.get('/api/messages')).status, 403);
  assert.equal((await client.get('/api/messages/contacts')).status, 403);
  assert.equal((await client.get('/api/notifications')).status, 403);
  const post = await client.post('/api/messages').set('X-CSRF-Token', csrf).send({ recipientId: 1, message: 'x' });
  assert.equal(post.status, 403);

  // Interne : superadmin voit les icones
  const admin = request.agent(app);
  const preA = await admin.get('/api/health');
  const csrfA = (preA.headers['set-cookie'] || []).find((c) => c.startsWith('zurion_csrf='))
    ?.split(';')[0].split('=').slice(1).join('=');
  const loginA = await admin.post('/api/auth/login').set('X-CSRF-Token', csrfA)
    .send({ email: 'admin@zurion.store', password: 'Admin1234!' });
  assert.equal(loginA.status, 200);
  const homeAdmin = await admin.get('/');
  assert.equal(homeAdmin.status, 200);
  assert.ok(homeAdmin.text.includes('/messages'), 'superadmin : lien /messages visible');
});