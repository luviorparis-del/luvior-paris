/* ============================================================
   LUVIOR PARIS — Shared Logic (Supabase Direct)
   ============================================================ */

const SUPABASE_URL = 'https://jvsudlhnnykpidyavxuq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c3VkbGhubnlrcGlkeWF2eHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MjE2MjgsImV4cCI6MjEwNTI5NzYyOH0.4URWWpEe-jQ34MkvrqCW0p3PlmAGRimCYAo1_ohejdc';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let PRODUCTS = [];
let COLLECTIONS = [];


async function loadProducts() {
    try {
        const { data } = await sb.from('products').select('*, product_images(*)').eq('status', 'active').order('created_at', { ascending: false });
        PRODUCTS = (data || []).map(p => {
            const primary = p.product_images?.find(i => i.is_primary) || p.product_images?.[0];
            return {
                id: p.id,
                name: p.name,
                slug: p.slug,
                notes: [p.top_notes, p.heart_notes, p.base_notes].filter(Boolean).join(' · ') || '',
                price: p.price || 0,
                compare_price: p.compare_price,
                category: p.fragrance_family || p.category || '',
                badge: p.new_arrival ? 'new' : (p.bestseller ? 'bestseller' : ''),
                image: primary?.image_url || null,
                short_description: p.short_description,
                volume: p.volume,
                concentration: p.concentration
            };
        });
    } catch (err) { console.error('Failed to load products:', err); }
}

async function loadCollections() {
    try {
        const { data } = await sb.from('collections').select('*').eq('status', 'active').order('sort_order');
        if (data && data.length) {
            COLLECTIONS = data.map(c => ({
                id: c.slug || c.id,
                name: c.name,
                subtitle: c.subtitle || '',
                description: c.description || '',
                image_url: c.image_url
            }));
        } else {
            COLLECTIONS = [
                { id: "floral", name: "Floral", subtitle: "Delicate Yet Bold", description: "Rose, jasmine, iris and luminous floral accords." },
                { id: "woody", name: "Woody", subtitle: "Earthy & Refined", description: "Cedarwood, sandalwood, vetiver and warm woods." },
                { id: "oriental", name: "Oriental", subtitle: "Rich & Evocative", description: "Amber, spice, resin, vanilla and deep sensual notes." },
                { id: "fresh", name: "Fresh", subtitle: "Clean & Timeless", description: "Citrus, bergamot, aquatic notes and crisp aromatics." }
            ];
        }
    } catch {
        COLLECTIONS = [
            { id: "floral", name: "Floral", subtitle: "Delicate Yet Bold", description: "Rose, jasmine, iris and luminous floral accords." },
            { id: "woody", name: "Woody", subtitle: "Earthy & Refined", description: "Cedarwood, sandalwood, vetiver and warm woods." },
            { id: "oriental", name: "Oriental", subtitle: "Rich & Evocative", description: "Amber, spice, resin, vanilla and deep sensual notes." },
            { id: "fresh", name: "Fresh", subtitle: "Clean & Timeless", description: "Citrus, bergamot, aquatic notes and crisp aromatics." }
        ];
    }
}

/* === Cart === */
let cart = [];

function loadCart() {
    try {
        const saved = localStorage.getItem('luvior_cart');
        if (saved) cart = JSON.parse(saved);
    } catch { cart = []; }
}

function saveCart() {
    try { localStorage.setItem('luvior_cart', JSON.stringify(cart)); } catch { }
}

function getCartCount() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
}

function getCartSubtotal() {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function addToCart(productId, qty = 1) {
    const pid = String(productId);
    const existing = cart.find(item => String(item.id) === pid);
    if (existing) {
        existing.qty += qty;
    } else {
        const product = PRODUCTS.find(p => String(p.id) === pid);
        if (product) {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                volume: product.volume || '',
                concentration: product.concentration || '',
                qty
            });
        } else {
            cart.push({ id: productId, name: 'Product', price: 0, image: null, volume: '', concentration: '', qty: 1 });
        }
    }
    saveCart();
    updateCartBadge();
    renderCartDrawer();
    showCartToast('Added to Cart');
}

function removeFromCart(productId) {
    const pid = String(productId);
    const index = cart.findIndex(item => String(item.id) === pid);
    if (index >= 0) {
        lastRemoved = { item: cart[index], index };
        clearTimeout(undoTimer);
        undoTimer = setTimeout(() => { lastRemoved = null; renderCartDrawer(); }, 6000);
    }
    cart = cart.filter(item => String(item.id) !== pid);
    saveCart();
    updateCartBadge();
    renderCartDrawer();
}

function updateCartQty(productId, delta) {
    const pid = String(productId);
    const item = cart.find(i => String(i.id) === pid);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
        removeFromCart(productId);
        return;
    }
    saveCart();
    updateCartBadge();
    renderCartDrawer();
}

function updateCartBadge() {
    const count = getCartCount();
    document.querySelectorAll('.header__cart-count').forEach(el => {
        el.textContent = count;
    });
}

