-- 0008_kennel_data_model.sql
--
-- Extends the data model to cover what the kennel actually records and what the
-- VŠMB/LKD submission forms require (litter notification, pedigree order, export
-- certificate), plus the whelping-night capture from the paper birth sheet.
--
-- Design decisions captured with the breeder (2026-07-10):
--   * one breed per dog; breed lives on the LITTER (kennel runs several breeds)
--   * price lives on the PUPPY (feeds litter balance); owner payments already
--     support partials via the payments jsonb
--   * puppy status is a manual, fixed set; `deceased` frees close-out
--   * coat + collar colours are per-breed, editable (breed_catalog)
--   * health_entries becomes the general medication log (dam + puppy scope)
--
-- Idempotent (add column if not exists) so it is safe to re-run. Apply after 0007.

-- ============================================================================
-- SPACES — kennel-level fields required by the pedigree order form
-- ============================================================================
alter table spaces add column if not exists club     text;             -- e.g. 'VŠMB'
alter table spaces add column if not exists vmvt_no  text;             -- 'VMVT vet. patvirtinimo Nr.', e.g. 'LT 77-13-282'
alter table spaces add column if not exists breeds   text[] not null default '{}';  -- breeds this kennel manages

-- ============================================================================
-- DOGS — conformation, health and titles the pedigree/export forms need
-- ============================================================================
alter table dogs add column if not exists color          text;
alter table dogs add column if not exists tail           text;   -- NBT / long / docked
alter table dogs add column if not exists eyes           text;
alter table dogs add column if not exists eyes_exam_date date;
alter table dogs add column if not exists elbows         text;
alter table dogs add column if not exists dentition      text;
alter table dogs add column if not exists bite           text;   -- scissor / level / under / over
alter table dogs add column if not exists titles         text;   -- 'LT JCH, LV JCH, BALTIC JCH...'
alter table dogs add column if not exists show_results   text;   -- 'Įvertinimai': 3xCAC, 2xN...
alter table dogs add column if not exists working_tests  text;   -- 'Dresūra, bandymai': NHAT test...
alter table dogs add column if not exists faults         text;   -- klubo pastabos / trūkumai
alter table dogs add column if not exists registry       text;   -- LOF / CMKU / LŠVK ...
alter table dogs add column if not exists genetics_notes text;   -- free prose: 'MDR1 & DM (carrier), HSF4, CEA, PRA - clear'

-- ============================================================================
-- LITTERS — breed per litter (VŠMB 'Veislė')
-- ============================================================================
alter table litters add column if not exists breed text;

-- ============================================================================
-- PUPPIES — price + paper-sheet identity fields
-- ============================================================================
alter table puppies add column if not exists price        numeric;  -- feeds litter balance / profitability
alter table puppies add column if not exists collar_color text;      -- 'Antkaklis'
alter table puppies add column if not exists tail         text;      -- NBT / long
alter table puppies add column if not exists markings     text;      -- 'Bruožai'

-- ============================================================================
-- HEALTH_ENTRIES -> general medication + health log (dam and puppy scope)
-- ============================================================================
alter table health_entries drop constraint if exists health_entries_type_check;
alter table health_entries add constraint health_entries_type_check
  check (type in ('vaccination','deworming','vet_check','medication'));

alter table health_entries add column if not exists dog_id   uuid references dogs(id) on delete cascade;  -- dam-scoped meds
alter table health_entries add column if not exists dose     text;
alter table health_entries add column if not exists route    text;   -- oral / SC / IM / IV
alter table health_entries add column if not exists given_at timestamptz;

-- ============================================================================
-- OWNERS — granular address for the export certificate
-- ============================================================================
alter table owners add column if not exists first_name  text;
alter table owners add column if not exists surname     text;
alter table owners add column if not exists street      text;
alter table owners add column if not exists city        text;
alter table owners add column if not exists postal_code text;
-- `country` already exists; legacy `name`/`address` kept for display/back-compat.

