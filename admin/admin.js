/* ============================================================
   LUVIOR PARIS — Admin Panel SPA (Direct Supabase)
   ============================================================ */

let currentPage = 'dashboard';
let currentUser = null;

// ---- Auth ----
async function checkAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return showLogin();

  const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  if (!profile || profile.role !== 'admin') return showLogin();

  currentUser = { email: session.user.email, name: profile.name || session.user.email, role: profile.role };
  showAdmin(currentUser);
}

function showLogin() {
  currentUser = null;
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('admin-shell').style.display = 'none';
}

function showAdmin(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-shell').style.display = 'flex';
  document.getElementById('user-name').textContent = user.name || user.email;
  navigate(window.location.hash.slice(1) || 'dashboard');
  loadNotifications();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
    if (!profile || profile.role !== 'admin') {
      await sb.auth.signOut();
      throw new Error('Access denied. Admin only.');
    }

    currentUser = { email: data.user.email, name: profile.name || data.user.email, role: profile.role };
    showAdmin(currentUser);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await sb.auth.signOut();
  showLogin();
});

// ---- Navigation ----
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(item.dataset.page);
    closeSidebar();
  });
});

function navigate(page) {
  currentPage = page;
  window.location.hash = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const active = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (active) active.classList.add('active');

  const pageMap = {
    dashboard: renderDashboard,
    products: renderProducts,
    collections: renderCollections,
    inventory: renderInventory,
    orders: renderOrders,
    customers: renderCustomers,
    content: renderContent,
    settings: renderSettings
  };

  const render = pageMap[page];
  if (render) render();
  else document.getElementById('page-content').innerHTML = '<div class="empty-state"><h3>Coming soon</h3></div>';
}

// ---- Mobile Sidebar ----
const sidebar = document.getElementById('sidebar');
document.getElementById('menu-toggle').addEventListener('click', () => {
  sidebar.classList.add('open');
  getOverlay().classList.add('show');
});
document.getElementById('sidebar-close').addEventListener('click', closeSidebar);

function closeSidebar() {
  sidebar.classList.remove('open');
  getOverlay().classList.remove('show');
}

function getOverlay() {
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', closeSidebar);
    document.body.appendChild(overlay);
  }
  return overlay;
}

// ---- Notifications ----
document.getElementById('notifications-btn').addEventListener('click', () => {
  const dd = document.getElementById('notification-dropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('mark-all-read').addEventListener('click', async () => {
  await sb.from('notifications').update({ read: true }).eq('read', false);
  loadNotifications();
});

document.addEventListener('click', (e) => {
  const dd = document.getElementById('notification-dropdown');
  if (!e.target.closest('#notifications-btn') && !e.target.closest('#notification-dropdown')) {
    dd.style.display = 'none';
  }
});

async function loadNotifications() {
  try {
    const { data } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(20);
    const items = data || [];
    const unread = items.filter(n => !n.read).length;
    const badge = document.getElementById('notification-badge');
    badge.textContent = unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';

    const list = document.getElementById('notification-list');
    if (!items.length) {
      list.innerHTML = '<div class="empty-state" style="padding:20px"><p>No notifications</p></div>';
      return;
    }
    list.innerHTML = items.map(n => `
      <div class="notification-item ${n.read ? '' : 'unread'}" onclick="markNotificationRead(${n.id})">
        <div class="notification-item-title">${esc(n.title)}</div>
        <div class="notification-item-text">${esc(n.message || '')}</div>
        <div class="notification-item-time">${timeAgo(n.created_at)}</div>
      </div>
    `).join('');
  } catch {}
}

async function markNotificationRead(id) {
  await sb.from('notifications').update({ read: true }).eq('id', id);
  loadNotifications();
}

// ---- Helpers ----
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function formatPriceRaw(amount) { return '₹' + (amount || 0).toLocaleString('en-IN'); }
function badge(status) { return `<span class="badge badge-${(status || '').replace(/ /g, '_')}">${(status || '').replace(/_/g, ' ')}</span>`; }
function stockBadge(stock) {
  if (stock <= 0) return '<span class="badge badge-out">Out of Stock</span>';
  if (stock < 10) return '<span class="badge badge-low">Low Stock</span>';
  return '<span class="badge badge-in_stock">In Stock</span>';
}
function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function loading() { return '<div class="loading"><div class="spinner"></div></div>'; }

function showModal(title, bodyHtml, footerHtml) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  return overlay;
}