/* === Cart Drawer === */
// Mirrors the delivery rule in the create_order() database function.
const FREE_DELIVERY_MIN = 10000;
const DELIVERY_FEE = 500;
const CONCENTRATIONS = { edp: 'Eau de Parfum', edt: 'Eau de Toilette', parfum: 'Parfum', cologne: 'Cologne', body_mist: 'Body Mist' };
let lastRemoved = null;
let undoTimer = null;
let cartReturnFocus = null;
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function injectCartDrawer() {
    if (document.getElementById('cart-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'cart-overlay';
    overlay.id = 'cart-overlay';
    overlay.addEventListener('click', closeCartDrawer);

    const drawer = document.createElement('aside');
    drawer.className = 'cart-drawer';
    drawer.id = 'cart-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-labelledby', 'cart-title');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = `
        <div class="cart-drawer__header">
            <h2 class="cart-drawer__title" id="cart-title">Your Cart <span class="cart-drawer__count" id="cart-count-label"></span></h2>
            <button class="cart-drawer__close" id="cart-drawer-close" aria-label="Close cart">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>
            </button>
        </div>
        <div class="cart-drawer__progress" id="cart-progress"></div>
        <div class="cart-drawer__items" id="cart-drawer-items" aria-live="polite"></div>
        <div class="cart-drawer__footer" id="cart-drawer-footer"></div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    document.getElementById('cart-drawer-close').addEventListener('click', closeCartDrawer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('active')) closeCartDrawer(); });
    drawer.addEventListener('click', e => {
        const t = e.target.closest('[data-cart-action]');
        if (!t) return;
        const id = t.dataset.id;
        switch (t.dataset.cartAction) {
            case 'minus': updateCartQty(id, -1); break;
            case 'plus': updateCartQty(id, 1); break;
            case 'remove': removeFromCart(id); break;
            case 'add': addToCart(id); break;
            case 'undo':
                if (lastRemoved) {
                    cart.splice(Math.min(lastRemoved.index, cart.length), 0, lastRemoved.item);
                    lastRemoved = null;
                    clearTimeout(undoTimer);
                    saveCart(); updateCartBadge(); renderCartDrawer();
                }
                break;
            case 'close': closeCartDrawer(); break;
        }
    });
}

function openCartDrawer() {
    cartReturnFocus = document.activeElement;
    syncCart();
    renderCartDrawer();
    const drawer = document.getElementById('cart-drawer');
    document.getElementById('cart-overlay')?.classList.add('active');
    drawer?.classList.add('active');
    drawer?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('cart-drawer-close')?.focus(), 50);
    if (!PRODUCTS.length) loadProducts().then(() => { syncCart(); renderCartDrawer(); });
}

function closeCartDrawer() {
    document.getElementById('cart-overlay')?.classList.remove('active');
    const drawer = document.getElementById('cart-drawer');
    drawer?.classList.remove('active');
    drawer?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (cartReturnFocus && typeof cartReturnFocus.focus === 'function') cartReturnFocus.focus();
}

// Refresh names, prices and images from live product data; flag items no longer sold.
function syncCart() {
    if (!PRODUCTS.length) return;
    let changed = false;
    cart.forEach(item => {
        const p = PRODUCTS.find(x => String(x.id) === String(item.id));
        const next = p
            ? { name: p.name, price: p.price, image: p.image, volume: p.volume || '', concentration: p.concentration || '', unavailable: false }
            : { unavailable: true };
        Object.entries(next).forEach(([k, v]) => { if (item[k] !== v) { item[k] = v; changed = true; } });
    });
    if (changed) { saveCart(); updateCartBadge(); }
}

function cartVariant(item) {
    const vol = item.volume ? String(item.volume).replace(/(\d)\s*ml/i, '$1 ml') : '';
    const conc = CONCENTRATIONS[item.concentration] || item.concentration || '';
    return [vol, conc].filter(Boolean).join(' · ');
}

function cartSuggestions(limit) {
    const inCart = new Set(cart.map(i => String(i.id)));
    return PRODUCTS.filter(p => !inCart.has(String(p.id))).slice(0, limit);
}

function suggestionsHtml(limit, title) {
    const list = cartSuggestions(limit);
    if (!list.length) return '';
    return `
        <div class="cart-suggest">
            <p class="cart-suggest__title">${title}</p>
            ${list.map(p => `
                <div class="cart-suggest__item">
                    <div class="cart-suggest__img">${p.image ? `<img src="${escHtml(p.image)}" alt="" loading="lazy">` : ''}</div>
                    <div class="cart-suggest__info">
                        <span class="cart-suggest__name">${escHtml(p.name)}</span>
                        <span class="cart-suggest__price">${inr(p.price)}</span>
                    </div>
                    <button class="cart-suggest__add" data-cart-action="add" data-id="${escHtml(p.id)}" aria-label="Add ${escHtml(p.name)} to cart">Add</button>
                </div>`).join('')}
        </div>`;
}

function renderCartDrawer() {
    const itemsEl = document.getElementById('cart-drawer-items');
    const footerEl = document.getElementById('cart-drawer-footer');
    const progressEl = document.getElementById('cart-progress');
    if (!itemsEl || !footerEl) return;

    const count = getCartCount();
    document.getElementById('cart-count-label').textContent = count ? `(${count})` : '';

    const undo = lastRemoved ? `
        <div class="cart-undo">
            <span>${escHtml(lastRemoved.item.name)} removed</span>
            <button data-cart-action="undo">Undo</button>
        </div>` : '';

    if (cart.length === 0) {
        progressEl.innerHTML = '';
        itemsEl.innerHTML = `${undo}
            <div class="cart-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                <p class="cart-empty__title">Your cart is empty</p>
                <p class="cart-empty__text">Discover a fragrance that feels like you.</p>
                <a href="collections.html" class="btn">Explore the Collection <span class="arrow">&rarr;</span></a>
            </div>
            ${suggestionsHtml(3, 'Our fragrances')}`;
        footerEl.innerHTML = '';
        return;
    }

    const billable = cart.filter(i => !i.unavailable);
    const subtotal = billable.reduce((s, i) => s + i.price * i.qty, 0);
    const delivery = subtotal >= FREE_DELIVERY_MIN ? 0 : DELIVERY_FEE;
    const remaining = Math.max(0, FREE_DELIVERY_MIN - subtotal);
    progressEl.innerHTML = `
        <p class="cart-progress__text">${remaining > 0 ? `You are <strong>${inr(remaining)}</strong> away from complimentary delivery` : 'Complimentary delivery unlocked'}</p>
        <div class="cart-progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(100, subtotal / FREE_DELIVERY_MIN * 100))}"><span style="width:${Math.min(100, subtotal / FREE_DELIVERY_MIN * 100)}%"></span></div>`;

    itemsEl.innerHTML = undo + cart.map(item => `
        <article class="cart-item${item.unavailable ? ' is-unavailable' : ''}">
            <div class="cart-item__image">${item.image ? `<img src="${escHtml(item.image)}" alt="${escHtml(item.name)}">` : `<span>${escHtml((item.name || '?').charAt(0))}</span>`}</div>
            <div class="cart-item__body">
                <div class="cart-item__top">
                    <h3 class="cart-item__name"><a href="${productUrl(PRODUCTS.find(p => String(p.id) === String(item.id)) || item)}">${escHtml(item.name)}</a></h3>
                    <span class="cart-item__line">${inr(item.price * item.qty)}</span>
                </div>
                ${cartVariant(item) ? `<p class="cart-item__variant">${escHtml(cartVariant(item))}</p>` : ''}
                ${item.qty > 1 ? `<p class="cart-item__each">${inr(item.price)} each</p>` : ''}
                ${item.unavailable ? '<p class="cart-item__warn">No longer available — remove to continue</p>' : ''}
                <div class="cart-item__bottom">
                    <div class="cart-item__qty" role="group" aria-label="Quantity for ${escHtml(item.name)}">
                        <button data-cart-action="minus" data-id="${escHtml(item.id)}" aria-label="Decrease quantity">&minus;</button>
                        <span aria-live="polite">${item.qty}</span>
                        <button data-cart-action="plus" data-id="${escHtml(item.id)}" aria-label="Increase quantity"${item.unavailable ? ' disabled' : ''}>+</button>
                    </div>
                    <button class="cart-item__remove" data-cart-action="remove" data-id="${escHtml(item.id)}">Remove</button>
                </div>
            </div>
        </article>
    `).join('') + suggestionsHtml(2, 'You may also like');

    footerEl.innerHTML = `
        <dl class="cart-summary">
            <div><dt>Subtotal</dt><dd>${inr(subtotal)}</dd></div>
            <div><dt>Delivery</dt><dd>${delivery ? inr(delivery) : 'Complimentary'}</dd></div>
            <div class="cart-summary__total"><dt>Total</dt><dd>${inr(subtotal + delivery)}</dd></div>
        </dl>
        <div class="cart-drawer__buttons">
            <button class="btn btn--filled" data-cart-action="close">Checkout</button>
            <button class="btn" data-cart-action="close">Continue Shopping</button>
        </div>
    `;
}

/* === Our Story statement: sequential line reveal === */
// Splits the (CMS-editable) statement into lines; one line is in focus at a time.
// Auto-advances while in view; hover/tap/focus picks a line, then the cycle resumes.
async function initStoryReveal() {
    const root = document.querySelector('.story-reveal');
    if (!root) return;
    await window.CMS?.ready;
    const lines = [];
    root.querySelectorAll('[data-cms]').forEach(block => {
        const parts = [];
        let current = '';
        block.childNodes.forEach(n => {
            if (n.nodeName === 'BR') { parts.push(current); current = ''; }
            else current += n.textContent;
        });
        parts.push(current);
        block.replaceChildren();
        parts.map(t => t.trim()).filter(Boolean).forEach((text, i) => {
            if (i) block.appendChild(document.createElement('br'));
            const span = document.createElement('span');
            span.className = 'reveal-line';
            span.textContent = text;
            span.tabIndex = 0;
            span.style.setProperty('--d', `${lines.length * 90}ms`);
            block.appendChild(span);
            lines.push(span);
        });
    });
    if (!lines.length || REDUCED_MOTION) { root.classList.add('is-static'); return; }

    root.classList.add('is-ready');
    let index = -1, timer = null, resumeTimer = null, inView = false, paused = false;
    const STEP = 2400;

    const activate = i => {
        index = (i + lines.length) % lines.length;
        lines.forEach((l, k) => {
            const on = k === index;
            if (on && !l.classList.contains('is-active')) {
                l.classList.remove('is-active');
                void l.offsetWidth; // restart the entrance animation
            }
            l.classList.toggle('is-active', on);
        });
    };
    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => {
        stop();
        if (!inView || paused || document.hidden) return;
        timer = setInterval(() => activate(index + 1), STEP);
    };

    new IntersectionObserver(([e]) => {
        inView = e.isIntersecting;
        if (inView) {
            root.classList.add('is-in');
            if (index < 0) setTimeout(() => { activate(0); start(); }, 900);
            else start();
        } else stop();
    }, { threshold: 0.35 }).observe(root);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

    const pick = l => { paused = true; clearTimeout(resumeTimer); stop(); activate(lines.indexOf(l)); };
    const release = () => { clearTimeout(resumeTimer); resumeTimer = setTimeout(() => { paused = false; start(); }, 1500); };
    lines.forEach(l => {
        l.addEventListener('mouseenter', () => pick(l));
        l.addEventListener('focus', () => pick(l));
        l.addEventListener('click', () => { pick(l); release(); });
    });
    root.addEventListener('mouseleave', release);
    root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) release(); });
}

/* === Search === */
function initSearch() {
    const buttons = document.querySelectorAll('.header__search-btn');
    if (!buttons.length) return;
    const overlay = document.createElement('div');
    overlay.className = 'search-overlay';
    overlay.id = 'search-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Search');
    overlay.hidden = true;
    overlay.innerHTML = `
        <div class="search-overlay__inner">
            <div class="search-overlay__bar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="search" id="search-input" placeholder="Search fragrances, notes, collections…" autocomplete="off" aria-label="Search" aria-controls="search-results">
                <button type="button" class="search-overlay__close" aria-label="Close search">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>
                </button>
            </div>
            <div class="search-overlay__results" id="search-results" aria-live="polite"></div>
        </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#search-input');
    const results = overlay.querySelector('#search-results');
    let returnFocus = null;

    const open = async () => {
        returnFocus = document.activeElement;
        overlay.hidden = false;
        requestAnimationFrame(() => overlay.classList.add('active'));
        document.body.style.overflow = 'hidden';
        input.focus();
        render();
        if (!PRODUCTS.length) { await loadProducts(); render(); }
        if (!COLLECTIONS.length) { await loadCollections(); render(); }
    };
    const close = () => {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => { overlay.hidden = true; }, 300);
        returnFocus?.focus?.();
    };

    function render() {
        const q = input.value.trim().toLowerCase();
        const terms = q.split(/\s+/).filter(Boolean);
        const hay = p => [p.name, p.notes, p.category, p.short_description, CONCENTRATIONS[p.concentration], p.volume].join(' ').toLowerCase();
        const products = (terms.length ? PRODUCTS.filter(p => terms.every(t => hay(p).includes(t))) : PRODUCTS).slice(0, 8);
        const cols = terms.length ? COLLECTIONS.filter(c => terms.every(t => `${c.name} ${c.subtitle} ${c.description}`.toLowerCase().includes(t))) : [];
        if (!PRODUCTS.length && !COLLECTIONS.length) { results.innerHTML = '<p class="search-empty">Loading…</p>'; return; }
        if (terms.length && !products.length && !cols.length) {
            results.innerHTML = `<p class="search-empty">No results for “${escHtml(input.value.trim())}”.</p><a href="collections.html" class="btn--ghost">Browse all fragrances <span class="arrow">&rarr;</span></a>`;
            return;
        }
        results.innerHTML = `
            <p class="search-label">${terms.length ? 'Fragrances' : 'All fragrances'}</p>
            <div class="search-list">${products.map((p, i) => `
                <a class="search-item${i === 0 && terms.length ? ' is-first' : ''}" href="${productUrl(p)}">
                    <span class="search-item__img">${p.image ? `<img src="${escHtml(p.image)}" alt="" loading="lazy">` : ''}</span>
                    <span class="search-item__info"><span class="search-item__name">${escHtml(p.name)}</span><span class="search-item__notes">${escHtml(p.notes)}</span></span>
                    <span class="search-item__price">${inr(p.price)}</span>
                </a>`).join('')}</div>
            ${cols.length ? `<p class="search-label">Collections</p><div class="search-cols">${cols.map(c => `<a href="collections.html#${encodeURIComponent(c.id)}" class="search-col">${escHtml(c.name)} <span class="arrow">&rarr;</span></a>`).join('')}</div>` : ''}`;
    }

    buttons.forEach(b => b.addEventListener('click', open));
    overlay.querySelector('.search-overlay__close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    input.addEventListener('input', render);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { const first = results.querySelector('.search-item'); if (first) window.location.href = first.href; }
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !overlay.hidden) close();
        if (e.key === '/' && overlay.hidden && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); open(); }
    });
}

