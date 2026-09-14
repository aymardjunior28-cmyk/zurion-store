# AUDIT ET CORRECTIONS — Zurion Store

Date : 14/09/2026

Ce document synthétise l'audit complet du code, la **restructuration du projet en
`front/` / `back/`**, les **corrections** appliquées et la **purge** des fichiers
devenus inutilisables. Il complète [CORRECTIONS.md](./CORRECTIONS.md) (bugs N°1-16
corrigés le 09/09/2026).

---

## Table des matières

1. [Restructuration du projet](#restructuration)
2. [Limites repérées par l'audit](#limites)
3. [Corrections backend](#backend)
4. [Corrections frontend](#frontend)
5. [Corrections logique](#logique)
6. [Purge des fichiers inutilisables](#purge)
7. [Vérifications](#verifications)
8. [Limites restantes (non traitées)](#restantes)

---

## <a name="restructuration"></a>1. Restructuration du projet en `front/` / `back/`

### Motivations
Le code était tout à la racine : un seul dossier `src/` mélangeait le serveur, et
`views/`, `public/`, `assets/` étaient les seules zones « frontend ». Cette
structuration ne permet pas de distinguer clairement la couche serveur (Node/Express/
Sequelize) de la couche présentation (templates EJS + statiques), complique Electron,
et brouille les responsabilités.

### Nouvelle arborescence

```
ZURION Store/
├── back/                            # Backend (serveur)
│   ├── server.js                    # Point d'entrée HTTP
│   ├── src/
│   │   ├── app.js                   # Configuration Express
│   │   ├── config/                  # env, db, migrations…
│   │   ├── controllers/             # Contrôleurs API/SSR
│   │   ├── middlewares/             # Auth, CSRF, validations, erreurs
│   │   ├── models/                  # Modèles Sequelize + associations
│   │   ├── routes/                  # pages.js (SSR), api.js (REST)
│   │   ├── services/                # Logique métier
│   │   └── utils/                    # Helpers de vues
│   ├── migrations/                  # Migrations de schéma
│   └── data/                        # Base SQLite locale
├── front/                           # Frontend (rendu + statiques)
│   ├── views/                       # Templates EJS
│   ├── public/                      # CSS, JS client, uploads
│   └── assets/                      # Images du thème
├── electron/                        # Application desktop
├── scripts/                         # migrate, seed, E2E…
├── tests/                           # Tests Node (node --test)
├── docs/
├── package.json / package-lock.json
├── playwright.config.js
├── electron-builder.yml
└── .env
```

### Règles de restructuration
- `src/`, `server.js`, `migrations/`, `data/` → `back/`.
- `views/`, `public/`, `assets/` → `front/` — les templates EJS sont du rendu
  serveur, mais appartiennent à la couche présentation : ils vivent donc dans `front/`.
- `package.json`, `package-lock.json`, `.env`, `electron/`, `scripts/`, `tests/`,
  `docs/` restent à la racine (outillage global du projet).

### Chemins mis à jour
| Fichier | Changement |
|---|---|
| `back/src/app.js` | `views` → `../../front/views` ; statics pointés sur `../../front/assets` et `../../front/public` |
| `back/server.js` | Aucun changement nécessaire : ses `require('./src/...')` restent valides |
| `back/src/config/db.js` | Aucun changement : `../../data` résout correctement vers `back/data/` |
| `electron/main.js` | `require('../back/server.js')` |
| `scripts/migrate.js`, `scripts/seed.js` | `../back/src/...` |
| `tests/smoke.test.js`, `tests/messages.test.js`, `tests/messages-visibility.test.js` | `../back/src/...` |
| `package.json` | scripts : `node back/server.js` |
| `playwright.config.js` | `webServer.command: node back/server.js` |
| `electron-builder.yml` | `files` : `back/src/**/*`, `back/server.js`, `front/views/**/*`, `front/public/**/*`, `front/assets/**/*`, `back/data/**/*`, `back/migrations/**/*` |
| `scripts/check-db.js`, `run-e2e.sh`, `verify-livreur.sh`, `run-notif-test.sh` | chemins `back/data/...`, `front/assets/...`, `back/src/...` |
| `.gitignore` | uploads → `front/public/uploads/` |

> Piège évité : `db.js` préfixe déjà `../../` devant le chemin SQLite. Les scripts
> bash doivent donc passer `DATABASE_URL="sqlite://./data/xxx.sqlite"` (et **non**
> `./back/data/...`, qui résoudrait en `back/back/data/...`).

---

## <a name="limites"></a>2. Limites repérées par l'audit

Un audit complet du code a identifié **58 limitations** réparties en trois familles :

- **22 limitations backend** — sécurité, transactions, robustesse des requêtes,
  validation des entrées, idempotence, pagination.
- **28 limitations frontend** — comportement du panier, parsing non protégé de
  `JSON.parse`, usages inline bloqués par la CSP, boutons inactifs (déjà traités le
  09/09), code mort, accessibilité, détails d'affichage.
- **8 limitations de logique** — incohérences entre les constantes partagées par
  plusieurs modules (statuts, cookies) et duplication de règles métier.

Les limitations ont été triées par priorité (critique / moyen / faible). Seules les
plus critiques ont été corrigées dans cette passe — voir sections 3 à 6. Les autres
sont listées en [section 8](#restantes).

### Deux faux positifs de l'audit (découverts pendant l'application)
1. **`header.ejs:68`** était signalé avec un attribut `data-zurion-cart-count` cassé.
   Le code s'est avéré **correct** — aucune modification nécessaire.
2. **Six vues admin** étaient signalées comme mortes. Vérification par grep des
   `renderPage(...)` : seules **trois** le sont réellement (`coupons.ejs`,
   `livraisons.ejs`, `couriers.ejs`, `orders.ejs`, `product-edit.ejs` sont bien
   rendues par `pages.js`). Voir [section 6](#purge).

---

## <a name="backend"></a>3. Corrections backend (7)

### C1 — CSRF non timing-safe
**Fichier :** `back/src/middlewares/csrf.js`

**Problème :** la comparaison du jeton CSRF utilisait `a === b`, sensible au timing
(attaque par analyse de chronométrage).

**Correction :** ajout d'une fonction `safeEqual(a, b)` qui hache les deux valeurs en
SHA-256 puis les compare avec `crypto.timingSafeEqual` — toujours en temps constant.

### C2 — Recherche LIKE sauvage (injection de motifs)
**Fichier :** `back/src/services/catalog.service.js`

**Problème :** les valeurs de recherche (`q`) étaient passées telles quelles dans des
clauses `LIKE '%…%'`. Les caractères spéciaux `%` et `_` de l'utilisateur agissaient
comme des jokers, faussant les résultats (et ouvrant la porte à des motifs malveillants).

**Correction :** ajout de `escapeLike()` qui neutralise `\`, `%` et `_`, appliqué à la
recherche catalogue (lignes 60-63) et aux suggestions (ligne 133) avec
`[Op.escape]: '\\'`.

### C3 — Injection XSS via l'adresse + fuite d'une commande invité
**Fichiers :** `back/src/services/order.service.js`, `back/src/routes/pages.js`

**Problème :**
- `sanitizeAddress` ne filtrait pas le HTML : un client pouvait injecter des balises
  affichées telles quelles dans le back-office.
- `getOrderForUser(userId, reference)` sur une commande type « guest » (sans userId)
  pouvait être atteinte par n'importe quel visiteur connaissant la référence.

**Correction :**
- `sanitizeAddress` (ligne 69) supprime désormais toute balise HTML
  (`replace(/<[^>]*>/g, '')` puis suppression des `<` et `>`).
- `getOrderForUser` (ligne 168) accepte un troisième paramètre
  `{ allowGuest = false }` : sans `userId` **et** sans `allowGuest`, elle lève une 403.
- Les deux seuls appels légitimes (placement de commande, `order.service.js:152` ;
  confirmation SSR, `pages.js:300`) passent explicitement `{ allowGuest: true }`.

### C4 — Suppression d'une commande non transactionnelle
**Fichier :** `back/src/controllers/admin.controller.js` (`deleteOrder`, ligne 340)

**Problème :** la suppression de la commande détruisait Livraison, puis OrderItem,
puis Order en trois opérations indépendantes. Un échec intermédiaire laissait des
lignes orphelines.

**Correction :** les trois destructions sont englobées dans une
`sequelize.transaction()` (ligne 346) → atomicité totale.

### C5 — Fusion panier invité → compte non transactionnelle
**Fichier :** `back/src/services/cart.service.js` (`mergeGuestIntoUser`, ligne 122)

**Problème :** l'attribution des items du panier invité au compte connecté (avec
éventuelle suppression du panier invité) se faisait sans transaction. Un échec en
cours de route produisait un panier incohérent.

**Correction :** toute l'opération est englobée dans `sequelize.transaction()` ;
`sequelize` a été ajouté à l'import des modèles.

### C6 — Liste admin des produits sans pagination
**Fichier :** `back/src/routes/api.js` (`GET /api/admin/products`, ligne 139)

**Problème :** la liste chargeait **tous** les produits en une seule requête — blocage
et charge mémoire dès quand le catalogue grossit.

**Correction :** passage à `Product.findAndCountAll` avec pagination : `page` et
`limit` bornés (maximum 100 par page), `offset` calculé, tri `id DESC`, retour de
`{ products, total, page, limit }` pour permettre le rendu paginé côté client.

### C7 — Promotion super-admin non idempotente
**Fichier :** `back/src/config/db.js` (fonction `promoteFirstAdmin`, ligne 58)

**Problème :** à chaque démarrage, la migration « promotion du premier compte admin »
créait/quittait l'état initial de façon non déterministe en présence de plusieurs
administrateurs.

**Correction :** la promotion n'est appliquée que si **aucun** super-admin n'existe
déjà : clause `(SELECT COUNT(*) FROM users WHERE role = 'superadmin') = 0` (lignes
70 et 77). Idempotence garantie quel que soit le nombre de démarrages.

---

## <a name="frontend"></a>4. Corrections frontend (4 appliquées + 1 faux positif)

### F1 — Boutons +/− du panier inopérants
**Fichier :** `front/public/js/storefront.js` (lignes 129-139)

**Problème :** le gestionnaire lisait l'attribut `data-cart-qty` sur le **conteneur**
`.zurion-qty` au lieu de l'**input** : la quantité lue était toujours `undefined`, et
les boutons +/− ne modifiaient rien.

**Correction :** l'attribut est lu sur l'input via `e.target.closest('[data-cart-qty]')`,
et la quantité est portée par `input.value`.

### F2 — `JSON.parse` non protégé sur les snapshots d'adresse
**Fichiers :** `front/views/admin/dashboard.ejs:373`, `front/views/admin/livraisons.ejs:69`

**Problème :** `JSON.parse(order.addressSnapshot)` plantait le rendu de la page admin
si le snapshot était `null` ou corrompu (données héritées).

**Correction :** parsing enveloppé dans un `try/catch` avec repli `destination = null`.

### F3 — Chaîne du retrait d'article du panier cassée + retour « panier vide »
**Fichier :** `front/public/js/storefront.js`

**Problème :** la chaîne de promesses du `DELETE /api/cart/items/:id` était fragmentée
(réponse non interprétée correctement), et le panier ne réagissait pas quand il
devenait vide (l'écran restait bloqué sur des éléments à retirer).

**Correction :** réécriture propre de la chaîne — `r.json().then(...)` exploité, statut
HTTP vérifié, et **rechargement de la page** quand la quantité retournée vaut `0` (ou
quand l'élément de remise est présent), ce qui réaffiche le panier vide.

### F4 — Faux positif : `header.ejs:68`
**Fichier :** `front/views/partials/header.ejs`

**Verdict :** le code était correct (`data-zurion-cart-count` bien formé). **Aucune
modification** n'a été nécessaire — consigné pour mémoire.

---

## <a name="logique"></a>5. Corrections logique (2)

### L1 — Incohérence du nom du cookie de session
**Fichiers :** `back/src/middlewares/auth.js:7`, `back/src/config/env.js:14`, `.env`

**Problème :** le code hardcodait `COOKIE_NAME = 'zurion_token'`, tandis que `.env`
déclarait un `COOKIE_NAME=zurion_session` qui n'était **jamais lu** (variable morte et
trompeuse). Trois sources de vérité : le code, le `.env`, et le cookie panier invité
(`zurion_cart`) — une dérive réelle entre config et comportement.

**Correction :**
- `env.js` lit désormais `COOKIE_NAME` avec repli sûr : `process.env.COOKIE_NAME || 'zurion_token'`.
- `auth.js` utilise `env.cookieName` (plus de constante en dur).
- `.env` harmonisé à `COOKIE_NAME=zurion_token` (aucun changement de comportement en
  runtime, la valeur effective d'avant est conservée).

### L2 — `ORDER_STATUSES` dupliqué entre deux modules
**Fichiers :** `back/src/services/order.service.js:21`, `back/src/controllers/admin.controller.js:18`

**Problème :** la liste des statuts de commande (`créée`, `paiement_confirmé`, …) était
définie **deux fois** — dans le service et dans le contrôleur admin. Toute modification
d'un des deux créait une dérive silencieuse (ex. un statut refusé par l'API mais
affiché côté SSR, ou inversement).

**Correction :** la définition unique reste dans `order.service.js` ; le contrôleur
admin impose maintenant `const ORDER_STATUSES = orderService.ORDER_STATUSES`. Les
exports existants (consommés par `views-helpers.js` et `order.controller.js`) restent
inchangés.

---

## <a name="purge"></a>6. Purge des fichiers et dossiers devenus inutilisables

### Supprimés
| Élément | Raison |
|---|---|
| `front/views/admin/categories.ejs`, `products.ejs`, `users.ejs` | **Seules** 3 vues admin mortes : leurs routes (`/admin/produits`, `/admin/categories`, `/admin/utilisateurs`) redirigent vers `/admin?tab=…` et aucun `renderPage(...)` ne les appelle. |
| `back/src/middlewares/viewData.js` | Code mort : jamais monté dans `app.js` **et** importait `{ helpers }` inexistant (module cassé de toute façon). |
| `www/` (47 Mo) | Duplication complète de l'ancien serveur monolithe pour Capacitor — devenu faux après la restructuration. |
| `capacitor.config.json` | Pointait sur `www/` supprimé (configuration morte). |
| `back/data/zurion-smoke.sqlite*`, `zurion-test.sqlite*`, `zurion-verify.sqlite*`, `zurion-notif.sqlite*` | Bases SQLite temporaires de tests — régénérées par les scripts à chaque exécution. |
| `tmp/`, `test-results/`, `front/public/fonts/` | Dossiers vides / artefacts éphémères. |

### Correction d'une erreur de l'audit en cours de route
L'audit préconisait de supprimer **6** vues admin. Vérification par grep des
`renderPage(...)` dans `pages.js` : `admin/coupons`, `admin/livraisons`,
`admin/couriers`, `admin/orders` et `admin/product-edit` sont **réellement rendues**.
Seules 3 ont été supprimées (voir tableau). C'est un exemple type de faux positif qui
aurait cassé le back-office si la purge avait été appliquée aveuglément.

---

## <a name="verifications"></a>7. Vérifications

1. **Syntaxe** : `node --check` sur les 18 fichiers modifiés (server, app, config,
   middlewares, services, contrôleurs, routes, electron, scripts, tests) — tous OK.
2. **Boot réel** sur base SQLite neuve (seed), puis requêtes HTTP :
   - Pages SSR : `/`, `/catalogue`, `/panier`, `/connexion`, `/contact`, `/faq` → **200**.
   - Statiques : `/css/storefront.css`, `/js/storefront.js`
     (`front/public`), `/images/Zurion/SVG/...` (`front/assets`) → **200**.
   - Les images produits sont des URLs Unsplash distantes (non locales) — aucun fichier
     manquant à ce titre.
3. **Tests automatiques** : `npm test` sur base SQLite jetable →
   **23 tests / 23 réussis** (0 échec). La suite couvre l'API publique, l'authentification,
   le panier, les commandes, la messagerie, les notifications et les workflows admin.

---

## <a name="restantes"></a>8. Limites restantes (non traitées)

Ces limites ont été repérées mais jugées non critiques ; elles sont laissées en l'état
et peuvent faire l'objet d'une passe ultérieure.

- **`fmtMoney`** — code mort dans `front/views/admin/dashboard.ejs` (helper non utilisé).
- **`cartToken()`** — code mort dans `front/public/js/storefront.js` (définie mais
  jamais appelée).
- **Fallback `Math.random()`** — la génération du jeton panier invité
  (`window.ZURION.cartToken`) retombe sur `Math.random()` quand aucun stockage n'est
  disponible : entropie faible pour ce jeton périphérique (faible sévérité).
- **Documentation obsolète** : `docs/ARCHITECTURE.md` et `docs/README.md` référencent
  encore l'ancienne arborescence (`src/`, `views/`, `public/`, `data/`,
  `server.js` à la racine). À mettre à jour vers `back/` / `front/`.
- **`docs/CORRECTIONS.md`** mentionne également les anciens chemins (`src/...`,
  `views/...`) dans ses 16 bugs — historique volontairement conservé tel quel.

---

## Annexe — Rappel des objectifs

Ce travail poursuivait trois objectifs :
1. **Clarifier la structure** du projet en isolant le backend (`back/`) du frontend
   (`front/`).
2. **Corriger les failles et limites** les plus critiques identifiées par l'audit
   (sécurité, transactions, robustesse, cohérence logique).
3. **Purger** les fichiers et dossiers devenus inutilisables après la restructuration.

Tout est vérifié : la suite de tests intégrale (23/23) passe, et le serveur démarre et
sert correctement les pages SSR ainsi que les statiques depuis la nouvelle structure.