// ============================================================
// DASHBOARD
// ============================================================
async function renderDashboard() {
  const el = document.getElementById('page-content');
  el.innerHTML = loading();

  try {
    const { data: stats, error: statsErr } = await sb.rpc('admin_dashboard_stats');
    if (statsErr) throw statsErr;

    const { data: recentOrders } = await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(10);
    const { data: lowStockProducts } = await sb.from('products').select('id, name, sku, stock').lt('stock', 10).gt('stock', 0).order('stock');

    el.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Welcome back. Here's your store overview.</p>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Total Orders</div><div class="stat-value">${stats.totalOrders}</div></div>
        <div class="stat-card"><div class="stat-label">Orders Today</div><div class="stat-value">${stats.todayOrders}</div></div>
        <div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value">${stats.pendingOrders}</div></div>
        <div class="stat-card"><div class="stat-label">Paid</div><div class="stat-value">${stats.paidOrders}</div></div>
        <div class="stat-card"><div class="stat-label">Awaiting Shipment</div><div class="stat-value">${stats.awaitingShipment}</div></div>
        <div class="stat-card"><div class="stat-label">Shipped</div><div class="stat-value">${stats.shippedOrders}</div></div>
        <div class="stat-card"><div class="stat-label">Delivered</div><div class="stat-value">${stats.deliveredOrders}</div></div>
        <div class="stat-card"><div class="stat-label">Cancelled</div><div class="stat-value">${stats.cancelledOrders}</div></div>
        <div class="stat-card"><div class="stat-label">Revenue</div><div class="stat-value revenue">${formatPriceRaw(stats.totalRevenue)}</div></div>
        <div class="stat-card"><div class="stat-label">Products</div><div class="stat-value">${stats.totalProducts}</div></div>
        <div class="stat-card"><div class="stat-label">Low Stock</div><div class="stat-value" style="color:var(--warning)">${stats.lowStockProducts}</div></div>
        <div class="stat-card"><div class="stat-label">Customers</div><div class="stat-value">${stats.totalCustomers}</div></div>
      </div>
      <div class="quick-actions">
        <button class="btn btn-primary" onclick="navigate('products'); setTimeout(()=>document.getElementById('add-product-btn')?.click(),100)">+ Add Product</button>
        <button class="btn btn-outline" onclick="navigate('orders')">View Orders</button>
        <button class="btn btn-outline" onclick="navigate('inventory')">Manage Inventory</button>
      </div>
      <div class="card">
        <div class="card-header"><h3>Recent Orders</h3></div>
        <div class="table-wrap">
          <table class="mobile-cards">
            <thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Payment</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>
              ${(recentOrders || []).length ? recentOrders.map(o => `
                <tr>
                  <td data-label="Order">${esc(o.order_number)}</td>
                  <td data-label="Customer">${esc(o.customer_name)}</td>
                  <td data-label="Amount">${formatPriceRaw(o.total)}</td>
                  <td data-label="Payment">${badge(o.payment_status)}</td>
                  <td data-label="Status">${badge(o.order_status)}</td>
                  <td data-label="Date">${formatDate(o.created_at)}</td>
                  <td><button class="btn btn-sm btn-outline" onclick="viewOrder(${o.id})">View</button></td>
                </tr>
              `).join('') : '<tr><td colspan="7" style="text-align:center;padding:24px">No orders yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      ${(lowStockProducts || []).length ? `
      <div class="card" style="margin-top:16px">
        <div class="card-header"><h3>Low Stock Alert</h3></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Status</th></tr></thead>
            <tbody>
              ${lowStockProducts.map(p => `
                <tr><td>${esc(p.name)}</td><td><code>${esc(p.sku)}</code></td><td>${p.stock}</td><td>${stockBadge(p.stock)}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><h3>Failed to load dashboard</h3><p>${esc(err.message || JSON.stringify(err))}</p></div>`;
  }
}

// ============================================================
// PRODUCTS
// ============================================================
let allProducts = [];

async function renderProducts() {
  const el = document.getElementById('page-content');
  el.innerHTML = loading();

  try {
    const { data } = await sb.from('products').select('*, product_images(*)').order('created_at', { ascending: false });
    allProducts = data || [];

    el.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Products</h1><p class="page-subtitle">${allProducts.length} products</p></div>
        <button class="btn btn-primary" id="add-product-btn" onclick="openProductForm()">+ Add Product</button>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="mobile-cards">
            <thead><tr><th>Image</th><th>Name</th><th>SKU</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${allProducts.length ? allProducts.map(p => {
                const img = p.product_images?.find(i => i.is_primary) || p.product_images?.[0];
                return `<tr>
                  <td data-label="Image">${img ? `<img src="${esc(img.image_url)}" style="width:40px;height:40px;object-fit:cover;border-radius:4px">` : '<div style="width:40px;height:40px;background:var(--bg);border-radius:4px"></div>'}</td>
                  <td data-label="Name"><strong>${esc(p.name)}</strong></td>
                  <td data-label="SKU"><code>${esc(p.sku)}</code></td>
                  <td data-label="Price">${formatPriceRaw(p.price)}</td>
                  <td data-label="Stock">${p.stock} ${stockBadge(p.stock)}</td>
                  <td data-label="Status">${badge(p.status)}</td>
                  <td data-label="Actions">
                    <div class="table-actions">
                      <button onclick="openProductForm(${p.id})">Edit</button>
                      <button onclick="duplicateProduct(${p.id})">Copy</button>
                      <button onclick="toggleProductStatus(${p.id}, '${p.status}')">${p.status === 'active' ? 'Unpublish' : 'Publish'}</button>
                      <button onclick="deleteProduct(${p.id})" style="color:var(--danger)">Del</button>
                    </div>
                  </td>
                </tr>`;
              }).join('') : '<tr><td colspan="7" style="text-align:center;padding:24px">No products yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = '<div class="empty-state"><h3>Failed to load products</h3></div>';
  }
}

async function openProductForm(productId) {
  let product = null;
  let collections = [];

  try {
    const { data: colData } = await sb.from('collections').select('*').order('sort_order');
    collections = colData || [];
  } catch {}

  if (productId) {
    const { data } = await sb.from('products').select('*, product_images(*), product_collections(collection_id)').eq('id', productId).single();
    product = data;
  }

  const p = product || {};
  const selectedCollections = (p.product_collections || []).map(pc => pc.collection_id);

  const body = `
    <div class="form-row">
      <div class="form-group"><label>Product Name *</label><input id="pf-name" value="${esc(p.name || '')}"></div>
      <div class="form-group"><label>Slug *</label><input id="pf-slug" value="${esc(p.slug || '')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>SKU *</label><input id="pf-sku" value="${esc(p.sku || '')}"></div>
      <div class="form-group"><label>Status</label>
        <select id="pf-status"><option value="draft" ${p.status === 'draft' ? 'selected' : ''}>Draft</option><option value="active" ${p.status === 'active' ? 'selected' : ''}>Active</option></select>
      </div>
    </div>
    <div class="form-group"><label>Short Description</label><textarea id="pf-short" rows="2">${esc(p.short_description || '')}</textarea></div>
    <div class="form-group"><label>Full Description</label><textarea id="pf-desc" rows="4">${esc(p.description || '')}</textarea></div>
    <div class="form-row-3">
      <div class="form-group"><label>Price (₹) *</label><input type="number" id="pf-price" value="${p.price || ''}"></div>
      <div class="form-group"><label>Compare-at Price (₹)</label><input type="number" id="pf-compare" value="${p.compare_price || ''}"></div>
      <div class="form-group"><label>Stock *</label><input type="number" id="pf-stock" value="${p.stock ?? 0}"></div>
    </div>
    <div class="form-row-3">
      <div class="form-group"><label>Fragrance Family</label>
        <select id="pf-family"><option value="">—</option><option value="floral" ${p.fragrance_family === 'floral' ? 'selected' : ''}>Floral</option><option value="woody" ${p.fragrance_family === 'woody' ? 'selected' : ''}>Woody</option><option value="oriental" ${p.fragrance_family === 'oriental' ? 'selected' : ''}>Oriental</option><option value="fresh" ${p.fragrance_family === 'fresh' ? 'selected' : ''}>Fresh</option></select>
      </div>
      <div class="form-group"><label>Concentration</label>
        <select id="pf-concentration"><option value="edp" ${p.concentration === 'edp' ? 'selected' : ''}>Eau de Parfum</option><option value="edt" ${p.concentration === 'edt' ? 'selected' : ''}>Eau de Toilette</option><option value="parfum" ${p.concentration === 'parfum' ? 'selected' : ''}>Parfum</option><option value="cologne" ${p.concentration === 'cologne' ? 'selected' : ''}>Cologne</option><option value="body_mist" ${p.concentration === 'body_mist' ? 'selected' : ''}>Body Mist</option></select>
      </div>
      <div class="form-group"><label>Volume</label>
        <select id="pf-volume"><option value="30ml" ${p.volume === '30ml' ? 'selected' : ''}>30ml</option><option value="50ml" ${p.volume === '50ml' ? 'selected' : ''}>50ml</option><option value="100ml" ${p.volume === '100ml' ? 'selected' : ''}>100ml</option><option value="200ml" ${p.volume === '200ml' ? 'selected' : ''}>200ml</option></select>
      </div>
    </div>
    <div class="form-row-3">
      <div class="form-group"><label>Top Notes</label><input id="pf-top" value="${esc(p.top_notes || '')}"></div>
      <div class="form-group"><label>Heart Notes</label><input id="pf-heart" value="${esc(p.heart_notes || '')}"></div>
      <div class="form-group"><label>Base Notes</label><input id="pf-base" value="${esc(p.base_notes || '')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Gender</label>
        <select id="pf-gender"><option value="unisex" ${p.gender === 'unisex' ? 'selected' : ''}>Unisex</option><option value="men" ${p.gender === 'men' ? 'selected' : ''}>Men</option><option value="women" ${p.gender === 'women' ? 'selected' : ''}>Women</option></select>
      </div>
      <div class="form-group"><label>Category</label><input id="pf-category" value="${esc(p.category || '')}"></div>
    </div>
    <div class="form-group"><label>Collections</label>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${collections.map(c => `<label class="form-check"><input type="checkbox" class="pf-collection" value="${c.id}" ${selectedCollections.includes(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}
      </div>
    </div>
    <div style="display:flex;gap:24px;margin:16px 0">
      <label class="form-check"><input type="checkbox" id="pf-featured" ${p.featured ? 'checked' : ''}> Featured</label>
      <label class="form-check"><input type="checkbox" id="pf-bestseller" ${p.bestseller ? 'checked' : ''}> Bestseller</label>
      <label class="form-check"><input type="checkbox" id="pf-new" ${p.new_arrival ? 'checked' : ''}> New Arrival</label>
    </div>
    <div class="form-row">
      <div class="form-group"><label>SEO Title</label><input id="pf-seo-title" value="${esc(p.seo_title || '')}"></div>
      <div class="form-group"><label>SEO Description</label><input id="pf-seo-desc" value="${esc(p.seo_description || '')}"></div>
    </div>
    ${productId ? `
    <div style="margin-top:24px">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:12px">Product Images</h3>
      <div class="image-upload-zone" id="image-drop-zone">
        <p>Drag & drop images here or click to upload</p>
        <input type="file" id="image-upload-input" multiple accept="image/*">
      </div>
      <div class="image-preview-grid" id="image-preview-grid">
        ${(p.product_images || []).sort((a,b) => a.sort_order - b.sort_order).map(img => `
          <div class="image-preview-item ${img.is_primary ? 'primary' : ''}" data-id="${img.id}">
            <img src="${esc(img.image_url)}" alt="${esc(img.alt_text || '')}">
            <div class="image-actions">
              <button onclick="setPrimaryImage(${productId}, ${img.id})" title="Set as primary">★</button>
              <button onclick="deleteImage(${productId}, ${img.id})" title="Delete">×</button>
            </div>
            ${img.is_primary ? '<div class="primary-badge">Primary</div>' : ''}
          </div>
        `).join('')}
      </div>
    </div>
    ` : '<p style="color:var(--text-secondary);font-size:12px;margin-top:16px">Save the product first, then you can upload images.</p>'}
  `;

  const footer = `
    <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay').remove()">Cancel</button>
    <button class="btn btn-primary" id="save-product-btn">Save Product</button>
  `;

  const modal = showModal(productId ? 'Edit Product' : 'Add Product', body, footer);

  const nameInput = modal.querySelector('#pf-name');
  const slugInput = modal.querySelector('#pf-slug');
  if (!productId) {
    nameInput.addEventListener('input', () => {
      slugInput.value = nameInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    });
  }

  if (productId) {
    const dropZone = modal.querySelector('#image-drop-zone');
    const fileInput = modal.querySelector('#image-upload-input');
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); uploadImages(productId, e.dataTransfer.files); });
    fileInput.addEventListener('change', () => uploadImages(productId, fileInput.files));
  }

  modal.querySelector('#save-product-btn').addEventListener('click', async () => {
    const payload = {
      name: nameInput.value,
      slug: slugInput.value,
      sku: modal.querySelector('#pf-sku').value,
      status: modal.querySelector('#pf-status').value,
      short_description: modal.querySelector('#pf-short').value,
      description: modal.querySelector('#pf-desc').value,
      price: parseInt(modal.querySelector('#pf-price').value) || 0,
      compare_price: parseInt(modal.querySelector('#pf-compare').value) || null,
      stock: parseInt(modal.querySelector('#pf-stock').value) || 0,
      fragrance_family: modal.querySelector('#pf-family').value || null,
      concentration: modal.querySelector('#pf-concentration').value,
      volume: modal.querySelector('#pf-volume').value,
      top_notes: modal.querySelector('#pf-top').value,
      heart_notes: modal.querySelector('#pf-heart').value,
      base_notes: modal.querySelector('#pf-base').value,
      gender: modal.querySelector('#pf-gender').value,
      category: modal.querySelector('#pf-category').value,
      featured: modal.querySelector('#pf-featured').checked,
      bestseller: modal.querySelector('#pf-bestseller').checked,
      new_arrival: modal.querySelector('#pf-new').checked,
      seo_title: modal.querySelector('#pf-seo-title').value,
      seo_description: modal.querySelector('#pf-seo-desc').value,
      updated_at: new Date().toISOString()
    };

    if (!payload.name || !payload.sku || !payload.slug) { alert('Name, SKU and Slug are required'); return; }

    const btn = modal.querySelector('#save-product-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      let savedId = productId;
      if (productId) {
        const { error } = await sb.from('products').update(payload).eq('id', productId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await sb.from('products').insert(payload).select().single();
        if (error) throw error;
        savedId = inserted.id;
      }

      const selectedCols = [...modal.querySelectorAll('.pf-collection:checked')].map(c => parseInt(c.value));
      await sb.from('product_collections').delete().eq('product_id', savedId);
      if (selectedCols.length) {
        await sb.from('product_collections').insert(selectedCols.map(cid => ({ product_id: savedId, collection_id: cid })));
      }

      modal.remove();
      renderProducts();
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.textContent = 'Save Product';
    }
  });
}

async function uploadImages(productId, files) {
  try {
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      const filename = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: upErr } = await sb.storage.from('product-images').upload(filename, file, { contentType: file.type, upsert: false });
      if (upErr) { alert('Upload failed: ' + upErr.message); continue; }

      const { data: urlData } = sb.storage.from('product-images').getPublicUrl(filename);

      await sb.from('product_images').insert({
        product_id: productId,
        image_url: urlData.publicUrl,
        alt_text: file.name,
        sort_order: Date.now()
      });
    }
    openProductForm(productId);
  } catch (err) {
    alert('Upload failed: ' + err.message);
  }
}

async function setPrimaryImage(productId, imageId) {
  await sb.from('product_images').update({ is_primary: false }).eq('product_id', productId);
  await sb.from('product_images').update({ is_primary: true, sort_order: 0 }).eq('id', imageId);
  openProductForm(productId);
}

async function deleteImage(productId, imageId) {
  if (!confirm('Delete this image?')) return;
  const { data: img } = await sb.from('product_images').select('image_url').eq('id', imageId).single();
  if (img) {
    const path = img.image_url.split('/product-images/')[1];
    if (path) await sb.storage.from('product-images').remove([path]);
  }
  await sb.from('product_images').delete().eq('id', imageId);
  openProductForm(productId);
}

async function duplicateProduct(id) {
  const { data: p } = await sb.from('products').select('*').eq('id', id).single();
  if (!p) return;
  const { id: _, created_at, updated_at, ...rest } = p;
  rest.name += ' (Copy)';
  rest.slug += '-copy';
  rest.sku += '-COPY';
  rest.status = 'draft';
  await sb.from('products').insert(rest);
  renderProducts();
}

async function toggleProductStatus(id, current) {
  const newStatus = current === 'active' ? 'draft' : 'active';
  await sb.from('products').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
  renderProducts();
}

async function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  await sb.from('products').delete().eq('id', id);
  renderProducts();
}

// ============================================================
// COLLECTIONS
// ============================================================
async function renderCollections() {
  const el = document.getElementById('page-content');
  el.innerHTML = loading();

  try {
    const { data: collections } = await sb.from('collections').select('*, product_collections(product_id)').order('sort_order');

    el.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Collections</h1></div>
        <button class="btn btn-primary" onclick="openCollectionForm()">+ Add Collection</button>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="mobile-cards">
            <thead><tr><th>Name</th><th>Subtitle</th><th>Products</th><th>Status</th><th>Order</th><th>Actions</th></tr></thead>
            <tbody>
              ${(collections || []).map(c => `
                <tr>
                  <td data-label="Name"><strong>${esc(c.name)}</strong></td>
                  <td data-label="Subtitle">${esc(c.subtitle || '')}</td>
                  <td data-label="Products">${(c.product_collections || []).length}</td>
                  <td data-label="Status">${badge(c.status)}</td>
                  <td data-label="Order">${c.sort_order}</td>
                  <td data-label="Actions">
                    <div class="table-actions">
                      <button onclick="openCollectionForm(${c.id})">Edit</button>
                      <button onclick="deleteCollection(${c.id})" style="color:var(--danger)">Del</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch {
    el.innerHTML = '<div class="empty-state"><h3>Failed to load collections</h3></div>';
  }
}

async function openCollectionForm(id) {
  let c = {};
  if (id) {
    const { data } = await sb.from('collections').select('*').eq('id', id).single();
    c = data || {};
  }

  const body = `
    <div class="form-row">
      <div class="form-group"><label>Name *</label><input id="cf-name" value="${esc(c.name || '')}"></div>
      <div class="form-group"><label>Slug *</label><input id="cf-slug" value="${esc(c.slug || '')}"></div>
    </div>
    <div class="form-group"><label>Subtitle</label><input id="cf-subtitle" value="${esc(c.subtitle || '')}"></div>
    <div class="form-group"><label>Description</label><textarea id="cf-desc" rows="3">${esc(c.description || '')}</textarea></div>
    <div class="form-group"><label>Image URL</label><input id="cf-image" value="${esc(c.image_url || '')}"></div>
    <div class="form-row">
      <div class="form-group"><label>Sort Order</label><input type="number" id="cf-order" value="${c.sort_order || 0}"></div>
      <div class="form-group"><label>Status</label>
        <select id="cf-status"><option value="active" ${c.status === 'active' ? 'selected' : ''}>Active</option><option value="draft" ${c.status === 'draft' ? 'selected' : ''}>Draft</option></select>
      </div>
    </div>
  `;

  const modal = showModal(id ? 'Edit Collection' : 'Add Collection', body, `
    <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay').remove()">Cancel</button>
    <button class="btn btn-primary" id="save-collection-btn">Save</button>
  `);

  if (!id) {
    modal.querySelector('#cf-name').addEventListener('input', function() {
      modal.querySelector('#cf-slug').value = this.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    });
  }

  modal.querySelector('#save-collection-btn').addEventListener('click', async () => {
    const payload = {
      name: modal.querySelector('#cf-name').value,
      slug: modal.querySelector('#cf-slug').value,
      subtitle: modal.querySelector('#cf-subtitle').value,
      description: modal.querySelector('#cf-desc').value,
      image_url: modal.querySelector('#cf-image').value,
      sort_order: parseInt(modal.querySelector('#cf-order').value) || 0,
      status: modal.querySelector('#cf-status').value
    };
    if (!payload.name || !payload.slug) { alert('Name and Slug required'); return; }

    if (id) {
      const { error } = await sb.from('collections').update(payload).eq('id', id);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await sb.from('collections').insert(payload);
      if (error) { alert(error.message); return; }
    }
    modal.remove();
    renderCollections();
  });
}

async function deleteCollection(id) {
  if (!confirm('Delete this collection?')) return;
  await sb.from('collections').delete().eq('id', id);
  renderCollections();
}

// ============================================================
// INVENTORY
// ============================================================
async function renderInventory() {
  const el = document.getElementById('page-content');
  el.innerHTML = loading();

  try {
    const { data: products } = await sb.from('products').select('id, name, sku, stock, status').order('stock');

    el.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Inventory</h1><p class="page-subtitle">${(products || []).length} products</p></div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="mobile-cards">
            <thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Status</th><th>Update</th></tr></thead>
            <tbody>
              ${(products || []).map(p => `
                <tr>
                  <td data-label="Product">${esc(p.name)}</td>
                  <td data-label="SKU"><code>${esc(p.sku)}</code></td>
                  <td data-label="Stock"><input type="number" class="stock-input" value="${p.stock}" id="stock-${p.id}" min="0"></td>
                  <td data-label="Status">${stockBadge(p.stock)}</td>
                  <td data-label="Update"><button class="btn btn-sm btn-outline" onclick="updateStock(${p.id})">Update</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch {
    el.innerHTML = '<div class="empty-state"><h3>Failed to load inventory</h3></div>';
  }
}

async function updateStock(id) {
  const stock = parseInt(document.getElementById(`stock-${id}`).value);
  await sb.from('products').update({ stock, updated_at: new Date().toISOString() }).eq('id', id);
  renderInventory();
}

// ============================================================
// ORDERS
// ============================================================
let orderFilter = 'all';

async function renderOrders() {
  const el = document.getElementById('page-content');
  el.innerHTML = loading();

  try {
    let query = sb.from('orders').select('*, shipments(status)').order('created_at', { ascending: false });
    if (orderFilter !== 'all') query = query.eq('order_status', orderFilter);

    const searchVal = document.getElementById('global-search')?.value;
    if (searchVal) query = query.or(`order_number.ilike.%${searchVal}%,customer_name.ilike.%${searchVal}%,phone.ilike.%${searchVal}%`);

    const { data: orders } = await query;
    const filters = ['all','new','confirmed','processing','packed','shipped','delivered','cancelled','refunded'];

    el.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Orders</h1><p class="page-subtitle">${(orders || []).length} orders</p></div>
      </div>
      <div class="filter-bar">
        ${filters.map(f => `<button class="filter-btn ${orderFilter === f ? 'active' : ''}" onclick="orderFilter='${f}';renderOrders()">${f === 'all' ? 'All' : f.replace(/_/g,' ')}</button>`).join('')}
        <div class="filter-search">
          <input placeholder="Search orders..." value="${esc(searchVal || '')}" onkeyup="if(event.key==='Enter'){renderOrders()}" id="order-search-input">
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="mobile-cards">
            <thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Amount</th><th>Payment</th><th>Status</th><th>Shipping</th><th>Date</th><th></th></tr></thead>
            <tbody>
              ${(orders || []).length ? orders.map(o => `
                <tr>
                  <td data-label="Order"><strong>${esc(o.order_number)}</strong></td>
                  <td data-label="Customer">${esc(o.customer_name)}</td>
                  <td data-label="Phone">${esc(o.phone)}</td>
                  <td data-label="Amount">${formatPriceRaw(o.total)}</td>
                  <td data-label="Payment">${badge(o.payment_status)}</td>
                  <td data-label="Status">${badge(o.order_status)}</td>
                  <td data-label="Shipping">${o.shipments?.[0] ? badge(o.shipments[0].status) : badge('not_ready')}</td>
                  <td data-label="Date">${formatDate(o.created_at)}</td>
                  <td><button class="btn btn-sm btn-primary" onclick="viewOrder(${o.id})">View</button></td>
                </tr>
              `).join('') : '<tr><td colspan="9" style="text-align:center;padding:24px">No orders found</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch {
    el.innerHTML = '<div class="empty-state"><h3>Failed to load orders</h3></div>';
  }
}

// ============================================================
// ORDER DETAIL
// ============================================================
async function viewOrder(id) {
  const el = document.getElementById('page-content');
  el.innerHTML = loading();

  try {
    const { data: o } = await sb.from('orders').select('*').eq('id', id).single();
    const { data: items } = await sb.from('order_items').select('*').eq('order_id', id);
    const { data: history } = await sb.from('order_status_history').select('*').eq('order_id', id).order('created_at');
    const { data: shipments } = await sb.from('shipments').select('*').eq('order_id', id);
    const ship = shipments?.[0] || {};
    o.order_items = items || [];
    o.order_status_history = history || [];

    const orderStatuses = ['new','confirmed','processing','packed','ready_to_ship','shipped','in_transit','out_for_delivery','delivered','cancelled','refund_requested','refunded'];
    const payStatuses = ['pending','paid','failed','refunded','partially_refunded'];
    const shipStatuses = ['not_ready','ready_to_ship','packed','shipped','in_transit','out_for_delivery','delivered','delivery_failed','returned'];

    el.innerHTML = `
      <div class="page-header">
        <div>
          <button class="btn btn-sm btn-outline" onclick="renderOrders()" style="margin-bottom:8px">&larr; Back to Orders</button>
          <h1 class="page-title">Order ${esc(o.order_number)}</h1>
          <p class="page-subtitle">Placed ${formatDate(o.created_at)}</p>
        </div>
        <div class="btn-group">${badge(o.order_status)} ${badge(o.payment_status)}</div>
      </div>
      <div class="order-detail-grid">
        <div>
          <div class="card detail-section">
            <div class="card-header"><h3>Products</h3></div>
            <div class="card-body">
              ${o.order_items.map(item => `
                <div class="order-item">
                  ${item.product_image ? `<img src="${esc(item.product_image)}" class="order-item-img">` : '<div class="order-item-img"></div>'}
                  <div class="order-item-info">
                    <div class="order-item-name">${esc(item.product_name)}</div>
                    <div class="order-item-variant">${esc(item.variant_info || '')} &middot; Qty: ${item.quantity}</div>
                  </div>
                  <div class="order-item-price">${formatPriceRaw(item.total_price)}</div>
                </div>
              `).join('')}
              <div style="border-top:2px solid var(--border);margin-top:12px;padding-top:12px">
                <div class="detail-row"><span class="label">Subtotal</span><span class="value">${formatPriceRaw(o.subtotal)}</span></div>
                <div class="detail-row"><span class="label">Delivery</span><span class="value">${formatPriceRaw(o.delivery_charge)}</span></div>
                ${o.discount ? `<div class="detail-row"><span class="label">Discount</span><span class="value">-${formatPriceRaw(o.discount)}</span></div>` : ''}
                <div class="detail-row"><span class="label" style="font-weight:700">Total</span><span class="value" style="font-size:18px;font-weight:700">${formatPriceRaw(o.total)}</span></div>
              </div>
            </div>
          </div>
          <div class="card detail-section">
            <div class="card-header"><h3>Order Timeline</h3></div>
            <div class="card-body">
              <ul class="timeline">
                ${o.order_status_history.map(h => `
                  <li class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <div class="timeline-status">${h.status.replace(/_/g, ' ')}</div>
                      ${h.note ? `<div class="timeline-note">${esc(h.note)}</div>` : ''}
                      <div class="timeline-time">${formatDate(h.created_at)} ${new Date(h.created_at).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'})}</div>
                    </div>
                  </li>
                `).join('')}
              </ul>
            </div>
          </div>
          <div class="card detail-section">
            <div class="card-header"><h3>Admin Notes</h3></div>
            <div class="card-body">
              <textarea id="admin-notes" rows="3" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:4px;font-family:inherit;font-size:13px">${esc(o.admin_notes || '')}</textarea>
              <button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="saveOrderNotes(${o.id})">Save Notes</button>
            </div>
          </div>
        </div>
        <div>
          <div class="card detail-section">
            <div class="card-header"><h3>Update Status</h3></div>
            <div class="card-body">
              <div class="form-group"><label>Order Status</label>
                <select class="status-select" id="order-status-select" style="width:100%">
                  ${orderStatuses.map(s => `<option value="${s}" ${o.order_status === s ? 'selected' : ''}>${s.replace(/_/g,' ')}</option>`).join('')}
                </select>
              </div>
              <div class="form-group"><label>Note</label><input id="status-note" placeholder="Optional note"></div>
              <button class="btn btn-primary btn-block btn-sm" onclick="updateOrderStatus(${o.id})">Update Order Status</button>
            </div>
          </div>
          <div class="card detail-section">
            <div class="card-header"><h3>Customer</h3></div>
            <div class="card-body">
              <div class="detail-row"><span class="label">Name</span><span class="value">${esc(o.customer_name)}</span></div>
              <div class="detail-row"><span class="label">Phone</span><span class="value">${esc(o.phone)}</span></div>
              <div class="detail-row"><span class="label">Email</span><span class="value">${esc(o.email || '—')}</span></div>
            </div>
          </div>
          <div class="card detail-section">
            <div class="card-header"><h3>Shipping Address</h3></div>
            <div class="card-body">
              <p style="font-size:13px;line-height:1.6">
                ${esc(o.full_name || o.customer_name)}<br>
                ${esc(o.address_line || '')}<br>
                ${o.apartment ? esc(o.apartment) + '<br>' : ''}
                ${esc(o.city || '')}${o.district ? ', ' + esc(o.district) : ''}<br>
                ${esc(o.state || '')} ${esc(o.pincode || '')}<br>
                ${esc(o.country || 'India')}<br>
                ${o.address_phone ? 'Phone: ' + esc(o.address_phone) : ''}
              </p>
            </div>
          </div>
          <div class="card detail-section">
            <div class="card-header"><h3>Payment</h3></div>
            <div class="card-body">
              <div class="detail-row"><span class="label">Status</span><span class="value">${badge(o.payment_status)}</span></div>
              <div class="detail-row"><span class="label">Method</span><span class="value">${esc(o.payment_method || '—')}</span></div>
              ${o.transaction_id ? `<div class="detail-row"><span class="label">Transaction</span><span class="value">${esc(o.transaction_id)}</span></div>` : ''}
              ${o.paid_at ? `<div class="detail-row"><span class="label">Paid At</span><span class="value">${formatDate(o.paid_at)}</span></div>` : ''}
              <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-light)">
                <div class="form-group"><label>Payment Status</label>
                  <select id="pay-status" class="status-select" style="width:100%">
                    ${payStatuses.map(s => `<option value="${s}" ${o.payment_status === s ? 'selected' : ''}>${s.replace(/_/g,' ')}</option>`).join('')}
                  </select>
                </div>
                <div class="form-row">
                  <div class="form-group"><label>Method</label><input id="pay-method" value="${esc(o.payment_method || '')}"></div>
                  <div class="form-group"><label>Transaction ID</label><input id="pay-txn" value="${esc(o.transaction_id || '')}"></div>
                </div>
                <button class="btn btn-sm btn-success btn-block" onclick="updatePayment(${o.id})">Update Payment</button>
              </div>
            </div>
          </div>
          <div class="card detail-section">
            <div class="card-header"><h3>Shipping</h3></div>
            <div class="card-body">
              <div class="detail-row"><span class="label">Status</span><span class="value">${badge(ship.status || 'not_ready')}</span></div>
              ${ship.courier_name ? `<div class="detail-row"><span class="label">Courier</span><span class="value">${esc(ship.courier_name)}</span></div>` : ''}
              ${ship.tracking_number ? `<div class="detail-row"><span class="label">Tracking</span><span class="value">${esc(ship.tracking_number)}</span></div>` : ''}
              ${ship.shipped_at ? `<div class="detail-row"><span class="label">Shipped</span><span class="value">${formatDate(ship.shipped_at)}</span></div>` : ''}
              ${ship.estimated_delivery ? `<div class="detail-row"><span class="label">Est. Delivery</span><span class="value">${formatDate(ship.estimated_delivery)}</span></div>` : ''}
              <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-light)">
                <div class="form-group"><label>Courier Name</label><input id="ship-courier" value="${esc(ship.courier_name || '')}"></div>
                <div class="form-group"><label>Tracking Number</label><input id="ship-tracking" value="${esc(ship.tracking_number || '')}"></div>
                <div class="form-group"><label>Est. Delivery</label><input type="date" id="ship-delivery" value="${ship.estimated_delivery || ''}"></div>
                <button class="btn btn-sm btn-outline btn-block" onclick="saveShipping(${o.id})" style="margin-bottom:8px">Save Shipping Details</button>
                <div class="form-group"><label>Shipping Status</label>
                  <select id="ship-status" class="status-select" style="width:100%">
                    ${shipStatuses.map(s => `<option value="${s}" ${(ship.status || 'not_ready') === s ? 'selected' : ''}>${s.replace(/_/g,' ')}</option>`).join('')}
                  </select>
                </div>
                <button class="btn btn-sm btn-primary btn-block" onclick="updateShippingStatus(${o.id})">Update Shipping Status</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><h3>Failed to load order</h3><p>${esc(err.message)}</p></div>`;
  }
}

async function updateOrderStatus(orderId) {
  const status = document.getElementById('order-status-select').value;
  const note = document.getElementById('status-note').value;
  await sb.from('orders').update({ order_status: status, updated_at: new Date().toISOString() }).eq('id', orderId);
  await sb.from('order_status_history').insert({ order_id: orderId, status, note: note || null, created_by: currentUser?.email });
  viewOrder(orderId);
}

async function updatePayment(orderId) {
  const payload = {
    payment_status: document.getElementById('pay-status').value,
    payment_method: document.getElementById('pay-method').value,
    transaction_id: document.getElementById('pay-txn').value,
    updated_at: new Date().toISOString()
  };
  if (payload.payment_status === 'paid' && !payload.paid_at) payload.paid_at = new Date().toISOString();
  await sb.from('orders').update(payload).eq('id', orderId);
  viewOrder(orderId);
}

async function saveShipping(orderId) {
  const payload = {
    order_id: orderId,
    courier_name: document.getElementById('ship-courier').value,
    tracking_number: document.getElementById('ship-tracking').value,
    estimated_delivery: document.getElementById('ship-delivery').value || null,
    updated_at: new Date().toISOString()
  };
  const { data: existing } = await sb.from('shipments').select('id').eq('order_id', orderId).single();
  if (existing) {
    await sb.from('shipments').update(payload).eq('order_id', orderId);
  } else {
    await sb.from('shipments').insert(payload);
  }
  viewOrder(orderId);
}

async function updateShippingStatus(orderId) {
  const status = document.getElementById('ship-status').value;
  const { data: existing } = await sb.from('shipments').select('id').eq('order_id', orderId).single();
  const shipUpdate = { status, updated_at: new Date().toISOString() };
  if (status === 'shipped') shipUpdate.shipped_at = new Date().toISOString();
  if (status === 'delivered') shipUpdate.delivered_at = new Date().toISOString();

  if (existing) {
    await sb.from('shipments').update(shipUpdate).eq('order_id', orderId);
    await sb.from('shipping_status_history').insert({ shipment_id: existing.id, status });
  }

  const statusMap = { shipped: 'shipped', in_transit: 'in_transit', out_for_delivery: 'out_for_delivery', delivered: 'delivered' };
  if (statusMap[status]) {
    await sb.from('orders').update({ order_status: statusMap[status], updated_at: new Date().toISOString() }).eq('id', orderId);
    await sb.from('order_status_history').insert({ order_id: orderId, status: statusMap[status], note: 'Auto-synced from shipping status', created_by: 'system' });
  }
  viewOrder(orderId);
}

async function saveOrderNotes(orderId) {
  const notes = document.getElementById('admin-notes').value;
  await sb.from('orders').update({ admin_notes: notes }).eq('id', orderId);
  alert('Notes saved');
}

// ============================================================
// CUSTOMERS
// ============================================================
async function renderCustomers() {
  const el = document.getElementById('page-content');
  el.innerHTML = loading();

  try {
    const { data: profiles } = await sb.from('profiles').select('*').eq('role', 'customer');
    const { data: allOrders } = await sb.from('orders').select('created_by, total, created_at');

    const customers = (profiles || []).map(p => {
      const userOrders = (allOrders || []).filter(o => o.created_by === p.id);
      return {
        ...p,
        orderCount: userOrders.length,
        totalSpend: userOrders.reduce((s, o) => s + (o.total || 0), 0),
        lastOrderDate: userOrders.length ? userOrders.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at : null
      };
    });

    el.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Customers</h1><p class="page-subtitle">${customers.length} customers</p></div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="mobile-cards">
            <thead><tr><th>Name</th><th>Email</th><th>Orders</th><th>Total Spend</th><th>Last Order</th><th></th></tr></thead>
            <tbody>
              ${customers.length ? customers.map(c => `
                <tr>
                  <td data-label="Name"><strong>${esc(c.name || 'Guest')}</strong></td>
                  <td data-label="Email">${esc(c.email)}</td>
                  <td data-label="Orders">${c.orderCount}</td>
                  <td data-label="Total Spend">${formatPriceRaw(c.totalSpend)}</td>
                  <td data-label="Last Order">${c.lastOrderDate ? formatDate(c.lastOrderDate) : '—'}</td>
                  <td><button class="btn btn-sm btn-outline" onclick="viewCustomer('${c.id}')">View</button></td>
                </tr>
              `).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px">No customers yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch {
    el.innerHTML = '<div class="empty-state"><h3>Failed to load customers</h3></div>';
  }
}

async function viewCustomer(id) {
  const el = document.getElementById('page-content');
  el.innerHTML = loading();

  try {
    const { data: profile } = await sb.from('profiles').select('*').eq('id', id).single();
    const { data: orders } = await sb.from('orders').select('*').eq('created_by', id).order('created_at', { ascending: false });
    const { data: addresses } = await sb.from('addresses').select('*').eq('customer_id', id);

    el.innerHTML = `
      <div class="page-header">
        <div>
          <button class="btn btn-sm btn-outline" onclick="renderCustomers()" style="margin-bottom:8px">&larr; Back</button>
          <h1 class="page-title">${esc(profile.name || 'Guest')}</h1>
          <p class="page-subtitle">${esc(profile.email)}</p>
        </div>
      </div>
      <div class="order-detail-grid">
        <div>
          <div class="card detail-section">
            <div class="card-header"><h3>Order History</h3></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Order</th><th>Amount</th><th>Payment</th><th>Status</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  ${(orders || []).map(o => `
                    <tr>
                      <td>${esc(o.order_number)}</td>
                      <td>${formatPriceRaw(o.total)}</td>
                      <td>${badge(o.payment_status)}</td>
                      <td>${badge(o.order_status)}</td>
                      <td>${formatDate(o.created_at)}</td>
                      <td><button class="btn btn-sm btn-outline" onclick="viewOrder(${o.id})">View</button></td>
                    </tr>
                  `).join('') || '<tr><td colspan="6" style="text-align:center">No orders</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div>
          <div class="card detail-section">
            <div class="card-header"><h3>Addresses</h3></div>
            <div class="card-body">
              ${(addresses || []).length ? addresses.map(a => `
                <div style="padding:8px 0;border-bottom:1px solid var(--border-light)">
                  <strong>${esc(a.label || 'Address')}</strong>${a.is_default ? ' (Default)' : ''}<br>
                  <span style="font-size:12px;color:var(--text-secondary)">
                    ${esc(a.full_name)}, ${esc(a.address_line)}, ${esc(a.city)} ${esc(a.state)} ${esc(a.pincode)}
                  </span>
                </div>
              `).join('') : '<p style="color:var(--text-secondary)">No addresses saved</p>'}
            </div>
          </div>
        </div>
      </div>
    `;
  } catch {
    el.innerHTML = '<div class="empty-state"><h3>Failed to load customer</h3></div>';
  }
}

// ============================================================
// CONTENT
// ============================================================
let heroConfig = null;

async function renderContent() {
  const el = document.getElementById('page-content');
  el.innerHTML = loading();

  try {
    const { data: heroRow } = await sb.from('site_content').select('*').eq('key', 'hero_banner').single();
    heroConfig = heroRow?.value || {};

    // Migrate old single-image to slides array
    if (!heroConfig.slides && heroConfig.image_url) {
      heroConfig.slides = [{ id: 's_' + Date.now(), image_url: heroConfig.image_url, mobile_image_url: heroConfig.mobile_image_url || null, active: true, sort_order: 0 }];
    }
    if (!heroConfig.slides) heroConfig.slides = [];

    const slides = heroConfig.slides;
    const slidesHtml = slides.length ? slides.sort((a,b) => (a.sort_order||0) - (b.sort_order||0)).map((slide, i) => `
      <div class="hero-slide-item" data-slide-id="${esc(slide.id)}" draggable="true" style="display:flex;gap:16px;align-items:flex-start;padding:16px;border:1px solid var(--border);border-radius:6px;background:var(--bg);margin-bottom:12px">
        <div style="cursor:grab;padding:8px 4px;color:var(--text-secondary);font-size:18px" class="slide-drag-handle">⠿</div>
        <div style="width:160px;aspect-ratio:16/9;background:#111;border-radius:4px;overflow:hidden;flex-shrink:0">
          ${slide.image_url ? `<img src="${esc(slide.image_url)}" style="width:100%;height:100%;object-fit:cover;opacity:0.7">` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);font-size:11px">No image</div>'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong style="font-size:13px">Slide ${i + 1}</strong>
            <div style="display:flex;gap:8px;align-items:center">
              <label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer">
                <input type="checkbox" class="slide-active-toggle" data-idx="${i}" ${slide.active !== false ? 'checked' : ''}> Active
              </label>
              <button class="btn btn-sm btn-outline slide-replace-btn" data-idx="${i}" style="font-size:11px">Replace</button>
              <button class="btn btn-sm btn-outline slide-delete-btn" data-idx="${i}" style="font-size:11px;color:var(--danger)">Delete</button>
            </div>
          </div>
          ${slide.mobile_image_url ? `<p style="font-size:11px;color:var(--text-secondary)">Mobile image: set</p>` : `<button class="btn btn-sm btn-outline slide-mobile-btn" data-idx="${i}" style="font-size:11px;margin-top:4px">Add Mobile Image</button>`}
          ${slide.mobile_image_url ? `<button class="btn btn-sm btn-outline slide-remove-mobile-btn" data-idx="${i}" style="font-size:11px;margin-top:4px;margin-left:4px">Remove Mobile</button>` : ''}
        </div>
      </div>
    `).join('') : '<p style="color:var(--text-secondary);font-size:13px">No hero slides yet. Add your first image below.</p>';

    el.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Website Content</h1><p class="page-subtitle">Manage dynamic content for the public website</p></div>
      </div>

      <!-- Hero Slideshow Management -->
      <div class="card" style="margin-bottom:24px">
        <div class="card-header"><h3>Homepage Hero Slideshow</h3></div>
        <div class="card-body">

          <!-- Slideshow Settings -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid var(--border-light)">
            <div class="form-group">
              <label>Auto Slideshow</label>
              <select id="hero-auto-slideshow">
                <option value="true" ${heroConfig.auto_slideshow !== false ? 'selected' : ''}>ON</option>
                <option value="false" ${heroConfig.auto_slideshow === false ? 'selected' : ''}>OFF</option>
              </select>
            </div>
            <div class="form-group">
              <label>Slide Interval</label>
              <select id="hero-slide-interval">
                <option value="3" ${heroConfig.slide_interval === 3 ? 'selected' : ''}>3 seconds</option>
                <option value="5" ${(heroConfig.slide_interval || 5) === 5 ? 'selected' : ''}>5 seconds</option>
                <option value="7" ${heroConfig.slide_interval === 7 ? 'selected' : ''}>7 seconds</option>
                <option value="10" ${heroConfig.slide_interval === 10 ? 'selected' : ''}>10 seconds</option>
                <option value="15" ${heroConfig.slide_interval === 15 ? 'selected' : ''}>15 seconds</option>
              </select>
            </div>
            <div class="form-group">
              <label>Transition Duration</label>
              <select id="hero-transition-duration">
                <option value="0.5" ${heroConfig.transition_duration === 0.5 ? 'selected' : ''}>0.5 seconds</option>
                <option value="1" ${(heroConfig.transition_duration || 1) === 1 ? 'selected' : ''}>1 second</option>
                <option value="1.5" ${heroConfig.transition_duration === 1.5 ? 'selected' : ''}>1.5 seconds</option>
              </select>
            </div>
            <div class="form-group">
              <label>Dark Overlay: <span id="overlay-value">${Math.round((heroConfig.overlay_opacity || 0.7) * 100)}%</span></label>
              <input type="range" id="hero-overlay" min="0" max="100" value="${Math.round((heroConfig.overlay_opacity || 0.7) * 100)}" style="width:100%">
            </div>
          </div>

          <div class="form-row" style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid var(--border-light)">
            <div class="form-group">
              <label>Image Position / Focal Point</label>
              <select id="hero-position">
                <option value="center center" ${(heroConfig.image_position || 'center center') === 'center center' ? 'selected' : ''}>Center</option>
                <option value="center top" ${heroConfig.image_position === 'center top' ? 'selected' : ''}>Top</option>
                <option value="center bottom" ${heroConfig.image_position === 'center bottom' ? 'selected' : ''}>Bottom</option>
                <option value="left center" ${heroConfig.image_position === 'left center' ? 'selected' : ''}>Left</option>
                <option value="right center" ${heroConfig.image_position === 'right center' ? 'selected' : ''}>Right</option>
              </select>
            </div>
          </div>

          <!-- Slide List -->
          <h4 style="font-size:14px;font-weight:600;margin-bottom:12px">Hero Slides (drag to reorder)</h4>
          <div id="hero-slides-list">
            ${slidesHtml}
          </div>

          <div style="margin-top:16px">
            <div class="image-upload-zone" id="hero-add-slide-zone" style="cursor:pointer;text-align:center;padding:20px">
              <p>+ Click or drag to add a new hero slide (JPEG, PNG, WebP — max 10MB)</p>
              <input type="file" id="hero-add-slide-input" accept="image/jpeg,image/png,image/webp" style="display:none">
            </div>
          </div>

          <!-- Hero Text Content -->
          <div style="margin-top:24px;padding-top:24px;border-top:1px solid var(--border-light)">
            <h4 style="font-size:14px;font-weight:600;margin-bottom:16px">Hero Text Content</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Label (small text above heading)</label>
                <input type="text" id="hero-text-label" value="${esc(heroConfig.label || '')}" placeholder="e.g. Scents for a Deeper You">
              </div>
              <div class="form-group">
                <label>Heading</label>
                <input type="text" id="hero-text-heading" value="${esc(heroConfig.heading || '')}" placeholder="e.g. More Than a Fragrance">
              </div>
            </div>
            <div class="form-row" style="margin-top:12px">
              <div class="form-group">
                <label>Subheading / Description</label>
                <input type="text" id="hero-text-subheading" value="${esc(heroConfig.subheading || '')}" placeholder="e.g. Exquisite fragrances, crafted to evoke emotion...">
              </div>
            </div>
            <div class="form-row" style="margin-top:12px">
              <div class="form-group">
                <label>CTA Button Text</label>
                <input type="text" id="hero-text-cta" value="${esc(heroConfig.cta_text || '')}" placeholder="e.g. Discover the Collection">
              </div>
              <div class="form-group">
                <label>CTA Button Link</label>
                <input type="text" id="hero-text-cta-link" value="${esc(heroConfig.cta_link || '')}" placeholder="e.g. collections.html">
              </div>
            </div>
            <div class="form-row" style="margin-top:12px">
              <div class="form-group">
                <label>Hero Content Position</label>
                <select id="hero-content-align">
                  <option value="centered" ${(heroConfig.content_align || 'centered') === 'centered' ? 'selected' : ''}>Center</option>
                  <option value="left" ${heroConfig.content_align === 'left' ? 'selected' : ''}>Left</option>
                  <option value="right" ${heroConfig.content_align === 'right' ? 'selected' : ''}>Right</option>
                </select>
              </div>
            </div>
          </div>

          <div style="display:flex;gap:12px;margin-top:20px">
            <button class="btn btn-primary" id="hero-save-btn">Save & Publish</button>
          </div>
          <p id="hero-status" style="font-size:12px;color:var(--text-secondary);margin-top:8px"></p>
        </div>
      </div>

      <!-- Other Content Entries -->
      <div class="card">
        <div class="card-header"><h3>Other Content</h3></div>
        <div class="card-body" id="other-content-list">
          ${loading()}
        </div>
      </div>
    `;

    loadOtherContent();
    initHeroSlideAdmin();
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><h3>Failed to load content</h3><p>${esc(err.message || '')}</p></div>`;
  }
}

async function loadOtherContent() {
  const container = document.getElementById('other-content-list');
  if (!container) return;
  try {
    const { data: items } = await sb.from('site_content').select('*').neq('key', 'hero_banner').order('key');
    if (!items || !items.length) {
      container.innerHTML = '<p style="color:var(--text-secondary)">No other content entries</p>';
      return;
    }
    container.innerHTML = items.map(item => `
      <div style="padding:16px 0;border-bottom:1px solid var(--border-light)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>${esc(item.key)}</strong>
            <p style="font-size:12px;color:var(--text-secondary);margin-top:2px">Last updated: ${formatDate(item.updated_at)}</p>
          </div>
          <button class="btn btn-sm btn-outline" onclick='editContent(${JSON.stringify(item.key)}, ${JSON.stringify(JSON.stringify(item.value))})'>Edit</button>
        </div>
        <pre style="background:var(--bg);padding:8px;border-radius:4px;font-size:11px;margin-top:8px;overflow-x:auto">${esc(JSON.stringify(item.value, null, 2))}</pre>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<p style="color:var(--text-secondary)">Failed to load</p>';
  }
}

async function uploadHeroToStorage(file, prefix) {
  const ext = file.name.split('.').pop().toLowerCase();
  const filename = `hero/${prefix}-${Date.now()}.${ext}`;
  const { error: upErr } = await sb.storage.from('hero-images').upload(filename, file, { contentType: file.type, upsert: false });
  if (upErr) throw new Error('Upload failed: ' + upErr.message);
  const { data: urlData } = sb.storage.from('hero-images').getPublicUrl(filename);
  return urlData.publicUrl;
}

function validateHeroFile(file) {
  if (!file) return false;
  if (file.size > 10 * 1024 * 1024) { alert('File too large. Max 10MB.'); return false; }
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) { alert('Only JPEG, PNG, WebP allowed.'); return false; }
  return true;
}

function initHeroSlideAdmin() {
  const overlaySlider = document.getElementById('hero-overlay');
  const overlayLabel = document.getElementById('overlay-value');
  if (overlaySlider && overlayLabel) {
    overlaySlider.addEventListener('input', () => { overlayLabel.textContent = overlaySlider.value + '%'; });
  }

  // Add new slide
  const addZone = document.getElementById('hero-add-slide-zone');
  const addInput = document.getElementById('hero-add-slide-input');
  if (addZone && addInput) {
    addZone.addEventListener('click', () => addInput.click());
    addZone.addEventListener('dragover', e => { e.preventDefault(); addZone.classList.add('dragover'); });
    addZone.addEventListener('dragleave', () => addZone.classList.remove('dragover'));
    addZone.addEventListener('drop', e => { e.preventDefault(); addZone.classList.remove('dragover'); addHeroSlide(e.dataTransfer.files[0]); });
    addInput.addEventListener('change', () => { if (addInput.files[0]) addHeroSlide(addInput.files[0]); });
  }

  // Active toggles
  document.querySelectorAll('.slide-active-toggle').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.idx);
      if (heroConfig.slides[idx]) heroConfig.slides[idx].active = cb.checked;
    });
  });

  // Delete buttons
  document.querySelectorAll('.slide-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (!confirm('Delete this slide?')) return;
      heroConfig.slides.splice(idx, 1);
      heroConfig.slides.forEach((s, i) => s.sort_order = i);
      renderContent();
    });
  });

  // Replace buttons
  document.querySelectorAll('.slide-replace-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.onchange = async () => {
        if (!input.files[0] || !validateHeroFile(input.files[0])) return;
        const status = document.getElementById('hero-status');
        status.textContent = 'Uploading replacement...';
        try {
          const url = await uploadHeroToStorage(input.files[0], 'slide');
          heroConfig.slides[idx].image_url = url;
          status.textContent = 'Replaced! Click Save & Publish to apply.';
          status.style.color = 'var(--success, #4caf50)';
          renderContent();
        } catch (err) {
          status.textContent = 'Error: ' + err.message;
          status.style.color = 'var(--danger)';
        }
      };
      input.click();
    });
  });

  // Mobile image buttons
  document.querySelectorAll('.slide-mobile-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.onchange = async () => {
        if (!input.files[0] || !validateHeroFile(input.files[0])) return;
        const status = document.getElementById('hero-status');
        status.textContent = 'Uploading mobile image...';
        try {
          const url = await uploadHeroToStorage(input.files[0], 'mobile');
          heroConfig.slides[idx].mobile_image_url = url;
          status.textContent = 'Mobile image set! Click Save & Publish to apply.';
          status.style.color = 'var(--success, #4caf50)';
          renderContent();
        } catch (err) {
          status.textContent = 'Error: ' + err.message;
          status.style.color = 'var(--danger)';
        }
      };
      input.click();
    });
  });

  // Remove mobile image
  document.querySelectorAll('.slide-remove-mobile-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      heroConfig.slides[idx].mobile_image_url = null;
      renderContent();
    });
  });

  // Drag and drop reorder
  initSlideDragDrop();

  // Save
  document.getElementById('hero-save-btn')?.addEventListener('click', saveHeroConfig);
}

