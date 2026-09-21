/* ============================================================
   LUVIOR PARIS — Shared Logic (Supabase Direct)
   ============================================================ */

const SUPABASE_URL = 'https://jvsudlhnnykpidyavxuq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c3VkbGhubnlrcGlkeWF2eHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MjE2MjgsImV4cCI6MjEwNTI5NzYyOH0.4URWWpEe-jQ34MkvrqCW0p3PlmAGRimCYAo1_ohejdc';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let PRODUCTS = [];
let COLLECTIONS = [];

const JOURNAL_ARTICLES = [
    { id: 1, category: "The Art of Fragrance", title: "Why Scent Becomes Memory", description: "The science and poetry behind how fragrance anchors itself to our most vivid recollections.", date: "Sep 12, 2024", readTime: "6 min read", featured: true },
    { id: 2, category: "Ingredients", title: "The Art of Layering Fragrance", description: "How to combine scents for a signature that is uniquely yours.", date: "Aug 28, 2024", readTime: "5 min read", featured: false },
    { id: 3, category: "Craftsmanship", title: "Inside the World of Oud", description: "One of the rarest and most prized ingredients in perfumery.", date: "Aug 15, 2024", readTime: "7 min read", featured: false },
    { id: 4, category: "Ingredients", title: "Why Bergamot Opens So Many Iconic Scents", description: "The citrus note that defines the opening of modern perfumery.", date: "Jul 30, 2024", readTime: "4 min read", featured: false },
    { id: 5, category: "Behind the Brand", title: "From Flower to Fragrance", description: "The journey of a single ingredient from harvest to bottle.", date: "Jul 18, 2024", readTime: "8 min read", featured: false },
    { id: 6, category: "Culture", title: "The Ritual of Choosing a Signature Scent", description: "Why your fragrance choice says more about you than you think.", date: "Jul 5, 2024", readTime: "5 min read", featured: false },
    { id: 7, category: "Places", title: "Places That Inspire Luvior Paris", description: "From Grasse to Kyoto — the landscapes that shape our fragrances.", date: "Jun 22, 2024", readTime: "6 min read", featured: false }
];

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
                rating: 4.7,
                reviews: Math.floor(Math.random() * 200) + 50,
                category: p.fragrance_family || p.category || '',
                badge: p.new_arrival ? 'new' : (p.bestseller ? 'bestseller' : ''),
                image: primary?.image_url || null,
                short_description: p.short_description,
                volume: p.volume,
                concentration: p.concentration
            };
        });
    } catch { }
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

