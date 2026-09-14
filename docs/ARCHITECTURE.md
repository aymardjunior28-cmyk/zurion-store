# Architecture technique

## Vue d’ensemble

ZURION Store utilise un rendu serveur EJS et une API REST Express partageant les
mêmes services et modèles Sequelize. Le code est organisé en deux dossiers :
`back/` (serveur) et `front/` (templates EJS + statiques servis par Express).

```text
Navigateur
   ├── Pages SSR → back/src/routes/pages.js → services → modèles Sequelize
   └── API REST  → back/src/routes/api.js  → contrôleurs → services → modèles
                                                       ↓
                                               SQLite / PostgreSQL
```

## Couches

### Application

[back/src/app.js](../back/src/app.js) configure Express, Helmet, CSP, cookies, parsing JSON/formulaire, multipart, CSRF, fichiers statiques et gestion d’erreurs. Les vues et statiques sont résolus depuis `front/` (`front/views`, `front/public`, `front/assets`).

[back/server.js](../back/server.js) initialise les modèles, synchronise la base et démarre l’écoute HTTP.

### Routes

- `back/src/routes/pages.js` : pages boutique, compte, checkout et administration.
- `back/src/routes/api.js` : endpoints JSON publics, authentifiés et administrateur.

### Services

- `back/src/services/catalog.service.js` : recherche, filtres, tri, pagination, produits.
- `back/src/services/cart.service.js` : panier invité/connecté, limites de stock et fusion à la connexion.
- `back/src/services/order.service.js` : validation, transaction, stock, commandes et statuts.
- `back/src/services/coupon.service.js` : validation et consommation des coupons.
- `back/src/services/delivery.service.js` : livreurs et livraisons.
- `back/src/services/payment.service.js` : contrôle des moyens de paiement et blocage des
  simulations en production.
- `back/src/config/migrations.js` et `back/migrations/` : migrations de schéma versionnées.

### Données

Les modèles sont agrégés dans [back/src/models/index.js](../back/src/models/index.js). Les relations couvrent :

- utilisateurs, adresses et commandes ;
- catégories, produits, images, spécifications et avis ;
- paniers et lignes de panier ;
- coupons, favoris, livraisons et messages de contact.

## Flux de commande

1. Le client ajoute un produit avec un token de panier invité ou une session utilisateur.
2. Le checkout valide l’adresse, le paiement et le mode de livraison.
3. `order.service` ouvre une transaction.
4. Les produits et stocks sont relus dans la transaction.
5. La commande, ses lignes et la remise éventuelle sont enregistrées.
6. Le stock est décrémenté.
7. Le panier est vidé.
8. En cas d’erreur, la transaction est annulée.

## Configuration

Les variables sont centralisées dans `back/src/config/env.js` :

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `COOKIE_NAME`
- `SESSION_MAX_AGE_DAYS`
- `NODE_ENV`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `DB_SSL_ENABLED`
- `DB_SSL_REJECT_UNAUTHORIZED`
- `ALLOW_SIMULATED_PAYMENTS`

Copier `.env.example` vers `.env` pour la config locale ; ne jamais versionner un
vrai secret dans `.env`.

En production PostgreSQL, exécuter `npm run migrate` avant le démarrage d'une
nouvelle version. Le serveur applique également les migrations manquantes au
démarrage, sans opération destructive.

## Déploiement

- **Render** : `render.yaml` (runtime Node) — `npm ci` puis `npm start`
  (`node back/server.js`), base PostgreSQL, healthcheck sur `/health`.
- **Docker** : `Dockerfile` + `.dockerignore` — image serveur web uniquement
  (backend + front), sans Electron, scripts, tests ni docs.
