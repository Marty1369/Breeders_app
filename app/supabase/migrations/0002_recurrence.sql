-- Litter Planner — recurrence engine (Ongoing tasks)
-- Adds recurring rules + per-occurrence check state, mirroring the design
-- prototype's rules[] / checks{} model. Apply after 0001_init.sql.

-- ============================================================================
-- RECURRENCE RULES
-- ============================================================================

create table recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  litter_id uuid references litters(id) on delete cascade,  -- null when scope = 'kennel'
  name text not null,
  scope text not null check (scope in ('kennel','litter')),
  freq text not null check (freq in ('daily','weekly','everyN')),
  interval int not null default 1,
  times text[] not null default '{}',        -- ['08:00','20:00']
  start_date date not null,
  end_type text not null default 'never' check (end_type in ('never','date','keydate','count')),
  end_key text,                              -- e.g. 'weaning','handover' when end_type = 'keydate'
  end_date date,                             -- when end_type = 'date'
  end_count int,                             -- when end_type = 'count'
  assignee_ids uuid[] not null default '{}', -- rotated across occurrences
  paused boolean not null default false,
  created_at timestamptz not null default now()
);

alter table recurrence_rules enable row level security;
create policy recurrence_rules_all on recurrence_rules for all
  using (is_space_member(space_id)) with check (is_space_member(space_id));
create index recurrence_rules_space_idx on recurrence_rules (space_id);
create index recurrence_rules_litter_idx on recurrence_rules (litter_id);

-- ============================================================================
-- RULE CHECKS — one row per completed/skipped occurrence
-- ============================================================================

create table rule_checks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  rule_id uuid not null references recurrence_rules(id) on delete cascade,
  occ_date date not null,
  occ_time text not null,                    -- 'HH:MM' of the occurrence slot
  status text not null check (status in ('done','skip')),
  done_by uuid references auth.users(id),
  done_at text,                              -- 'HH:MM' actually logged (display only)
  created_at timestamptz not null default now(),
  unique (rule_id, occ_date, occ_time)
);

alter table rule_checks enable row level security;
create policy rule_checks_all on rule_checks for all
  using (is_space_member(space_id)) with check (is_space_member(space_id));
create index rule_checks_rule_idx on rule_checks (rule_id, occ_date);

-- ============================================================================
-- REALTIME
-- ============================================================================

alter publication supabase_realtime add table recurrence_rules, rule_checks;
