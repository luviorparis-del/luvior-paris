/* ============================================================
   LUVIOR PARIS — Admin › Product page extras
   Per-product page settings stored in site_content as  product:<id>
   { highlights[], variants[{label, product_id}], specs[{label, value}],
     usage, related_ids[], addon_ids[], bundle{enabled, product_ids[], tiers[{count, percent}]},
     hide{notes, specs, usage, shipping, faq} }
   ============================================================ */

let peState = null;

const PE_SECTIONS = [['notes', 'Fragrance notes'], ['specs', 'Specifications'], ['usage', 'How to use'], ['shipping', 'Shipping & returns'], ['faq', 'FAQ']];

function peDefault() {
  return { highlights: [], variants: [], specs: [], usage: '', related_ids: [], addon_ids: [], bundle: { enabled: false, product_ids: [], tiers: [] }, hide: {} };
}

async function peInit(modal, productId) {
  peState = null; // never carry settings over from a previously opened product
  const root = modal.querySelector('#pe-root');
  if (!root) return;
  root.innerHTML = loading();
  const [extras, products] = await Promise.all([
    productId ? sb.from('site_content').select('value').eq('key', 'product:' + productId).maybeSingle() : Promise.resolve({ data: null }),
    sb.from('products').select('id,name,volume,price,status').order('name')
  ]);
  peState = { productId, data: { ...peDefault(), ...(extras.data?.value || {}) }, products: (products.data || []).filter(p => String(p.id) !== String(productId)) };
  peState.data.bundle = { ...peDefault().bundle, ...(peState.data.bundle || {}) };
  peRender(root);
}

function peRender(root) {
  const d = peState.data;
  const opts = (sel) => peState.products.map(p => `<option value="${p.id}" ${String(sel) === String(p.id) ? 'selected' : ''}>${esc(p.name)}${p.volume ? ' · ' + esc(p.volume) : ''}${p.status !== 'active' ? ' (draft)' : ''}</option>`).join('');
  const checks = (cls, ids) => peState.products.length
    ? peState.products.map(p => `<label class="form-check pe-check"><input type="checkbox" class="${cls}" value="${p.id}" ${ids.map(String).includes(String(p.id)) ? 'checked' : ''}> ${esc(p.name)}${p.volume ? ' · ' + esc(p.volume) : ''}</label>`).join('')
    : '<p class="ws-hint">Add more products to link them here.</p>';

  root.innerHTML = `
    <h3 class="pe-title">Product page</h3>
    <p class="ws-hint">Extra details shown on this product's page. Leave anything empty to hide it.</p>

    <div class="form-group"><label>Highlights</label>
      <textarea id="pe-highlights" rows="2" placeholder="One per line, e.g. Long-lasting · 8–12 hours">${esc(d.highlights.join('\n'))}</textarea>
      <p class="ws-hint">Short selling points shown under the name.</p>
    </div>

    <div class="form-group"><label>Sizes / variants</label>
      <p class="ws-hint">Link the other sizes of this fragrance (each size is its own product with its own price and stock). This product is shown with its own Volume automatically.</p>
      <div id="pe-variants">${d.variants.map((v, i) => `
        <div class="pe-row" data-i="${i}">
          <input class="pe-var-label" placeholder="Label, e.g. 50ml" value="${esc(v.label || '')}">
          <select class="pe-var-product"><option value="">Choose product…</option>${opts(v.product_id)}</select>
          <button type="button" class="btn btn-sm btn-outline ws-danger pe-del" data-list="variants" data-i="${i}">Remove</button>
        </div>`).join('')}</div>
      <button type="button" class="btn btn-sm btn-outline" id="pe-add-variant">+ Add size</button>
    </div>

    <div class="form-group"><label>Specifications</label>
      <div id="pe-specs">${d.specs.map((s, i) => `
        <div class="pe-row" data-i="${i}">
          <input class="pe-spec-label" placeholder="e.g. Longevity" value="${esc(s.label || '')}">
          <input class="pe-spec-value" placeholder="e.g. 8–12 hours" value="${esc(s.value || '')}">
          <button type="button" class="btn btn-sm btn-outline ws-danger pe-del" data-list="specs" data-i="${i}">Remove</button>
        </div>`).join('')}</div>
      <button type="button" class="btn btn-sm btn-outline" id="pe-add-spec">+ Add specification</button>
      <p class="ws-hint">Concentration, volume and gender are shown automatically from the fields above.</p>
    </div>

    <div class="form-group"><label>How to use</label>
      <textarea id="pe-usage" rows="3" placeholder="Usage instructions">${esc(d.usage || '')}</textarea>
    </div>

    <div class="form-group"><label>Customers also add (add-ons next to Add to Cart)</label>
      <div class="pe-checks">${checks('pe-addon', d.addon_ids)}</div>
    </div>

    <div class="form-group"><label>You may also like</label>
      <div class="pe-checks">${checks('pe-related', d.related_ids)}</div>
      <p class="ws-hint">None selected → fragrances from the same family are shown.</p>
    </div>

    <div class="form-group"><label class="form-check pe-check"><input type="checkbox" id="pe-bundle-on" ${d.bundle.enabled ? 'checked' : ''}> Bundle offer</label>
      <div id="pe-bundle" ${d.bundle.enabled ? '' : 'hidden'}>
        <p class="ws-hint">Products offered together with this one. The discount applies to the whole bundle when the customer selects enough items.</p>
        <div class="pe-checks">${checks('pe-bundle-item', d.bundle.product_ids)}</div>
        <div id="pe-tiers">${d.bundle.tiers.map((t, i) => `
          <div class="pe-row" data-i="${i}">
            <span class="pe-inline-label">Buy</span><input type="number" class="pe-tier-count" min="2" max="10" value="${t.count}">
            <span class="pe-inline-label">items, get</span><input type="number" class="pe-tier-percent" min="1" max="90" value="${t.percent}">
            <span class="pe-inline-label">% off</span>
            <button type="button" class="btn btn-sm btn-outline ws-danger pe-del" data-list="tiers" data-i="${i}">Remove</button>
          </div>`).join('')}</div>
        <button type="button" class="btn btn-sm btn-outline" id="pe-add-tier">+ Add discount tier</button>
      </div>
    </div>

    <div class="form-group"><label>Show on product page</label>
      <div class="pe-checks">${PE_SECTIONS.map(([k, label]) => `<label class="form-check pe-check"><input type="checkbox" class="pe-show" value="${k}" ${d.hide[k] ? '' : 'checked'}> ${label}</label>`).join('')}</div>
    </div>`;

  const keep = () => peCollect(root);
  root.querySelector('#pe-add-variant').onclick = () => { keep(); peState.data.variants.push({ label: '', product_id: '' }); peRender(root); };
  root.querySelector('#pe-add-spec').onclick = () => { keep(); peState.data.specs.push({ label: '', value: '' }); peRender(root); };
  root.querySelector('#pe-add-tier').onclick = () => { keep(); const last = peState.data.bundle.tiers.slice(-1)[0]; peState.data.bundle.tiers.push({ count: last ? last.count + 1 : 2, percent: last ? last.percent + 5 : 10 }); peRender(root); };
  root.querySelector('#pe-bundle-on').onchange = e => { root.querySelector('#pe-bundle').hidden = !e.target.checked; };
  root.querySelectorAll('.pe-del').forEach(b => b.onclick = () => {
    keep();
    const list = b.dataset.list === 'tiers' ? peState.data.bundle.tiers : peState.data[b.dataset.list];
    list.splice(Number(b.dataset.i), 1);
    peRender(root);
  });
}

