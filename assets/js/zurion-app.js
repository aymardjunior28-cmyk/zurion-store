/* ZURION demo storefront. Data is deliberately stored locally so the MVP works
 * without a server and can later be connected to a real API. */
(function () {
    'use strict';

    var KEYS = { products: 'zurion_products', cart: 'zurion_cart', wishlist: 'zurion_wishlist', orders: 'zurion_orders', profile: 'zurion_profile' };
    var money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 });
    var seed = [
        { id: 'buds-air', name: 'Écouteurs ZURION Air Buds', category: 'Audio', price: 18900, stock: 18, image: 'assets/images/demos/demo-3/products/product-1.jpg', description: 'Écouteurs sans fil, réduction de bruit et autonomie longue durée.' },
        { id: 'power-20k', name: 'Power bank ZURION 20 000 mAh', category: 'Charge', price: 24900, stock: 12, image: 'assets/images/demos/demo-3/products/product-2.jpg', description: 'Recharge rapide USB-C pour vos appareils du quotidien.' },
        { id: 'watch-fit', name: 'ZURION Fit Watch', category: 'Montres connectées', price: 32900, stock: 9, image: 'assets/images/demos/demo-3/products/product-3.jpg', description: 'Suivi d’activité, appels Bluetooth et notifications intelligentes.' },
        { id: 'speaker-mini', name: 'Enceinte Bluetooth Mini', category: 'Audio', price: 15900, stock: 24, image: 'assets/images/demos/demo-3/products/product-4.jpg', description: 'Un son puissant dans un format nomade.' },
        { id: 'desk-lamp', name: 'Lampe LED Smart Desk', category: 'Éclairage', price: 21900, stock: 7, image: 'assets/images/demos/demo-3/products/product-5.jpg', description: 'Éclairage ajustable et contrôle tactile.' },
        { id: 'gaming-pad', name: 'Manette Gaming Pro', category: 'Gaming', price: 28900, stock: 5, image: 'assets/images/demos/demo-3/products/product-6.jpg', description: 'Manette ergonomique compatible smartphone et ordinateur.' },
        { id: 'phone-stand', name: 'Support smartphone aluminium', category: 'Smartphones', price: 8500, stock: 30, image: 'assets/images/demos/demo-3/products/product-7.jpg', description: 'Support réglable pour bureau et visioconférences.' },
        { id: 'keyboard', name: 'Clavier compact sans fil', category: 'Informatique', price: 27500, stock: 11, image: 'assets/images/demos/demo-3/products/product-8.jpg', description: 'Clavier Bluetooth compact avec frappe silencieuse.' }
    ];

    function get(key, fallback) { try { var value = JSON.parse(localStorage.getItem(key)); return value || fallback; } catch (e) { return fallback; } }
    function set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
    function products() { var list = get(KEYS.products, null); if (!list) { set(KEYS.products, seed); return seed.slice(); } return list; }
    function cart() { return get(KEYS.cart, []); }
    function wishlist() { return get(KEYS.wishlist, []); }
    function esc(value) { return String(value).replace(/[&<>'"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]; }); }
    function product(id) { return products().filter(function (p) { return p.id === id; })[0] || products()[0]; }
    function cartItems() { return cart().map(function (line) { return { product: product(line.id), quantity: line.quantity }; }); }
    function total() { return cartItems().reduce(function (sum, line) { return sum + line.product.price * line.quantity; }, 0); }
    function updateBadges() {
        var count = cart().reduce(function (sum, line) { return sum + line.quantity; }, 0);
        document.querySelectorAll('.cart-count').forEach(function (node) { node.textContent = count; });
        document.querySelectorAll('.wishlist-count, .wishlist .badge').forEach(function (node) { node.textContent = wishlist().length; });
    }
    function addCart(id, quantity) {
        quantity = Number(quantity || 1);
        var p = product(id), list = cart(), line = list.filter(function (item) { return item.id === id; })[0];
        if (!p.stock) return toast('Ce produit est momentanément indisponible.');
        if (line) line.quantity = Math.min(line.quantity + quantity, p.stock); else list.push({ id: id, quantity: Math.min(quantity, p.stock) });
        set(KEYS.cart, list); updateBadges(); toast('Produit ajouté au panier.');
    }
    function toggleWishlist(id) {
        var list = wishlist(), at = list.indexOf(id);
        if (at === -1) { list.push(id); toast('Ajouté aux favoris.'); } else { list.splice(at, 1); toast('Retiré des favoris.'); }
        set(KEYS.wishlist, list); updateBadges();
    }
    function toast(message) {
        var notice = document.createElement('div'); notice.className = 'zurion-toast'; notice.textContent = message;
        notice.style.cssText = 'position:fixed;z-index:2000;right:20px;bottom:20px;background:#231f20;color:#fff;padding:14px 18px;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.2)';
        document.body.appendChild(notice); setTimeout(function () { notice.remove(); }, 2800);
    }
    function shell(title, content, actions) { return '<div class="container zurion-app"><div class="zurion-app__heading"><div><p class="text-primary mb-1">ZURION STORE</p><h1>' + title + '</h1></div>' + (actions || '') + '</div>' + content + '</div>'; }
    function card(p) { return '<article class="zurion-card"><a href="product.html?id=' + encodeURIComponent(p.id) + '"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + '"></a><div class="zurion-card__body"><p class="zurion-card__category">' + esc(p.category) + '</p><h3><a href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.name) + '</a></h3><p class="zurion-card__price">' + money.format(p.price) + '</p><p class="small">' + (p.stock ? p.stock + ' en stock' : 'Indisponible') + '</p><div class="zurion-card__actions"><button class="btn btn-primary" data-add="' + p.id + '" ' + (!p.stock ? 'disabled' : '') + '>Ajouter</button><button class="btn btn-outline-primary" data-favorite="' + p.id + '" aria-label="Favoris"><i class="icon-heart-o"></i></button></div></div></article>'; }
    function replacePage(content) { var page = document.querySelector('.page-content'); if (page) page.innerHTML = content; }
    function renderHome() {
        var featured = products().slice(0, 4).map(card).join('');
        var categories = [
            { label: 'Audio', detail: 'Écouteurs & enceintes', icon: 'icon-volume-up' },
            { label: 'Smartphones', detail: 'Accessoires essentiels', icon: 'icon-mobile-alt' },
            { label: 'Énergie', detail: 'Chargeurs & power banks', icon: 'icon-battery-full' },
            { label: 'Lifestyle tech', detail: 'Montres & maison connectée', icon: 'icon-watch' }
        ].map(function (c) { return '<a class="zurion-category" href="category.html?category=' + encodeURIComponent(c.label === 'Énergie' ? 'Charge' : c.label === 'Lifestyle tech' ? 'Montres connectées' : c.label) + '"><i class="' + c.icon + '"></i><strong>' + c.label + '</strong><span>' + c.detail + '</span></a>'; }).join('');
        var home = '<div class="container zurion-home"><section class="zurion-hero"><div class="zurion-hero__content"><p class="zurion-eyebrow">TECHNOLOGIE, SANS COMPLICATION</p><h1>Le quotidien,<br>en mieux connecté.</h1><p>Une sélection ZURION pensée pour mieux écouter, travailler, jouer et rester en mouvement.</p><a href="category.html" class="btn">Explorer le store <i class="icon-long-arrow-right"></i></a></div></section><section class="zurion-home-section"><div class="zurion-section-head"><div><h2>Choisissez votre univers</h2><p>Les essentiels technologiques pour chaque moment.</p></div><a href="category.html">Voir tout <i class="icon-long-arrow-right"></i></a></div><div class="zurion-category-grid">' + categories + '</div></section><section class="zurion-home-section"><div class="zurion-section-head"><div><h2>Les incontournables</h2><p>Une sélection prête à rejoindre votre quotidien.</p></div><a href="category.html">Voir le catalogue <i class="icon-long-arrow-right"></i></a></div><div class="zurion-grid">' + featured + '</div></section><section class="zurion-trust"><div><i class="icon-truck"></i><p><strong>Livraison suivie</strong><span>De la commande à la réception.</span></p></div><div><i class="icon-lock"></i><p><strong>Paiement sécurisé</strong><span>Des options adaptées à vos usages.</span></p></div><div><i class="icon-headphones"></i><p><strong>Support ZURION</strong><span>Une équipe disponible pour vous aider.</span></p></div></section></div>';
        var main = document.querySelector('main.main'); if (main) main.innerHTML = home;
    }
    function setupNavigation() {
        var page = location.pathname.split('/').pop() || 'index-3.html';
        var links = [
            { href: 'index-3.html', label: 'Accueil', active: page === 'index-3.html' || page === 'index.html' },
            { href: 'category.html', label: 'Catalogue', active: page.indexOf('category') === 0 },
            { href: 'wishlist.html', label: 'Favoris', active: page === 'wishlist.html' },
            { href: 'dashboard.html', label: 'Mon compte', active: page === 'dashboard.html' },
            { href: 'contact.html', label: 'Assistance', active: page.indexOf('contact') === 0 }
        ];
        var nav = '<ul class="zurion-nav">' + links.map(function (link) { return '<li><a href="' + link.href + '" class="' + (link.active ? 'zurion-nav__active' : '') + '">' + link.label + '</a></li>'; }).join('') + '</ul>';
        document.querySelectorAll('.main-nav').forEach(function (node) { node.innerHTML = nav; });
        document.querySelectorAll('.mobile-menu').forEach(function (node) { node.innerHTML = links.map(function (link) { return '<li><a href="' + link.href + '">' + link.label + '</a></li>'; }).join(''); });
        document.querySelectorAll('.logo').forEach(function (node) { node.href = 'index-3.html'; });
        document.querySelectorAll('.header-right .top-menu').forEach(function (node) { node.closest('.header-right').innerHTML = '<span class="zurion-top-message">Livraison suivie · Paiement sécurisé</span>'; });
        document.querySelectorAll('.cart-dropdown > a').forEach(function (node) { node.href = 'cart.html'; node.removeAttribute('data-toggle'); node.removeAttribute('data-display'); node.classList.remove('dropdown-toggle'); });
        document.querySelectorAll('.header .dropdown-menu, .header .megamenu, .header .category-dropdown, .header .compare-dropdown').forEach(function (node) { node.remove(); });
    }
    function renderCatalog() {
        var params = new URLSearchParams(location.search), query = (params.get('q') || '').toLowerCase(), category = params.get('category') || '';
        var list = products().filter(function (p) { return (!query || (p.name + ' ' + p.category).toLowerCase().indexOf(query) !== -1) && (!category || p.category === category); });
        var controls = '<form class="zurion-toolbar" id="zurion-catalog-form"><input class="form-control" name="q" value="' + esc(params.get('q') || '') + '" placeholder="Rechercher un produit"><select class="form-control" name="category"><option value="">Toutes les catégories</option>' + Array.from(new Set(products().map(function (p) { return p.category; }))).map(function (c) { return '<option ' + (c === category ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select><button class="btn btn-primary">Rechercher</button></form>';
        replacePage(shell('Catalogue', controls + (list.length ? '<div class="zurion-grid">' + list.map(card).join('') + '</div>' : '<div class="zurion-empty"><h2>Aucun produit trouvé</h2><p>Essayez une autre recherche.</p></div>')));
    }
    function renderProduct() {
        var p = product(new URLSearchParams(location.search).get('id'));
        var body = '<div class="row"><div class="col-lg-6"><div class="zurion-summary text-center"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" style="max-width:100%;max-height:420px;object-fit:contain"></div></div><div class="col-lg-6 mt-4 mt-lg-0"><p class="text-primary">' + esc(p.category) + '</p><h2>' + esc(p.name) + '</h2><p class="product-price" style="font-size:2.6rem">' + money.format(p.price) + '</p><p>' + esc(p.description) + '</p><p><strong>Disponibilité :</strong> ' + (p.stock ? p.stock + ' en stock' : 'Indisponible') + '</p><p><strong>Caractéristiques :</strong> Garantie 12 mois · Paiement sécurisé · Livraison suivie</p><div class="d-flex align-items-center" style="gap:1rem"><input id="zurion-product-quantity" class="form-control" style="width:90px" min="1" max="' + p.stock + '" value="1" type="number"><button class="btn btn-primary" data-add="' + p.id + '" ' + (!p.stock ? 'disabled' : '') + '>Ajouter au panier</button><button class="btn btn-outline-primary" data-favorite="' + p.id + '">Favoris</button></div></div></div>';
        replacePage(shell(p.name, body));
    }
    function renderCart() {
        var items = cartItems();
        if (!items.length) return replacePage(shell('Votre panier', '<div class="zurion-empty"><h2>Votre panier est vide</h2><p>Explorez notre sélection technologique et ajoutez vos produits préférés.</p><a class="btn btn-primary" href="category.html">Voir le catalogue</a></div>'));
        var rows = items.map(function (line) { var p = line.product; return '<div class="zurion-cart-row"><img src="' + esc(p.image) + '" alt=""><div><strong>' + esc(p.name) + '</strong><br><span class="text-primary">' + money.format(p.price) + '</span></div><input class="zurion-qty" type="number" min="1" max="' + p.stock + '" value="' + line.quantity + '" data-quantity="' + p.id + '"><strong class="zurion-line-price">' + money.format(p.price * line.quantity) + '</strong><button class="btn btn-link" data-remove="' + p.id + '" aria-label="Retirer"><i class="icon-close"></i></button></div>'; }).join('');
        var summary = '<div class="zurion-summary"><h2>Récapitulatif</h2><p class="d-flex justify-content-between"><span>Sous-total</span><strong>' + money.format(total()) + '</strong></p><p class="d-flex justify-content-between"><span>Livraison</span><strong>À confirmer</strong></p><hr><p class="d-flex justify-content-between"><strong>Total</strong><strong class="text-primary">' + money.format(total()) + '</strong></p><a class="btn btn-primary btn-block" href="checkout.html">Passer la commande</a></div>';
        replacePage(shell('Votre panier', '<div class="row"><div class="col-lg-8">' + rows + '</div><div class="col-lg-4 mt-4 mt-lg-0">' + summary + '</div></div>'));
    }
    function renderWishlist() { var ids = wishlist(); replacePage(shell('Vos favoris', ids.length ? '<div class="zurion-grid">' + ids.map(product).map(card).join('') + '</div>' : '<div class="zurion-empty"><h2>Vous n’avez pas encore de favoris</h2><a class="btn btn-primary" href="category.html">Découvrir les produits</a></div>')); }
    function renderCheckout() {
        var items = cartItems(); if (!items.length) { location.href = 'cart.html'; return; }
        var profile = get(KEYS.profile, {}), summary = '<div class="zurion-summary"><h2>Votre commande</h2>' + items.map(function (l) { return '<p class="d-flex justify-content-between"><span>' + esc(l.product.name) + ' × ' + l.quantity + '</span><strong>' + money.format(l.product.price * l.quantity) + '</strong></p>'; }).join('') + '<hr><p class="d-flex justify-content-between"><strong>Total</strong><strong class="text-primary">' + money.format(total()) + '</strong></p><p class="small">Paiement simulé et sécurisé pour cette démonstration.</p></div>';
        var form = '<form id="zurion-checkout-form" class="zurion-form"><h2>Livraison</h2><label for="z-name">Nom complet</label><input class="form-control" id="z-name" required value="' + esc(profile.name || '') + '"><label for="z-email">E-mail</label><input class="form-control" id="z-email" type="email" required value="' + esc(profile.email || '') + '"><label for="z-phone">Téléphone</label><input class="form-control" id="z-phone" required value="' + esc(profile.phone || '') + '"><label for="z-address">Adresse de livraison</label><textarea class="form-control" id="z-address" required>' + esc(profile.address || '') + '</textarea><label for="z-payment">Mode de paiement</label><select class="form-control" id="z-payment"><option>Paiement à la livraison</option><option>Mobile Money (simulation)</option><option>Carte bancaire (simulation)</option></select><button class="btn btn-primary" type="submit">Confirmer la commande</button></form>';
        replacePage(shell('Finaliser la commande', '<div class="zurion-checkout"><div>' + form + '</div><div>' + summary + '</div></div>'));
    }
    function renderDashboard() {
        var orders = get(KEYS.orders, []), profile = get(KEYS.profile, {}), admin = new URLSearchParams(location.search).get('admin') === '1';
        var ordersHtml = orders.length ? orders.map(function (o) { return '<div class="zurion-order"><div class="d-flex justify-content-between flex-wrap"><strong>Commande ' + esc(o.id) + '</strong><span class="zurion-status">' + esc(o.status) + '</span></div><p class="mb-0">' + esc(o.date) + ' · ' + o.items.length + ' produit(s) · <strong>' + money.format(o.total) + '</strong></p>' + (admin ? '<button class="btn btn-outline-primary mt-2" data-order-status="' + esc(o.id) + '">Mettre à jour le statut</button>' : '') + '</div>'; }).join('') : '<p>Aucune commande pour le moment.</p>';
        var account = '<div class="zurion-admin-grid"><section class="zurion-summary"><h2>Mon profil</h2><p>' + esc(profile.name || 'Client ZURION') + '<br>' + esc(profile.email || 'Ajoutez vos informations lors de la commande.') + '</p><a href="checkout.html" class="btn btn-outline-primary">Modifier via une commande</a></section><section><h2>Mes commandes</h2>' + ordersHtml + '</section></div>';
        var manage = '<section class="mt-5"><div class="d-flex justify-content-between align-items-center"><h2>Administration produits</h2><button class="btn btn-primary" id="zurion-add-product">Ajouter un produit</button></div><div id="zurion-admin-products" class="mt-3">' + products().map(function (p) { return '<div class="zurion-order d-flex justify-content-between align-items-center"><span><strong>' + esc(p.name) + '</strong><br><small>' + money.format(p.price) + ' · stock ' + p.stock + '</small></span><span><button class="btn btn-outline-primary" data-edit="' + p.id + '">Modifier</button> <button class="btn btn-outline-primary" data-disable="' + p.id + '">' + (p.stock ? 'Désactiver' : 'Activer') + '</button> <button class="btn btn-link" data-delete="' + p.id + '">Supprimer</button></span></div>'; }).join('') + '</div></section>';
        replacePage(shell(admin ? 'Back-office ZURION' : 'Mon espace ZURION', '<div class="zurion-notice">' + (admin ? 'Mode administrateur local : les modifications sont enregistrées dans ce navigateur.' : 'Suivez vos commandes et retrouvez vos informations de livraison.') + '</div>' + account + (admin ? manage : '<p class="mt-4"><a href="dashboard.html?admin=1">Accéder au mode administrateur</a></p>')));
    }
    function placeOrder(form) {
        var profile = { name: form.querySelector('#z-name').value.trim(), email: form.querySelector('#z-email').value.trim(), phone: form.querySelector('#z-phone').value.trim(), address: form.querySelector('#z-address').value.trim() };
        set(KEYS.profile, profile);
        var orders = get(KEYS.orders, []), order = { id: 'ZR-' + Date.now().toString().slice(-6), date: new Date().toLocaleDateString('fr-FR'), status: 'Paiement confirmé', total: total(), items: cartItems().map(function (l) { return { id: l.product.id, quantity: l.quantity }; }) };
        orders.unshift(order); set(KEYS.orders, orders); set(KEYS.cart, []); updateBadges();
        replacePage(shell('Commande confirmée', '<div class="zurion-empty"><i class="icon-check-circle" style="font-size:5rem;color:#2a7cbe"></i><h2>Merci pour votre commande !</h2><p>Votre référence est <strong>' + order.id + '</strong>. Son statut initial est : <span class="zurion-status">Paiement confirmé</span>.</p><a href="dashboard.html" class="btn btn-primary">Suivre ma commande</a></div>'));
    }
    function route() { var path = location.pathname.split('/').pop(); if (path === 'index-3.html' || path === 'index.html' || !path) renderHome(); else if (path === 'category.html' || path === 'category-4cols.html') renderCatalog(); else if (path === 'product.html' || path === 'product-extended.html' || path === 'single.html') renderProduct(); else if (path === 'cart.html') renderCart(); else if (path === 'wishlist.html') renderWishlist(); else if (path === 'checkout.html') renderCheckout(); else if (path === 'dashboard.html') renderDashboard(); }
    document.addEventListener('click', function (event) {
        var target = event.target.closest('[data-add], [data-favorite], [data-remove], [data-disable], [data-edit], [data-delete], [data-order-status], #zurion-add-product'); if (!target) return;
        event.preventDefault();
        if (target.dataset.add) { var quantity = document.getElementById('zurion-product-quantity'); addCart(target.dataset.add, quantity ? quantity.value : 1); }
        if (target.dataset.favorite) toggleWishlist(target.dataset.favorite);
        if (target.dataset.remove) { set(KEYS.cart, cart().filter(function (line) { return line.id !== target.dataset.remove; })); updateBadges(); renderCart(); }
        if (target.dataset.disable) { var list = products(); list.forEach(function (p) { if (p.id === target.dataset.disable) p.stock = p.stock ? 0 : 10; }); set(KEYS.products, list); renderDashboard(); }
        if (target.dataset.edit) { var editable = product(target.dataset.edit), price = prompt('Prix XAF :', editable.price), stock = prompt('Stock :', editable.stock); if (price !== null && stock !== null) { var updated = products(); updated.forEach(function (p) { if (p.id === editable.id) { p.price = Number(price); p.stock = Number(stock); } }); set(KEYS.products, updated); renderDashboard(); } }
        if (target.dataset.delete) { if (confirm('Supprimer ce produit ?')) { set(KEYS.products, products().filter(function (p) { return p.id !== target.dataset.delete; })); set(KEYS.cart, cart().filter(function (line) { return line.id !== target.dataset.delete; })); renderDashboard(); updateBadges(); } }
        if (target.dataset.orderStatus) { var statuses = ['Paiement confirmé', 'Préparation', 'Expédition', 'Livraison', 'Terminée'], nextOrders = get(KEYS.orders, []); nextOrders.forEach(function (o) { if (o.id === target.dataset.orderStatus) o.status = statuses[(statuses.indexOf(o.status) + 1) % statuses.length]; }); set(KEYS.orders, nextOrders); renderDashboard(); }
        if (target.id === 'zurion-add-product') { var name = prompt('Nom du produit :'); if (!name) return; var list = products(); list.push({ id: 'custom-' + Date.now(), name: name, category: 'Autres', price: Number(prompt('Prix (XAF) :') || 0), stock: Number(prompt('Stock :') || 0), image: 'assets/images/demos/demo-3/products/product-1.jpg', description: 'Produit ajouté depuis le back-office local.' }); set(KEYS.products, list); renderDashboard(); }
    });
    document.addEventListener('change', function (event) { if (event.target.matches('[data-quantity]')) { var list = cart(); list.forEach(function (line) { if (line.id === event.target.dataset.quantity) line.quantity = Math.max(1, Math.min(Number(event.target.value || 1), product(line.id).stock)); }); set(KEYS.cart, list); renderCart(); updateBadges(); } });
    document.addEventListener('submit', function (event) { if (event.target.id === 'zurion-checkout-form') { event.preventDefault(); placeOrder(event.target); } if (event.target.id === 'zurion-catalog-form') { event.preventDefault(); var data = new FormData(event.target), query = new URLSearchParams(); if (data.get('q')) query.set('q', data.get('q')); if (data.get('category')) query.set('category', data.get('category')); location.href = 'category.html?' + query.toString(); } });
    function start() { setupNavigation(); updateBadges(); route(); document.querySelectorAll('.header-search form, .mobile-search').forEach(function (form) { form.addEventListener('submit', function (event) { event.preventDefault(); var input = form.querySelector('input[type="search"]'); location.href = 'category.html?q=' + encodeURIComponent(input.value); }); }); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}());
