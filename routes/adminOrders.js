const express = require('express');
const router = express.Router();
const { getClientForUser } = require('../db/supabase');

router.get('/', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { status, payment, search } = req.query;

  let query = sb.from('orders')
    .select('*, order_items(*), shipments(*)')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('order_status', status);
  if (payment && payment !== 'all') query = query.eq('payment_status', payment);
  if (search) {
    query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/:id', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { data, error } = await sb
    .from('orders')
    .select('*, order_items(*), order_status_history(*), shipments(*)')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Order not found' });
  res.json(data);
});

router.put('/:id/status', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { status, note } = req.body;

  const { error: updateErr } = await sb.from('orders')
    .update({ order_status: status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id);

  if (updateErr) return res.status(400).json({ error: updateErr.message });

  await sb.from('order_status_history').insert({
    order_id: parseInt(req.params.id),
    status,
    note: note || `Status changed to ${status}`,
    created_by: req.session.user.email
  });

  res.json({ ok: true });
});

router.put('/:id/payment', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const updates = { ...req.body, updated_at: new Date().toISOString() };
  if (updates.payment_status === 'paid' && !updates.paid_at) {
    updates.paid_at = new Date().toISOString();
  }

  const { error } = await sb.from('orders').update(updates).eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });

  if (updates.payment_status === 'paid') {
    await sb.from('order_status_history').insert({
      order_id: parseInt(req.params.id),
      status: 'payment_confirmed',
      note: `Payment confirmed via ${updates.payment_method || 'manual'}`,
      created_by: req.session.user.email
    });
  }

  res.json({ ok: true });
});

router.put('/:id/notes', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { admin_notes } = req.body;
  const { error } = await sb.from('orders')
    .update({ admin_notes, updated_at: new Date().toISOString() })
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
