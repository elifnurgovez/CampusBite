-- Geçmiş AI analizleri: ürün adı, etki puanı, zaman
-- Supabase SQL Editor'da veya CLI ile uygulayın.

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  product_id text,
  product_name text not null,
  impact_score smallint not null check (impact_score >= 0 and impact_score <= 100),
  created_at timestamptz not null default now()
);

create index if not exists scans_created_at_idx on public.scans (created_at desc);

alter table public.scans enable row level security;

-- Anon anahtar ile okuma / ekleme (geliştirme ve PRD’deki istemci akışı için)
create policy "scans_select_anon" on public.scans
  for select using (true);

create policy "scans_insert_anon" on public.scans
  for insert with check (true);
