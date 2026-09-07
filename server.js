'use strict';

/**
 * Point d'entrée du serveur. Charge la BDD puis démarre le serveur HTTP.
 */
const { connectDatabase } = require('./src/config/db');
const env = require('./src/config/env');

(async () => {
  try {
    // Charge les modèles AVANT la synchronisation du schéma pour que
    // sequelize.sync() crée aussi les tables ajoutées récemment (couriers…).
    require('./src/models');
    await connectDatabase();
    // Insère les livreurs partenaires par défaut si la table est vide
    // (l'administrateur peut ensuite les gérer depuis le back-office).
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