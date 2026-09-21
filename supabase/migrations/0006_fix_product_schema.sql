-- ============================================================
-- COMPLETE PRODUCT SCHEMA FIX
-- Run in Supabase SQL Editor
-- Safe: ADD COLUMN IF NOT EXISTS = no-op if column exists
-- Does NOT drop tables or delete data
-- ============================================================

-- ============================================================
-- COLLECTIONS TABLE (needed before product_collections FK)
-- ============================================================
CREATE TABLE IF NOT EXISTS collections (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "collections: public reads active" ON collections FOR SELECT
    USING (status = 'active' OR is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "collections: admin inserts" ON collections FOR INSERT
    WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "collections: admin updates" ON collections FOR UPDATE
    USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "collections: admin deletes" ON collections FOR DELETE
    USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed default collections
INSERT INTO collections (slug, name, subtitle, description, sort_order) VALUES
  ('floral', 'Floral', 'Delicate Yet Bold', 'Rose, jasmine, iris and luminous floral accords.', 1),
  ('woody', 'Woody', 'Earthy & Refined', 'Cedarwood, sandalwood, vetiver and warm woods.', 2),
  ('oriental', 'Oriental', 'Rich & Evocative', 'Amber, spice, resin, vanilla and deep sensual notes.', 3),
  ('fresh', 'Fresh', 'Clean & Timeless', 'Citrus, bergamot, aquatic notes and crisp aromatics.', 4)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- PRODUCT COLUMNS
-- ============================================================

-- Core product columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS price INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_price INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;

-- Perfume-specific columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS fragrance_family TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS concentration TEXT DEFAULT 'edp';
ALTER TABLE products ADD COLUMN IF NOT EXISTS volume TEXT DEFAULT '100ml';
ALTER TABLE products ADD COLUMN IF NOT EXISTS top_notes TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS heart_notes TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_notes TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'unisex';

-- Display flags
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bestseller BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS new_arrival BOOLEAN DEFAULT false;

-- SEO
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_description TEXT DEFAULT '';

-- Timestamps
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add UNIQUE constraints if missing (safe — ignores if already exist)
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_slug_key UNIQUE (slug);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_sku_key UNIQUE (sku);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- PRODUCT IMAGES TABLE (if missing)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_images (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- PRODUCT COLLECTIONS TABLE (if missing)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_collections (
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  collection_id BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, collection_id)
);

-- ============================================================
-- STORAGE BUCKETS (if missing)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-images', 'hero-images', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RLS POLICIES (safe — errors if already exist, that's fine)
-- ============================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_collections ENABLE ROW LEVEL SECURITY;

-- Products RLS
DO $$ BEGIN
  CREATE POLICY "products: public reads active" ON products FOR SELECT
    USING (status = 'active' OR is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "products: admin inserts" ON products FOR INSERT
    WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "products: admin updates" ON products FOR UPDATE
    USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "products: admin deletes" ON products FOR DELETE
    USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Product images RLS
DO $$ BEGIN
  CREATE POLICY "product_images: public read" ON product_images FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "product_images: admin writes" ON product_images FOR INSERT
    WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "product_images: admin updates" ON product_images FOR UPDATE
    USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "product_images: admin deletes" ON product_images FOR DELETE
    USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Product collections RLS
DO $$ BEGIN
  CREATE POLICY "product_collections: public read" ON product_collections FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "product_collections: admin writes" ON product_collections FOR INSERT
    WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "product_collections: admin deletes" ON product_collections FOR DELETE
    USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Storage policies for product-images bucket
DO $$ BEGIN
  CREATE POLICY "product-images: public read" ON storage.objects FOR SELECT
    USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "product-images: admin upload" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'product-images' AND is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "product-images: admin update" ON storage.objects FOR UPDATE
    USING (bucket_id = 'product-images' AND is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "product-images: admin delete" ON storage.objects FOR DELETE
    USING (bucket_id = 'product-images' AND is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Storage policies for hero-images bucket
DO $$ BEGIN
  CREATE POLICY "Public read hero images" ON storage.objects FOR SELECT
    USING (bucket_id = 'hero-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can upload hero images" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'hero-images' AND auth.role() = 'authenticated' AND is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update hero images" ON storage.objects FOR UPDATE
    USING (bucket_id = 'hero-images' AND is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete hero images" ON storage.objects FOR DELETE
    USING (bucket_id = 'hero-images' AND is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- HERO SLIDESHOW SUPPORT (from 0005)
-- ============================================================
UPDATE site_content
SET value = value || '{"slides": [], "auto_slideshow": true, "slide_interval": 5, "transition_duration": 1}'::jsonb,
    updated_at = NOW()
WHERE key = 'hero_banner'
  AND NOT (value ? 'slides');

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
