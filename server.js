const path = require('path');
const express = require('express');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 4400;
const PUBLIC_DIR = __dirname;
const ADMIN_DIR = path.join(__dirname, 'admin');

app.use(express.json({ limit: '10mb' }));

app.use(session({
  name: 'lv_sid',
  secret: process.env.SESSION_SECRET || 'luvior-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000
  }
}));

const requireAdmin = require('./middleware/requireAdmin');

// Auth
app.use('/api/auth', require('./routes/auth'));

// Public API
app.use('/api/products', require('./routes/productsPublic'));
app.use('/api/orders', require('./routes/ordersPublic'));

// Admin API
app.use('/api/admin/dashboard', requireAdmin, require('./routes/adminDashboard'));
app.use('/api/admin/products', requireAdmin, require('./routes/adminProducts'));
app.use('/api/admin/orders', requireAdmin, require('./routes/adminOrders'));
app.use('/api/admin/customers', requireAdmin, require('./routes/adminCustomers'));
app.use('/api/admin/collections', requireAdmin, require('./routes/adminCollections'));
app.use('/api/admin/shipments', requireAdmin, require('./routes/adminShipments'));
app.use('/api/admin/content', requireAdmin, require('./routes/adminContent'));
app.use('/api/admin/upload', requireAdmin, require('./routes/upload'));

// Notifications
app.get('/api/admin/notifications', requireAdmin, async (req, res) => {
  const { getClientForUser } = require('./db/supabase');
  const sb = getClientForUser(req.session.user.accessToken);
  const { data } = await sb.from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  res.json(data || []);
});

app.put('/api/admin/notifications/:id/read', requireAdmin, async (req, res) => {
  const { getClientForUser } = require('./db/supabase');
  const sb = getClientForUser(req.session.user.accessToken);
  await sb.from('notifications').update({ read: true }).eq('id', req.params.id);
  res.json({ ok: true });
});

app.put('/api/admin/notifications/read-all', requireAdmin, async (req, res) => {
  const { getClientForUser } = require('./db/supabase');
  const sb = getClientForUser(req.session.user.accessToken);
  await sb.from('notifications').update({ read: true }).eq('read', false);
  res.json({ ok: true });
});

// Inventory (quick endpoint)
app.get('/api/admin/inventory', requireAdmin, async (req, res) => {
  const { getClientForUser } = require('./db/supabase');
  const sb = getClientForUser(req.session.user.accessToken);
  const { data } = await sb.from('products')
    .select('id, name, sku, stock, status')
    .order('stock', { ascending: true });
  res.json(data || []);
});

app.put('/api/admin/inventory/:id', requireAdmin, async (req, res) => {
  const { getClientForUser } = require('./db/supabase');
  const sb = getClientForUser(req.session.user.accessToken);
  const { stock } = req.body;
  const { error } = await sb.from('products')
    .update({ stock, updated_at: new Date().toISOString() })
    .eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// Static assets — admin CSS/JS only (not index.html)
app.use('/admin', express.static(ADMIN_DIR, { index: false }));

// Admin HTML — gate behind session check
app.get('/admin', adminGate);
app.get('/admin/*', adminGate);

function adminGate(req, res) {
  if (!req.session?.user || req.session.user.role !== 'admin') {
    return res.sendFile(path.join(ADMIN_DIR, 'index.html'));
  }
  res.sendFile(path.join(ADMIN_DIR, 'index.html'));
}

// Public site
app.use('/', express.static(PUBLIC_DIR, {
  extensions: ['html'],
  index: 'index.html'
}));

// SPA fallback for public pages
app.get('/track-order', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'track-order.html')));

app.listen(PORT, () => console.log(`Luvior Paris running on http://localhost:${PORT}`));
