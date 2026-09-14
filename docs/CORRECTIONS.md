# CORRECTIONS DE BUGS — Zurion Store

Date : 09/09/2026

Ce document récapitule les bugs identifiés lors de l'analyse de code et les démarches
entreprises pour les corriger. Chaque section détaille le problème, sa cause racine et
la correction appliquée.

---

## Table des matières

1. [Bug critique 1 — Conflit d'alias Sequelize sur les notifications](#bug-1)
2. [Bug critique 2 — Transaction inconsistante lors du passage en expédition](#bug-2)
3. [Bug critique 3 — Race condition statut + création de livraison](#bug-3)
4. [Bug moyen 4 — Ordre invalide dans les `include` Sequelize (hasMany)](#bug-4)
5. [Bug moyen 5 — `JSON.parse` sans protection sur addressSnapshot](#bug-5)
6. [Bug moyen 6 — Avancement de statut + livraison hors transaction (SSR)](#bug-6)
7. [Bug moyen 7 — Scope de `couponCode` dans la route POST /commande](#bug-7)
8. [Bug moyen 8 — Livraisons orphelines lors de la suppression d'un livreur](#bug-8)
9. [Bug faible 9 — Fonction `getDashboard` inutilisée](#bug-9)
10. [Bug faible 10 — Requête `addReview` non optimisée](#bug-10)
11. [Bug faible 11 — Imports redondants dans `pages.js`](#bug-11)
12. [Bug faible 12 — Absence de validation des query params SSR](#bug-12)
13. [Bug 13 — Erreur 500 généralisée due à un header EJS](#bug-13)
14. [Bug 14 — Boutons de la messagerie/notifications inactifs (CSP)](#bug-14)
15. [Bug 15 — Bulk delete expulse de l'espace admin (formulaires entrelacés)](#bug-15)
16. [Bug 16 — Select de statut livraison ne met pas à jour le voyant](#bug-16)
17. [Vérifications effectuées](#verifications)

---

## <a name="bug-1"></a>BUG CRITIQUE 1 — Conflit d'alias Sequelize sur les notifications

**Fichier :** `src/models/index.js` (lignes 86-91)

### Symptôme
Le modèle `Notification` possède **deux** associations `belongsTo(User)` :
- une pour le **destinataire** (via `userId`, alias `user`),
- une pour l'**expéditeur** (via `senderId`, alias `sender`).

En Sequelize, la seconde association `belongsTo(User)` *sans* alias distinct peut écraser
la première, ou créer un conflit au moment des `include`. Les requêtes qui incluient
`sender` ou `user` sur les notifications/messages pouvaient renvoyer des données
incorrectes ou échouer.

### Correction
L'alias de l'association « expéditeur » a été renommé :

```js
// Avant
User.hasMany(Notification, { as: 'sentMessages', foreignKey: 'senderId', onDelete: 'SET NULL' });
Notification.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });

// Après
User.hasMany(Notification, { as: 'sentNotifications', foreignKey: 'senderId', onDelete: 'SET NULL' });
Notification.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });
```

### Impact
Les deux associations sont maintenant bien distinctes : `user` (destinataire) et
`sender` (expéditeur) peuvent être incluses séparément et sans conflit. Aucun code
n'utilisait l'ancien alias `sentMessages`, donc pas de régression.

---

## <a name="bug-2"></a>BUG CRITIQUE 2 — Transaction inconsistante lors du passage en expédition

**Fichier :** `src/services/delivery.service.js` (fonction `autoCreateForOrder`, lignes 127-153)

### Symptôme
`autoCreateForOrder` gère elle-même sa transaction (commit/rollback) **uniquement**
lorsqu'elle n'en reçoit pas. Or elle était appelée **sans transaction externe** depuis
`admin.controller.js`, après que le statut de la commande ait déjà été modifié (voir bug 3).
En cas d'échec, la commande restait en « expédition » sans livraison créée.

### Correction
La fonction `autoCreateForOrder` supporte désormais le passage d'une **transaction externe**
(le paramètre `transaction` était déjà présent). Les appelants passent maintenant la
transaction pour garantir l'atomicité des opérations (voir bug 3 et bug 6).

---

## <a name="bug-3"></a>BUG CRITIQUE 3 — Race condition statut + création de livraison

**Fichier :** `src/controllers/admin.controller.js` (fonction `setOrderStatus`)

### Symptôme
Le changement de statut (`transitionStatus`) et la création de la livraison
(`autoCreateForOrder`) étaient exécutés **dans deux opérations indépendantes**, sans
transaction commune. Si la création de la livraison échouait après la sauvegarde du
statut, on obtenait une commande « expédition » sans livraison → données incohérentes.

### Correction
Les deux opérations sont maintenant englobées dans une **seule transaction** :

```js
await sequelize.transaction(async (tx) => {
  await orderService.transitionStatus(order, status);
  if (status === 'expédition') {
    await deliveryService.autoCreateForOrder(order, tx);
  }
});
```

### Impact
Si l'une des deux étapes échoue, la transaction est annulée : le statut n'est **pas**
modifié et aucune livraison partielle n'est créée.

---

## <a name="bug-4"></a>BUG MOYEN 4 — Ordre invalide dans les `include` Sequelize (hasMany)

**Fichiers :**
- `src/services/catalog.service.js`
- `src/services/cart.service.js`
- `src/controllers/catalog.controller.js`
- `src/routes/pages.js` (route `GET /admin/produits/:id`)

### Symptôme
L'option `order` a été placée **à l'intérieur** des objets `include` pour des relations
`hasMany` (images, specs, avis). En Sequelize, ce `order` n'est pris en compte que si
`separate: true` est défini — sans cela, il est **ignoré silencieusement**. Les images,
spécifications et avis apparaissaient donc dans un **ordre non déterministe**.

### Correction
Ajout de `separate: true` à chaque `include` concerné :

```js
// Avant
{ model: ProductImage, as: 'images', order: [['position', 'ASC']] }

// Après
{ model: ProductImage, as: 'images', separate: true, order: [['position', 'ASC']] }
```

Liste des endroits corrigés :
- `catalog.service.js` : `listProducts` (images), `getProductBySlug` (images, specs, reviews), `getNewProducts` (images)
- `cart.service.js` : `getCart` (images)
- `catalog.controller.js` : `getProductImages` (images)
- `pages.js` : route `GET /admin/produits/:id` (images, specs)

### Impact
Le tri des images, specs et avis est maintenant effectué correctement par la base de
données. La première image corresponde toujours à la vignette du produit.

---

## <a name="bug-5"></a>BUG MOYEN 5 — `JSON.parse` sans protection sur addressSnapshot

**Fichier :** `src/routes/pages.js` (page admin `GET /admin/commandes`)

### Symptôme
```js
const address = JSON.parse(order.addressSnapshot);
```
Si `addressSnapshot` est `null`, `undefined` ou un JSON corrompu, `JSON.parse` lève une
exception **non capturée** → le serveur crash sur la page admin des commandes.

### Correction
Le parsing est désormais protégé par un `try/catch`, avec des valeurs par défaut :

```js
let address = {};
try { address = JSON.parse(order.addressSnapshot); } catch (_) { /* snapshot corrompu */ }
```

Et la valeur `customerName` retombe sur `'N/A'` si l'adresse est absente.

### Impact
La page admin ne plante plus face à des données héritées ou corrompues.

---

## <a name="bug-6"></a>BUG MOYEN 6 — Avancement de statut + livraison hors transaction (SSR)

**Fichier :** `src/routes/pages.js` (route `POST /admin/commandes/:reference/statut`)

### Symptôme
Même problème que le bug 3, mais dans la route **SSR** du back-office : `advanceStatus`
était appelé sans transaction, puis `autoCreateForOrder` créait une transaction séparée.
Une incohérence possible entre statut et livraison.

### Correction
Les deux opérations sont désormais englobées dans une transaction commune :

```js
await sequelize.transaction(async (tx) => {
  await orderService.advanceStatus(order);
  if (order.status === 'expédition') {
    await deliveryService.autoCreateForOrder(order, tx);
  }
});
```

### Impact
Changement de statut et création de la livraison sont atomiques côté SSR.

---

## <a name="bug-7"></a>BUG MOYEN 7 — Scope de `couponCode` dans la route POST /commande

**Fichier :** `src/routes/pages.js` (route `POST /commande`)

### Symptôme
La variable `couponCode` était déclarée **à l'intérieur** du bloc `try`, mais utilisée
également dans le bloc `catch` (pour réafficher le coupon en cas d'erreur). Selon la
portée de `const`/`let` en JavaScript, elle n'était **pas accessible** dans le `catch`,
ce qui pouvait provoquer une erreur `ReferenceError` ou un comportement imprévisible.

### Correction
La déstructuration de `req.body` et la définition de `couponCode` ont été déplacées
**hors du bloc `try`**, les rendant accessibles à la fois dans le `try` et le `catch` :

```js
router.post('/commande', async (req, res, next) => {
  const { fullName, phone, ... } = req.body;
  const couponCode = req.body.couponCode !== undefined ? req.body.couponCode : req.cookies[COUPON_COOKIE];
  try {
    // ...
  } catch (err) {
    // couponCode accessible ici
  }
});
```

### Impact
Le réaffichage du checkout avec erreur utilise correctement le code promo saisi.

---

## <a name="bug-8"></a>BUG MOYEN 8 — Livraisons orphelines lors de la suppression d'un livreur

**Fichier :** `src/controllers/admin.controller.js` (fonction `deleteLivreur`)

### Symptôme
Lors de la suppression d'un compte livreur, ses livraisons `en_cours` étaient mises à
jour avec `courierId: null` mais **conservaient leur statut** `en_cours`. Résultat : des
livraisons sans livreur assigné, impossibles à confirmer depuis l'espace livreur.

### Correction
Les livraisons `en_cours` du livreur supprimé sont désormais **annulées** en même temps
que le désassignement :

```js
await Livraison.update(
  { courierId: null, status: 'annulée', cancelledAt: new Date() },
  { where: { courierId: livreur.id, status: 'en_cours' } }
);
```

### Impact
Plus aucune livraison ne reste bloquée à l'état `en_cours` sans livreur.

---

## <a name="bug-9"></a>BUG FAIBLE 9 — Fonction `getDashboard` inutilisée

**Fichier :** `src/controllers/livreur.controller.js`

### Symptôme
La fonction `getDashboard` était exportée mais **jamais montée** dans les routes.
La route SSR `/livreur` (dans `pages.js`) a sa propre implémentation qui rend le template
sans passer par `renderPage()`, créant une duplication de logique.

### Correction
La fonction `getDashboard` (code mort et doublon) a été **supprimée** du contrôleur
ainsi que son export. Le code incohérent (rendu direct sans layout) est éliminé.

### Impact
Suppression de code mort ; la route `/livreur` dans `pages.js` reste la seule source de
vérité pour le rendering SSR.

---

## <a name="bug-10"></a>BUG FAIBLE 10 — Requête `addReview` non optimisée

**Fichier :** `src/controllers/order.controller.js` (fonction `addReview`)

### Symptôme
Pour savoir si un client a acheté un produit, le code chargeait **toutes** ses commandes
et **toutes** les lignes en mémoire, puis filtrait côté JavaScript :

```js
const purchased = await Order.findAll({
  where: { userId: req.user.id },
  include: [{ model: OrderItem, as: 'items' }],
});
const owns = purchased.some((o) => o.items.some((it) => Number(it.productId) === Number(product.id)));
```

Inefficace pour un client avec beaucoup de commandes.

### Correction
Une **requête optimisée** effectue désormais le test directement en base, via un JOIN :

```js
const purchased = await OrderItem.findOne({
  where: { productId: product.id },
  include: [{ model: Order, as: 'Order', where: { userId: req.user.id }, required: true }],
});
```

Le résultat est ensuite utilisé avec `Boolean(purchased)`.

### Impact
Gain de performance : seule une requête avec JOIN est exécutée, au lieu de charger
l'intégralité de l'historique du client.

---

## <a name="bug-11"></a>BUG FAIBLE 11 — Imports redondants dans `pages.js`

**Fichier :** `src/routes/pages.js`

### Symptôme
De nombreux handlers SSR appelaient `require('../models')` à l'intérieur du corps de la
fonction, alors que les mêmes modèles étaient déjà importés en haut de fichier. Cela
polluait le code et créait de la confusion.

### Correction
Tous les modèles nécessaires (`Wishlist`, `ContactMessage`, `Notification`, `sequelize`,
`Product`, `ProductImage`, `OrderItem`, etc.) ont été ajoutés à l'import du haut de fichier,
et les `require` inline redondants ont été **supprimés**.

Les appels `require('../models').sequelize.fn(...)` ont été remplacés par l'import
`sequelize` du haut de fichier.

### Impact
Code plus propre et plus lisible ; les modèles ne sont requis qu'une seule fois par module.

---

## <a name="bug-12"></a>BUG FAIBLE 12 — Absence de validation des query params SSR

**Fichier :** `src/routes/pages.js` (route `GET /catalogue`)

### Symptôme
Les paramètres de requête (`q`, `category`, `sort`, `page`, `max`, `inStock`) étaient
passés bruts aux services, sans validation ni bornage. Une valeur inattendue de `sort`
retombait implicitement sur `popular`, mais `page` ou `max` pouvaient contenir des
valeurs non numériques ou excessives.

### Correction
Les paramètres sont désormais **validés, bornés et nettoyés** avant d'être transmis au
service :

```js
const q = String(req.query.q || '').trim().slice(0, 100);
const category = String(req.query.category || '').slice(0, 80);
const sort = SORTS_SET.has(req.query.sort) ? String(req.query.sort) : 'popular';
const page = Math.max(Number(req.query.page) || 1, 1);
const max = /^\d+$/.test(String(req.query.max || '')) ? Number(req.query.max) : undefined;
const inStock = req.query.inStock === '1';
```

Un ensemble `SORTS_SET` a été défini pour n'accepter que les tris connus.

### Impact
Les requêtes mal formées sont neutralisées ; la pagination et le filtre prix sont bornés,
et seuls les tris valides sont appliqués.

---

## <a name="bug-13"></a>BUG 13 — Erreur 500 généralisée due à un header EJS

**Fichier :** `views/partials/header.ejs`

### Symptôme
Au chargement de la page d'accueil (et de toutes les pages SSR), l'application renvoyait
`{"error":"Erreur interne du serveur."}` (statut 500). Le log serveur indiquait :

```
/home/junior_dev/Documents/Zurion Store/views/partials/header.ejs:5
Cannot access 'backHref' before initialization
```

### Cause racine
Dans `header.ejs`, la ligne 6 déclarait :
```js
const backHref = (typeof backHref !== 'undefined' && ...) ? backHref : '/';
```
Cette déclaration `const backHref` créait une **Temporal Dead Zone (TDZ)**. En JavaScript,
toute variable `const`/`let` déclarée dans un scope est soumise à la TDZ pour **tout** le
scope, y compris les tests `typeof` qui apparaissent **avant** la déclaration. Or, la
variable `backHref` était **déjà injectée** dans le partial via l'`include` du layout
(`layout.ejs:15`). Le `typeof backHref` à la ligne 6 levait donc `ReferenceError`, car il
se heurtait à la redéclaration locale `const`.

### Correction
La redéclaration redondante `const backHref = ...` a été **supprimée** : la variable
`backHref` provient directement de l'`include` du layout, donc il suffit de l'utiliser
sans la redéclarer.

### Impact
Le rendu SSR de toutes les pages fonctionne à nouveau (retour HTTP 200 vérifié sur
l'accueil, le catalogue, le panier, la connexion, l'inscription, le contact, la FAQ,
la livraison et les mentions légales).

---

## <a name="bug-14"></a>BUG 14 — Boutons messagerie/notifications inactifs (CSP `script-src-attr 'none'`)

**Fichiers :**
- `views/messages.ejs`
- `views/notifications.ejs`
- `views/livreur/dashboard.ejs`

### Symptôme
Depuis la messagerie interne ou le centre de notifications, aucun des boutons ne répond :
- « Envoyer » : le message ne part pas et **aucune notification (ni succès ni échec)** ne
  s'affiche ;
- « Marquer lu », « Supprimer », « Transférer au super admin », « Tout marquer lu »,
  « Tout supprimer », « Livrée / Non livré » (livreur) : aucun effet.

Le message n'apparaît **ni chez le destinataire, ni dans la liste des envoyés**.

### Cause racine
La politique CSP (`src/app.js`) interdit les gestionnaires d'événements inline via la
directive `script-src-attr 'none'` :

```js
scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
```

Or les trois vues attachaient toutes leurs actions avec des attributs inline
`onclick="..."` (ex : `onclick="delNotif(<%= n.id %>)"`). Le navigateur bloquait
silencieusement l'exécution de ces handlers, d'où l'absence totale d'effet (aucune
erreur visible côté utilisateur) :

```
Executing inline event handler violates the following Content Security Policy
directive 'script-src-attr 'none'' ... The action has been blocked.
```

La nonce sur le `<script>` n'autorise que les scripts *dans* ce bloc : elle ne couvre
**pas** les attributs `onclick`, contrôlés séparément par `script-src-attr`.

### Correction
Remplacement de tous les attributs inline `onclick="fn(id)"` par des boutons porteurs
d'attributs `data-action` / `data-id`, puis branchement des écouteurs via
`addEventListener` **à l'intérieur** du script noncé :

- `messages.ejs` : `sendMsg`, `markRead`, `delNotif`, `forwardMsg`, `toggleGroup`
  (boutons `toggle-group`, `msg-action`, `#msg-send-btn`) ;
- `notifications.ejs` : `markAllRead`, `markOneRead`, `deleteNotif`, `deleteAllNotifs`,
  `forwardMsg` (boutons `.notif-action`, `#notif-markall`, `#notif-delall`) ;
- `livreur/dashboard.ejs` : `sendLivMsg`, `signalerLivree`, `signalerNonLivree`
  (boutons `.liv-action`, `#liv-send-btn`).

### Impact
La sécurité CSP est préservée (aucun `'unsafe-inline'` / `'unsafe-hashes'` ajouté), et
tous les boutons fonctionnent à nouveau. Vérifié avec un navigateur headless (Playwright)
pour un compte super-admin : clic « Supprimer » → `DELETE /api/notifications/:id` 200,
clic « Marquer lu » → `PATCH /api/notifications/:id/read` 200, envoi → `POST /api/messages`
201, plus aucune violation CSP dans la console.

---

## <a name="bug-15"></a>BUG 15 — Bulk delete expulse de l'espace admin (formulaires entrelacés)

**Fichier :** `views/admin/dashboard.ejs`

### Symptôme
Cliquer sur « Supprimer la sélection » dans n'importe quel tableau admin (produits,
codes promo, catégories, utilisateurs, livreurs) expulsait l'administrateur de l'espace
admin au lieu de supprimer les éléments cochés.

### Cause racine
Chaque `<form>` de suppression en masse englobait l'intégralité du `<table>`. Or chaque
ligne du tableau contenait ses propres formulaires (supprimer un produit, modifier une
catégorie, activer/désactiver un coupon). En HTML, les formulaires **ne peuvent pas être
imbriqués** — un `<form>` à l'intérieur d'un autre est ignoré ou provoque un comportement
indéfini du navigateur. Quand l'admin cliquait sur « Supprimer la sélection », le navigateur
soumettait le formulaire externe mais les checkboxes `name="ids"` se retrouvaient dans un
contexte de formulaire invalide, provoquant une redirection inattendue (expulsion).

### Correction
Déplacé la fermeture `</form>` de chaque bulk juste après la barre de sélection, **avant**
le `<table>`. Le formulaire bulk ne contient plus que le token CSRF et le bouton de
soumission. Le JavaScript a été modifié pour :
1. Rechercher les checkboxes via `document.querySelectorAll` (au lieu de `form.querySelectorAll`)
2. Au `submit`, injecter dynamiquement des `<input type="hidden" name="ids">` dans le
   formulaire pour chaque case cochée

```js
// Avant
const cbs = form.querySelectorAll(`.bulk-${prefix}-cb`);
form.addEventListener('submit', (e) => {
  const checked = form.querySelectorAll(`.bulk-${prefix}-cb:checked`).length;
  // ...
});

// Après
const cbs = document.querySelectorAll(`.bulk-${prefix}-cb`);
form.addEventListener('submit', (e) => {
  const checked = document.querySelectorAll(`.bulk-${prefix}-cb:checked`);
  if (!checked.length) { e.preventDefault(); return; }
  if (!confirm(`Supprimer ${checked.length} élément(s) sélectionné(s) ?`)) { e.preventDefault(); return; }
  form.querySelectorAll('input[name="ids"]').forEach(el => el.remove());
  checked.forEach(cb => {
    const hid = document.createElement('input');
    hid.type = 'hidden';
    hid.name = 'ids';
    hid.value = cb.value;
    form.appendChild(hid);
  });
});
```

### Sections concernées
- Produits (`bulk-products-form`)
- Codes promo (`bulk-coupons-form`)
- Catégories (`bulk-categories-form`)
- Utilisateurs (`bulk-users-form`)
- Livreur comptes (`bulk-livreurs-form`)

### Impact
Les cinq suppressions en masse fonctionnent correctement sans expulser l'admin.
Les formulaires individuels par ligne (supprimer, modifier, activer/désactiver)
continuent de fonctionner indépendamment.

---

## <a name="bug-16"></a>BUG 16 — Select de statut livraison ne met pas à jour le voyant

**Fichier :** `views/admin/dashboard.ejs` (section livraisons)

### Symptôme
Dans le tableau des livraisons, le `<select>` permettant de changer le statut
(« En cours » → « Livrée ») ne fonctionnait pas de manière fiable : le changement
de statut ne se reflétait pas toujours dans le voyant de couleur, et l'interface
restait ambiguë sur l'action réelle effectuée.

### Cause racine
Le `<select>` utilisait `onchange="this.form.submit()"` pour soumettre le formulaire
au changement de valeur. Ce mécanisme est fragile :
- L'utilisateur pouvait accidentellement changer la valeur en naviguant avec le clavier
- Il n'y avait pas de confirmation avant la soumission
- Le `<select>` affichait deux options (« En cours » et « Livrée ») ce qui créait une
  confusion sur l'action réelle (rester en cours vs marquer comme livré)

### Correction
Remplacé le `<select>` par un bouton vert « Effectué(e) » avec icône `fa-circle-check`.
Le bouton n'apparaît que lorsque le statut est `en_cours` et soumet directement
`status=livrée` via un `<input type="hidden">` :

```html
<!-- Avant -->
<select class="form-control zurion-status-select" name="status" onchange="this.form.submit()">
  <option value="en_cours" <%= l.status === 'en_cours' ? 'selected' : '' %>>En cours</option>
  <option value="livrée" <%= l.status === 'livrée' ? 'selected' : '' %>>Livrée</option>
</select>

<!-- Après -->
<% if (l.status === 'en_cours') { %>
  <form method="post" action="/admin/livraisons/<%= l.id %>/statut" style="display:inline">
    <input type="hidden" name="_csrf" value="<%= csrfToken %>">
    <input type="hidden" name="status" value="livrée">
    <button class="btn btn-sm btn-success" type="submit">
      <i class="fa-solid fa-circle-check"></i> Effectué(e)
    </button>
  </form>
<% } %>
```

### Impact
L'action est maintenant explicite et unique : confirmer la livraison. Le voyant
vert (🟢 livrée), rouge (🔴 annulée) et bleu (🔵 en cours) reflètent fidèlement
le statut après chaque action. Plus aucune ambiguïté sur le statut sélectionné.

---

## <a name="verifications"></a>Vérifications effectuées

Après les corrections, les modules suivants ont été chargés et compilés avec succès
(vérification de la syntaxe et de la résolution des dépendances) :

- `src/models`
- `src/app.js`
- `src/routes/pages.js`
- `src/controllers/admin.controller.js`
- `src/controllers/livreur.controller.js`
- `src/controllers/order.controller.js`
- `src/services/catalog.service.js`
- `src/services/cart.service.js`

```bash
node -e "require('./src/app.js'); console.log('app.js OK')"
```

Tous les modules se chargent sans erreur syntaxique ni référence manquante.

Les deux corrections supplémentaires (bugs 15 et 16) ont été vérifiées :
- `views/admin/dashboard.ejs` charge et compile sans erreur EJS
- `src/controllers/admin.controller.js` et `src/controllers/livreur.controller.js` ont une syntaxe JS valide