function initSlideDragDrop() {
  const list = document.getElementById('hero-slides-list');
  if (!list) return;
  let dragItem = null;

  list.querySelectorAll('.hero-slide-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      dragItem = item;
      item.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.style.opacity = '1';
      dragItem = null;
      list.querySelectorAll('.hero-slide-item').forEach(el => el.style.borderTop = '');
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragItem && dragItem !== item) {
        item.style.borderTop = '2px solid var(--primary, #4f46e5)';
      }
    });
    item.addEventListener('dragleave', () => { item.style.borderTop = ''; });
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.style.borderTop = '';
      if (!dragItem || dragItem === item) return;
      const fromId = dragItem.dataset.slideId;
      const toId = item.dataset.slideId;
      const fromIdx = heroConfig.slides.findIndex(s => s.id === fromId);
      const toIdx = heroConfig.slides.findIndex(s => s.id === toId);
      if (fromIdx < 0 || toIdx < 0) return;
      const [moved] = heroConfig.slides.splice(fromIdx, 1);
      heroConfig.slides.splice(toIdx, 0, moved);
      heroConfig.slides.forEach((s, i) => s.sort_order = i);
      renderContent();
    });
  });
}

async function addHeroSlide(file) {
  if (!validateHeroFile(file)) return;
  const status = document.getElementById('hero-status');
  status.textContent = 'Uploading new slide...';
  try {
    const url = await uploadHeroToStorage(file, 'slide');
    if (!heroConfig.slides) heroConfig.slides = [];
    heroConfig.slides.push({
      id: 's_' + Date.now(),
      image_url: url,
      mobile_image_url: null,
      active: true,
      sort_order: heroConfig.slides.length
    });
    status.textContent = 'Slide added! Click Save & Publish to apply.';
    status.style.color = 'var(--success, #4caf50)';
    renderContent();
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    status.style.color = 'var(--danger)';
  }
}

