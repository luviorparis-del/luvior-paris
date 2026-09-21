-- ============================================================
-- site_content table + hero-images storage bucket
-- ============================================================

-- Site content key-value store for dynamic website settings
CREATE TABLE IF NOT EXISTS site_content (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: public read, admin write
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site_content"
    ON site_content FOR SELECT
    USING (true);

CREATE POLICY "Admins can insert site_content"
    ON site_content FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update site_content"
    ON site_content FOR UPDATE
    USING (is_admin());

CREATE POLICY "Admins can delete site_content"
    ON site_content FOR DELETE
    USING (is_admin());

-- Seed the hero_banner row
INSERT INTO site_content (key, value) VALUES
    ('hero_banner', '{"image_url": null, "mobile_image_url": null, "overlay_opacity": 0.7, "image_position": "center center"}')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- hero-images storage bucket
-- ============================================================

-- Create the bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-images', 'hero-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for hero images
CREATE POLICY "Public read hero images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'hero-images');

-- Only authenticated admins can upload/update/delete
CREATE POLICY "Admins can upload hero images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'hero-images'
        AND auth.role() = 'authenticated'
        AND is_admin()
    );

CREATE POLICY "Admins can update hero images"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'hero-images'
        AND is_admin()
    );

CREATE POLICY "Admins can delete hero images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'hero-images'
        AND is_admin()
    );
