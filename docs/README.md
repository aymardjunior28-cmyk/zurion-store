# ZURION Store

MVP e-commerce construit avec Node.js, Express, EJS, Sequelize et SQLite.

## Fonctionnalités

- Accueil, catalogue, recherche, filtres, tri et pagination.
- Fiches produits avec galerie, spécifications et avis.
- Panier invité ou utilisateur connecté.
- Checkout avec livraison standard, express ou retrait.
- Paiement à la livraison et moyens de paiement simulés.
- Commandes, suivi de statut et historique client.
- Comptes client, adresses et favoris.
- Codes promotionnels.
- Contact, FAQ et informations livraison/retours.
- Back-office administrateur : produits, catégories, commandes, utilisateurs, coupons, livreurs et livraisons.
- API REST pour le catalogue, l'authentification, le panier, les commandes et les favoris.

### Système de livraison

- **Attribution de livraison** : le super-admin ou l'admin sélectionne une commande active
  et un livreur, puis saisit les informations du destinataire (nom, téléphone, adresse,
  ville, région) et la date/heure de livraison prévue pour créer une livraison.
- **Notifications enrichies** : à l'attribution, le livreur reçoit une notification avec le
  contact du client, le délai de livraison et la localisation. À la confirmation de livraison,
  les admin/super-admin reçoivent une notification avec le nom du livreur, son contact,
  l'identifiant de livraison et l'heure de notification.
- **Tableau de bord livreur** : colonnes Contact client, Destination et Livraison prévue.
  Bouton « Confirmer la livraison » (au lieu d'un select) qui notifie les administrateurs.
- **Voyants de statut** dans l'espace admin : vert (🟢 livrée), rouge (🔴 annulée),
  bleu (🔵 en cours) pour un suivi visuel rapide.
- **Annulation** : le super-admin ou l'admin peut annuler une livraison en cours ;
  le livreur ne peut plus la confirmer.
- **Suppression en masse** : cases à cocher + barre de sélection pour supprimer
  plusieurs éléments d'un coup depuis l'espace admin (produits, coupons, catégories,
  utilisateurs, livreur comptes).

## Prérequis

- Node.js 20 ou supérieur
- npm

## Installation

```bash
npm install
cp .env.example .env
```

La configuration par défaut utilise SQLite dans `back/data/zurion.sqlite`.

## Lancement

```bash
npm start
```

Application : <http://localhost:4173>

Mode développement avec rechargement automatique :

```bash
npm run dev
```

## Données de démonstration

Pour recréer la base avec les catégories, produits, comptes et coupons de démonstration :

```bash
npm run seed
```

Cette commande réinitialise la base SQLite locale. Elle est refusée en production.

## Tests

```bash
npm test
```

### Tests navigateur

Les tests Playwright couvrent Chromium desktop et mobile. Installation du
navigateur (une seule fois), puis exécution :

```bash
npx playwright install chromium
npm run test:browser
```

Le serveur est lancé automatiquement par Playwright. Pour tester une instance
déjà démarrée, définir `BASE_URL`.

### Benchmark HTTP

Après `npm start`, lancer :

```bash
npm run benchmark
```

Les paramètres sont configurables avec `BENCHMARK_URL`,
`BENCHMARK_DURATION` et `BENCHMARK_CONNECTIONS`. Utiliser une base de test,
jamais une base de production.

La suite actuelle couvre :

- le healthcheck ;
- la protection des endpoints privés ;
- la connexion administrateur ;
- l'accueil ;
- le catalogue ;
- le parcours panier → commande ;
- la FAQ ;
- l'API des images produit.

Les tests sont des smoke tests ciblés. Ils ne constituent pas une mesure de couverture exhaustive, responsive ou de performance.

## Structure

```text
back/
  server.js             Point d'entrée HTTP
  src/app.js            Configuration Express
  src/routes/           Routes SSR et API
  src/controllers/      Contrôleurs API
  src/services/         Logique métier
  src/models/           Modèles Sequelize et associations
  src/middlewares/      Authentification, CSRF, validation, erreurs
  src/config/           env, base de données, migrations
  migrations/           Migrations de schéma
  data/                 Base SQLite locale
front/
  views/                Templates EJS
  public/               CSS, JavaScript client, uploads
  assets/               Images et vidéos du thème
scripts/                Migration, seed et diagnostics
tests/                  Tests Node.js + specs Playwright
docs/                   Documentation
```

## Déploiement

- **Docker** : `docker build . -t zurion-store` puis lancer avec `DATABASE_URL`
  PostgreSQL, `JWT_SECRET` et `NODE_ENV=production`. L'image n'embarque que le
  serveur web (voir `Dockerfile` et `.dockerignore`).
- **Render** : voir `render.yaml` (runtime Node + base PostgreSQL).

Seul `back/` et `front/` sont nécessaires à l'exécution du serveur ; `electron/`,
`scripts/`, `tests/` et `docs/` ne sont pas déployés.

## Sécurité

- Hashage des mots de passe avec bcryptjs.
- Sessions JWT dans cookie `httpOnly`.
- Protection CSRF pour les mutations.
- Helmet avec Content Security Policy.
- Rate limiting sur l'API.
- Validation des entrées.
- Secret JWT obligatoire lorsque `NODE_ENV=production`.

## API principales

| Méthode | Route | Usage |
| --- | --- | --- |
| GET | `/api/health` | État du service |
| POST | `/api/auth/register` | Créer un compte |
| POST | `/api/auth/login` | Se connecter |
| GET | `/api/auth/me` | Utilisateur courant |
| GET | `/api/categories` | Catégories actives |
| GET | `/api/products` | Catalogue paginé |
| GET | `/api/products/:slug` | Produit détaillé |
| GET | `/api/product-images?slug=...` | Galerie d'un produit |
| GET | `/api/suggestions?q=...` | Suggestions de recherche |
| GET/POST | `/api/cart` et `/api/cart/items` | Panier |
| POST | `/api/orders` | Créer une commande |
| GET | `/api/orders` | Commandes de l'utilisateur |
| GET/POST/DELETE | `/api/wishlist` | Favoris |

Les mutations API doivent fournir le jeton CSRF dans `X-CSRF-Token`.

## État connu

- Les paiements Mobile Money et carte bancaire sont simulés.
- PostgreSQL local peut être utilisé directement ou via Docker. Avec une
  installation système, créer une base et un rôle dédiés, définir
  `DATABASE_URL`, puis exécuter `npm run migrate`.
- Les tests navigateur et le benchmark sont maintenant disponibles, mais leurs
  résultats restent dépendants de la machine d'exécution.

Pour le détail technique, consulter [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) et [docs/VALIDATION.md](docs/VALIDATION.md).