/* === Cart Toast === */
let toastTimer = null;
function showCartToast(msg) {
    let toast = document.getElementById('cart-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'cart-toast';
        toast.id = 'cart-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    clearTimeout(toastTimer);
    requestAnimationFrame(() => {
        toast.classList.add('visible');
        toastTimer = setTimeout(() => toast.classList.remove('visible'), 2000);
    });
}

/* === Render Helpers === */
function productUrl(product) {
    return `product.html?p=${encodeURIComponent(product.slug || product.id)}`;
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.category = product.category;
    if (product.badge) card.dataset.badge = product.badge;
    const url = productUrl(product);
    const name = escHtml(product.name);
    card.innerHTML = `
        <a class="product-card__image" href="${url}" aria-label="${name}">
            ${product.image
                ? `<img src="${escHtml(product.image)}" alt="${name}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
                : `<div class="placeholder-image" style="width:100%;height:100%">${name}</div>`}
        </a>
        <h3 class="product-card__name"><a href="${url}">${name}</a></h3>
        <p class="product-card__notes">${escHtml(product.notes)}</p>
        <div class="product-card__bottom">
            <span class="product-card__price">${inr(product.price)}</span>
            ${product.compare_price > product.price ? `<span class="product-card__compare">${inr(product.compare_price)}</span>` : ''}
        </div>
        <button class="product-card__add-to-cart" data-id="${escHtml(product.id)}">Add to Cart</button>
    `;
    return card;
}

function createCollectionCard(collection) {
    const card = document.createElement('div');
    card.className = 'collection-card';
    card.innerHTML = `
        <div class="collection-card__image">
            ${collection.image_url
                ? `<img src="${collection.image_url}" alt="${collection.name}" style="width:100%;height:100%;object-fit:cover">`
                : `<div class="placeholder-image" style="width:100%;height:100%">${collection.name}</div>`}
        </div>
        <div class="collection-card__overlay"></div>
        <div class="collection-card__content">
            <h3 class="collection-card__title">${collection.name}</h3>
            <p class="collection-card__subtitle">${collection.subtitle}</p>
            <span class="collection-card__cta">Explore <span class="arrow">&rarr;</span></span>
        </div>
    `;
    card.addEventListener('click', () => {
        window.location.href = `collections.html#${collection.id}`;
    });
    return card;
}

