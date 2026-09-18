const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { getClientForUser, SUPABASE_URL } = require('../db/supabase');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only image files allowed'));
  }
});

router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const sb = getClientForUser(req.session.user.accessToken);
  const ext = path.extname(req.file.originalname).toLowerCase();
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  const filePath = `products/${filename}`;

  const { error } = await sb.storage
    .from('product-images')
    .upload(filePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false
    });

  if (error) return res.status(500).json({ error: error.message });

  const { data: urlData } = sb.storage.from('product-images').getPublicUrl(filePath);

  res.json({ url: urlData.publicUrl, filename });
});

router.post('/multiple', upload.array('images', 10), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });

  const sb = getClientForUser(req.session.user.accessToken);
  const results = [];

  for (const file of req.files) {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    const filePath = `products/${filename}`;

    const { error } = await sb.storage
      .from('product-images')
      .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });

    if (!error) {
      const { data: urlData } = sb.storage.from('product-images').getPublicUrl(filePath);
      results.push({ url: urlData.publicUrl, filename, originalName: file.originalname });
    }
  }

  res.json(results);
});

module.exports = router;
