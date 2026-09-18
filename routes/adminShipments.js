const express = require('express');
const router = express.Router();
const { getClientForUser } = require('../db/supabase');

router.get('/', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { data, error } = await sb.from('shipments')
    .select('*, orders(order_number, customer_name, phone)')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:orderId', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { courier_name, tracking_number, estimated_delivery, carrier_code } = req.body;

  const { data: existing } = await sb.from('shipments').select('id').eq('order_id', req.params.orderId).single();

  if (existing) {
    const { data, error } = await sb.from('shipments')
      .update({
        courier_name, tracking_number, estimated_delivery,
        carrier_code: carrier_code || 'manual',
        updated_at: new Date().toISOString()
      })
      .eq('order_id', req.params.orderId)
      .select().single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }

  const { data, error } = await sb.from('shipments').insert({
    order_id: parseInt(req.params.orderId),
    courier_name, tracking_number, estimated_delivery,
    carrier_code: carrier_code || 'manual',
    status: 'ready_to_ship'
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/:orderId/status', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { status, note } = req.body;
  const updates = { status, updated_at: new Date().toISOString() };

  if (status === 'shipped') updates.shipped_at = new Date().toISOString();
  if (status === 'delivered') updates.delivered_at = new Date().toISOString();

  const { data: shipment } = await sb.from('shipments')
    .select('id')
    .eq('order_id', req.params.orderId)
    .single();

  if (!shipment) return res.status(404).json({ error: 'No shipment found for this order' });

  const { error } = await sb.from('shipments')
    .update(updates)
    .eq('order_id', req.params.orderId);

  if (error) return res.status(400).json({ error: error.message });

  await sb.from('shipping_status_history').insert({
    shipment_id: shipment.id,
    status,
    note: note || `Shipping status changed to ${status}`
  });

  const orderStatusMap = {
    shipped: 'shipped', in_transit: 'in_transit',
    out_for_delivery: 'out_for_delivery', delivered: 'delivered'
  };
  if (orderStatusMap[status]) {
    await sb.from('orders')
      .update({ order_status: orderStatusMap[status], updated_at: new Date().toISOString() })
      .eq('id', req.params.orderId);

    await sb.from('order_status_history').insert({
      order_id: parseInt(req.params.orderId),
      status: orderStatusMap[status],
      note: note || `Shipping: ${status}`,
      created_by: req.session.user.email
    });
  }

  res.json({ ok: true });
});

module.exports = router;
