-- ══════════════════════════════════════════════════════════════════
--  Schéma d'une boutique — à exécuter UNE FOIS par nouvelle boutique
--
--  Remplacer {{prefix}} par la valeur de `PREFIX` dans
--  config/store.config.ts, puis exécuter dans le projet Supabase.
--  (Le script scripts/create-store.mjs le fait automatiquement.)
--
--  ⚠️ RLS activée SANS AUCUNE POLICY, volontairement : seule la clé
--  service role (côté serveur) accède aux données. La clé anonyme,
--  exposée au navigateur, ne sert qu'à la présence temps réel et ne
--  doit rien pouvoir lire. Ajouter une policy « lecture publique »
--  exposerait les commandes et les clients.
-- ══════════════════════════════════════════════════════════════════

-- Stockage clé→valeur : catalogue, commandes, clients, passerelles,
-- pixels, brouillons de paiement, verrous d'idempotence.
create table if not exists public.{{prefix}}_kv (
  key        text primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

-- Journal des visites (une ligne par vue ou événement).
create table if not exists public.{{prefix}}_visits (
  id       bigserial primary key,
  ts       timestamptz not null default now(),
  path     text,
  referrer text,
  visitor  text,
  type     text not null default 'view',
  ip       text,
  city     text
);
create index if not exists {{prefix}}_visits_ts_idx      on public.{{prefix}}_visits (ts);
create index if not exists {{prefix}}_visits_visitor_idx on public.{{prefix}}_visits (visitor);

-- Visiteurs uniques (agrégat mis à jour à chaque visite).
create table if not exists public.{{prefix}}_visitors (
  id         text primary key,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  count      integer     not null default 1,
  last_path  text,
  ip         text,
  city       text
);

alter table public.{{prefix}}_kv       enable row level security;
alter table public.{{prefix}}_visits    enable row level security;
alter table public.{{prefix}}_visitors  enable row level security;