async function saveHeroConfig() {
  const btn = document.getElementById('hero-save-btn');
  const status = document.getElementById('hero-status');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  status.textContent = '';

  try {
    const config = { ...heroConfig };
    config.image_position = document.getElementById('hero-position')?.value || 'center center';
    config.overlay_opacity = (parseInt(document.getElementById('hero-overlay')?.value) || 70) / 100;
    config.auto_slideshow = document.getElementById('hero-auto-slideshow')?.value !== 'false';
    config.slide_interval = parseInt(document.getElementById('hero-slide-interval')?.value) || 5;
    config.transition_duration = parseFloat(document.getElementById('hero-transition-duration')?.value) || 1;
    config.label = document.getElementById('hero-text-label')?.value || '';
    config.heading = document.getElementById('hero-text-heading')?.value || '';
    config.subheading = document.getElementById('hero-text-subheading')?.value || '';
    config.cta_text = document.getElementById('hero-text-cta')?.value || '';
    config.cta_link = document.getElementById('hero-text-cta-link')?.value || '';
    config.content_align = document.getElementById('hero-content-align')?.value || 'centered';

    // Keep backward compat: set image_url to first active slide
    const activeSlides = (config.slides || []).filter(s => s.active !== false);
    config.image_url = activeSlides[0]?.image_url || null;
    config.mobile_image_url = activeSlides[0]?.mobile_image_url || null;

    const { data: existing } = await sb.from('site_content').select('id').eq('key', 'hero_banner').single();
    if (existing) {
      const { error } = await sb.from('site_content').update({ value: config, updated_at: new Date().toISOString() }).eq('key', 'hero_banner');
      if (error) throw error;
    } else {
      const { error } = await sb.from('site_content').insert({ key: 'hero_banner', value: config, updated_at: new Date().toISOString() });
      if (error) throw error;
    }

    heroConfig = config;
    status.textContent = 'Hero slideshow saved and published!';
    status.style.color = 'var(--success, #4caf50)';
    setTimeout(() => renderContent(), 1500);
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    status.style.color = 'var(--danger)';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save & Publish';
  }
}

function editContent(key, valueStr) {
  const body = `
    <div class="form-group"><label>Key</label><input value="${esc(key)}" disabled></div>
    <div class="form-group"><label>Value (JSON)</label>
      <textarea id="content-value" rows="10" style="font-family:monospace;font-size:12px">${esc(typeof valueStr === 'string' ? valueStr : JSON.stringify(JSON.parse(valueStr), null, 2))}</textarea>
    </div>
  `;
  const modal = showModal('Edit Content: ' + key, body, `
    <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay').remove()">Cancel</button>
    <button class="btn btn-primary" id="save-content-btn">Save</button>
  `);
  modal.querySelector('#save-content-btn').addEventListener('click', async () => {
    try {
      const value = JSON.parse(modal.querySelector('#content-value').value);
      const { error } = await sb.from('site_content').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
      if (error) throw error;
      modal.remove();
      renderContent();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });
}

// ============================================================
// SETTINGS
// ============================================================
function renderSettings() {
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><div><h1 class="page-title">Settings</h1></div></div>
    <div class="card"><div class="card-body">
      <div class="empty-state"><h3>Store Settings</h3><p>Store configuration coming soon. Currently managed through Content section and database.</p></div>
    </div></div>
  `;
}

// ---- Init ----
checkAuth();
