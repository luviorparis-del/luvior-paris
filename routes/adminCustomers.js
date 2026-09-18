const express = require('express');
const router = express.Router();
const { getClientForUser } = require('../db/supabase');

router.get('/', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);

  const { data: profiles } = await sb.from('profiles')
    .select('*')
    .eq('role', 'customer')
    .order('created_at', { ascending: false });

  const { data: orders } = await sb.from('orders')
    .select('created_by, total, created_at');

  const customers = (profiles || []).map(p => {
    const customerOrders = (orders || []).filter(o => o.created_by === p.id);
    return {
      ...p,
      orderCount: customerOrders.length,
      totalSpend: customerOrders.reduce((sum, o) => sum + o.total, 0),
      lastOrderDate: customerOrders.length
        ? customerOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at
        : null
    };
  });

  res.json(customers);
});

router.get('/:id', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);

  const { data: profile } = await sb.from('profiles')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (!profile) return res.status(404).json({ error: 'Customer not found' });

  const { data: orders } = await sb.from('orders')
    .select('*, order_items(*)')
    .eq('created_by', req.params.id)
    .order('created_at', { ascending: false });

  const { data: addresses } = await sb.from('addresses')
    .select('*')
    .eq('customer_id', req.params.id);

  res.json({ ...profile, orders: orders || [], addresses: addresses || [] });
});

module.exports = router;
