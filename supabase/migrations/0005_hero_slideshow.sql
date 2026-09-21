-- ============================================================
-- Extend hero_banner with slideshow support
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Add slideshow fields to existing hero_banner config
UPDATE site_content
SET value = value || '{
  "slides": [],
  "auto_slideshow": true,
  "slide_interval": 5,
  "transition_duration": 1
}'::jsonb,
    updated_at = NOW()
WHERE key = 'hero_banner'
  AND NOT (value ? 'slides');

-- Migrate existing single image_url to slides array if present
UPDATE site_content
SET value = jsonb_set(
  value,
  '{slides}',
  jsonb_build_array(
    jsonb_build_object(
      'id', 's_' || extract(epoch from now())::text,
      'image_url', value->>'image_url',
      'mobile_image_url', value->'mobile_image_url',
      'active', true,
      'sort_order', 0
    )
  )
)
WHERE key = 'hero_banner'
  AND value->>'image_url' IS NOT NULL
  AND jsonb_array_length(value->'slides') = 0;
