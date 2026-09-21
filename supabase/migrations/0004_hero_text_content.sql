-- ============================================================
-- Extend hero_banner with text content + alignment fields
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Update the hero_banner seed value to include text content fields
UPDATE site_content
SET value = value || '{
  "label": "",
  "heading": "",
  "subheading": "",
  "cta_text": "",
  "cta_link": "",
  "content_align": "centered"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'hero_banner'
  AND NOT (value ? 'content_align');
