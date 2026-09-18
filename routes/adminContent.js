const express = require('express');
const router = express.Router();
const { getClientForUser } = require('../db/supabase');

router.get('/', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { data, error } = await sb.from('site_content').select('*').order('key');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/:key', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);
  const { value } = req.body;

  const { data: existing } = await sb.from('site_content').select('id').eq('key', req.params.key).single();

  if (existing) {
    const { error } = await sb.from('site_content')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', req.params.key);
    if (error) return res.status(400).json({ error: error.message });
  } else {
    const { error } = await sb.from('site_content').insert({ key: req.params.key, value });
    if (error) return res.status(400).json({ error: error.message });
  }

  res.json({ ok: true });
});

module.exports = router;