function addToCart(productId) {
    const pid = String(productId);
    const existing = cart.find(item => String(item.id) === pid);
    if (existing) {
        existing.qty++;
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
                qty: 1
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
function injectCartDrawer() {
    if (document.getElementById('cart-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'cart-overlay';
    overlay.id = 'cart-overlay';
    overlay.addEventListener('click', closeCartDrawer);

    const drawer = document.createElement('div');
    drawer.className = 'cart-drawer';
    drawer.id = 'cart-drawer';
    drawer.innerHTML = `
        <div class="cart-drawer__header">
            <span class="cart-drawer__title">Your Cart</span>
            <button class="cart-drawer__close" id="cart-drawer-close">&times;</button>
        </div>
        <div class="cart-drawer__items" id="cart-drawer-items"></div>
        <div class="cart-drawer__footer" id="cart-drawer-footer"></div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    document.getElementById('cart-drawer-close').addEventListener('click', closeCartDrawer);
}

function openCartDrawer() {
    renderCartDrawer();
    document.getElementById('cart-overlay')?.classList.add('active');
    document.getElementById('cart-drawer')?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
    document.getElementById('cart-overlay')?.classList.remove('active');
    document.getElementById('cart-drawer')?.classList.remove('active');
    document.body.style.overflow = '';
}

function renderCartDrawer() {
    const itemsEl = document.getElementById('cart-drawer-items');
    const footerEl = document.getElementById('cart-drawer-footer');
    if (!itemsEl || !footerEl) return;

    if (cart.length === 0) {
        itemsEl.innerHTML = '<div class="cart-drawer__empty">Your cart is empty</div>';
        footerEl.innerHTML = '';
        return;
    }

    itemsEl.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item__image">
                ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
            </div>
            <div class="cart-item__details">
                <div class="cart-item__name">${item.name}</div>
                ${item.volume || item.concentration ? `<div class="cart-item__variant">${[item.volume, item.concentration].filter(Boolean).join(' · ')}</div>` : ''}
                <div class="cart-item__price">₹${(item.price * item.qty).toLocaleString('en-IN')}</div>
            </div>
            <div class="cart-item__actions">
                <button class="cart-item__remove" data-remove="${item.id}">Remove</button>
                <div class="cart-item__qty">
                    <button data-qty-minus="${item.id}">&minus;</button>
                    <span>${item.qty}</span>
                    <button data-qty-plus="${item.id}">+</button>
                </div>
            </div>
        </div>
    `).join('');

    const subtotal = getCartSubtotal();
    footerEl.innerHTML = `
        <div class="cart-drawer__subtotal">
            <span class="cart-drawer__subtotal-label">Subtotal</span>
            <span class="cart-drawer__subtotal-value">₹${subtotal.toLocaleString('en-IN')}</span>
        </div>
        <div class="cart-drawer__buttons">
            <button class="btn btn--filled" onclick="closeCartDrawer()">Checkout</button>
            <button class="btn" onclick="closeCartDrawer()">Continue Shopping</button>
        </div>
    `;

    itemsEl.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => removeFromCart(btn.dataset.remove));
    });
    itemsEl.querySelectorAll('[data-qty-minus]').forEach(btn => {
        btn.addEventListener('click', () => updateCartQty(btn.dataset.qtyMinus, -1));
    });
    itemsEl.querySelectorAll('[data-qty-plus]').forEach(btn => {
        btn.addEventListener('click', () => updateCartQty(btn.dataset.qtyPlus, 1));
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
function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    let stars = '';
    for (let i = 0; i < full; i++) stars += '★';
    if (half) stars += '★';
    return stars;
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.category = product.category;
    if (product.badge) card.dataset.badge = product.badge;
    card.innerHTML = `
        <div class="product-card__image">
            ${product.image
                ? `<img src="${product.image}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover">`
                : `<div class="placeholder-image" style="width:100%;height:100%">${product.name}</div>`}
            <div class="product-card__wishlist">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>
            </div>
        </div>
        <h3 class="product-card__name">${product.name}</h3>
        <p class="product-card__notes">${product.notes}</p>
        <div class="product-card__bottom">
            <span class="product-card__price">₹${(product.price || 0).toLocaleString('en-IN')}</span>
            <span class="product-card__rating">
                <span class="stars">${renderStars(product.rating)}</span>
                (${product.reviews})
            </span>
        </div>
        <button class="product-card__add-to-cart" data-id="${product.id}">Add to Cart</button>
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
    const card = document.createElement('div');
    card.className = 'article-card';
    card.innerHTML = `
        <div class="article-card__image">
            <div class="placeholder-image" style="width:100%;height:100%">${article.category}</div>
        </div>
        <p class="article-card__category">${article.category}</p>
        <h3 class="article-card__title">${article.title}</h3>
        <div class="article-card__meta">
            <span>${article.date}</span>
            <span>&middot;</span>
            <span>${article.readTime}</span>
        </div>
        <span class="article-card__arrow">Read Story <span class="arrow">&rarr;</span></span>
    `;
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
function initScrollAnimations() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
}

/* === Scroll to Top === */
function initScrollTop() {
    const btn = document.querySelector('.scroll-top');
    if (!btn) return;

    window.addEventListener('scroll', () => {
        btn.classList.toggle('visible', window.scrollY > 500);
    });

    btn.addEventListener('click', () => {
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
function initFAQ() {
    document.querySelectorAll('.faq-item__question').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.faq-item');
            const isOpen = item.classList.contains('open');
            item.closest('.faq-list').querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
            if (!isOpen) item.classList.add('open');
        });
    });
}

/* === Hero Image from Supabase === */
async function loadHeroImage() {
    const heroImg = document.getElementById('hero-bg-img');
    if (!heroImg) return;

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

        // Hero background image
        const imageUrl = config.image_url;
        if (!imageUrl) return;

        const overlay = heroImg.parentElement.querySelector('.hero__bg-gradient--center');
        if (config.overlay_opacity != null && overlay) {
            const op = Math.min(Math.max(config.overlay_opacity, 0), 1);
            overlay.style.background = `radial-gradient(ellipse at center, rgba(0,0,0,${op * 0.4}) 0%, rgba(0,0,0,${op}) 100%)`;
        }

        if (config.image_position && heroImg) {
            heroImg.style.objectPosition = config.image_position;
        }

        heroImg.onload = () => heroImg.classList.add('loaded');
        heroImg.onerror = () => {};
        heroImg.src = imageUrl;
        heroImg.alt = 'Luvior Paris Hero';
    } catch {}
}

/* === Populate Homepage === */
async function initHomepage() {
    const featuredGrid = document.getElementById('featured-products');
    const collectionCards = document.getElementById('collection-cards');
    const heroImg = document.getElementById('hero-bg-img');

    const tasks = [];
    if (featuredGrid || collectionCards) tasks.push(loadProducts(), loadCollections());
    if (heroImg) tasks.push(loadHeroImage());

    await Promise.all(tasks);

    if (featuredGrid) {
        PRODUCTS.slice(0, 4).forEach(p => featuredGrid.appendChild(createProductCard(p)));
    }
    if (collectionCards) {
        COLLECTIONS.forEach(c => collectionCards.appendChild(createCollectionCard(c)));
    }
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
    initHomepage();
    updateCartBadge();
});