function createArticleCard(article) {
    const card = document.createElement('a');
    card.className = 'article-card';
    card.href = `article.html?a=${encodeURIComponent(article.slug || slugify(article.title))}`;
    const imageWrap = document.createElement('div');
    imageWrap.className = 'article-card__image';
    if (article.cover && article.cover.src) setCoverImage(imageWrap, article.cover, article.title);
    else {
        const ph = document.createElement('div');
        ph.className = 'placeholder-image';
        ph.style.cssText = 'width:100%;height:100%';
        ph.textContent = article.category || '';
        imageWrap.appendChild(ph);
    }
    const cat = Object.assign(document.createElement('p'), { className: 'article-card__category', textContent: article.category || '' });
    const title = Object.assign(document.createElement('h3'), { className: 'article-card__title', textContent: article.title || '' });
    const meta = document.createElement('div');
    meta.className = 'article-card__meta';
    [article.date, '·', article.read_time || article.readTime].filter(Boolean).forEach(t => meta.appendChild(Object.assign(document.createElement('span'), { textContent: t })));
    const arrow = document.createElement('span');
    arrow.className = 'article-card__arrow';
    arrow.innerHTML = 'Read Story <span class="arrow">&rarr;</span>';
    card.append(imageWrap, cat, title, meta, arrow);
    return card;
}

