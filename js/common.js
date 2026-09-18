/* ============================================================
   MAISON NOIRE — Shared Logic
   ============================================================ */

// --- Product Data ---
const PRODUCTS = [
    {
        id: 1,
        name: "L'Ombre",
        notes: "Bergamot · Iris · Musk",
        price: 185.00,
        rating: 4.8,
        reviews: 128,
        category: "floral",
        badge: "",
        image: null
    },
    {
        id: 2,
        name: "Le Solstice",
        notes: "Saffron · Leather · Amber",
        price: 195.00,
        rating: 4.9,
        reviews: 247,
        category: "oriental",
        badge: "bestseller",
        image: null
    },
    {
        id: 3,
        name: "Fleur Noire",
        notes: "Black Rose · Vanilla · Patchouli",
        price: 180.00,
        rating: 4.7,
        reviews: 96,
        category: "floral",
        badge: "",
        image: null
    },
    {
        id: 4,
        name: "Cèdre",
        notes: "Cedarwood · Vetiver · Tonka",
        price: 175.00,
        rating: 4.6,
        reviews: 112,
        category: "woody",
        badge: "",
        image: null
    },
    {
        id: 5,
        name: "Nuit Dorée",
        notes: "Oud · Amber · Sandalwood",
        price: 210.00,
        rating: 4.9,
        reviews: 184,
        category: "oriental",
        badge: "new",
        image: null
    },
    {
        id: 6,
        name: "Jardin Secret",
        notes: "Jasmine · Peony · White Musk",
        price: 165.00,
        rating: 4.5,
        reviews: 73,
        category: "floral",
        badge: "",
        image: null
    },
    {
        id: 7,
        name: "Bois Sacré",
        notes: "Sandalwood · Cardamom · Moss",
        price: 190.00,
        rating: 4.7,
        reviews: 159,
        category: "woody",
        badge: "",
        image: null
    },
    {
        id: 8,
        name: "Eau Première",
        notes: "Bergamot · Sea Salt · White Cedar",
        price: 155.00,
        rating: 4.6,
        reviews: 88,
        category: "fresh",
        badge: "new",
        image: null
    },
    {
        id: 9,
        name: "Cuir Velours",
        notes: "Leather · Tobacco · Vanilla",
        price: 205.00,
        rating: 4.8,
        reviews: 201,
        category: "oriental",
        badge: "bestseller",
        image: null
    },
    {
        id: 10,
        name: "Aube Claire",
        notes: "Citrus · Green Tea · Bamboo",
        price: 150.00,
        rating: 4.4,
        reviews: 64,
        category: "fresh",
        badge: "",
        image: null
    },
    {
        id: 11,
        name: "Velvet Noir",
        notes: "Black Orchid · Musk · Praline",
        price: 200.00,
        rating: 4.8,
        reviews: 176,
        category: "oriental",
        badge: "",
        image: null
    },
    {
        id: 12,
        name: "Forêt Profonde",
        notes: "Pine · Birch · Amber Resin",
        price: 185.00,
        rating: 4.6,
        reviews: 91,
        category: "woody",
        badge: "",
        image: null
    }
];

const COLLECTIONS = [
    {
        id: "floral",
        name: "Floral",
        subtitle: "Delicate Yet Bold",
        description: "Rose, jasmine, iris and luminous floral accords."
    },
    {
        id: "woody",
        name: "Woody",
        subtitle: "Earthy & Refined",
        description: "Cedarwood, sandalwood, vetiver and warm woods."
    },
    {
        id: "oriental",
        name: "Oriental",
        subtitle: "Rich & Evocative",
        description: "Amber, spice, resin, vanilla and deep sensual notes."
    },
    {
        id: "fresh",
        name: "Fresh",
        subtitle: "Clean & Timeless",
        description: "Citrus, bergamot, aquatic notes and crisp aromatics."
    }
];

