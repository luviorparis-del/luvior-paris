document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([loadProducts(), loadCollections()]);

    const familyCards = document.getElementById('family-cards');
    if (familyCards) {
        COLLECTIONS.forEach(c => {
            const card = createCollectionCard(c);
            card.style.aspectRatio = '3/4';
            familyCards.appendChild(card);
        });
    }

    const allProducts = document.getElementById('all-products');
    if (allProducts) {
        PRODUCTS.forEach(p => allProducts.appendChild(createProductCard(p)));
    }

    const filterBar = document.getElementById('filter-bar');
    if (filterBar && allProducts) {
        filterBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-bar__btn');
            if (!btn) return;

            filterBar.querySelectorAll('.filter-bar__btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;
            const cards = allProducts.querySelectorAll('.product-card');

            cards.forEach(card => {
                if (filter === 'all') {
                    card.style.display = '';
                } else if (filter === 'bestseller' || filter === 'new') {
                    card.style.display = card.dataset.badge === filter ? '' : 'none';
                } else {
                    card.style.display = card.dataset.category === filter ? '' : 'none';
                }
            });
        });
    }

    const hash = window.location.hash.replace('#', '');
    if (hash && filterBar) {
        const targetBtn = filterBar.querySelector(`[data-filter="${hash}"]`);
        if (targetBtn) {
            targetBtn.click();
            setTimeout(() => {
                document.getElementById('filter-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }
});