/* === Mobile Menu === */
function initMobileMenu() {
    const toggle = document.querySelector('.header__menu-toggle');
    const menu = document.querySelector('.mobile-menu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        menu.classList.toggle('active');
        document.body.style.overflow = menu.classList.contains('active') ? 'hidden' : '';
    });

    menu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            toggle.classList.remove('active');
            menu.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
}

/* === Scroll Animations === */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!REDUCED_MOTION) document.documentElement.classList.add('anim');

// Containers whose children reveal one after another (hero excluded).
const STAGGER_SEL = '.product-grid, .lx-benefits__grid, .lx-testimonials__grid, .lx-collections__list, .faq-list, .journal-grid, .timeline, .ingredient-grid, .values-grid, .contact-options, .lx-split__text, .footer__top';

function indexStagger(container) {
    [...container.children].forEach((child, i) => child.style.setProperty('--i', Math.min(i, 8)));
}

function initScrollAnimations() {
    if (REDUCED_MOTION) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    const mo = new MutationObserver(muts => muts.forEach(m => indexStagger(m.target)));
    document.querySelectorAll(STAGGER_SEL).forEach(el => {
        if (el.closest('.hero')) return;
        el.classList.add('stagger');
        if (!el.classList.contains('fade-up')) el.classList.add('fade-up');
        indexStagger(el);
        mo.observe(el, { childList: true });
    });
    document.querySelectorAll('.lx-split__media, .footer').forEach(el => { if (!el.classList.contains('fade-up')) el.classList.add('fade-up'); });
    document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
    initDrift();
}

