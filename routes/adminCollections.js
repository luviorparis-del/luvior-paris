const express = require('express');
const router = express.Router();
const { getClientForUser } = require('../db/supabase');

router.get('/', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { data, error } = await sb.from('collections')
    .select('*, product_collections(product_id)')
    .order('sort_order', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/:id', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { data, error } = await sb.from('collections')
    .select('*, product_collections(product_id, products(id, name, sku, price, stock, status))')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Collection not found' });
  res.json(data);
});

router.post('/', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { data, error } = await sb.from('collections').insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/:id', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { data, error } = await sb.from('collections')
    .update(req.body)
    .eq('id', req.params.id)
    .select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { error } = await sb.from('collections').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

router.put('/:id/products', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { productIds } = req.body;

  await sb.from('product_collections').delete().eq('collection_id', req.params.id);
  if (productIds?.length) {
    await sb.from('product_collections').insert(
      productIds.map(pid => ({ product_id: pid, collection_id: parseInt(req.params.id) }))
    );
  }
  res.json({ ok: true });
});

module.exports = router;
