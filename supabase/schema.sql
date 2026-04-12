-- AutoFilm — Supabase Schema
-- Run this in the Supabase SQL editor: supabase.com/dashboard/project/_/sql
-- Creates all tables, indexes, and Row Level Security policies

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists rooftops (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  dealer_group     text,
  plan             text not null default 'standard',  -- standard | branded | enterprise
  stripe_customer_id text,
  active           bool not null default true,

  -- Tenant branding (populated during onboarding)
  logo_url         text,                -- dealer logo image
  brand_color      text default '#D94F00', -- primary hex color
  secondary_color  text,                -- optional secondary hex
  website          text,                -- e.g. harteautogroup.com
  phone            text,                -- dealer main phone
  email            text,                -- dealer contact email
  address          text,                -- physical address
  city             text,
  state            text,
  zip              text,

  -- Product config
  trade_url        text,                -- custom trade-in URL (e.g. hartecash.com/trade)
  sms_greeting     text,                -- custom SMS opening line
  sms_signature    text,                -- custom SMS signature

  -- Onboarding
  onboarded        bool not null default false,
  onboarded_at     timestamptz,
  onboard_step     int not null default 0,  -- tracks progress (0-5)

  -- Cross-platform
  source           text not null default 'autofilm',  -- autofilm | autocurb | manual
  autocurb_tenant_id text,              -- linked autocurb.io tenant ID

  created_at       timestamptz not null default now()
);

