# Architecture technique

## Vue d’ensemble

ZURION Store utilise un rendu serveur EJS et une API REST Express partageant les mêmes services et modèles Sequelize.

```text
Navigateur
   ├── Pages SSR → src/routes/pages.js → services → modèles Sequelize
   └── API REST  → src/routes/api.js   → contrôleurs → services → modèles
                                                      ↓
                                              SQLite / PostgreSQL
```

## Couches

### Application

[src/app.js](../src/app.js) configure Express, Helmet, CSP, cookies, parsing JSON/formulaire, multipart, CSRF, fichiers statiques et gestion d’erreurs.

[server.js](../server.js) initialise les modèles, synchronise SQLite et démarre l’écoute HTTP.

### Routes

- `src/routes/pages.js` : pages boutique, compte, checkout et administration.
- `src/routes/api.js` : endpoints JSON publics, authentifiés et administrateur.

### Services

- `catalog.service.js` : recherche, filtres, tri, pagination et produits.
- `cart.service.js` : panier invité/connecté, limites de stock et fusion à la connexion.
- `order.service.js` : validation, transaction, stock, commandes et statuts.
- `coupon.service.js` : validation et consommation des coupons.
- `delivery.service.js` : livreurs et livraisons.
- `payment.service.js` : contrôle des moyens de paiement et blocage des
  simulations en production.
- `src/config/migrations.js` et `migrations/` : migrations de schéma versionnées.

### Données

Les modèles sont agrégés dans [src/models/index.js](../src/models/index.js). Les relations couvrent :

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

Les variables sont centralisées dans `src/config/env.js` :

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `SESSION_MAX_AGE_DAYS`
- `NODE_ENV`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `DB_SSL_REJECT_UNAUTHORIZED`
- `ALLOW_SIMULATED_PAYMENTS`

Ne jamais versionner un vrai secret dans `.env`.

En production PostgreSQL, exécuter `npm run migrate` avant le démarrage d'une
nouvelle version. Le serveur applique également les migrations manquantes au
démarrage, sans opération destructive.
