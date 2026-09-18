const express = require('express');
const router = express.Router();
const { supabase, getClientForUser } = require('../db/supabase');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  const client = getClientForUser(data.session.access_token);
  const { data: profile } = await client.from('profiles').select('*').eq('id', data.user.id).single();

  req.session.user = {
    id: data.user.id,
    email: data.user.email,
    name: profile?.name || '',
    role: profile?.role || 'customer',
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token
  };

  res.json({ user: { email: req.session.user.email, name: req.session.user.name, role: req.session.user.role } });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  const u = req.session.user;
  res.json({ user: { email: u.email, name: u.name, role: u.role } });
});

module.exports = router;
