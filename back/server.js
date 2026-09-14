'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
 *  POINT D'ENTRÉE DU SERVEUR
 *  1. Charge les définitions de modèles Sequelize (nécessaire AVANT sync()).
 *  2. Connecte la base (SQLite en dev, PostgreSQL + migrations en prod).
 *  3. Seed les livreurs partenaires par défaut si la table est vide.
 *  4. Démarre l'écoute HTTP sur le port configuré.
 * ═══════════════════════════════════════════════════════════════════════════ */
const { connectDatabase } = require('./src/config/db');
const env = require('./src/config/env');

// Détection du mode Electron (application desktop)
const isElectron = process.env.ELECTRON_RUN === '1' ||
                   (typeof process.versions !== 'undefined' && process.versions.electron);

if (isElectron) {
  console.log('[server] Mode Electron détecté — SQLite forcé');
}

(async () => {
  try {
    // Les modèles doivent être enregistrés avant la synchronisation du schéma,
    // sinon les tables récentes (couriers…) ne seraient pas créées.
    require('./src/models');
    await connectDatabase();
    const deliveryService = require('./src/services/delivery.service');
    await deliveryService.seedCouriersIfEmpty();
    const app = require('./src/app');
    app.listen(env.port, () => {
      console.log(`[zurion] Server prêt sur http://localhost:${env.port}`);
      console.log(`[zurion] Mode : ${env.nodeEnv}`);
    });
  } catch (err) {
    console.error('[zurion] Démarrage impossible :', err);
    process.exit(1);
  }
})();