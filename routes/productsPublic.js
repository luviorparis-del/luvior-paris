const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*), product_collections(collection_id)')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/featured', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('status', 'active')
    .eq('featured', true)
    .order('created_at', { ascending: false })
    .limit(4);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/bestsellers', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('status', 'active')
    .eq('bestseller', true)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/collections', async (req, res) => {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('status', 'active')
    .order('sort_order', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/:slug', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('slug', req.params.slug)
    .eq('status', 'active')
    .single();

  if (error) return res.status(404).json({ error: 'Product not found' });
  res.json(data);
});

module.exports = router;
