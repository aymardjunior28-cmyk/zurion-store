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
- API REST pour le catalogue, l’authentification, le panier, les commandes et les favoris.

## Prérequis

- Node.js 20 ou supérieur
- npm

## Installation

```bash
npm install
cp .env.example .env
```

La configuration par défaut utilise SQLite dans `data/zurion.sqlite`.

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
- l’accueil ;
- le catalogue ;
- le parcours panier → commande ;
- la FAQ ;
- l’API des images produit.

Les tests sont des smoke tests ciblés. Ils ne constituent pas une mesure de couverture exhaustive, responsive ou de performance.

## Structure

```text
server.js                 Point d’entrée HTTP
src/app.js                Configuration Express
src/routes/               Routes SSR et API
src/controllers/          Contrôleurs API
src/services/             Logique métier
src/models/               Modèles Sequelize et associations
src/middlewares/          Authentification, CSRF, validation, erreurs
views/                    Templates EJS
public/                   CSS et JavaScript client
scripts/                  Migration, seed et diagnostics
tests/                    Tests Node.js
data/                     Base SQLite locale
```

## Sécurité

- Hashage des mots de passe avec bcryptjs.
- Sessions JWT dans cookie `httpOnly`.
- Protection CSRF pour les mutations.
- Helmet avec Content Security Policy.
- Rate limiting sur l’API.
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
| GET | `/api/product-images?slug=...` | Galerie d’un produit |
| GET | `/api/suggestions?q=...` | Suggestions de recherche |
| GET/POST | `/api/cart` et `/api/cart/items` | Panier |
| POST | `/api/orders` | Créer une commande |
| GET | `/api/orders` | Commandes de l’utilisateur |
| GET/POST/DELETE | `/api/wishlist` | Favoris |

Les mutations API doivent fournir le jeton CSRF dans `X-CSRF-Token`.

## État connu

- Les paiements Mobile Money et carte bancaire sont simulés.
- PostgreSQL local peut être utilisé directement ou via Docker. Avec une
  installation système, créer une base et un rôle dédiés, définir
  `DATABASE_URL`, puis exécuter `npm run migrate`.
- Les tests navigateur et le benchmark sont maintenant disponibles, mais leurs
  résultats restent dépendants de la machine d’exécution.

Pour le détail technique, consulter [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) et [docs/VALIDATION.md](docs/VALIDATION.md).
