/* ZURION Storefront — interactions JS vanilla (panier, favoris, recherche live, toasts) */
(function () {
  'use strict';

  var TOKEN_KEY = 'zurion_cart_token';

  function cartToken() {
    var t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      t = 'ct_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(TOKEN_KEY, t);
    }
    return t;
  }
  void cartToken; // conservé pour compatibilité

  window.ZURION = window.ZURION || {};

  // Le token du panier invité est fourni par le serveur (window.ZURION.cartToken),
  // rendu depuis le cookie httpOnly `zurion_cart` — le JS ne lit plus document.cookie.
  if (!window.ZURION.cartToken) {
    // Dernier recours (page sans layout) : token local unique.
    window.ZURION.cartToken = localStorage.getItem(TOKEN_KEY) || ('ct_' + Math.random().toString(36).slice(2) + Date.now().toString(36));
  }
  localStorage.setItem(TOKEN_KEY, window.ZURION.cartToken);

  function apiHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-Cart-Token': window.ZURION.cartToken,
      'X-CSRF-Token': (window.ZURION && window.ZURION.csrfToken) || ''
    };
  }

  /* ── Toast ───────────────────────────────────────────────────── */
  function toast(message, type) {
    var box = document.getElementById('zurion-toasts');
    if (!box) return;
    var el = document.createElement('div');
    el.className = 'zurion-toast' + (type ? ' is-' + type : '');
    el.textContent = message;
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, 2800);
  }
  window.zurionToast = toast;

  /* ── Compteurs header ────────────────────────────────────────── */
  function setCartCount(n) {
    document.querySelectorAll('[data-zurion-cart-count]').forEach(function (el) { el.textContent = n; });
  }
  function setWishCount(n) {
    document.querySelectorAll('[data-zurion-wish-count]').forEach(function (el) { el.textContent = n; });
  }

  function refreshCartCount() {
    fetch('/api/cart', { headers: apiHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) { setCartCount(data.count || 0); })
      .catch(function () {});
  }

  /* ── Ajout au panier ─────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var addBtn = e.target.closest('[data-add-to-cart]');
    if (addBtn) {
      e.preventDefault();
      var id = Number(addBtn.getAttribute('data-add-to-cart'));
      var qtyInput = addBtn.closest('.zurion-product__buy') ? addBtn.closest('.zurion-product__buy').querySelector('[data-qty-input]') : null;
      var qty = qtyInput ? Number(qtyInput.value) || 1 : 1;
      fetch('/api/cart/items', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ productId: id, quantity: qty })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (!res.ok) { toast(res.data.error || 'Impossible d\u2019ajouter', 'error'); return; }
          setCartCount(res.data.count || 0);
          toast('Produit ajouté au panier.', 'success');
        })
        .catch(function () { toast('Erreur réseau.', 'error'); });
      return;
    }

    var favBtn = e.target.closest('[data-wishlist-toggle]');
    if (favBtn) {
      e.preventDefault();
      var pid = Number(favBtn.getAttribute('data-wishlist-toggle'));
      var wasActive = favBtn.classList.contains('is-active');
      fetch(wasActive ? '/api/wishlist/' + pid : '/api/wishlist', {
        method: wasActive ? 'DELETE' : 'POST',
        headers: apiHeaders(),
        body: wasActive ? undefined : JSON.stringify({ productId: pid })
      })
        .then(function (r) {
          if (r.status === 401) { toast('Connectez-vous pour gérer vos favoris.', 'error'); return null; }
          return r.json();
        })
        .then(function (d) {
          if (!d) return;
          if (d.error) { toast(d.error, 'error'); return; }
          favBtn.classList.toggle('is-active', !wasActive);
          refreshWishlist();
        })
        .catch(function () { toast('Erreur réseau.', 'error'); });
      return;
    }
  });

  function refreshWishlist() {
    fetch('/api/wishlist', { headers: apiHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (d) { setWishCount((d.wishlist || []).length); })
      .catch(function () {});
  }

  /* ── Panier : quantités (démo, rechargement serveur) ────────── */
  document.addEventListener('click', function (e) {
    var minus = e.target.closest('[data-qty-minus]');
    var plus = e.target.closest('[data-qty-plus]');
    var qtyRow = e.target.closest('.zurion-qty');
    if ((minus || plus) && qtyRow) {
      var input = qtyRow.querySelector('[data-qty-input]');
      if (!input) return;
      var val = Number(input.value) || 1;
      if (minus) val = Math.max(1, val - 1);
      if (plus) val = Math.min(Number(input.max || 99), val + 1);
      input.value = val;
      // `data-cart-qty` est porté par l'INPUT (pas par le conteneur .zurion-qty).
      var cartBtn = input.getAttribute('data-cart-qty');
      if (cartBtn) {
        updateCartItem(Number(cartBtn), val);
      }
    }
  });

  document.addEventListener('change', function (e) {
    var input = e.target.closest('[data-cart-qty]');
    if (input) updateCartItem(Number(input.getAttribute('data-cart-qty')), Number(input.value) || 1);
  });

  function updateCartItem(productId, qty) {
    fetch('/api/cart/items/' + productId, {
      method: 'PUT',
      headers: apiHeaders(),
      body: JSON.stringify({ quantity: qty })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { toast(d.error, 'error'); return; }
        setCartCount(d.count || 0);
        if (document.getElementById('zurion-cart-discount')) { window.location.reload(); return; }
        if (d.subtotalFormatted) {
          var st = document.getElementById('zurion-subtotal'); if (st) st.textContent = d.subtotalFormatted;
          recomputeCartTotal();
          var ot = document.getElementById('zurion-order-total'); if (ot) recomputeTotal();
        }
        toast('Panier mis à jour.', 'success');
      })
      .catch(function () { toast('Erreur réseau.', 'error'); });
  }

  document.addEventListener('click', function (e) {
    var rm = e.target.closest('[data-cart-remove]');
    if (rm) {
      e.preventDefault();
      var pid = Number(rm.getAttribute('data-cart-remove'));
      fetch('/api/cart/items/' + pid, { method: 'DELETE', headers: apiHeaders() })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (!res.ok) { toast(res.data.error || 'Impossible de retirer l\u2019article', 'error'); return; }
          var d = res.data;
          if (document.getElementById('zurion-cart-discount')) { window.location.reload(); return; }
          if (d.count === 0) { window.location.reload(); return; }
          var row = rm.closest('[data-cart-row]');
          if (row) row.remove();
          setCartCount(d.count || 0);
          var st = document.getElementById('zurion-subtotal'); if (st) st.textContent = d.subtotalFormatted;
          recomputeCartTotal();
          toast('Article retiré du panier.', 'success');
        })
        .catch(function () { toast('Erreur réseau.', 'error'); });
    }
  });

  /* ── Cart : total estimé (sous-total − remise + livraison) ────── */
  function recomputeCartTotal() {
    var st = document.getElementById('zurion-subtotal');
    var sh = document.getElementById('zurion-shipping');
    var gt = document.getElementById('zurion-grand-total');
    if (!st || !sh || !gt) return;
    var subtotal = parseFloat(String(st.textContent).replace(/[^0-9]/g, '')) || 0;
    var shipping = parseFloat(String(sh.textContent).replace(/[^0-9]/g, '')) || 0;
    var discEl = document.getElementById('zurion-cart-discount');
    var discount = discEl ? parseFloat(String(discEl.textContent).replace(/[^0-9]/g, '')) || 0 : 0;
    var fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 });
    gt.textContent = fmt.format(Math.max(0, subtotal + shipping - discount));
  }

  /* ── Checkout : calcul livraison ────────────────────────────── */
  function recomputeTotal() {
    var feeEl = document.getElementById('zurion-delivery-fee');
    var totalEl = document.getElementById('zurion-order-total');
    var subtotalEl = document.getElementById('zurion-subtotal');
    if (!feeEl || !totalEl) return;
    var fee = 0;
    var checked = document.querySelector('[name=deliveryMode]:checked');
    if (checked && checked.getAttribute('data-delivery')) fee = Number(checked.getAttribute('data-delivery'));
    var subtotal = subtotalEl ? parseFloat(String(subtotalEl.textContent).replace(/[^0-9]/g, '')) || 0 : 0;
    var discountEl = document.getElementById('zurion-discount');
    var discount = discountEl ? parseFloat(String(discountEl.textContent).replace(/[^0-9]/g, '')) || 0 : 0;
    var fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 });
    feeEl.textContent = fmt.format(fee);
    totalEl.textContent = fmt.format(Math.max(0, subtotal + fee - discount));
  }
  document.addEventListener('change', function (e) {
    if (e.target.matches('[name=deliveryMode]')) recomputeTotal();
  });

  /* ── Galerie produit ────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var thumb = e.target.closest('[data-zurion-gallery-thumb]');
    if (!thumb) return;
    var main = document.getElementById('zurion-gallery-main');
    if (!main) return;
    main.src = thumb.getAttribute('data-zurion-gallery-thumb');
    var thumbs = document.querySelectorAll('[data-zurion-gallery-thumb]');
    thumbs.forEach(function (t) { t.classList.remove('is-active'); });
    thumb.classList.add('is-active');
  });

  /* ── Recherche live ─────────────────────────────────────────── */
  var searchToggle = document.querySelector('[data-zurion-search-toggle]');
  var searchBar = document.querySelector('[data-zurion-search]');
  var searchInput = document.querySelector('[data-zurion-search-input]');
  var suggestionsBox = document.querySelector('[data-zurion-suggestions]');

  if (searchToggle && searchBar) {
    searchToggle.addEventListener('click', function (e) {
      e.preventDefault();
      searchBar.hidden = !searchBar.hidden;
      if (!searchBar.hidden && searchInput) searchInput.focus();
    });
  }

  var searchTimer = null;
  if (searchInput && suggestionsBox) {
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      var q = searchInput.value.trim();
      if (q.length < 2) { suggestionsBox.hidden = true; return; }
      searchTimer = setTimeout(function () {
        fetch('/api/suggestions?q=' + encodeURIComponent(q))
          .then(function (r) { return r.json(); })
          .then(function (d) {
            suggestionsBox.innerHTML = '';
            (d.items || []).slice(0, 6).forEach(function (it) {
              var a = document.createElement('a');
              a.href = '/produit/' + it.slug;
              a.innerHTML = '<span></span><small></small>';
              a.querySelector('span').textContent = it.name;
              a.querySelector('small').textContent = it.priceFormatted;
              suggestionsBox.appendChild(a);
            });
            suggestionsBox.hidden = d.items.length === 0;
          })
          .catch(function () {});
      }, 250);
    });
    document.addEventListener('click', function (e) {
      if (!suggestionsBox.contains(e.target) && e.target !== searchInput) suggestionsBox.hidden = true;
    });
  }

  /* ── Menu mobile ────────────────────────────────────────────── */
  var burger = document.querySelector('[data-zurion-burger]');
  var menu = document.querySelector('[data-zurion-menu]');
  if (burger && menu) {
    burger.addEventListener('click', function () {
      menu.classList.toggle('is-open');
      if (!menu.classList.contains('is-open')) closeDropdowns();
    });
  }

  /* ── Dropdown Catalogue ─────────────────────────────────────── */
  document.querySelectorAll('[data-zurion-dropdown]').forEach(function (item) {
    var toggle = item.querySelector('[data-zurion-dropdown-toggle]');
    if (!toggle) return;
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var isOpen = item.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  });

  function closeDropdowns() {
    document.querySelectorAll('[data-zurion-dropdown].is-open').forEach(function (item) {
      item.classList.remove('is-open');
      var t = item.querySelector('[data-zurion-dropdown-toggle]');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  }

  document.addEventListener('click', function (e) {
    var open = document.querySelector('[data-zurion-dropdown].is-open');
    if (open && !open.contains(e.target)) closeDropdowns();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDropdowns();
  });

  /* ── Confirmation des actions destructives (forms data-confirm) ─ */
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      var allowed = true;
      try {
        allowed = window.confirm(form.getAttribute('data-confirm') || 'Confirmer cette action ?');
      } catch (err) {
        allowed = true; // environnement sans boîte de dialogue : ne bloque pas l'action
      }
      if (!allowed) e.preventDefault();
    });
  });

  /* ── Démarrage ──────────────────────────────────────────────── */
  refreshCartCount();
  refreshWishlist();
  recomputeTotal();
})();
