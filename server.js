'use strict';

/**
 * Point d'entrée du serveur. Charge la BDD puis démarre le serveur HTTP.
 */
const { connectDatabase } = require('./src/config/db');
const env = require('./src/config/env');

(async () => {
  try {
    await connectDatabase();
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