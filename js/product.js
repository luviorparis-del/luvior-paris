/* ============================================================
   LUVIOR PARIS — Product details page
   Data: products (+ images, collections) and per-product extras in
   site_content "product:<id>" (managed in Admin → Shop → Products).
   ============================================================ */
(function () {
    const root = document.getElementById('product-root');
    const key = new URLSearchParams(location.search).get('p') || '';
    const ml = v => parseFloat(String(v || '').replace(/[^\d.]/g, '')) || 0;

    const notFound = msg => {
        root.innerHTML = `<div class="product-page__empty"><h1 class="heading-md">${msg}</h1><a href="collections.html" class="btn">Browse fragrances <span class="arrow">&rarr;</span></a></div>`;
    };

    document.addEventListener('DOMContentLoaded', async () => {
        if (!key) return notFound('Fragrance not found');
        try {
            let q = sb.from('products').select('*, product_images(*), product_collections(collections(name, slug))').eq('status', 'active');
            q = /^\d+$/.test(key) ? q.eq('id', key) : q.eq('slug', key);
            const [{ data: p, error }] = await Promise.all([q.maybeSingle(), loadProducts(), window.CMS?.ready]);
            if (error) throw new Error(error.message);
            if (!p) return notFound('This fragrance is no longer available');
            const { data: ex } = await sb.from('site_content').select('value').eq('key', 'product:' + p.id).maybeSingle();
            const extras = { highlights: [], variants: [], specs: [], usage: '', related_ids: [], addon_ids: [], bundle: {}, hide: {}, ...(ex?.value || {}) };
            const variantIds = extras.variants.map(v => v.product_id).filter(Boolean);
            let variantRows = [];
            if (variantIds.length) {
                const { data } = await sb.from('products').select('id,slug,price,stock,volume,status').in('id', variantIds).eq('status', 'active');
                variantRows = data || [];
            }
            render(p, extras, variantRows);
        } catch (err) {
            console.error('Product load failed:', err);
            notFound('This fragrance could not be loaded');
        }
    });

    function render(p, extras, variantRows) {
        document.title = `${p.seo_title || p.name} — Luvior Paris`;
        document.getElementById('meta-desc')?.setAttribute('content', p.seo_description || p.short_description || p.name);

        const images = (p.product_images || []).slice().sort((a, b) => (b.is_primary - a.is_primary) || (a.sort_order - b.sort_order));
        const collection = (p.product_collections || []).map(pc => pc.collections).filter(Boolean)[0];
        const family = collection ? collection.name : (p.fragrance_family || '');
        const discount = p.compare_price && p.compare_price > p.price;
        const stock = p.stock ?? 0;
        const stockText = stock <= 0 ? 'Out of stock' : stock <= 5 ? `Only ${stock} left` : 'In stock';
        const byId = id => PRODUCTS.find(x => String(x.id) === String(id));

        // Sizes: this product + linked variant products (each with its own price/stock)
        const sizes = [{ label: p.volume || 'Default', id: p.id, slug: p.slug, price: p.price, stock, current: true },
            ...extras.variants.map(v => {
                const row = variantRows.find(r => String(r.id) === String(v.product_id));
                return row ? { label: v.label || row.volume, id: row.id, slug: row.slug, price: row.price, stock: row.stock } : null;
            }).filter(Boolean)].sort((a, b) => ml(a.label) - ml(b.label));

        const addons = (extras.addon_ids || []).map(byId).filter(Boolean).slice(0, 3);

        root.innerHTML = `
            <nav class="product__crumbs" aria-label="Breadcrumb"><a href="collections.html">Shop</a><span>/</span>${collection ? `<a href="collections.html#${encodeURIComponent(collection.slug)}">${escHtml(collection.name)}</a><span>/</span>` : ''}<span aria-current="page">${escHtml(p.name)}</span></nav>
            <div class="pd${images.length ? '' : ' pd--no-media'}">
                ${images.length ? `
                <div class="pd-gallery">
                    <div class="pd-main" id="pd-main" tabindex="0" aria-label="Product image. Click to zoom.">
                        <img src="${escHtml(images[0].image_url)}" alt="${escHtml(images[0].alt_text || p.name)}" id="pd-main-img">
                    </div>
                    ${images.length > 1 ? `<div class="pd-thumbs">${images.map((img, i) => `
                        <button type="button" class="pd-thumb${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Show image ${i + 1} of ${images.length}">
                            <img src="${escHtml(img.image_url)}" alt="" loading="lazy">
                        </button>`).join('')}</div>` : ''}
                </div>` : ''}
                <div class="pd-info">
                    ${family ? `<p class="label">${escHtml(family)}</p>` : ''}
                    <h1 class="pd-name">${escHtml(p.name)}</h1>
                    ${extras.highlights.length ? `<ul class="pd-highlights">${extras.highlights.map(h => `<li>${escHtml(h)}</li>`).join('')}</ul>` : ''}
                    ${p.short_description ? `<p class="body-text pd-lead">${escHtml(p.short_description)}</p>` : ''}
                    ${sizes.length > 1 ? `
                    <div class="pd-block">
                        <p class="pd-block__label">Size</p>
                        <div class="pd-sizes" role="radiogroup" aria-label="Size">
                            ${sizes.map(s => s.current
                                ? `<span class="pd-size is-active" role="radio" aria-checked="true">${escHtml(s.label)}</span>`
                                : `<a class="pd-size${s.stock <= 0 ? ' is-out' : ''}" role="radio" aria-checked="false" href="product.html?p=${encodeURIComponent(s.slug || s.id)}">${escHtml(s.label)}<small>${inr(s.price)}</small></a>`).join('')}
                        </div>
                    </div>` : ''}
                    <div class="pd-price">
                        <span class="pd-price__now">${inr(p.price)}</span>
                        ${discount ? `<span class="pd-price__was">${inr(p.compare_price)}</span><span class="pd-price__save">Save ${Math.round((1 - p.price / p.compare_price) * 100)}%</span>` : ''}
                    </div>
                    <p class="pd-stock${stock <= 0 ? ' is-out' : stock <= 5 ? ' is-low' : ''}">${stockText}</p>
                    ${addons.length ? `
                    <div class="pd-block">
                        <p class="pd-block__label">Customers also add</p>
                        ${addons.map(a => `
                        <label class="pd-addon">
                            <input type="checkbox" class="pd-addon__check" value="${escHtml(a.id)}">
                            <span class="pd-addon__img">${a.image ? `<img src="${escHtml(a.image)}" alt="" loading="lazy">` : ''}</span>
                            <span class="pd-addon__info"><span class="pd-addon__name">${escHtml(a.name)}</span><span class="pd-addon__price">Add for ${inr(a.price)}</span></span>
                        </label>`).join('')}
                    </div>` : ''}
                    <div class="pd-buy" id="pd-buy">
                        <div class="cart-item__qty pd-qty" role="group" aria-label="Quantity">
                            <button type="button" data-q="-1" aria-label="Decrease quantity">&minus;</button>
                            <span id="pd-qty" aria-live="polite">1</span>
                            <button type="button" data-q="1" aria-label="Increase quantity">+</button>
                        </div>
                        <button type="button" class="btn btn--filled pd-add" id="pd-add" ${stock <= 0 ? 'disabled' : ''}>${stock <= 0 ? 'Out of stock' : 'Add to Cart'}</button>
                    </div>
                    ${stock > 0 ? '<button type="button" class="btn pd-buynow" id="pd-buynow">Buy Now</button>' : ''}
                    <p class="pd-delivery">Complimentary delivery on orders over ${inr(FREE_DELIVERY_MIN)}</p>
                </div>
            </div>
            <section class="pd-bundle" id="pd-bundle" hidden></section>
            <section class="pd-details" id="pd-details"></section>
            <section class="product__related" id="pd-related" hidden>
                <h2 class="heading-md">You may also like</h2>
                <div class="product-grid" id="pd-related-grid"></div>
            </section>
            <div class="pd-sticky" id="pd-sticky" aria-hidden="true">
                ${images.length ? `<img src="${escHtml(images[0].image_url)}" alt="">` : ''}
                <div class="pd-sticky__info"><span>${escHtml(p.name)}</span><span>${inr(p.price)}</span></div>
                <button type="button" class="btn btn--filled" id="pd-sticky-add" ${stock <= 0 ? 'disabled' : ''}>${stock <= 0 ? 'Out of stock' : 'Add to Cart'}</button>
            </div>`;

        wireGallery(images);
        wireBuy(p, stock);
        renderBundle(p, extras);
        renderDetails(p, extras);
        renderRelated(p, extras);
    }

    /* ---------- gallery with zoom ---------- */
    function wireGallery(images) {
        const main = document.getElementById('pd-main');
        if (!main) return;
        const img = document.getElementById('pd-main-img');
        document.querySelectorAll('.pd-thumb').forEach(t => t.addEventListener('click', () => {
            const im = images[Number(t.dataset.i)];
            document.querySelectorAll('.pd-thumb').forEach(x => x.classList.toggle('active', x === t));
            main.classList.remove('is-zoom');
            img.classList.add('is-swapping');
            setTimeout(() => { img.src = im.image_url; img.alt = im.alt_text || ''; img.classList.remove('is-swapping'); }, 200);
        }));
        const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        const setOrigin = e => {
            const r = main.getBoundingClientRect();
            img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
        };
        if (fine) {
            main.addEventListener('mouseenter', () => main.classList.add('is-zoom'));
            main.addEventListener('mousemove', setOrigin);
            main.addEventListener('mouseleave', () => main.classList.remove('is-zoom'));
        } else {
            main.addEventListener('click', e => { setOrigin(e); main.classList.toggle('is-zoom'); });
        }
        main.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); main.classList.toggle('is-zoom'); } });
    }

    /* ---------- add to cart / buy now / sticky bar ---------- */
    function wireBuy(p, stock) {
        let qty = 1;
        const qtyEl = document.getElementById('pd-qty');
        document.querySelectorAll('.pd-qty [data-q]').forEach(b => b.addEventListener('click', () => {
            qty = Math.max(1, Math.min(Math.max(1, stock), qty + Number(b.dataset.q)));
            qtyEl.textContent = qty;
        }));
        const add = () => {
            if (stock <= 0) return;
            addToCart(p.id, qty, { silent: true });
            document.querySelectorAll('.pd-addon__check:checked').forEach(c => addToCart(c.value, 1, { silent: true }));
            openCartDrawer();
        };
        document.getElementById('pd-add')?.addEventListener('click', add);
        document.getElementById('pd-sticky-add')?.addEventListener('click', add);
        // Online checkout is not live yet: Buy Now adds the selection and opens the cart.
        document.getElementById('pd-buynow')?.addEventListener('click', add);

        const buy = document.getElementById('pd-buy'), bar = document.getElementById('pd-sticky');
        if (buy && bar) new IntersectionObserver(([e]) => {
            const show = !e.isIntersecting && e.boundingClientRect.top < 0;
            bar.classList.toggle('is-visible', show);
            bar.setAttribute('aria-hidden', String(!show));
        }).observe(buy);
    }

    /* ---------- bundle offer (configured per product; tiers from admin) ---------- */
    function renderBundle(p, extras) {
        const b = extras.bundle || {};
        const section = document.getElementById('pd-bundle');
        if (!b.enabled) return;
        const main = PRODUCTS.find(x => String(x.id) === String(p.id)) || { id: p.id, name: p.name, price: p.price, image: (p.product_images || [])[0]?.image_url, volume: p.volume };
        const others = (b.product_ids || []).map(id => PRODUCTS.find(x => String(x.id) === String(id))).filter(Boolean);
        if (!others.length) return;
        const items = [main, ...others];
        const tiers = (b.tiers || []).filter(t => t.count >= 2 && t.percent > 0).sort((x, y) => x.count - y.count);
        const selected = new Set(items.map(i => String(i.id)));

        section.innerHTML = `
            <h2 class="heading-md pd-bundle__title">Complete the ritual</h2>
            ${tiers.length ? `<ol class="pd-bundle__steps">
                <li><span>1</span><strong>${escHtml(main.name)}</strong><em>${inr(main.price)}</em></li>
                ${tiers.map(t => `<li><span>${t.count}</span><strong>${t.count} fragrances</strong><em>${t.percent}% off</em></li>`).join('')}
            </ol>` : ''}
            <div class="pd-bundle__items">
                ${items.map((it, i) => `
                    ${i ? '<span class="pd-bundle__plus" aria-hidden="true">+</span>' : ''}
                    <label class="pd-bundle__item${i === 0 ? ' is-main' : ''}">
                        <input type="checkbox" value="${escHtml(it.id)}" checked ${i === 0 ? 'disabled' : ''} aria-label="Include ${escHtml(it.name)}">
                        ${it.image ? `<span class="pd-bundle__img"><img src="${escHtml(it.image)}" alt="" loading="lazy"></span>` : ''}
                        <span class="pd-bundle__name">${escHtml(it.name)}</span>
                        <span class="pd-bundle__meta">${escHtml(it.volume || '')}<span>${inr(it.price)}</span></span>
                    </label>`).join('')}
            </div>
            <div class="pd-bundle__total">
                <div><p class="pd-bundle__label">Total</p><p class="pd-bundle__save" id="pd-bundle-save"></p></div>
                <div class="pd-bundle__prices"><span class="pd-bundle__was" id="pd-bundle-was"></span><span class="pd-bundle__now" id="pd-bundle-now"></span></div>
            </div>
            <button type="button" class="btn btn--filled pd-bundle__add" id="pd-bundle-add">Add All to Cart</button>`;
        section.hidden = false;

        const calc = () => {
            const chosen = items.filter(i => selected.has(String(i.id)));
            const sum = chosen.reduce((s, i) => s + i.price, 0);
            const tier = tiers.filter(t => chosen.length >= t.count).pop();
            const saving = tier ? Math.round(sum * tier.percent / 100) : 0;
            document.getElementById('pd-bundle-now').textContent = inr(sum - saving);
            document.getElementById('pd-bundle-was').textContent = saving ? inr(sum) : '';
            const next = tiers.find(t => chosen.length < t.count);
            document.getElementById('pd-bundle-save').textContent = saving ? `You save ${inr(saving)}` : next ? `Add ${next.count - chosen.length} more for ${next.percent}% off` : '';
            document.getElementById('pd-bundle-add').textContent = `Add ${chosen.length > 1 ? 'All ' : ''}to Cart`;
            return { chosen, percent: tier ? tier.percent : 0 };
        };
        section.querySelectorAll('input[type=checkbox]').forEach(c => c.addEventListener('change', () => {
            c.checked ? selected.add(c.value) : selected.delete(c.value);
            c.closest('.pd-bundle__item').classList.toggle('is-off', !c.checked);
            calc();
        }));
        document.getElementById('pd-bundle-add').addEventListener('click', () => {
            const { chosen, percent } = calc();
            addBundleToCart(chosen.map(i => i.id), percent);
            openCartDrawer();
        });
        calc();
    }

    /* ---------- detail sections ---------- */
    function renderDetails(p, extras) {
        const hide = extras.hide || {};
        const conc = CONCENTRATIONS[p.concentration] || p.concentration;
        const specs = [['Concentration', conc], ['Volume', p.volume], ['For', p.gender ? p.gender[0].toUpperCase() + p.gender.slice(1) : ''], ...(extras.specs || []).map(s => [s.label, s.value])].filter(s => s[1]);
        const notes = [['Top notes', p.top_notes], ['Heart notes', p.heart_notes], ['Base notes', p.base_notes]].filter(n => n[1]);
        const para = t => String(t).split(/\n{2,}/).map(x => `<p class="body-text">${escHtml(x)}</p>`).join('');
        const shipping = document.querySelector('[data-cms-section="shipping"]');
        const faqs = window.CMS ? CMS.list('faq', 'items').filter(f => f.question) : [];

        const blocks = [
            p.description && ['Description', para(p.description)],
            !hide.notes && notes.length && ['Fragrance notes', `<dl class="pd-dl">${notes.map(([k, v]) => `<div><dt>${k}</dt><dd>${escHtml(v)}</dd></div>`).join('')}</dl>`],
            !hide.specs && specs.length && ['Specifications', `<dl class="pd-dl">${specs.map(([k, v]) => `<div><dt>${escHtml(k)}</dt><dd>${escHtml(v)}</dd></div>`).join('')}</dl>`],
            !hide.usage && extras.usage && ['How to use', para(extras.usage)],
            !hide.shipping && shipping && ['Shipping & returns', para(CMS.readText(shipping.querySelector('[data-cms="text"]')))],
            !hide.faq && faqs.length && ['FAQ', faqs.map(f => `<div class="pd-faq"><p class="pd-faq__q">${escHtml(f.question)}</p><p class="body-text">${escHtml(f.answer)}</p></div>`).join('')]
        ].filter(Boolean);
        document.getElementById('pd-details').innerHTML = blocks.map(([title, html], i) => `
            <details class="pd-acc"${i === 0 ? ' open' : ''}>
                <summary><span>${title}</span><span class="pd-acc__icon" aria-hidden="true"></span></summary>
                <div class="pd-acc__body">${html}</div>
            </details>`).join('');
    }

    function renderRelated(p, extras) {
        const chosen = (extras.related_ids || []).map(id => PRODUCTS.find(x => String(x.id) === String(id))).filter(Boolean);
        const fam = p.fragrance_family || p.category;
        const list = (chosen.length ? chosen : PRODUCTS.filter(x => String(x.id) !== String(p.id)).sort((a, b) => (b.category === fam) - (a.category === fam))).slice(0, 4);
        if (!list.length) return;
        const grid = document.getElementById('pd-related-grid');
        list.forEach(r => grid.appendChild(createProductCard(r)));
        document.getElementById('pd-related').hidden = false;
    }
})();