create table if not exists reps (
  id               uuid primary key default gen_random_uuid(),
  rooftop_id       uuid references rooftops(id) on delete cascade,
  name             text not null,
  nickname         text,
  title            text default 'Sales Consultant',
  email            text unique not null,
  photo_url        text,
  push_subscription jsonb,  -- Web Push subscription object for notifications
  onboarded        bool not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists videos (
  id               uuid primary key default gen_random_uuid(),
  rep_id           uuid references reps(id) on delete cascade,
  rooftop_id       uuid references rooftops(id) on delete cascade,
  mux_asset_id     text,
  mux_playback_id  text,
  customer_name    text,
  customer_phone   text,
  vehicle          text,
  short_code       text unique not null,
  sent_at          timestamptz,
  last_watched_at  timestamptz,
  max_watch_pct    int not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists watch_events (
  id               uuid primary key default gen_random_uuid(),
  video_id         uuid references videos(id) on delete cascade,
  watch_pct        int not null default 0,
  watch_seconds    int not null default 0,
  ip               text,
  user_agent       text,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- AUTOCURB PLATFORM — MULTI-PRODUCT TABLES
-- Shared across all products: AutoCurb, AutoFilm, AutoFrame, Clear Deal
-- ============================================================

-- Product registry — defines the products in the ecosystem
create table if not exists products (
  id               text primary key,        -- 'autocurb' | 'autofilm' | 'autoframe' | 'cleardeal'
  name             text not null,            -- Display name
  description      text,
  icon             text,                     -- emoji or SVG path
  base_url         text not null,            -- https://autofilm.autocurb.io
  active           bool not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

-- Seed the 4 products
insert into products (id, name, description, icon, base_url, sort_order) values
  ('autocurb',  'Autocurb.io', 'Off-street vehicle acquisition — buy cars from customers, not auctions', '🚗', 'https://autocurb.io',                  0),
  ('cleardeal', 'Clear Deal',  'Window stickers + FTC-compliant addendums with digital signatures',      '📋', 'https://cleardeal.autocurb.io',         1),
  ('autoframe', 'AutoFrame',   'Vehicle photography — auto background removal and consistent lighting',  '📷', 'https://autoframe.autocurb.io',         2),
  ('autovideo', 'AutoVideo',   'Personal video messaging + walkarounds + MPI for service department',    '🎬', 'https://autovideo.autocurb.io',         3)
on conflict (id) do nothing;

-- Subscription bundles — defines pricing tiers
create table if not exists bundles (
  id               text primary key,        -- 'starter' | 'professional' | 'growth' | 'enterprise'
  name             text not null,
  price_monthly    int not null default 0,   -- cents
  price_annual     int not null default 0,   -- cents (per month equivalent)
  product_ids      text[] not null,          -- e.g. {'autocurb','cleardeal'}
  stripe_price_monthly text,                 -- Stripe price ID
  stripe_price_annual  text,                 -- Stripe price ID
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

-- Seed bundles (matching the architecture plan)
insert into bundles (id, name, price_monthly, price_annual, product_ids, sort_order) values
  ('starter',      'Starter',      49500,  39500,  '{autocurb,cleardeal}',                          0),
  ('professional', 'Professional', 99500,  79500,  '{autocurb,cleardeal}',                          1),
  ('growth',       'Growth',       149500, 119500, '{autocurb,cleardeal,autoframe,autovideo}',       2),
  ('enterprise',   'Enterprise',   249500, 199500, '{autocurb,cleardeal,autoframe,autovideo}',       3)
on conflict (id) do nothing;

-- Product access per rooftop — which products a tenant can use
create table if not exists product_access (
  id               uuid primary key default gen_random_uuid(),
  rooftop_id       uuid references rooftops(id) on delete cascade,
  product_id       text references products(id) on delete cascade,
  bundle_id        text references bundles(id),    -- which bundle granted this
  granted_at       timestamptz not null default now(),
  expires_at       timestamptz,                    -- null = never expires
  unique(rooftop_id, product_id)
);

-- Shared vehicle file — one VIN = one file across ALL products
-- Photos from AutoFrame, stickers from Clear Deal, leads from AutoCurb,
-- videos from AutoFilm all link to the same VIN
create table if not exists vehicle_files (
  id               uuid primary key default gen_random_uuid(),
  rooftop_id       uuid references rooftops(id) on delete cascade,
  vin              text not null,
  year             int,
  make             text,
  model            text,
  trim             text,
  exterior_color   text,
  stock_number     text,
  status           text default 'active',           -- active | sold | archived

  -- Cross-product references
  autoframe_photos jsonb default '[]'::jsonb,       -- [{url, angle, created_at}]
  cleardeal_sticker_id text,                        -- link to Clear Deal sticker
  autocurb_lead_id text,                            -- link to AutoCurb acquisition lead
  autovideo_video_ids text[] default '{}',            -- AutoVideo video short_codes for this VIN

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(rooftop_id, vin)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists videos_short_code_idx    on videos(short_code);
create index if not exists videos_rep_id_idx        on videos(rep_id);
create index if not exists videos_rooftop_id_idx    on videos(rooftop_id);
create index if not exists videos_sent_at_idx       on videos(sent_at desc);
create index if not exists watch_events_video_id_idx on watch_events(video_id);
create index if not exists watch_events_created_idx  on watch_events(created_at desc);
create index if not exists reps_rooftop_id_idx      on reps(rooftop_id);
create index if not exists reps_email_idx           on reps(email);
create index if not exists product_access_rooftop_idx on product_access(rooftop_id);
create index if not exists product_access_product_idx on product_access(product_id);
create index if not exists vehicle_files_rooftop_idx  on vehicle_files(rooftop_id);
create index if not exists vehicle_files_vin_idx      on vehicle_files(vin);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table rooftops      enable row level security;
alter table reps          enable row level security;
alter table videos        enable row level security;
alter table watch_events  enable row level security;
alter table product_access enable row level security;
alter table vehicle_files  enable row level security;

-- Reps can read/write their own rooftop's data
-- Service role (backend) bypasses RLS entirely

create policy "Reps read own rooftop"
  on rooftops for select
  using (id in (
    select rooftop_id from reps where email = auth.jwt()->>'email'
  ));

create policy "Reps read own data"
  on reps for select
  using (email = auth.jwt()->>'email' or rooftop_id in (
    select rooftop_id from reps where email = auth.jwt()->>'email'
  ));

create policy "Reps update own profile"
  on reps for update
  using (email = auth.jwt()->>'email');

create policy "Reps read own videos"
  on videos for select
  using (rooftop_id in (
    select rooftop_id from reps where email = auth.jwt()->>'email'
  ));

create policy "Watch events readable by rep's rooftop"
  on watch_events for select
  using (video_id in (
    select v.id from videos v
    join reps r on r.rooftop_id = v.rooftop_id
    where r.email = auth.jwt()->>'email'
  ));

-- Products table is publicly readable (no secrets)
create policy "Products readable by all"
  on products for select using (true);

-- Product access scoped to own rooftop
create policy "Product access readable by own rooftop"
  on product_access for select
  using (rooftop_id in (
    select rooftop_id from reps where email = auth.jwt()->>'email'
  ));

-- Vehicle files scoped to own rooftop
create policy "Vehicle files readable by own rooftop"
  on vehicle_files for select
  using (rooftop_id in (
    select rooftop_id from reps where email = auth.jwt()->>'email'
  ));

create policy "Vehicle files writable by own rooftop"
  on vehicle_files for insert
  with check (rooftop_id in (
    select rooftop_id from reps where email = auth.jwt()->>'email'
  ));

create policy "Vehicle files updatable by own rooftop"
  on vehicle_files for update
  using (rooftop_id in (
    select rooftop_id from reps where email = auth.jwt()->>'email'
  ));

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- Video stats per rep (used in Command leaderboard)
create or replace view rep_stats as
  select
    r.id as rep_id,
    r.name as rep_name,
    r.rooftop_id,
    count(v.id)                           as videos_sent,
    count(v.id) filter (where v.sent_at is not null) as sms_sent,
    avg(v.max_watch_pct)                  as avg_watch_pct,
    count(v.id) filter (where v.max_watch_pct >= 75) as hot_leads,
    max(v.sent_at)                        as last_sent_at
  from reps r
  left join videos v on v.rep_id = r.id
  group by r.id, r.name, r.rooftop_id;
