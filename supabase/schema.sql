-- ============================================================
-- Repos — Schéma de base de données (Supabase / PostgreSQL)
-- Plateforme de réservation day-use au Gabon
-- À exécuter dans l'éditeur SQL de Supabase (1 seul passage)
-- ============================================================

-- ---------- Profils (lié à auth.users de Supabase) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'client' check (role in ('client','tenancier','admin')),
  loyalty_points int not null default 0,
  referral_code text unique,
  created_at timestamptz not null default now()
);

-- ---------- Établissements ----------
create table if not exists establishments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete set null,
  name text not null,
  type text not null check (type in ('hotel','motel','maison','auberge')),
  city text not null,
  address text,
  lat double precision,
  lng double precision,
  description text,
  stars int check (stars between 0 and 5),
  amenities text[] not null default '{}',
  photos text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Tarifs par créneau ----------
create table if not exists slot_prices (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  slot_type text not null check (slot_type in ('3h','6h','journee','nuit')),
  price_fcfa int not null check (price_fcfa >= 0),
  weekend_price_fcfa int,
  unique(establishment_id, slot_type)
);

-- ---------- Promos flash ----------
create table if not exists promos (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  discount_pct int not null check (discount_pct between 1 and 90),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Extras payants ----------
create table if not exists extras (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  name text not null,
  price_fcfa int not null check (price_fcfa >= 0),
  icon text,
  is_active boolean not null default true
);

-- ---------- Blocages de disponibilités ----------
create table if not exists availability_blocks (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  day date not null,
  slot_type text check (slot_type in ('3h','6h','journee','nuit')), -- null = journée entière
  reason text,
  unique(establishment_id, day, slot_type)
);

-- ---------- Réservations ----------
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- ex. REPOS-XXXX
  establishment_id uuid not null references establishments(id) on delete restrict,
  client_id uuid references profiles(id) on delete set null,
  day date not null,
  slot_type text not null check (slot_type in ('3h','6h','journee','nuit')),
  extras jsonb not null default '[]', -- [{name, price_fcfa}]
  total_fcfa int not null check (total_fcfa >= 0),
  payment_method text check (payment_method in ('airtel','moov','carte','sur_place')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','on_site')),
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','completed','no_show')),
  created_at timestamptz not null default now()
);
create index if not exists bookings_establishment_day_idx on bookings(establishment_id, day);

-- ---------- Avis ----------
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete set null,
  establishment_id uuid not null references establishments(id) on delete cascade,
  client_id uuid references profiles(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  title text,
  comment text,
  owner_reply text,
  is_flagged boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists reviews_establishment_idx on reviews(establishment_id);

-- ---------- Favoris ----------
create table if not exists favorites (
  client_id uuid not null references profiles(id) on delete cascade,
  establishment_id uuid not null references establishments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, establishment_id)
);

-- ---------- Mouvements de fidélité ----------
create table if not exists loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  points int not null, -- positif = gain, négatif = échange
  reason text not null,
  created_at timestamptz not null default now()
);

-- ---------- Messages ----------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_booking_idx on messages(booking_id);

-- ---------- Retraits tenanciers ----------
create table if not exists withdrawals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  amount_fcfa int not null check (amount_fcfa > 0),
  method text not null check (method in ('airtel','moov')),
  phone text not null,
  status text not null default 'pending' check (status in ('pending','paid','rejected')),
  created_at timestamptz not null default now()
);

-- ---------- Équipe ----------
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade, -- le tenancier qui invite
  establishment_id uuid references establishments(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  role text not null check (role in ('proprietaire','manager','receptionniste')),
  status text not null default 'invited' check (status in ('invited','active','revoked')),
  created_at timestamptz not null default now()
);

-- ---------- Parrainage ----------
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referred_id uuid references profiles(id) on delete set null,
  credit_fcfa int not null default 0,
  status text not null default 'pending' check (status in ('pending','validated')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Sécurité : RLS activé avec politiques ouvertes pour la démo.
-- À durcir en production (restreindre par auth.uid() et rôles).
-- ============================================================
alter table profiles enable row level security;
alter table establishments enable row level security;
alter table slot_prices enable row level security;
alter table promos enable row level security;
alter table extras enable row level security;
alter table availability_blocks enable row level security;
alter table bookings enable row level security;
alter table reviews enable row level security;
alter table favorites enable row level security;
alter table loyalty_ledger enable row level security;
alter table messages enable row level security;
alter table withdrawals enable row level security;
alter table team_members enable row level security;
alter table referrals enable row level security;

-- Politiques démo : lecture/écriture ouvertes (à restreindre ensuite)
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','establishments','slot_prices','promos','extras',
    'availability_blocks','bookings','reviews','favorites',
    'loyalty_ledger','messages','withdrawals','team_members','referrals'
  ] loop
    execute format('drop policy if exists "demo_all" on %I', t);
    execute format('create policy "demo_all" on %I for all using (true) with check (true)', t);
  end loop;
end $$;
