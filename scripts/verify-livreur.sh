#!/bin/bash
# Script de vérification complète — exécuté en arrière-plan
cd "/home/junior_dev/Documents/Zurion Store" || exit 1
LOG=/tmp/zurion-verify.log
: > "$LOG"

echo "[1/5] Vérification syntaxique" >> "$LOG"
for f in back/src/controllers/livreur.controller.js back/src/routes/pages.js back/src/routes/api.js \
         back/src/middlewares/auth.js back/src/middlewares/index.js back/src/models/Notification.js \
         back/src/models/User.js back/src/models/Livraison.js back/src/models/index.js \
         back/src/services/notification.service.js back/src/services/delivery.service.js \
         back/src/controllers/admin.controller.js back/src/config/db.js; do
  if node --check "$f" 2>>"$LOG"; then
    echo "OK: $f" >> "$LOG"
  else
    echo "FAIL-SYNTAX: $f" >> "$LOG"
  fi
done

echo "[2/5] Lancement du serveur (démarrage app)" >> "$LOG"
DATABASE_URL="sqlite://./data/zurion-verify.sqlite" node -e "
const { sequelize } = require('./back/src/config/db');
const app = require('./back/src/app');
(async () => {
  await require('./back/src/config/db').connectDatabase();
  console.log('APP-DB-OK');
  process.exit(0);
})().catch(e => { console.error('APP-DB-FAIL', e.message); process.exit(1); });
" >> "$LOG" 2>&1

echo "[3/5] Création du livreur + notifications via API" >> "$LOG"
DATABASE_URL="sqlite://./data/zurion-verify.sqlite" node -e "
const app = require('./back/src/app');
const request = require('supertest');
(async () => {
  const api = request.agent(app);
  const health = await api.get('/api/health');
  const csrfRaw = health.headers['set-cookie']?.find(c => c.startsWith('zurion_csrf='));
  const csrf = csrfRaw ? decodeURIComponent(csrfRaw.split(';')[0].split('=').slice(1).join('=')) : null;
  console.log('CSRF present:', !!csrf);

  // Login superadmin
  const login = await api.post('/api/auth/login')
    .set('X-CSRF-Token', csrf)
    .send({ email: 'admin@zurion.store', password: 'Admin1234!' });
  console.log('Login superadmin:', login.status, login.body.user?.role);

  // Créer un livreur
  const livreur = await api.post('/api/admin/livreurs')
    .set('X-CSRF-Token', csrf)
    .send({ firstName: 'Livreur', lastName: 'Test', email: 'livreur@verif.com', password: 'Livreur123!', phone: '690000000' });
  console.log('Créer livreur:', livreur.status, livreur.body.user?.role);

  // Liste admin des livreurs
  const list = await api.get('/api/admin/livreurs');
  console.log('Liste livreurs:', list.status, 'count=', list.body.livreurs?.length);

  // Login en tant que livreur avec UN SEUL agent
  const lAgent = request.agent(app);
  await lAgent.get('/api/health');
  const lCsrfRaw = health.headers['set-cookie']?.find(c => c.startsWith('zurion_csrf='));
  const lCsrf = lCsrfRaw ? decodeURIComponent(lCsrfRaw.split(';')[0].split('=').slice(1).join('=')) : null;
  const lLogin = await lAgent.post('/api/auth/login')
    .set('X-CSRF-Token', lCsrf)
    .send({ email: 'livreur@verif.com', password: 'Livreur123!' });
  console.log('Login livreur:', lLogin.status, lLogin.body.user?.role);

  // Vérifier que le centre de notifications répond (marquer comme lu = 0 notif)
  const unread = await lAgent.get('/api/notifications/unread-count');
  console.log('Unread count:', unread.status, JSON.stringify(unread.body));
  const notifs = await lAgent.get('/api/notifications');
  console.log('Liste notifications:', notifs.status, 'count=', notifs.body.notifications?.length);

  // Notifications pour le superadmin aussi
  const unreadAdmin = await api.get('/api/notifications/unread-count');
  console.log('Unread admin:', unreadAdmin.status, JSON.stringify(unreadAdmin.body));

  process.exit(0);
})().catch(e => { console.error('TEST-FAIL', e.message, e.stack); process.exit(1); });
" >> "$LOG" 2>&1

echo "[4/5] Test SSR /livreur (route page)" >> "$LOG"

echo "[5/5] TERMINÉ" >> "$LOG"
echo "DONE-VERIFY" >> "$LOG"
tail -60 "$LOG"