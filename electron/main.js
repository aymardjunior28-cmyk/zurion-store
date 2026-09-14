'use strict';

const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');

/* ═══════════════════════════════════════════════════════════════════════════
 *  ZURION STORE — Processus principal Electron
 *  Lance le serveur Node.js intégré puis ouvre une fenêtre BrowserWindow.
 * ═══════════════════════════════════════════════════════════════════════════ */

const SERVER_PORT = 4173;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

let mainWindow = null;

/** Crée la fenêtre principale de l'application. */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, 'assets/icon.png'),
    title: 'Zurion Store',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

/** Démarre le serveur Node.js en arrière-plan. */
async function startServer() {
  process.env.NODE_ENV = 'production';
  process.env.PORT = SERVER_PORT;
  process.env.DATABASE_URL = 'sqlite://./data/zurion.sqlite';
  process.env.ELECTRON_RUN = '1';

  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'electron-secret-' + Date.now();
  }

  console.log('[Electron] Démarrage du serveur Zurion...');
  require('../back/server.js');
}

/** Menu personnalisé de l'application. */
function createMenu() {
  const template = [
    {
      label: 'Zurion Store',
      submenu: [
        { label: 'À propos de Zurion Store', role: 'about' },
        { type: 'separator' },
        { label: 'Quitter', role: 'quit' },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { label: 'Recharger', role: 'reload' },
        { label: 'Outils de développement', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Plein écran', role: 'togglefullscreen' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  LIFECYCLE ELECTRON
 * ═══════════════════════════════════════════════════════════════════════════ */

app.whenReady().then(async () => {
  await startServer();
  setTimeout(() => {
    createMenu();
    createWindow();
  }, 2000);
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
