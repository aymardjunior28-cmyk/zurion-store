'use strict';

const { contextBridge } = require('electron');

/* ═══════════════════════════════════════════════════════════════════════════
 *  ZURION STORE — Script de préchargement sécurisé
 *  Expose des APIs sûres au processus de rendu (frontend).
 * ═══════════════════════════════════════════════════════════════════════════ */

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  isElectron: true,
});
