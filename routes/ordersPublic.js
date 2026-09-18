const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');

router.post('/create', async (req, res) => {
  const { customer, address, items } = req.body;
  if (!customer || !address || !items?.length) {
    return res.status(400).json({ error: 'Missing order data' });
  }

  const { data, error } = await supabase.rpc('create_order', {
    p_customer: customer,
    p_address: address,
    p_items: items
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/track', async (req, res) => {
  const { orderNumber, identifier } = req.body;
  if (!orderNumber || !identifier) {
    return res.status(400).json({ error: 'Order number and phone/email required' });
  }

  const { data, error } = await supabase.rpc('track_order', {
    p_order_number: orderNumber,
    p_identifier: identifier
  });

  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
});

module.exports = router;
