-- Wingman initial schema. Run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- Catalog -------------------------------------------------------------------
create table if not exists products (
  id text primary key,                         -- `${store}-${shopifyProductId}`
  store text not null,
  store_name text not null,
  name text not null,
  price numeric(10,2) not null,                -- SGD
  currency text not null default 'SGD' check (currency = 'SGD'),
  original_price numeric(10,2) not null,
  original_currency text not null,
  tier text not null check (tier in ('budget','mid','luxury')),
  category text not null check (category in ('top','outerwear','bottom','shoes','watch','glasses','accessory')),
  colour text not null,
  formality text not null check (formality in ('casual','smart-casual','formal')),
  occasions text[] not null default '{}',
  image text not null,
  images text[] not null default '{}',
  url text not null,
  variants jsonb not null default '[]',        -- [{id,size,available}]
  in_stock boolean not null default false,     -- any variant available
  updated_at timestamptz not null default now()
);
create index if not exists products_pick_idx on products (category, tier, formality) where in_stock;
create index if not exists products_store_idx on products (store);
create index if not exists products_occasions_idx on products using gin (occasions);

-- User photos (auto-deleted after 24 hours) ---------------------------------
create table if not exists selfies (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,                  -- private bucket `selfies`
  sha256 text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists selfies_expires_idx on selfies (expires_at);

-- YouCam render cache --------------------------------------------------------
create table if not exists render_cache (
  cache_key text primary key,                  -- sha256(selfieHash|productId|api|params)
  api text not null,
  selfie_sha256 text not null,
  product_id text,
  params jsonb not null default '{}',
  output_path text,                            -- private bucket `renders`
  response jsonb,                              -- non-image APIs (skin analysis, tone)
  created_at timestamptz not null default now()
);
create index if not exists render_cache_selfie_idx on render_cache (selfie_sha256);

-- YouCam unit log ------------------------------------------------------------
create table if not exists youcam_usage (
  id bigserial primary key,
  api text not null,
  units integer not null check (units >= 0),
  cache_key text,
  status text not null check (status in ('reserved','ok','failed')),
  created_at timestamptz not null default now()
);

-- Atomic reserve so parallel renders can't overshoot the unit limit.
create or replace function reserve_youcam_units(
  p_api text, p_units int, p_limit int, p_cache_key text default null
) returns bigint
language plpgsql as $$
declare
  used int;
  new_id bigint;
begin
  perform pg_advisory_xact_lock(42);
  select coalesce(sum(units), 0) into used from youcam_usage where status <> 'failed';
  if used + p_units > p_limit then
    raise exception 'QUOTA' using hint = format('used %s + %s > limit %s', used, p_units, p_limit);
  end if;
  insert into youcam_usage (api, units, cache_key, status)
  values (p_api, p_units, p_cache_key, 'reserved')
  returning id into new_id;
  return new_id;
end $$;

-- Access: server-side service role only. RLS on with no policies blocks anon.
alter table products enable row level security;
alter table selfies enable row level security;
alter table render_cache enable row level security;
alter table youcam_usage enable row level security;
revoke execute on function reserve_youcam_units(text, int, int, text) from anon, authenticated, public;

-- Storage: private buckets, accessed through signed URLs -------------------
insert into storage.buckets (id, name, public)
values ('selfies', 'selfies', false), ('renders', 'renders', false)
on conflict (id) do nothing;