// Very subtle scroll-linked drift on cutout images (desktop only).
function initDrift() {
    if (!window.matchMedia('(min-width: 861px)').matches) return;
    const items = new Set();
    const io = new IntersectionObserver(entries => entries.forEach(e => e.isIntersecting ? items.add(e.target) : items.delete(e.target)), { rootMargin: '100px 0px' });
    document.querySelectorAll('.lx-cutout').forEach(el => io.observe(el));
    let ticking = false;
    const update = () => {
        const vh = window.innerHeight;
        items.forEach(el => {
            const r = el.getBoundingClientRect();
            const offset = (r.top + r.height / 2 - vh / 2) / vh;
            el.style.transform = `translate3d(0, ${(offset * -24).toFixed(1)}px, 0)`;
        });
        ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
}

/* === Scroll to Top === */
function initScrollTop() {
    const btn = document.querySelector('.scroll-top');
    const header = document.querySelector('.header');
    const isHomepage = document.body.classList.contains('page-homepage');

    const lightSections = isHomepage ? [...document.querySelectorAll('.section--white')] : [];
    window.addEventListener('scroll', () => {
        if (btn) btn.classList.toggle('visible', window.scrollY > 500);
        if (isHomepage && header) {
            header.classList.toggle('header--scrolled', window.scrollY > 80);
            const probe = header.offsetHeight / 2;
            const overLight = lightSections.some(s => {
                const r = s.getBoundingClientRect();
                return r.top <= probe && r.bottom >= probe;
            });
            header.classList.toggle('header--on-light', overLight);
        }
    }, { passive: true });

    btn?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

/* === Newsletter === */
function initNewsletter() {
    document.querySelectorAll('#newsletter-form, .newsletter__form').forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = form.querySelector('input[type="email"]');
            if (input && input.value) {
                const btn = form.querySelector('button');
                const original = btn.textContent;
                btn.textContent = 'Subscribed!';
                btn.disabled = true;
                input.value = '';
                setTimeout(() => {
                    btn.textContent = original;
                    btn.disabled = false;
                }, 3000);
            }
        });
    });
}

/* === Add to Cart Delegation === */
function initAddToCart() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.product-card__add-to-cart');
        if (!btn) return;
        const id = btn.dataset.id;
        addToCart(id);
        const original = btn.textContent;
        btn.textContent = 'Added ✓';
        btn.disabled = true;
        setTimeout(() => {
            btn.textContent = original;
            btn.disabled = false;
        }, 1500);
    });
}

/* === Cart Icon Click === */
function initCartIcon() {
    document.querySelectorAll('.header__icon[aria-label="Cart"]').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.preventDefault();
            openCartDrawer();
        });
    });
}

/* === FAQ Toggle === */
// Delegated so FAQ items rendered later from CMS content also toggle.
function initFAQ() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.faq-item__question');
        if (!btn) return;
        const item = btn.closest('.faq-item');
        const isOpen = item.classList.contains('open');
        item.closest('.faq-list').querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
        btn.setAttribute('aria-expanded', String(!isOpen));
    });
}

/* === Hero Slideshow from Supabase === */
let heroSlideTimer = null;
let heroCurrentSlide = 0;
let heroSlides = [];