function peCollect(root) {
  if (!root || !root.querySelector('#pe-highlights')) return peState?.data;
  const d = peState.data;
  const ids = cls => [...root.querySelectorAll('.' + cls + ':checked')].map(c => Number(c.value));
  d.highlights = root.querySelector('#pe-highlights').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8);
  d.variants = [...root.querySelectorAll('#pe-variants .pe-row')].map(r => ({ label: r.querySelector('.pe-var-label').value.trim(), product_id: Number(r.querySelector('.pe-var-product').value) || '' }));
  d.specs = [...root.querySelectorAll('#pe-specs .pe-row')].map(r => ({ label: r.querySelector('.pe-spec-label').value.trim(), value: r.querySelector('.pe-spec-value').value.trim() }));
  d.usage = root.querySelector('#pe-usage').value.trim();
  d.addon_ids = ids('pe-addon');
  d.related_ids = ids('pe-related');
  d.bundle.enabled = root.querySelector('#pe-bundle-on').checked;
  d.bundle.product_ids = ids('pe-bundle-item');
  d.bundle.tiers = [...root.querySelectorAll('#pe-tiers .pe-row')].map(r => ({ count: Number(r.querySelector('.pe-tier-count').value), percent: Number(r.querySelector('.pe-tier-percent').value) }));
  d.hide = Object.fromEntries(PE_SECTIONS.map(([k]) => [k, !root.querySelector(`.pe-show[value="${k}"]`).checked]));
  return d;
}

function peValidate(d) {
  if (d.variants.some(v => (v.label && !v.product_id) || (!v.label && v.product_id))) return 'Each size needs both a label and a product.';
  if (d.specs.some(s => (s.label && !s.value) || (!s.label && s.value))) return 'Each specification needs a name and a value.';
  if (d.bundle.enabled) {
    if (!d.bundle.product_ids.length) return 'Choose at least one product for the bundle offer.';
    const max = d.bundle.product_ids.length + 1;
    for (const t of d.bundle.tiers) {
      if (!(t.count >= 2 && t.count <= max)) return `Bundle tiers must be between 2 and ${max} items.`;
      if (!(t.percent >= 1 && t.percent <= 90)) return 'Bundle discounts must be between 1% and 90%.';
    }
  }
  return null;
}

// Called by the product form's Save handler after the product row is saved.
async function peSave(productId, modal) {
  if (!peState) return;
  const d = peCollect(modal.querySelector('#pe-root'));
  const problem = peValidate(d);
  if (problem) throw new Error(problem);
  const clean = {
    ...d,
    variants: d.variants.filter(v => v.label && v.product_id),
    specs: d.specs.filter(s => s.label && s.value),
    bundle: { ...d.bundle, tiers: d.bundle.tiers.filter(t => t.count && t.percent).sort((a, b) => a.count - b.count) }
  };
  const { error } = await sb.from('site_content').upsert({ key: 'product:' + productId, value: clean, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error('Product page details: ' + error.message);
}

// Reorder an existing product image (left/right in the grid).
async function moveImage(productId, imageId, dir) {
  const { data } = await sb.from('product_images').select('id,sort_order').eq('product_id', productId).order('sort_order');
  const list = data || [];
  const i = list.findIndex(x => x.id === imageId), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  const results = await Promise.all(list.map((x, k) => sb.from('product_images').update({ sort_order: k }).eq('id', x.id)));
  const failed = results.find(r => r.error);
  if (failed) showToast('Could not reorder: ' + failed.error.message, 'error');
  openProductForm(productId);
}
