-- Luvior Paris — Supabase (Postgres) schema
-- Run in Supabase SQL Editor (Project → SQL Editor → New query → paste → Run)

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'customer' check (role in ('admin', 'customer')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''), 'customer');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select using (id = auth.uid());
create policy "profiles: admin reads all" on public.profiles for select using (public.is_admin());
create policy "profiles: update own name" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------- products ----------
create table if not exists public.products (
  id bigint generated always as identity primary key,
  sku text unique not null,
  slug text unique not null,
  name text not null,
  short_description text default '',
  description text default '',
  price integer not null,
  compare_price integer,
  stock integer not null default 0,
  category text,
  fragrance_family text check (fragrance_family in ('floral', 'woody', 'oriental', 'fresh')),
  gender text default 'unisex' check (gender in ('unisex', 'men', 'women')),
  concentration text default 'edp' check (concentration in ('edp', 'edt', 'parfum', 'cologne', 'body_mist')),
  volume text default '100ml',
  top_notes text default '',
  heart_notes text default '',
  base_notes text default '',
  featured boolean not null default false,
  bestseller boolean not null default false,
  new_arrival boolean not null default false,
  status text not null default 'draft' check (status in ('active', 'draft')),
  seo_title text default '',
  seo_description text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text default '',
  sort_order integer not null default 0,
  is_primary boolean not null default false
);

-- ---------- collections ----------
create table if not exists public.collections (
  id bigint generated always as identity primary key,
  slug text unique not null,
  name text not null,
  subtitle text default '',
  description text default '',
  image_url text default '',
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'draft')),
  created_at timestamptz not null default now()
);

create table if not exists public.product_collections (
  product_id bigint not null references public.products(id) on delete cascade,
  collection_id bigint not null references public.collections(id) on delete cascade,
  primary key (product_id, collection_id)
);

-- ---------- media ----------
create table if not exists public.media (
  id bigint generated always as identity primary key,
  url text unique not null,
  filename text not null,
  uploaded_at timestamptz not null default now()
);

-- ---------- orders ----------
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  order_number text unique not null,
  customer_name text not null,
  phone text not null,
  email text,
  -- address
  full_name text,
  address_line text,
  apartment text,
  city text,
  district text,
  state text,
  pincode text,
  country text default 'India',
  address_phone text,
  -- totals
  subtotal integer not null,
  delivery_charge integer not null default 0,
  discount integer not null default 0,
  total integer not null,
  -- payment
  payment_method text not null default 'pending',
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  payment_reference text,
  gateway text,
  transaction_id text,
  paid_amount integer,
  paid_at timestamptz,
  payment_notes text,
  -- status
  order_status text not null default 'new'
    check (order_status in (
      'new', 'confirmed', 'processing', 'packed', 'ready_to_ship',
      'shipped', 'in_transit', 'out_for_delivery', 'delivered',
      'cancelled', 'refund_requested', 'refunded'
    )),
  admin_notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  product_id bigint references public.products(id),
  sku text,
  product_name text not null,
  product_image text,
  variant_info text,
  quantity integer not null,
  unit_price integer not null,
  total_price integer not null
);

create table if not exists public.order_status_history (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);

