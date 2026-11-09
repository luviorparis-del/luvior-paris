-- Contact form messages (written only by the contact-message Edge Function with the service role).
-- Admins can read them; the public cannot read or write directly.
create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  reason text not null,
  order_number text,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_email_created_idx on public.contact_messages (email, created_at desc);

alter table public.contact_messages enable row level security;

do $$ begin
  create policy "contact_messages: admin read" on public.contact_messages for select using (is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "contact_messages: admin delete" on public.contact_messages for delete using (is_admin());
exception when duplicate_object then null; end $$;