-- ============================================================================
-- BREED_CATALOG — per-breed, editable coat + collar colour options
-- ============================================================================
create table if not exists breed_catalog (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references spaces(id) on delete cascade,
  breed      text not null,
  kind       text not null check (kind in ('coat','collar')),
  label      text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
alter table breed_catalog enable row level security;
drop policy if exists breed_catalog_all on breed_catalog;
create policy breed_catalog_all on breed_catalog for all
  using (is_space_member(space_id)) with check (is_space_member(space_id));
create index if not exists breed_catalog_space_idx on breed_catalog (space_id, breed, kind);

-- ============================================================================
-- WHELPING_SESSIONS — one per litter; replaces the paper sheet header
-- ============================================================================
create table if not exists whelping_sessions (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references spaces(id) on delete cascade,
  litter_id     uuid not null references litters(id) on delete cascade,
  mucus_plug_at timestamptz,                    -- 'Kamščio laikas'
  started_at    timestamptz,
  ended_at      timestamptz,
  delivery_mode text check (delivery_mode in ('natural','c_section','mixed')),
  vet_attended  boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (litter_id)
);
alter table whelping_sessions enable row level security;
drop policy if exists whelping_sessions_all on whelping_sessions;
create policy whelping_sessions_all on whelping_sessions for all
  using (is_space_member(space_id)) with check (is_space_member(space_id));
create index if not exists whelping_sessions_litter_idx on whelping_sessions (litter_id);

-- ============================================================================
-- BIRTH_EVENTS — one row per puppy/stillborn (replaces whelping_log jsonb)
-- Columns map 1:1 to the paper birth sheet.
-- ============================================================================
create table if not exists birth_events (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references spaces(id) on delete cascade,
  litter_id       uuid not null references litters(id) on delete cascade,
  session_id      uuid references whelping_sessions(id) on delete set null,
  puppy_id        uuid references puppies(id) on delete set null,
  seq             int,                          -- 'No.'
  born_at         timestamptz,                  -- 'Laikas'
  type            text not null default 'born' check (type in ('born','stillborn')),
  sex             text check (sex in ('male','female')),   -- 'Lytis'
  color           text,                         -- 'Spalva'
  weight_g        int,                          -- 'Svoris, g'
  markings        text,                         -- 'Bruožai'
  dewclaws        text,                         -- 'Pirštai'
  palate_ok       boolean,                      -- 'Gomurys'
  presentation    text,                         -- head / breech
  placenta_passed boolean,                      -- 'Placenta'
  calcium_given   boolean,                      -- 'Kalcis'
  collar_color    text,                         -- 'Antkaklis'
  photo           text,                         -- storage path
  notes           text,
  created_at      timestamptz not null default now()
);
alter table birth_events enable row level security;
drop policy if exists birth_events_all on birth_events;
create policy birth_events_all on birth_events for all
  using (is_space_member(space_id)) with check (is_space_member(space_id));
create index if not exists birth_events_litter_idx on birth_events (litter_id, seq);

-- ============================================================================
-- DAM_VITALS — temperature log (pre-whelp drop + postpartum fever watch)
-- ============================================================================
create table if not exists dam_vitals (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references spaces(id) on delete cascade,
  litter_id   uuid references litters(id) on delete cascade,
  dog_id      uuid references dogs(id) on delete cascade,
  measured_at timestamptz not null default now(),
  temp_c      numeric,
  phase       text check (phase in ('pre_whelp','postpartum')),
  note        text,
  created_at  timestamptz not null default now()
);
alter table dam_vitals enable row level security;
drop policy if exists dam_vitals_all on dam_vitals;
create policy dam_vitals_all on dam_vitals for all
  using (is_space_member(space_id)) with check (is_space_member(space_id));
create index if not exists dam_vitals_litter_idx on dam_vitals (litter_id, measured_at);

-- ============================================================================
-- REALTIME (guarded: alter publication ... add table aborts if already added)
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array['breed_catalog','whelping_sessions','birth_events','dam_vitals'] loop
    if not exists (
      select 1 from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      where p.pubname = 'supabase_realtime' and c.relname = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