-- ---------- shipments ----------
create table if not exists public.shipments (
  id bigint generated always as identity primary key,
  order_id bigint unique not null references public.orders(id) on delete cascade,
  carrier_code text not null default 'manual',
  courier_name text,
  tracking_number text,
  tracking_url text,
  shipping_cost integer,
  shipped_at timestamptz,
  pickup_date date,
  estimated_delivery date,
  delivered_at timestamptz,
  status text not null default 'not_ready'
    check (status in (
      'not_ready', 'ready_to_ship', 'packed', 'shipped', 'in_transit',
      'out_for_delivery', 'delivered', 'delivery_failed', 'returned'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipping_status_history (
  id bigint generated always as identity primary key,
  shipment_id bigint not null references public.shipments(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- addresses ----------
create table if not exists public.addresses (
  id bigint generated always as identity primary key,
  customer_id uuid references auth.users(id) on delete cascade,
  label text default 'Home',
  full_name text not null,
  phone text not null,
  address_line text not null,
  apartment text,
  city text not null,
  district text,
  state text not null,
  pincode text not null,
  country text default 'India',
  is_default boolean default false,
  created_at timestamptz not null default now()
);

-- ---------- site content ----------
create table if not exists public.site_content (
  id bigint generated always as identity primary key,
  key text unique not null,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------- notifications ----------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  type text not null,
  title text not null,
  message text,
  entity_type text,
  entity_id bigint,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ========== RLS ==========

alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.collections enable row level security;
alter table public.product_collections enable row level security;
alter table public.media enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.shipments enable row level security;
alter table public.shipping_status_history enable row level security;
alter table public.addresses enable row level security;
alter table public.site_content enable row level security;
alter table public.notifications enable row level security;

-- products: public reads active, admin full access
create policy "products: public reads active" on public.products for select
  using (status = 'active' or public.is_admin());
create policy "products: admin inserts" on public.products for insert with check (public.is_admin());
create policy "products: admin updates" on public.products for update using (public.is_admin());
create policy "products: admin deletes" on public.products for delete using (public.is_admin());

-- product_images: public read, admin write
create policy "product_images: public read" on public.product_images for select using (true);
create policy "product_images: admin writes" on public.product_images for insert with check (public.is_admin());
create policy "product_images: admin updates" on public.product_images for update using (public.is_admin());
create policy "product_images: admin deletes" on public.product_images for delete using (public.is_admin());

-- collections: public reads active, admin full
create policy "collections: public reads active" on public.collections for select
  using (status = 'active' or public.is_admin());
create policy "collections: admin inserts" on public.collections for insert with check (public.is_admin());
create policy "collections: admin updates" on public.collections for update using (public.is_admin());
create policy "collections: admin deletes" on public.collections for delete using (public.is_admin());

-- product_collections: public read, admin write
create policy "product_collections: public read" on public.product_collections for select using (true);
create policy "product_collections: admin writes" on public.product_collections for insert with check (public.is_admin());
create policy "product_collections: admin deletes" on public.product_collections for delete using (public.is_admin());

-- media: admin only
create policy "media: admin only" on public.media for all using (public.is_admin()) with check (public.is_admin());

-- orders: admin read/update, customers see own via RPC
create policy "orders: admin reads" on public.orders for select using (public.is_admin());
create policy "orders: admin updates" on public.orders for update using (public.is_admin());
create policy "order_items: admin reads" on public.order_items for select using (public.is_admin());
create policy "order_status_history: admin reads" on public.order_status_history for select using (public.is_admin());
create policy "order_status_history: admin inserts" on public.order_status_history for insert with check (public.is_admin());

-- shipments: admin only
create policy "shipments: admin all" on public.shipments for all using (public.is_admin()) with check (public.is_admin());
create policy "shipping_history: admin all" on public.shipping_status_history for all using (public.is_admin()) with check (public.is_admin());

-- addresses: own + admin
create policy "addresses: read own" on public.addresses for select using (customer_id = auth.uid() or public.is_admin());
create policy "addresses: insert own" on public.addresses for insert with check (customer_id = auth.uid());
create policy "addresses: update own" on public.addresses for update using (customer_id = auth.uid());
create policy "addresses: delete own" on public.addresses for delete using (customer_id = auth.uid());
create policy "addresses: admin reads" on public.addresses for select using (public.is_admin());

-- site_content: public read, admin write
create policy "site_content: public read" on public.site_content for select using (true);
create policy "site_content: admin writes" on public.site_content for insert with check (public.is_admin());
create policy "site_content: admin updates" on public.site_content for update using (public.is_admin());

-- notifications: admin only
create policy "notifications: admin all" on public.notifications for all using (public.is_admin()) with check (public.is_admin());

-- ========== create_order() ==========
create or replace function public.create_order(p_customer jsonb, p_address jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_unit_price integer;
  v_image text;
  v_subtotal integer := 0;
  v_delivery integer := 0;
  v_total integer := 0;
  v_order_id bigint;
  v_order_number text;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
      where id = (v_item->>'productId')::bigint and status = 'active';
    if not found then raise exception 'Product no longer available.'; end if;

    v_qty := greatest(1, coalesce((v_item->>'quantity')::integer, 1));
    if v_product.stock < v_qty then
      raise exception '% only has % left in stock.', v_product.name, v_product.stock;
    end if;

    v_unit_price := coalesce(v_product.compare_price, v_product.price);
    -- Use actual price (sale price) for billing
    v_unit_price := v_product.price;
    v_subtotal := v_subtotal + v_unit_price * v_qty;
  end loop;

  v_delivery := case when v_subtotal >= 10000 then 0 else 500 end;
  v_total := v_subtotal + v_delivery;
  v_order_number := 'LV-' || to_char(now(), 'YYMMDD') || '-' || lpad(floor(random()*10000)::text, 4, '0');

  insert into public.orders (
    order_number, customer_name, phone, email,
    full_name, address_line, apartment, city, district, state, pincode, country, address_phone,
    subtotal, delivery_charge, discount, total,
    payment_method, payment_status, order_status, created_by
  ) values (
    v_order_number,
    p_customer->>'name', p_customer->>'phone', p_customer->>'email',
    p_address->>'fullName', p_address->>'addressLine', p_address->>'apartment',
    p_address->>'city', p_address->>'district', p_address->>'state',
    p_address->>'pincode', coalesce(p_address->>'country', 'India'), p_address->>'phone',
    v_subtotal, v_delivery, 0, v_total,
    'pending', 'pending', 'new', auth.uid()
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id = (v_item->>'productId')::bigint;
    v_qty := greatest(1, coalesce((v_item->>'quantity')::integer, 1));
    v_unit_price := v_product.price;
    select image_url into v_image from public.product_images
      where product_id = v_product.id and is_primary = true limit 1;
    if v_image is null then
      select image_url into v_image from public.product_images
        where product_id = v_product.id order by sort_order asc limit 1;
    end if;

    insert into public.order_items (order_id, product_id, sku, product_name, product_image, variant_info, quantity, unit_price, total_price)
    values (v_order_id, v_product.id, v_product.sku, v_product.name, v_image,
            v_product.volume || ' · ' || v_product.concentration, v_qty, v_unit_price, v_unit_price * v_qty);

    update public.products set stock = stock - v_qty, updated_at = now() where id = v_product.id;
  end loop;

  insert into public.order_status_history (order_id, status, note)
    values (v_order_id, 'new', 'Order placed from website');

  -- Create notification
  insert into public.notifications (type, title, message, entity_type, entity_id)
    values ('new_order', 'New Order', 'Order ' || v_order_number || ' from ' || (p_customer->>'name'), 'order', v_order_id);

  return jsonb_build_object(
    'id', v_order_id,
    'orderNumber', v_order_number,
    'totals', jsonb_build_object('subtotal', v_subtotal, 'delivery', v_delivery, 'discount', 0, 'total', v_total)
  );
end;
$$;

grant execute on function public.create_order(jsonb, jsonb, jsonb) to anon, authenticated;

-- ========== track_order() ==========
create or replace function public.track_order(p_order_number text, p_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_shipment public.shipments%rowtype;
  v_items jsonb;
  v_history jsonb;
begin
  select * into v_order from public.orders
    where order_number = upper(p_order_number)
      and (phone = p_identifier or email = lower(p_identifier));
  if not found then
    raise exception 'Order not found. Check order number and phone/email.';
  end if;

  select jsonb_agg(jsonb_build_object(
    'name', product_name, 'image', product_image, 'variant', variant_info,
    'qty', quantity, 'price', unit_price
  )) into v_items from public.order_items where order_id = v_order.id;

  select jsonb_agg(jsonb_build_object(
    'status', status, 'note', note, 'at', created_at
  ) order by created_at asc) into v_history
  from public.order_status_history where order_id = v_order.id;

  select * into v_shipment from public.shipments where order_id = v_order.id;

  return jsonb_build_object(
    'orderNumber', v_order.order_number,
    'status', v_order.order_status,
    'paymentStatus', v_order.payment_status,
    'total', v_order.total,
    'createdAt', v_order.created_at,
    'items', coalesce(v_items, '[]'::jsonb),
    'history', coalesce(v_history, '[]'::jsonb),
    'shipping', case when v_shipment.id is not null then jsonb_build_object(
      'courier', v_shipment.courier_name,
      'tracking', v_shipment.tracking_number,
      'status', v_shipment.status,
      'estimatedDelivery', v_shipment.estimated_delivery
    ) else null end
  );
end;
$$;

grant execute on function public.track_order(text, text) to anon, authenticated;

-- ========== Storage ==========
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product-images: public read" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "product-images: admin upload" on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "product-images: admin update" on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());
create policy "product-images: admin delete" on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());

-- ========== Seed default collections ==========
insert into public.collections (slug, name, subtitle, description, sort_order) values
  ('floral', 'Floral', 'Delicate Yet Bold', 'Rose, jasmine, iris and luminous floral accords.', 1),
  ('woody', 'Woody', 'Earthy & Refined', 'Cedarwood, sandalwood, vetiver and warm woods.', 2),
  ('oriental', 'Oriental', 'Rich & Evocative', 'Amber, spice, resin, vanilla and deep sensual notes.', 3),
  ('fresh', 'Fresh', 'Clean & Timeless', 'Citrus, bergamot, aquatic notes and crisp aromatics.', 4)
on conflict (slug) do nothing;

-- ========== Seed default site content ==========
insert into public.site_content (key, value) values
  ('announcement_bar', '{"text": "Complimentary Shipping on All Orders Over ₹10,000", "secondary": "A More Beautiful Tomorrow"}'),
  ('homepage_hero', '{"title": "The Art of\\nScent", "subtitle": "Exquisite fragrances crafted in Paris, designed to evoke emotion and create lasting memories.", "cta_text": "Explore the Collection", "cta_link": "collections.html"}'),
  ('brand_story_short', '{"title": "Born from a belief that fragrance is the most intimate form of self-expression.", "text": "Every Luvior Paris fragrance is composed in Grasse, France — the perfume capital of the world — using the rarest, most evocative ingredients."}')
on conflict (key) do nothing;
