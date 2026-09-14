# ZURION Store — Applications Desktop & Mobile

## 📦 Statut Actuel

| Platform | Build | Fichier | Statut |
|----------|-------|---------|--------|
| **Linux** | ✅ | `dist/Zurion Store-1.0.0-x86_64.AppImage` | Fonctionnel |
| **Windows** | ⏳ | `dist/Zurion Store-Setup-1.0.0.exe` | Prêt (déploiement GitHub Actions) |
| **Android** | ⏳ | `app-release.apk` | À venir |

---

## 🖥️ Application Desktop

### Prérequis

- Node.js 20+
- npm

### Installation du développement

```bash
npm install
npm run electron:dev
```

### Build desktop

```bash
# Linux (AppImage + .deb)
npm run electron:build:linux

# Windows (NSIS installer) — nécessite Wine ou Windows
npm run electron:build:win

# Build complet
npm run electron:build
```

### Le build Windows nécessite

1. **Sur Linux** : `sudo dnf install -y wine` puis `npm run electron:build:win`
2. **Sur Windows** : `npm install` puis `npm run electron:build:win`
3. **Automatisé** : GitHub Actions (`.github/workflows/build-desktop.yml`) — pousser un tag `v*`

---

## 📱 Application Android (à venir)

### Prérequis

- Android Studio (SDK 34+)
- Node.js 20+

### Installation

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor-community/sqlite
npx cap init zurion-store com.zurion.store --web-dir www
```

### Build

```bash
npm run build:android
npx cap sync
npx cap open android
```

---

## 🏗️ Architecture Electron

```
electron/
├── main.js          # Processus principal
├── preload.js       # Sécurité IPC
└── assets/
    └── icon.png     # Icône
```

L'application démarre le serveur Node.js intégré (`server.js`) sur le port 4173, puis ouvre une `BrowserWindow` Electron qui charge `http://localhost:4173`.

---

## 🔧 Dépannage

### L'app ne démarre pas

1. Vérifier que le port 4173 est libre : `netstat -ano | findstr 4173`
2. Supprimer le fichier verrou SQLite : `data/zurion.sqlite`
3. Vérifier les logs dans la console Electron

### Le build Windows échoue

- **Sans Wine** : installer Wine (`sudo dnf install -y wine` sur Fedora)
- **Erreur fpm/libcrypt** : `sudo dnf install -y compat-libs libxcrypt-compat`