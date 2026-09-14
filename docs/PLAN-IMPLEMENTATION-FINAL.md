# PLAN D'IMPLEMENTATION FINAL — ZURION STORE

Version : 1.0 — Date : 14/09/2026
Statut : **À valider à deux**
Repo : https://github.com/aymardjunior28-cmyk/zurion-store

---

## Table des matières

1. [Contexte et objectifs](#contexte)
2. [État actuel du projet](#etat)
3. [Décisions à trancher ensemble](#decisions)
4. [Plan d'implémentation ordonné](#plan)
5. [Critères d'acceptation](#acceptation)
6. [Répartition des rôles](#roles)
7. [Risques et mitigations](#risques)
8. [Tâches post-validation](#post-validation)

---

## <a name="contexte"></a>1. Contexte et objectifs

- Projet ZURION Store : e-commerce Express/EJS (SSR + API REST), Sequelize, PostgreSQL
  (prod) / SQLite (dev), Electron (desktop).
- Le code vient d'être **restructuré en `back/` + `front/`** (corrections audit + purge
  incluses) et **commité localement** sur `main` — **rien n'a encore été poussé**.
- But : mettre le dépôt GitHub dans un état **propre, organisé par branches et prêt à
  accueillir d'autres développeurs**, avec un déploiement minimal.

---

## <a name="etat"></a>2. État actuel du projet

| Élément | État |
|---|---|
| Restructuration `back/`/`front/` | ✅ Fait sur disque |
| Corrections audit (backend 7 + frontend 4 + logique 2) | ✅ Appliquées |
| Purge (vues mortes, `www/`, bases temporaires…) | ✅ Fait |
| Tests `npm test` | ✅ 23/23 verts |
| Commit local | ✅ `01634d7` + merge `44639bd` sur `main` |
| Push vers GitHub | ⛔ **Rien n'est poussé** |
| Branches locales | `main`, `chore/01-restructure-front-back` |
| Branches distantes | `origin/main` (ancien état, avant restructuration) |
| CI | `.github/workflows/build-desktop.yml` présent, non testée sur branche |

---

## <a name="decisions"></a>3. Décisions à trancher ensemble

Valider chaque point par OUI / NON.

| # | Décision | Proposé | Votre avis |
|---|---|---|---|
| D1 | **Pousser `main` restructuré sur GitHub** (remplace l'ancien `main` non structuré) | 🟢 OUI | ☐ OUI / ☐ NON |
| D2 | **Changer le nom par défaut** vers `main` (déjà le cas) et créer la branche **`develop`** | 🟢 OUI | ☐ OUI / ☐ NON |
| D3 | **Retirer du dépôt** `front/assets/images/products/**` et `front/assets/images/categories/**` (inutilisés, images réelles sur Unsplash) — garde `placeholder.jpg` | 🟢 OUI (gain de données) | ☐ OUI / ☐ NON |
| D4 | **Exclure du serveur** `electron/`, `scripts/`, `tests/`, `docs/`, `electron-builder.yml`, docker-compose via **`.dockerignore` + Dockerfile** (exclusion efficace) | 🟢 OUI si on veut un déploiement réellement minimal | ☐ OUI / ☐ NON |
| D5 | **Protections GitHub** sur `main` : push direct interdit, 1 reviewer, statuts requis (CI verte) | 🟢 OUI | ☐ OUI / ☐ NON |
| D6 | **Protections GitHub** sur `develop` : push direct interdit (via PR), pas de force-push | 🟢 OUI (recommandé) | ☐ OUI / ☐ NON |
| D7 | **CI** : ajouter les triggers `develop`, `feature/*`, `hotfix/*` dans `build-desktop.yml` (+ étape `npm test`) | 🟢 OUI | ☐ OUI / ☐ NON |
| D8 | **Maintenir** `electron/`, `scripts/tests` dans le repo (juste non déployés) vs les **déplacer hors du repo** | 🟢 Garder dans le repo (exclus du déploiement) | ☐ Garder / ☐ Exclure du repo |
| D9 | Supprimer la branche locale `chore/01-restructure-front-back` après push | 🟢 OUI | ☐ OUI / ☐ NON |
| D10 | Mettre à jour `docs/ARCHITECTURE.md` et `docs/README.md` (anciens chemins) | 🟢 OUI | ☐ OUI / ☐ NON |

---

## <a name="plan"></a>4. Plan d'implémentation ordonné

> Chaque étape est une action concrète, exécutable en moins d'une session. À dérouler
> **après validation conjointe** de la section 3.

### Étape 0 — Sauvegarde et état zéro
- [ ] Vérifier `git status` propre sur `main` (déjà le cas).
- [ ] `git log --oneline --graph` : 2 commits attendus (`01634d7`, `44639bd`).

### Étape 1 — Publication de la base
- [ ] `git push -u origin main` (pousse `44639bd`).
- [ ] (Si D3 = OUI) branche `chore/03-rm-images-inutilisees` : supprimer les images
      produits/catégories non référencées + mise à jour si nécessaire, commit, merge
      sur `main` `--no-ff`, push.

### Étape 2 — Configuration des branches
- [ ] (D2) `git branch develop main` puis `git push -u origin develop`.
- [ ] (D9) `git branch -d chore/01-restructure-front-back`.

### Étape 3 — CI et déploiement
- [ ] (D7) Mettre à jour `.github/workflows/build-desktop.yml` : déclencheurs sur
      `develop`, `feature/*`, `hotfix/*` + job `npm test`.
- [ ] (D4) Créer `Dockerfile` + `.dockerignore` (exclusions serveur) — **uniquement si
      le déploiement passe en conteneur** (Render reste en runtime natif sinon).
- [ ] (D10) Mettre à jour `docs/ARCHITECTURE.md` et `docs/README.md` (chemins
      `back/`/`front/`, section déploiement minimal, lien vers ce plan).

### Étape 4 — Protections GitHub (réglages repo)
- [ ] (D5/D6) Sur `main` puis `develop` : activer
      *Require a pull request* + *Require status checks* + *Require branches up to
      date* + *No force push*.
- [ ] Vérifier `Actions` : une exécution de workflow sur un push de test (`feature/ci-check`).

### Étape 5 — Validation finale à deux
- [ ] Refaire `npm test` (23/23) sur `main`.
- [ ] Boot du serveur (SQLite) + `/health` 200.
- [ ] Vérifier le push reflète la structure (`back/`, `front/` sur GitHub, pas de
      `src/`, `views/` à la racine).

---

## <a name="acceptation"></a>5. Critères d'acceptation

| Critère | Cible |
|---|---|
| `git status` propre sur `main` | aucun changement |
| Branches distantes | `main`, `develop` présentes |
| Arborescence distante | `back/`, `front/`, `electron/`, `scripts/`, `tests/`, `docs/`, `.github/` |
| Aucun secret commité | `.env`, `*.sqlite`, `node_modules` absents |
| CI | verte sur un commit de test |
| Tests locaux | 23/23 |
| Déploiement (si Docker) | build image OK, exclusions respectées |
| Docs | chemins `back/`/`front/` à jour |

---

## <a name="roles"></a>6. Répartition des rôles à deux

| Tâche | Qui fait |
|---|---|
| Décisions D1–D10 | Les deux (validation conjointe) |
| Push `main` + création `develop` | Propriétaire du repo |
| Ligne de protection GitHub (settings) | Propriétaire du repo |
| Images inutilisées (D3) | Dev 2 (branche dédiée) |
| CI + `.dockerignore`/Dockerfile (D4/D7) | Dev 2 |
| Docs (D10) | Dev 2 |
| Vérifications finales (tests, boot) | Les deux |

---

## <a name="risques"></a>7. Risques et mitigations

| Risque | Mitigation |
|---|---|
| Push écrasant l'ancien `main` non structuré | Le push est un **nouveau** historique (commits `01634d7`/`44639bd`) ; aucun travail des autres n'existe encore. Confirmer avant. |
| Secrets dans l'historique | Vérifié : `.env`, `*.sqlite`, `node_modules` ignorés. |
| Confusion front/back chez les nouveaux devs | `docs/PLAN-BRANCHES-GIT.md` + conventions de nommage diffusés. |
| CI bloquée par la nonce/node-sqlite sur Linux CI | workflow existant à tester ; le job desktop build peut être long → optionnel pour garder la CI légère. |
| Force-push accidentel | Interdit par protections (§5). |

---

## <a name="post-validation"></a>8. Tâches post-validation (feuille de route produits)

- [ ] Migration des guides : `docs/PLAN-BRANCHES-GIT.md` lu par chaque nouveau dev.
- [ ] Corrections mineures restantes (code mort `fmtMoney`, `cartToken()`, fallback
      `Math.random()`) — à traiter via `feature/*` une fois les branches en place.
- [ ] Passe mobile (Capacitor) repensée proprement, sans dépendance à l'ancien `www/`.
- [ ] Suivi des limites restantes documentées dans `docs/AUDIT-CORRECTIONS.md` §8.

---

*Fin du plan — à valider point par point avant exécution.*