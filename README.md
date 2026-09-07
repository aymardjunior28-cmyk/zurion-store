# ZURION Store

MVP e-commerce Node.js/Express/EJS avec Sequelize et SQLite ou PostgreSQL.

## Installation

```bash
npm install
cp .env.example .env
npm run migrate
npm run seed
npm start
```

L’application est disponible sur `http://localhost:4173`.

## Configuration

Les variables sont documentées dans `.env.example`. En production, définir au
minimum `NODE_ENV=production`, `DATABASE_URL` et un `JWT_SECRET` aléatoire.
Pour PostgreSQL local sans TLS, utiliser `DB_SSL_ENABLED=false`; conserver
`true` avec une base hébergée correctement certifiée.

## Validation

```bash
npm test
npm run test:browser
npm run benchmark
```

Les tests navigateur nécessitent Chromium (`npx playwright install chromium`) et
couvrent les profils desktop, mobile et tablette.
Le benchmark est indicatif et doit être exécuté sur une base de test.

## Déploiement

1. Provisionner PostgreSQL et un rôle dédié.
2. Définir les variables d’environnement sans les committer.
3. Exécuter `npm run migrate`.
4. Démarrer avec `NODE_ENV=production npm start`.
5. Placer l’application derrière un reverse proxy HTTPS et vérifier
   `/health`.

Les paiements Mobile Money et carte restent simulés tant qu’un adaptateur
marchand réel n’est pas configuré. La checklist détaillée et les limites
connues sont dans [docs/VALIDATION.md](docs/VALIDATION.md).
