# PLAN D'IMPLÉMENTATION — Branches de migration du code GitHub

Date : 14/09/2026 — Période de migration : la restructuration `front/` / `back/` vient
d'être faite sur le disque mais n'est **pas encore commitée** (168 fichiers en mouvement
dans `git status`).

Ce plan définit **quel code va dans quelle branche**, l'ordre de création des branches
de migration, et les règles de collaboration pour les futurs développeurs assignés au
projet.

---

## Table des matières

1. [Objectif](#objectif)
2. [Modèle de branches retenu](#modele)
3. [Carte code → branche](#carte)
4. [Branches de migration — ordre d'exécution](#migration)
5. [Workflow de développement](#workflow)
6. [Règles de protection GitHub](#protection)
7. [Conventions](#conventions)
8. [Checklist de mise en place](#checklist)

---

## <a name="objectif"></a>1. Objectif

- Donner une **structure de branches prédictible** pour qu'un nouveau développeur
  sache immédiatement `où` mettre son code.
- Isoler les **trois domaines techniques** du monorepo : backend (`back/`), frontend
  (`front/`), desktop (`electron/`).
- Garantir que `main` reste **toujours déployable** et que la CI
  (`.github/workflows/build-desktop.yml`) tourne sur chaque branche.
- Mijorer proprement l'état *non commité* actuel sans forcer de force-push destructif.

---

## <a name="modele"></a>2. Modèle de branches retenu

Modèle **GitHub Flow étendu par une branche d'intégration `develop`** — simple, adapté
à une petite équipe, sans la lourdeur du git-flow complet.

| Longévité | Branche | Rôle |
|---|---|---|
| Longue | `main` | Production. Toujours buildable + testée. Protégée, taggée (vX.Y.Z). |
| Longue | `develop` | Intégration des travaux en cours. Point de départ des branches de fonctionnalités. |
| Courte | `feature/<domaine>/<sujet>` | Travail d'un dev sur un domaine (≤ 1-2 semaines). |
| Courte | `hotfix/<sujet>` | Correction urgente de production, fusionnée direct dans `main`. |
| Courte | `chore/<sujet>` | Migration, purge, mise à niveau outillage. |

Règles de base :
- **Jamais de commit direct** sur `main` (push protégé). Tout passe par Pull Request.
- `main` et `develop` ne sont fusionnés que par la CI verte.
- Une branche courte vit le temps d'une fonctionnalité puis est **supprimée**.

---

## <a name="carte"></a>3. Carte code → branche

### 3.1 Branche de base — `main` : TOUT le projet

`main` contient l'intégralité du dépôt (monorepo). Les branches ci-dessous opposent le
même dépôt mais permettent d'**organiser le travail par domaine et de limiter la portée
des PRs** — c'est la « virtualisation » du découpage front/back.

### 3.2 Correspondance par domaine

| Domaine | Code (dossiers) | Préfixe de branche | Propriétaire type |
|---|---|---|---|
| **Backend** | `back/` entier (server, API, SSR, services, modèles, config, migrations, `back/data`) | `feature/api/`, `feature/ssr/`, `feature/db/` | Dev backend |
| **Frontend** | `front/views/**`, `front/public/**`, `front/assets/**` | `feature/storefront/`, `feature/admin/`, `feature/panier/` | Dev frontend |
| **Desktop** | `electron/`, `electron-builder.yml`, `scripts/electron-after-pack.js` | `feature/electron/`, `fix/electron/` | Dev desktop |
| **Outillage** | `scripts/` (hors electron), `playwright.config.js`, `tests/` | `chore/tests/`, `chore/ci/` | Tout dev + mainteneur |
| **Docs** | `docs/`, READMEs | `docs/` | Tout dev + mainteneur |
| **Méta** | `package.json`, `.env.example`, `.gitignore` | `chore/meta/` | Mainteneur |

### 3.3 Règles de portée d'une PR
- Une PR **ne mélange pas les domaines** : une PR `feature/api/*` ne modifie pas
  `front/views/**` (sauf dépendance explicite signalée dans la description).
- Le préfixe dans le nom de branche = le domaine **dominant**. Si la PR touche aussi
  un domaine voisin, le corps de la PR le liste (`Scope : back + front/panier`).

### 3.4 Ce qui ne doit **jamais** être commité
- `.env` (réel, avec secrets) — seul `.env.example` versionné.
- `back/data/*.sqlite` (base de dev locale) — déjà dans `.gitignore`.
- `front/public/uploads/**` (contenus clients).
- `node_modules/`, `dist/`, `dist-*`, `linux-unpacked/`, `win-unpacked/`.

---

## <a name="migration"></a>4. Branches de migration — ordre d'exécution

L'état actuel n'est pas commité : il faut **d'abord enregistrer proprement la
restructuration**, puis créer `develop`, puis dérouler les migrations. Chaque migration
est une PR vers `develop`.

| # | Branche courte | Contenu (qui va là) | Départ | Cible |
|---|---|---|---|---|
| 1 | `chore/01-restructure-front-back` | Le **socle** : enregistrer la restructuration. `git add -A` (git détectera les renames `src/→back/src/`, `views/→front/views/`, etc.), `back/`, `front/`, suppression des anciens chemins racine. TOUT ce qui doit exister dans `main` à terme. | racine | `main` (premier commit structurant) |
| 2 | `chore/02-cleanup-purge` | La **purge** : suppression `www/`, vues admin mortes, `viewData.js`, bases temporaires, `capacitor.config.json` ; `.gitignore` (qui contient l'état git, pas le disque — déjà favorable). | `main` | `main` |
| 3 | `develop` (longue) | Créée depuis `main` propre : c'est la **base** de toutes les futures branches. | `main` | — |
| 4 | `chore/03-corrections-audit` | Les **corrections** backend/frontend/logique (CSRF, XSS, transactions, cookies, ORDER_STATUSES…). Seule branche qui touche `back/` + `front/` (exception légitime, signalée). | `develop` | `develop` |
| 5 | `chore/04-meta-ci-docs` | `docs/` (ARCHITECTURE, README mis à jour, plan de branches), CI : ajout des triggers sur `develop` + `feature/*` dans `build-desktop.yml`, `.env.example`. | `develop` | `develop` |
| 6 | `chore/05-tests-review` | `tests/` : vérification/expansion de la suite, E2E Playwright. | `develop` | `develop` |

### Cas particulier — développeur sur un **domaine seul**
Un dev backend démarre de `develop` : `git checkout -b feature/api/envoyage develop`.
Il ne touche que `back/`. Il ne reçoit jamais de fusion du frontend.

---

## <a name="workflow"></a>5. Workflow de développement

1. **Démarrer** : checkout de `develop` à jour → `git checkout -b feature/<dom>/<sujet> develop`.
2. **Committer** : petits commits atomiques en français ; message
   `<type>(<domaine>): <résumé>` (voir conventions).
3. **Tester localement** avant push :
   ```bash
   DATABASE_URL="sqlite://./data/zurion.sqlite" npm test
   ```
4. **Pousser** la branche, ouvrir une PR vers `develop` (description : scope,
   changements, capture d'écran si UI).
5. **CI** : `.github/workflows/build-desktop.yml` s'exécute ; la PR n'est fusionnée
   que si elle est verte.
6. **Fusion** en `develop` → rebase éventuelle, ou commit de merge `--no-ff`.
7. **Release** : `develop` → `main` via PR `release/vX.Y.Z` ; tag `vX.Y.Z` sur `main`.
8. **Hotfix** : `git checkout -b hotfix/<sujet> main`, PR direct vers `main`,
   puis `cherry-pick` des fixes dans `develop`.

---

## <a name="protection"></a>6. Règles de protection GitHub (à configurer)

Sur **`main`** (et recommandé sur `develop`) :
- ☐ Push direct refusé (au moins 1 reviewer requis pour fusionner vers `develop`).
- ☐ Statuts requis : le workflow `build-desktop.yml` (et `npm test`) doivent passer.
- ☐ Branches à jour requises avant fusion.
- ☐ Détection des commits de rebase forcé changée récemment : pas de force-push.

---

## <a name="conventions"></a>7. Conventions

### 7.1 Nommage des branches
```
<type>/<domaine>/<sujet-kebab-case>
```
- Type : `feature`, `fix`, `hotfix`, `chore`, `docs`, `release`.
- Domaine : `api`, `ssr`, `db`, `storefront`, `panier`, `admin`, `electron`, `tests`,
  `ci`, `meta`, `docs`.
Exemples :
- `feature/api/pagination-produits-admin`
- `feature/storefront/panier-compteur-invite`
- `fix/electron/fenetre-offline`
- `chore/ci/wf-desktop-truncages`

### 7.2 Messages de commit
```
<type>(<domaine>): <résumé>        # ex: fix(api): comparer le jeton CSRF en temps constant
```
Types : `feat`, `fix`, `chore`, `docs`, `test`, `refactor`. Résumé : impératif, ≤ 72 signes.

### 7.3 Merge
- `main` : merge `--no-ff` (historique clair) ou rebase pour les petites PRs.
- Interdiction d'écrire directement dans `docs/` d'un autre domaine sans accord.

---

## <a name="checklist"></a>8. Checklist de mise en place

- [ ] **Dépôt** : héberger à `github.com/aymardjunior28-cmyk/zurion-store` (déjà lié `origin`).
- [ ] **Migration 1** : branche `chore/01-restructure-front-back` → PR → `main`.
- [ ] **Migration 2** : branche `chore/02-cleanup-purge` → PR → `main`.
- [ ] Créer `develop` depuis `main`.
- [ ] **Migration 3** : `chore/03-corrections-audit` → PR → `develop`.
- [ ] **Migration 4** : `chore/04-meta-ci-docs` → PR → `develop` (inclut ce plan).
- [ ] **Migration 5** : `chore/05-tests-review` → PR → `develop`.
- [ ] Configurer les protections GitHub (§6) sur `main` puis `develop`.
- [ ] Vérifier la CI sur une branche `feature/*` de test.
- [ ] Informer les nouveaux devs : pointer vers ce document + `docs/ARCHITECTURE.md`.

---

## Annexe — Rappel du périmètre du monorepo

| Chemin | DOMAINE | Détient |
|---|---|---|
| `back/` | Backend | server, Express app, routes SSR/API, services, modèles, migrations, `data/` |
| `front/` | Frontend | templates EJS (`views/`), statiques (`public/`, `assets/`) |
| `electron/` | Desktop | process principal, fenêtres, packaging |
| `scripts/` | Outillage | seed, migrate, E2E, vérifs DB |
| `tests/` | Qualité | tests Node (`node --test`) + specs Playwright |
| `docs/` | Documentation | ARCHITECTURE, CORRECTIONS, VALIDATION, plan de branches |
| racine | Méta | package.json, lockfile, CI, configs build/deploy |