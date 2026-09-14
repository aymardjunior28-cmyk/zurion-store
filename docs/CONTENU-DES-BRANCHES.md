# CONTENU DES BRANCHES — ZURION STORE

Date : 14/09/2026 — Repo : https://github.com/aymardjunior28-cmyk/zurion-store

Ce document décrit **ce que contient chaque branche** (réel aujourd'hui, attendu à
l'avenir) afin d'orienter les développeurs et contributeurs : où faire le code, quoi
livrer, comment se structurer pour que les PRs restent petites et lisibles.

Voir aussi :
- [docs/PLAN-BRANCHES-GIT.md](PLAN-BRANCHES-GIT.md) — stratégie de branches & conventions
- [docs/ARCHITECTURE.md](ARCHITECTURE.md) — arborescence `back/` / `front/`

---

## Table des matières

1. [État actuel](#etat)
2. [Rôle de chaque branche](#roles)
3. [Contenu par branche](#contenu)
4. [Domaine → dossier → branche](#domaine)
5. [Règles de fusion](#fusion)
6. [Comment démarrer](#demarrer)
7. [Exemples concrets](#exemples)

---

## <a name="etat"></a>1. État actuel (au 14/09/2026)

| Branche | Commit | Contenu | Relation |
|---|---|---|---|
| `main` | `27c43f2` | Production stable | Branche par défaut, protégée |
| `develop` | `27c43f2` | Intégration | **Identique à `main`** à sa création (point de départ de tout nouveau travail) |

Les deux branches sont **protégées** : push direct interdit, 1 review requise,
force-push refusé ; `main` exige en plus le statut CI `Tests (backend)` à jour.

---

## <a name="roles"></a>2. Rôle de chaque branche

| Branche | Rôle | Qui fusionne dedans | Destinée à |
|---|---|---|---|
| `main` | Production, toujours déployable | `release/*`, `hotfix/*` | Utilisateurs |
| `develop` | Intégration des fonctionnalités en cours | `feature/*`, `fix/*`, `chore/*`, `docs/*` | Équipe |
| `feature/<domaine>/<sujet>` | Nouvelle fonctionnalité | (source du travail) | `develop` |
| `fix/<domaine>/<sujet>` | Correction non urgente | (source du travail) | `develop` |
| `hotfix/<sujet>` | Correctif urgent de production | (source du travail) | `main` (+ report sur `develop`) |
| `release/vX.Y.Z` | Préparation d'une version | rassemble `develop` | `main` |
| `docs/*` | Documentation | (source du travail) | `develop` |

---

## <a name="contenu"></a>3. Contenu par branche

### `main` — ce qu'elle contient Aujourd'hui (6 commits)
1. **`01634d7` — `chore(meta)`** : restructuration `back/` + `front/`
   - Déplacement `src/`→`back/src/`, `views/`→`front/views/`, `public/`→`front/public/`,
     `assets/`→`front/assets/`, `server.js`→`back/server.js`, `migrations/` et `data/`→`back/`.
   - Mise à jour des chemins (app.js, electron/main.js, scripts, tests, package.json,
     playwright.config.js, electron-builder.yml, .gitignore).
   - **Corrections audit** : CSRF timing-safe, échappement LIKE, XSS adresse, transactions
     (`deleteOrder`, `mergeGuestIntoUser`), pagination produits admin, `patchSchema`
     idempotent, cookie harmonisé, `ORDER_STATUSES` centralisé, fixes panier frontend.
   - **Purge** : vues admin mortes, `viewData.js`, `www/`, `capacitor.config.json`, bases temporaires.
2. **`44639bd` — merge `chore/01`** : commit de fusion (historique structuré).
3. **`94192aa` — `chore(front)`** : suppression des images produits/catégories inutilisées
   (les images réelles viennent d'Unsplash ; seul `placeholder.jpg` reste comme fallback).
4. **`12fc34c` — merge `chore/03`** : fusion de la suppression d'images.
5. **`e829d64` — `chore(infra)`** : CI multi-branches, `Dockerfile`, `.dockerignore`,
   restauration de `.env.example`, mise à jour de `docs/ARCHITECTURE.md` et `docs/README.md`.
6. **`27c43f2` — merge `chore/04`** : fusion de l'infra (état courant de `main`).

**Contenu terminal de `main`** :
```
back/  front/  electron/  scripts/  tests/  docs/  .github/
Dockerfile  .dockerignore  .env.example  render.yaml
electron-builder.yml  package.json  package-lock.json  playwright.config.js
```

### `develop` — contenu actuel = contenu de `main`
Elle **n'anticipe rien** pour l'instant : c'est la base de travail. Son contenu
évoluera à mesure que les `feature/*` et `fix/*` y seront fusionnés.

### À venir — contenu des branches courtes (à créer)
- `feature/storefront/*` : changements dans `front/views/**`, `front/public/**`, `front/assets/**`.
- `feature/api/*` : changements dans `back/src/routes/api.js`, `back/src/controllers/**`, `back/src/services/**`.
- `feature/ssr/*` : changement dans `back/src/routes/pages.js` + `front/views/**`.
- `feature/electron/*` : `electron/**`, `electron-builder.yml`.
- `chore/tests/*` : `tests/**`, `scripts/**`.
- `docs/*` : `docs/**`, `README*`.

---

## <a name="domaine"></a>4. Domaine → dossier → branche

| Domaine | Dossier impacté | Préfixe de branche | Ne PAS toucher |
|---|---|---|---|
| Backend API | `back/src/` (routes, controllers, services, models, middlewares, config) | `feature/api/`, `fix/api/` | `front/` |
| Rendu SSR | `back/src/routes/pages.js` + `front/views/**` | `feature/ssr/` | `back/src/routes/api.js` |
| Frontend store | `front/views/**`, `front/public/**` | `feature/storefront/` | `back/src/services/**` |
| Panier / commandes | `back/src/services/cart.service.js`, `order.service.js`, `front/views/cart.ejs`, `checkout.ejs`, `confirmation.ejs` | `feature/panier/` | — |
| Admin back-office | `front/views/admin/**`, `back/src/controllers/admin.controller.js` | `feature/admin/` | — |
| Desktop | `electron/**`, `electron-builder.yml` | `feature/electron/` | serveur |
| Livreur | `front/views/livreur/**`, `back/src/controllers/livreur.controller.js` | `feature/livreur/` | — |
| Tests / qualité | `tests/**`, `scripts/**`, `playwright.config.js` | `chore/tests/` | code applicatif |
| CI / déploiement | `.github/`, `Dockerfile`, `render.yaml` | `chore/ci/` | — |
| Docs | `docs/**`, `README*` | `docs/` | — |

**Règle d'or** : une PR ne mélange pas les domaines. Si un changement touche deux
domaines (ex. SSR + storefront), la branche prend le préfixe du domaine dominant et la
description le précise.

---

## <a name="fusion"></a>5. Règles de fusion

1. **Feature/fix/chore/docs** → fusionner dans **`develop`** (via une PR).
2. **Release** : `develop` → `main` via une PR `release/vX.Y.Z` = état stable livrable ;
   on pose un tag `vX.Y.Z` sur `main`.
3. **Hotfix** : depuis `main`, PR directe vers `main`, puis report du correctif sur
   `develop` pour éviter une divergence.
4. **Revue** : 1 reviewer obligatoire sur `main` et `develop` ; le statut CI
   `Tests (backend)` doit être vert.
5. Toujours rebaser sur la branche cible avant la PR (branches à jour requises).

---

## <a name="demarrer"></a>6. Comment démarrer

```bash
# 1. Récupérer l'état distant
git clone https://github.com/aymardjunior28-cmyk/zurion-store.git
cd zurion-store

# 2. Se placer sur la base d'intégration
git checkout develop
git pull origin develop

# 3. Créer sa branche de travail (nommage : <type>/<domaine>/<sujet>)
git checkout -b feature/storefront/ameliorer-filtres develop

# 4. Travailler, committer (msg : <type>(<domaine>): <résumé>)
# 5. Pousser et ouvrir une PR vers develop
git push -u origin feature/storefront/ameliorer-filtres
# → puis créer la PR (ou : gh pr create --base develop)
```

---

## <a name="exemples"></a>7. Exemples concrets

| Nouveau code demandé | Branche à créer | Dans les dossiers |
|---|---|---|
| « Ajouter un filtre de réduction sur le catalogue » | `feature/storefront/filtrer-reductions` | `front/public/js/storefront.js`, `front/views/catalog.ejs`, `back/src/services/catalog.service.js` |
| « Nouveau mode de paiement à l'API » | `feature/api/paiement-mobile-money-v2` | `back/src/services/payment.service.js`, `back/src/routes/api.js` |
| « Section profil client étendue » | `feature/ssr/profil-client` | `back/src/routes/pages.js`, `front/views/compte.ejs` |
| « Purger les logs du terminal desktop » | `feature/electron/nettoyage-log` | `electron/main.js` |
| « Couvrir le parcours checkout en Playwright » | `chore/tests/e2e-checkout` | `tests/browser/*.spec.js` |
| « Documenter l'API REST » | `docs/api-rest` | `docs/**` |

---

*Toute contribution = PR vers `develop` (ou `main` si hotfix), 1 review, CI verte.*