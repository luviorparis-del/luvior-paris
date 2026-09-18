const express = require('express');
const router = express.Router();
const { getClientForUser } = require('../db/supabase');

router.get('/', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { data, error } = await sb
    .from('products')
    .select('*, product_images(*), product_collections(collection_id)')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/:id', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { data, error } = await sb
    .from('products')
    .select('*, product_images(*), product_collections(collection_id)')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Product not found' });
  res.json(data);
});

router.post('/', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { collections, ...product } = req.body;

  const { data, error } = await sb.from('products').insert(product).select().single();
  if (error) return res.status(400).json({ error: error.message });

  if (collections?.length) {
    await sb.from('product_collections').insert(
      collections.map(cid => ({ product_id: data.id, collection_id: cid }))
    );
  }

  res.json(data);
});

router.put('/:id', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { collections, ...product } = req.body;
  product.updated_at = new Date().toISOString();

  const { data, error } = await sb
    .from('products')
    .update(product)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  if (collections !== undefined) {
    await sb.from('product_collections').delete().eq('product_id', req.params.id);
    if (collections.length) {
      await sb.from('product_collections').insert(
        collections.map(cid => ({ product_id: data.id, collection_id: cid }))
      );
    }
  }

  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { error } = await sb.from('products').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

router.post('/:id/duplicate', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { data: original } = await sb.from('products').select('*').eq('id', req.params.id).single();
  if (!original) return res.status(404).json({ error: 'Not found' });

  const { id, created_at, updated_at, ...copy } = original;
  copy.name = copy.name + ' (Copy)';
  copy.slug = copy.slug + '-copy-' + Date.now();
  copy.sku = copy.sku + '-COPY';
  copy.status = 'draft';

  const { data, error } = await sb.from('products').insert(copy).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Product images
router.post('/:id/images', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { image_url, alt_text, sort_order, is_primary } = req.body;

  if (is_primary) {
    await sb.from('product_images').update({ is_primary: false }).eq('product_id', req.params.id);
  }

  const { data, error } = await sb.from('product_images').insert({
    product_id: parseInt(req.params.id),
    image_url, alt_text: alt_text || '', sort_order: sort_order || 0, is_primary: is_primary || false
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/:id/images/:imageId', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { is_primary, sort_order, alt_text } = req.body;

  if (is_primary) {
    await sb.from('product_images').update({ is_primary: false }).eq('product_id', req.params.id);
  }

  const { data, error } = await sb.from('product_images')
    .update({ is_primary, sort_order, alt_text })
    .eq('id', req.params.imageId)
    .select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/:id/images/:imageId', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { error } = await sb.from('product_images').delete().eq('id', req.params.imageId);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

router.put('/:id/images-order', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { order } = req.body;
  for (let i = 0; i < order.length; i++) {
    await sb.from('product_images').update({ sort_order: i }).eq('id', order[i]);
  }
  res.json({ ok: true });
});

module.exports = router;