async function loadHeroImage() {
    const slideshowEl = document.getElementById('hero-slideshow');
    if (!slideshowEl) return;

    try {
        const { data } = await sb.from('site_content').select('value').eq('key', 'hero_banner').single();
        if (!data || !data.value) return;

        const config = data.value;

        // Hero text content — admin-editable
        if (config.heading) {
            const el = document.getElementById('hero-title');
            if (el) el.innerHTML = config.heading;
        }
        if (config.subheading) {
            const el = document.getElementById('hero-subtitle');
            if (el) el.textContent = config.subheading;
        }
        if (config.label) {
            const el = document.getElementById('hero-label');
            if (el) el.textContent = config.label;
        }
        const ctaEl = document.getElementById('hero-cta');
        if (ctaEl) {
            if (config.cta_text) ctaEl.innerHTML = config.cta_text + ' <span class="arrow">&rarr;</span>';
            if (config.cta_link) ctaEl.href = config.cta_link;
        }

        // Hero content alignment — left / center / right
        const heroContent = document.getElementById('hero-content');
        if (heroContent && config.content_align) {
            heroContent.classList.remove('hero__content--centered', 'hero__content--left', 'hero__content--right');
            heroContent.classList.add('hero__content--' + config.content_align);
            const textWrap = heroContent.querySelector('.hero__text');
            if (textWrap) {
                textWrap.classList.remove('hero__text--centered');
                if (config.content_align === 'centered') textWrap.classList.add('hero__text--centered');
            }
        }

        // Overlay
        const overlay = document.querySelector('.hero__bg-gradient--center');
        if (config.overlay_opacity != null && overlay) {
            const op = Math.min(Math.max(config.overlay_opacity, 0), 1);
            overlay.style.background = `radial-gradient(ellipse at center, rgba(0,0,0,${op * 0.4}) 0%, rgba(0,0,0,${op}) 100%)`;
        }

        // Build slides array — backward compatible with single image_url
        const slides = config.slides || [];
        const activeSlides = slides.filter(s => s.active !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        // Fallback: old single-image config
        if (!activeSlides.length && config.image_url) {
            activeSlides.push({ image_url: config.image_url, mobile_image_url: config.mobile_image_url });
        }

        if (!activeSlides.length) return;

        heroSlides = activeSlides;
        const isMobile = window.innerWidth <= 768;
        const imgPosition = config.image_position || 'center center';
        const transitionDuration = (config.transition_duration || 1) * 1000;

        // Set transition duration from config
        slideshowEl.querySelectorAll('img').forEach(img => {
            img.style.transitionDuration = transitionDuration + 'ms';
        });

        // Create first slide immediately
        const firstUrl = isMobile && heroSlides[0].mobile_image_url ? heroSlides[0].mobile_image_url : heroSlides[0].image_url;
        const firstImg = document.createElement('img');
        firstImg.style.objectPosition = imgPosition;
        firstImg.style.transitionDuration = transitionDuration + 'ms';
        firstImg.alt = 'Luvior Paris Hero';
        firstImg.onload = () => firstImg.classList.add('active');
        firstImg.src = firstUrl;
        slideshowEl.appendChild(firstImg);
        heroCurrentSlide = 0;

        // Preload remaining slides
        for (let i = 1; i < heroSlides.length; i++) {
            const url = isMobile && heroSlides[i].mobile_image_url ? heroSlides[i].mobile_image_url : heroSlides[i].image_url;
            const img = document.createElement('img');
            img.style.objectPosition = imgPosition;
            img.style.transitionDuration = transitionDuration + 'ms';
            img.alt = 'Luvior Paris Hero';
            img.src = url;
            slideshowEl.appendChild(img);
        }

        // Start auto slideshow if enabled and multiple slides
        const autoEnabled = config.auto_slideshow !== false;
        const interval = (config.slide_interval || 5) * 1000;

        if (autoEnabled && heroSlides.length > 1) {
            heroSlideTimer = setInterval(() => {
                const imgs = slideshowEl.querySelectorAll('img');
                if (!imgs.length) return;
                imgs[heroCurrentSlide].classList.remove('active');
                heroCurrentSlide = (heroCurrentSlide + 1) % imgs.length;
                imgs[heroCurrentSlide].classList.add('active');
            }, interval);
        }
    } catch (err) {
        console.error('Hero slideshow load failed:', err);
    }
}

/* === Populate Homepage === */
async function initHomepage() {
    const featuredGrid = document.getElementById('featured-products');
    const collectionCards = document.getElementById('collection-cards');
    const heroSlideshow = document.getElementById('hero-slideshow');

    const tasks = [];
    if (featuredGrid || collectionCards) tasks.push(loadProducts(), loadCollections());
    if (heroSlideshow) tasks.push(loadHeroImage());

    await Promise.all(tasks);
    await window.CMS?.ready;

    if (featuredGrid) {
        PRODUCTS.slice(0, 4).forEach(p => featuredGrid.appendChild(createProductCard(p)));
    }
    if (collectionCards) {
        const asRows = collectionCards.classList.contains('lx-collections__list');
        COLLECTIONS.forEach((c, i) => collectionCards.appendChild(asRows ? createCollectionRow(c, i) : createCollectionCard(c)));
    }
    fillEditorialImages();
    renderSpecialOffer();
}

function createCollectionRow(collection, index) {
    const row = document.createElement('a');
    row.className = 'lx-collection-row';
    row.href = `collections.html#${encodeURIComponent(collection.id)}`;
    const num = document.createElement('span');
    num.className = 'lx-collection-row__num';
    num.textContent = String(index + 1).padStart(2, '0');
    const body = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'lx-collection-row__name';
    name.textContent = collection.name;
    const sub = document.createElement('span');
    sub.className = 'lx-collection-row__sub';
    sub.textContent = collection.subtitle || '';
    body.append(name, sub);
    const arrow = document.createElement('span');
    arrow.className = 'lx-collection-row__arrow';
    arrow.textContent = '→';
    arrow.setAttribute('aria-hidden', 'true');
    row.append(num, body, arrow);
    return row;
}

// Tries each candidate in order; first that loads wins. Slot stays empty if none load.
function setSlotImage(slot, candidates) {
    const list = candidates.filter(c => c && c.src);
    const tryNext = i => {
        if (i >= list.length) return;
        const img = new Image();
        img.alt = list[i].alt || '';
        if (list[i].photo) img.className = 'is-photo';
        img.onload = () => slot.replaceChildren(img);
        img.onerror = () => tryNext(i + 1);
        img.src = list[i].src;
    };
    tryNext(0);
}

// Cutout slots: drop a transparent PNG at the slot's data-cutout path to override;
// otherwise real Supabase product/collection imagery is used, else the space stays open.
function fillEditorialImages() {
    const productImages = PRODUCTS.filter(p => p.image).map(p => ({ src: p.image, alt: p.name, photo: true }));
    const collectionImage = COLLECTIONS.find(c => c.image_url);
    document.querySelectorAll('.lx-cutout[data-cutout]:not(#offer-image):not([data-cms-filled])').forEach(slot => {
        const candidates = [{ src: slot.dataset.cutout, alt: '' }];
        if (slot.dataset.editorialSlot !== undefined) {
            const i = parseInt(slot.dataset.editorialSlot, 10);
            if (i === 1 && collectionImage) candidates.push({ src: collectionImage.image_url, alt: collectionImage.name, photo: true });
            candidates.push(productImages[i] || productImages[0]);
        }
        if (slot.dataset.fallback) candidates.push({ src: slot.dataset.fallback, alt: '' });
        setSlotImage(slot, candidates);
    });
}

// Offer uses real admin data only: the product chosen in Website → Home → Special Offer,
// otherwise the active product with the largest compare_price discount. Countdown only
// shows when an end date is set, and the section hides itself once that date passes.
function renderSpecialOffer() {
    const section = document.getElementById('special-offer');
    if (!section) return;
    const chosenId = window.CMS ? CMS.setting('offer', 'product_id') : '';
    const endsAt = window.CMS ? CMS.setting('offer', 'ends_at') : '';
    const discounted = PRODUCTS
        .filter(p => p.compare_price && p.compare_price > p.price)
        .sort((a, b) => (b.compare_price - b.price) / b.compare_price - (a.compare_price - a.price) / a.compare_price);
    const p = (chosenId && PRODUCTS.find(x => String(x.id) === String(chosenId))) || discounted[0];
    if (!p) return;

    const end = endsAt ? new Date(endsAt).getTime() : null;
    if (end !== null && (isNaN(end) || end <= Date.now())) return;

    const inr = n => '₹' + Number(n).toLocaleString('en-IN');
    const hasDiscount = p.compare_price && p.compare_price > p.price;
    section.querySelector('#offer-name').textContent = p.name;
    section.querySelector('#offer-desc').textContent = p.short_description || p.notes || '';
    section.querySelector('#offer-price').textContent = inr(p.price);
    section.querySelector('#offer-compare').textContent = hasDiscount ? inr(p.compare_price) : '';
    section.querySelector('#offer-save').textContent = hasDiscount ? `Save ${Math.round((1 - p.price / p.compare_price) * 100)}%` : '';
    section.querySelector('#offer-save').hidden = !hasDiscount;
    section.querySelector('#offer-cta').dataset.id = p.id;
    const slot = section.querySelector('#offer-image');
    if (!slot.dataset.cmsFilled) setSlotImage(slot, [{ src: slot.dataset.cutout, alt: p.name }, { src: p.image, alt: p.name, photo: true }]);
    section.hidden = false;
    if (end !== null) startCountdown(section, end);
}

function startCountdown(section, end) {
    const box = section.querySelector('#offer-countdown');
    if (!box) return;
    const units = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
    const tick = () => {
        let left = end - Date.now();
        if (left <= 0) { clearInterval(timer); section.hidden = true; return; }
        Object.entries(units).forEach(([u, ms]) => {
            const v = Math.floor(left / ms);
            left -= v * ms;
            box.querySelector(`[data-unit="${u}"]`).textContent = String(v).padStart(2, '0');
        });
    };
    box.hidden = false;
    tick();
    const timer = setInterval(tick, 1000);
}

/* === Journal (articles managed in Website → Journal) === */
function slugify(t) {
    return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function journalArticles() {
    const items = window.CMS ? CMS.list('articles', 'articles') : [];
    return items.filter(a => a.published !== false && a.title).map(a => ({ ...a, slug: slugify(a.title) }));
}

async function initJournal() {
    await window.CMS?.ready;
    const articles = journalArticles();
    const featured = articles.find(a => a.featured);
    const fs = document.getElementById('journal-featured');
    if (fs) {
        if (!featured) fs.hidden = true;
        else {
            const set = (k, v) => { const el = fs.querySelector(`[data-jf="${k}"]`); if (el) el.textContent = v || ''; };
            ['category', 'title', 'description', 'date', 'read_time'].forEach(k => set(k, featured[k]));
            const link = fs.querySelector('[data-jf="link"]');
            if (link) link.href = `article.html?a=${encodeURIComponent(featured.slug)}`;
            const cover = fs.querySelector('[data-jf="cover"]');
            if (cover && featured.cover && featured.cover.src) setCoverImage(cover, featured.cover, featured.title);
        }
    }
    const grid = document.getElementById('journal-grid');
    if (grid) articles.filter(a => a !== featured).forEach(a => grid.appendChild(createArticleCard(a)));
}

function setCoverImage(el, cover, alt) {
    const img = document.createElement('img');
    img.src = cover.src;
    img.alt = alt || '';
    img.className = 'article-cover-img';
    el.classList.add('cms-has-img');
    el.replaceChildren(img);
}

/* === Init === */
document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    injectCartDrawer();
    initMobileMenu();
    initScrollAnimations();
    initScrollTop();
    initNewsletter();
    initAddToCart();
    initCartIcon();
    initFAQ();
    initSearch();
    initStoryReveal();
    initHomepage();
    updateCartBadge();
});
