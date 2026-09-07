# Rapport de validation

Dernière validation : 7 septembre 2026.

## Résultats automatisés

Commande exécutée :

```bash
npm test
```

Résultat :

- 12 tests exécutés ;
- 12 tests réussis ;
- 0 échec ;
- 0 test annulé.

Scénarios couverts :

1. `GET /health`
2. refus d’un endpoint privé sans authentification
3. connexion administrateur et lecture de `/api/auth/me`
4. rendu de la page d’accueil
5. lecture du catalogue
6. ajout au panier puis création d’une commande
7. rendu de `/faq`
8. lecture de `/api/product-images`
9. CRUD SSR des livreurs (création, modification, suppression)
10. accessibilité des panneaux SSR d'administration et des routes directes
11. CRUD SSR des catégories et coupons
12. présence et fonctionnement des pages légales
13. CRUD API admin produits, catégories et coupons, plus lecture commandes/livraisons

Les scénarios de gestion regroupent plusieurs assertions dans un seul test.

## Démarrage

`npm start` a été vérifié avec succès :

```text
[db] Connexion OK (sqlite)
[db] Schéma synchronisé (SQLite)
[zurion] Server prêt sur http://localhost:4173
```

## Routes vérifiées manuellement

- `/`
- `/catalogue`
- `/contact`
- `/faq`
- `/panier`
- `/connexion`
- `/inscription`
- `/livraison`
- `/api/health`
- `/api/products`
- `/api/product-images`
- `/admin?tab=couriers`
- `/admin/livreurs`
- `/cgu`
- `/confidentialite`
- `/cookies`
- `/mentions-legales`

## Scénario métier intégré exécuté

Après réinitialisation par `npm run seed`, un scénario API a aussi vérifié :

- création, modification et suppression d’un produit ;
- création et activation d’un code promo ;
- ajout au panier invité ;
- commande avec remise fixe ;
- recalcul du total et décrémentation du stock ;
- progression de la commande jusqu’à `expédition` ;
- création automatique de la livraison ;
- passage de la livraison à `livrée` ;
- désactivation du code promo.

Le total remisé et le stock après commande ont été contrôlés sur les données
retournées par l’API.

## Contrôles de déploiement

- `npm start` démarre correctement en mode développement ;
- `npm start` démarre correctement avec `NODE_ENV=production`, `PORT` et `JWT_SECRET` définis ;
- sans `JWT_SECRET` explicite en production, la configuration doit refuser le démarrage ;
- `npm audit --omit=dev` signale encore des vulnérabilités transitives liées à
  `sqlite3`/`node-gyp`/`tar`, à `qs` et à `uuid`. Un `npm audit fix --force`
  n’a pas été appliqué car il propose des changements majeurs de versions.
- Les migrations versionnées ont été exécutées deux fois consécutivement avec
  `npm run migrate` : la première exécution applique l'initialisation, la
  seconde ne modifie rien et confirme l'idempotence.
- PostgreSQL 18.6 local : connexion, migration, seed et suite Node validés ;
  17 produits, 8 catégories et 1 commande de test étaient présents après le
  scénario.
- Le démarrage en mode production avec PostgreSQL a été validé sur le port
  `4181`. Pour cette instance locale sans TLS, `DB_SSL_ENABLED=false` est
  requis ; il doit rester à `true` sur une base hébergée avec TLS.
- Playwright : **9 tests réussis sur 9** sur Chromium desktop, mobile et tablette
  (viewport tactile 1024 × 1366).
- Benchmark local sans erreur sur 10 connexions pendant 10 secondes par route
  (dernière exécution) : `/health` 1 009 req/s, `/` 47 req/s,
  `/catalogue` 61 req/s, `/api/products` 1 350 req/s.

## Limites de cette validation

- La couverture de code n’est pas calculée.
- Les parcours SSR de produits et de livraisons restent à automatiser intégralement ;
  les catégories, coupons et livreurs sont couverts.
- La recette tablette automatisée couvre le rendu et les contrôles publics ; une
  recette manuelle complète sur appareil réel reste recommandée.
- Le benchmark est local et indicatif ; il ne remplace pas un test de charge
  distribué sur l’infrastructure cible.
- PostgreSQL 18.6 local est validé. Le serveur écoute sur `127.0.0.1:5432` et
  l’application utilise le rôle/base dédiés `zurion`.
- Le paiement réel n’est pas intégré.
- Un fournisseur PostgreSQL hébergé et son certificat TLS n’ont pas été testés.
- En production, les moyens Mobile Money et carte simulés sont désormais
  refusés par défaut (`ALLOW_SIMULATED_PAYMENTS=false`). L'intégration réelle
  MTN/Orange Cameroun reste conditionnée aux identifiants marchands et à
  l'activation du contrat opérateur.
- Les migrations versionnées créent le schéma sans opération destructive ; les
  évolutions futures devront être ajoutées sous forme de nouveaux fichiers de
  migration.
- Les pages d’informations légales du MVP sont présentes. Les coordonnées
  juridiques et d’hébergement doivent encore être remplacées par les
  informations de l’exploitant avant publication.

## Matrice de couverture actuelle

| Bloc checklist | Statut | Preuve |
| --- | --- | --- |
| Installation, démarrage, migration | Validé | `npm start`, `npm run migrate` |
| Catalogue et pages publiques | Validé partiellement | smoke + Playwright |
| Panier et commande | Validé sur scénario nominal | smoke + scénario métier |
| Stock et coupon | Validé sur scénario nominal | scénario métier documenté |
| Produits, catégories, commandes admin | Produits API, catégories/coupons SSR validés | smoke + scénario SSR |
| Livreurs et livraisons | Livreurs validés, livraisons partiel | smoke + service métier |
| Authentification et sécurité | Validé partiellement | smoke + inspection configuration |
| Responsive/accessibilité | Validé partiellement | Playwright desktop/mobile/tablette + contrôles de base |
| Performance | Indicatif | benchmark local |
| Paiement réel | Non livré | intégration opérateur requise |

Cette matrice ne remplace pas un audit juridique, un test de charge distribué
ou une recette sur l’infrastructure de production.

Ces limites sont volontairement documentées pour éviter de présenter le MVP comme entièrement certifié alors que seules les validations listées ont été exécutées.

## Tâches externes encore bloquantes

Les tâches suivantes ne peuvent pas être finalisées uniquement dans le dépôt :

- créer/configurer le dépôt et les workflows GitHub ;
- provisionner l’hébergement public, le domaine, le TLS et les sauvegardes ;
- fournir les coordonnées légales définitives de l’exploitant ;
- fournir les identifiants marchands et le contrat d’un prestataire de paiement réel ;
- valider PostgreSQL hébergé avec TLS et effectuer la recette de production.

Les dépendances npm présentent encore 12 vulnérabilités transitives avec
`npm audit --omit=dev`. Une correction forcée n’est pas appliquée automatiquement,
car elle implique des changements majeurs de dépendances et doit être validée
avec une stratégie de migration séparée.

Une copie annotée de la checklist originale est disponible dans
`Checklist Avancement ZURION - remplie.pdf`. Les coches vertes correspondent
aux éléments implémentés et vérifiés localement ; les éléments dépendant de
GitHub, d’un paiement réel ou d’une infrastructure de production restent
volontairement non cochés.
