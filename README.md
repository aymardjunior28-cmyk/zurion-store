# ZURION Store — MVP web

Application e-commerce front-end pour ZURION, spécialisée dans les produits électroniques et accessoires technologiques.

## Lancer le projet

Le projet ne requiert ni installation ni serveur applicatif. Depuis le dossier du projet :

```bash
python3 -m http.server 4173
```

Ouvrir ensuite `http://localhost:4173/index-3.html`.

## Parcours disponibles

- Accueil : `index-3.html`
- Catalogue, recherche et catégories : `category.html`
- Détail produit : `product.html?id=buds-air`
- Panier : `cart.html`
- Favoris : `wishlist.html`
- Commande simulée : `checkout.html`
- Compte, commandes et suivi : `dashboard.html`
- Back-office local : `dashboard.html?admin=1`

## Fonctionnalités du MVP

- Catalogue filtrable et recherche.
- Fiches produits avec stock, quantité, ajout au panier et favoris.
- Panier persistant, modification des quantités et suppression.
- Checkout avec adresse, choix du paiement simulé et confirmation.
- Création de commande et suivi : paiement confirmé, préparation, expédition, livraison, terminée.
- Gestion locale des produits : ajout, modification, désactivation, suppression.

## Données

Le MVP utilise `localStorage` afin de rester fonctionnel sans API. Les données sont conservées seulement dans le navigateur courant. Pour remettre la démonstration à zéro, supprimer les clés `zurion_*` depuis les outils de développement du navigateur.

Pour passer en production, remplacer les appels de stockage dans `assets/js/zurion-app.js` par une API sécurisée, avec authentification et une base de données côté serveur.