const JOURNAL_ARTICLES = [
    {
        id: 1,
        category: "The Art of Fragrance",
        title: "Why Scent Becomes Memory",
        description: "The science and poetry behind how fragrance anchors itself to our most vivid recollections.",
        date: "Sep 12, 2024",
        readTime: "6 min read",
        featured: true
    },
    {
        id: 2,
        category: "Ingredients",
        title: "The Art of Layering Fragrance",
        description: "How to combine scents for a signature that is uniquely yours.",
        date: "Aug 28, 2024",
        readTime: "5 min read",
        featured: false
    },
    {
        id: 3,
        category: "Craftsmanship",
        title: "Inside the World of Oud",
        description: "One of the rarest and most prized ingredients in perfumery.",
        date: "Aug 15, 2024",
        readTime: "7 min read",
        featured: false
    },
    {
        id: 4,
        category: "Ingredients",
        title: "Why Bergamot Opens So Many Iconic Scents",
        description: "The citrus note that defines the opening of modern perfumery.",
        date: "Jul 30, 2024",
        readTime: "4 min read",
        featured: false
    },
    {
        id: 5,
        category: "Behind the Brand",
        title: "From Flower to Fragrance",
        description: "The journey of a single ingredient from harvest to bottle.",
        date: "Jul 18, 2024",
        readTime: "8 min read",
        featured: false
    },
    {
        id: 6,
        category: "Culture",
        title: "The Ritual of Choosing a Signature Scent",
        description: "Why your fragrance choice says more about you than you think.",
        date: "Jul 5, 2024",
        readTime: "5 min read",
        featured: false
    },
    {
        id: 7,
        category: "Places",
        title: "Places That Inspire Luvior Paris",
        description: "From Grasse to Kyoto — the landscapes that shape our fragrances.",
        date: "Jun 22, 2024",
        readTime: "6 min read",
        featured: false
    }
];

// --- Cart ---
let cart = [];

function getCartCount() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
}

function addToCart(productId) {
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ id: productId, qty: 1 });
    }
    updateCartBadge();
}

function updateCartBadge() {
    document.querySelectorAll('.header__cart-count').forEach(el => {
        el.textContent = getCartCount();
    });
}

// --- Render Helpers ---
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
            <div class="placeholder-image" style="width:100%;height:100%">${product.name}</div>
            <div class="product-card__wishlist">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>
            </div>
        </div>
        <h3 class="product-card__name">${product.name}</h3>
        <p class="product-card__notes">${product.notes}</p>
        <div class="product-card__bottom">
            <span class="product-card__price">$${product.price.toFixed(2)}</span>
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
            <div class="placeholder-image" style="width:100%;height:100%">${collection.name}</div>
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

// --- Mobile Menu ---
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

// --- Scroll Animations ---
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

// --- Scroll to Top ---
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

// --- Newsletter ---
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

// --- Add to Cart Delegation ---
function initAddToCart() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.product-card__add-to-cart');
        if (!btn) return;
        const id = parseInt(btn.dataset.id);
        addToCart(id);
        const original = btn.textContent;
        btn.textContent = 'Added!';
        btn.disabled = true;
        setTimeout(() => {
            btn.textContent = original;
            btn.disabled = false;
        }, 1500);
    });
}

// --- FAQ Toggle ---
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

// --- Populate Homepage ---
function initHomepage() {
    const featuredGrid = document.getElementById('featured-products');
    if (featuredGrid) {
        PRODUCTS.slice(0, 4).forEach(p => featuredGrid.appendChild(createProductCard(p)));
    }

    const collectionCards = document.getElementById('collection-cards');
    if (collectionCards) {
        COLLECTIONS.forEach(c => collectionCards.appendChild(createCollectionCard(c)));
    }
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initScrollAnimations();
    initScrollTop();
    initNewsletter();
    initAddToCart();
    initFAQ();
    initHomepage();
    updateCartBadge();
});
