-- Litter Planner — initial schema
-- Paste this whole file into Supabase Studio -> SQL Editor -> New query -> Run.
-- Safe to re-run only if you drop the schema first; this is a from-scratch init.

create extension if not exists pgcrypto;

-- ============================================================================
-- SPACES & MEMBERS
-- ============================================================================

create table spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kennel_name text,
  affix text,
  breeder_name text,
  breeder_address text,
  breeder_phone text,
  breeder_email text,
  invite_token text unique default encode(gen_random_bytes(16), 'hex'),
  invite_token_expires_at timestamptz not null default (now() + interval '7 days'),
  notif_rules jsonb not null default '{
    "due_hour": 7, "overdue_hour": 7,
    "milestone_days_before": [7, 1],
    "heat_watch_days_before": 14
  }',
  created_at timestamptz not null default now()
);

create table space_members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  avatar_color text not null default '#17805a',
  role text not null default 'member', -- unused in MVP, reserved for future RBAC
  notif_prefs jsonb not null default '{"push":true,"email":false,"assignments":true,"milestones":true,"teammatesTasks":false}',
  push_tokens jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (space_id, user_id)
);

-- Helper: is the current user a member of this space? (security definer to dodge RLS recursion)
create or replace function is_space_member(p_space_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from space_members m
    where m.space_id = p_space_id and m.user_id = auth.uid()
  );
$$;

alter table spaces enable row level security;
alter table space_members enable row level security;

create policy spaces_select on spaces for select using (is_space_member(id));
create policy spaces_update on spaces for update using (is_space_member(id));
-- Creating a space is allowed to any authenticated user; the create_space() RPC
-- below does it as SECURITY DEFINER anyway, this just guards direct inserts.
create policy spaces_insert on spaces for insert with check (auth.uid() is not null);

create policy space_members_select on space_members for select using (is_space_member(space_id));
-- You may insert yourself as a member if you're already one (no-op, blocked by unique)
-- or if the space has zero members yet (i.e. you're the creator finishing setup).
create policy space_members_insert on space_members for insert with check (
  user_id = auth.uid() and (
    is_space_member(space_id) or
    not exists (select 1 from space_members m2 where m2.space_id = space_members.space_id)
  )
);
create policy space_members_update on space_members for update using (
  user_id = auth.uid() or is_space_member(space_id)
);
create policy space_members_delete on space_members for delete using (user_id = auth.uid());

-- ============================================================================
-- DOGS
-- ============================================================================

create table dogs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  name text not null,
  sex text not null check (sex in ('male','female')),
  breed text,
  dob date,
  reg_no text,
  chip_no text,
  photos jsonb not null default '[]',
  genetics jsonb not null default '[]', -- [{test,result,byParentage}]
  hips text,
  is_external boolean not null default false,
  external_owner jsonb, -- {name,phone,city}
  heats jsonb not null default '[]', -- [{startedAt}]
  next_heat_predicted date,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table dogs enable row level security;
create policy dogs_all on dogs for all using (is_space_member(space_id)) with check (is_space_member(space_id));

-- ============================================================================
-- LITTERS
-- ============================================================================

create table litters (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  code text,
  name text not null,
  letter text,
  dam_id uuid references dogs(id),
  sire_id uuid references dogs(id),
  status text not null default 'planned' check (status in ('planned','pregnant','born','closed','did_not_take')),
  -- dates: { heat: {predicted, actual}, ovulation: {...}, mating: {...}, whelping: {...}, weaning: {...}, handover: {...} }
  dates jsonb not null default '{}',
  whelping_log jsonb not null default '[]', -- [{ts, type(born|stillborn), puppyId?, note?}]
  created_at timestamptz not null default now()
);

alter table litters enable row level security;
create policy litters_all on litters for all using (is_space_member(space_id)) with check (is_space_member(space_id));

-- ============================================================================
-- TASK TEMPLATES & TASKS
-- ============================================================================

create table task_templates (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  name text not null,
  phase text not null check (phase in ('prewhelp','t1_birth','t2_wean','t3_social')),
  anchor text not null check (anchor in ('heat','ovulation','mating','whelping','handover')),
  offset_days int not null default 0,
  duration_days int not null default 0,
  repeat jsonb, -- {every, count}
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table task_templates enable row level security;
create policy task_templates_all on task_templates for all using (is_space_member(space_id)) with check (is_space_member(space_id));

create table tasks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  litter_id uuid not null references litters(id) on delete cascade,
  template_id uuid references task_templates(id),
  name text not null,
  phase text not null check (phase in ('prewhelp','t1_birth','t2_wean','t3_social')),
  start_date date not null,
  due_date date,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  assignee_ids uuid[] not null default '{}',
  is_pinned_date boolean not null default false,
  anchor_mode text not null default 'anchor+offset' check (anchor_mode in ('fixed','anchor+offset')),
  anchor text check (anchor in ('heat','ovulation','mating','whelping','handover')),
  offset_days int,
  notes text,
  comments jsonb not null default '[]', -- [{ts, byUserId, text}]
  checklist jsonb not null default '[]', -- [{label,done}]
  cost_expected boolean not null default false,
  result_log jsonb, -- {type(progesterone|weight|ultrasound|note), value, unit}
  created_at timestamptz not null default now()
);

alter table tasks enable row level security;
create policy tasks_all on tasks for all using (is_space_member(space_id)) with check (is_space_member(space_id));

create index tasks_litter_idx on tasks (litter_id);
create index tasks_space_date_idx on tasks (space_id, start_date);

-- ============================================================================
-- PUPPIES
-- ============================================================================

create table puppies (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  litter_id uuid not null references litters(id) on delete cascade,
  name text not null default '',
  litter_affix text,
  sex text check (sex in ('male','female')),
  color text,
  birth_date_time timestamptz,
  birth_weight int,
  chip_no text,
  reg_no text,
  photos jsonb not null default '[]',
  genetics jsonb not null default '[]',
  weigh_log jsonb not null default '{}', -- { "YYYY-MM-DD": {am, pm} }
  status text not null default 'available' check (status in ('available','reserved','coowned','export','deceased')),
  handover jsonb not null default '{"contractSigned":false,"paymentComplete":false,"chipRegistered":false,"passportGiven":false}',
  owner_id uuid,
  created_at timestamptz not null default now()
);

alter table puppies enable row level security;
create policy puppies_all on puppies for all using (is_space_member(space_id)) with check (is_space_member(space_id));
create index puppies_litter_idx on puppies (litter_id);

-- ============================================================================
-- OWNERS
-- ============================================================================

create table owners (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  email text,
  country text,
  payments jsonb not null default '[]', -- [{amount,date,kind(deposit|final),method}]
  full_price numeric not null default 0,
  handover_date date,
  notes text,
  waiting_list_for uuid references litters(id),
  data_source text not null default 'manual' check (data_source in ('manual','link')),
  link_filled_at timestamptz,
  created_at timestamptz not null default now()
);

alter table owners enable row level security;
create policy owners_all on owners for all using (is_space_member(space_id)) with check (is_space_member(space_id));

alter table puppies add constraint puppies_owner_fk foreign key (owner_id) references owners(id) on delete set null;

-- ============================================================================
-- HEALTH ENTRIES
-- ============================================================================

create table health_entries (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  litter_id uuid not null references litters(id) on delete cascade,
  type text not null check (type in ('vaccination','deworming','vet_check')),
  product text,
  date date not null,
  applies_to jsonb not null default '"all"', -- "all" or [puppyIds]
  by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table health_entries enable row level security;
create policy health_entries_all on health_entries for all using (is_space_member(space_id)) with check (is_space_member(space_id));

-- ============================================================================
-- PAYERS & EXPENSES
-- ============================================================================

create table payers (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  label text not null,
  owner_user_id uuid,
  created_at timestamptz not null default now()
);

alter table payers enable row level security;
create policy payers_all on payers for all using (is_space_member(space_id)) with check (is_space_member(space_id));

create table expenses (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  litter_id uuid references litters(id) on delete cascade,
  date date not null,
  description text not null,
  category text not null check (category in ('vet_tests','travel','food','lodging','mating','documents','supplies','other')),
  amount_eur numeric not null,
  payer_id uuid references payers(id),
  receipt_photo text,
  task_id uuid references tasks(id),
  created_at timestamptz not null default now()
);

alter table expenses enable row level security;
create policy expenses_all on expenses for all using (is_space_member(space_id)) with check (is_space_member(space_id));
create index expenses_litter_idx on expenses (litter_id);

-- ============================================================================
-- DOCUMENTS & UPLOADS
-- ============================================================================

create table documents (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  litter_id uuid references litters(id) on delete cascade,
  puppy_id uuid references puppies(id) on delete cascade,
  type text not null check (type in ('sale_lt','sale_en','coown','export','mating')),
  field_values jsonb not null default '{}',
  missing_fields jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft','ready','sent','signed','submitted','approved')),
  history jsonb not null default '[]', -- [{ts,event,byUserId}]
  pdf_url text,
  created_at timestamptz not null default now()
);

alter table documents enable row level security;
create policy documents_all on documents for all using (is_space_member(space_id)) with check (is_space_member(space_id));

create table uploads (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  litter_id uuid references litters(id) on delete set null,
  puppy_id uuid references puppies(id) on delete set null,
  owner_id uuid references owners(id) on delete set null,
  file text not null, -- storage path
  name text not null,
  mime_type text,
  by_user_id uuid,
  task_id uuid references tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table uploads enable row level security;
create policy uploads_all on uploads for all using (is_space_member(space_id)) with check (is_space_member(space_id));

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

create table notifications (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'assigned','due','overdue','milestone','comment','weight_alert',
    'plan_shift','invite_joined','heat_watch','whelping_started','litter_cancelled'
  )),
  title text not null,
  body text,
  ref_id uuid,
  ref_type text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;
create policy notifications_select on notifications for select using (user_id = auth.uid());
create policy notifications_update on notifications for update using (user_id = auth.uid());
-- Any space member can create a notification for another member (e.g. task assignment) — no roles in MVP.
-- Requires the target user to actually belong to that space, so notifications can't be forged cross-space.
create policy notifications_insert on notifications for insert with check (
  is_space_member(space_id) and exists (
    select 1 from space_members m where m.space_id = notifications.space_id and m.user_id = notifications.user_id
  )
);

create index notifications_user_idx on notifications (user_id, created_at desc);

-- ============================================================================
-- RPCs
-- ============================================================================

-- Create a new space + first member + default payer + default task template plan.
-- Runs as SECURITY DEFINER so the "zero members yet" insert policy race is avoided.
create or replace function create_space(
  p_name text,
  p_kennel_name text,
  p_affix text,
  p_breeder_name text,
  p_breeder_address text,
  p_breeder_phone text,
  p_breeder_email text,
  p_member_name text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  insert into spaces (name, kennel_name, affix, breeder_name, breeder_address, breeder_phone, breeder_email)
  values (p_name, p_kennel_name, p_affix, p_breeder_name, p_breeder_address, p_breeder_phone, p_breeder_email)
  returning id into v_space_id;

  insert into space_members (space_id, user_id, name, email)
  values (v_space_id, auth.uid(), p_member_name, (select email from auth.users where id = auth.uid()));

  insert into payers (space_id, label) values (v_space_id, 'Cash');

  insert into task_templates (space_id, name, phase, anchor, offset_days, sort_order, repeat) values
    (v_space_id, 'Progesterone test #1', 'prewhelp', 'heat', 10, 5, null),
    (v_space_id, 'Progesterone test #2 — confirm ovulation', 'prewhelp', 'heat', 13, 6, null),
    (v_space_id, '2nd mating (15th day)', 'prewhelp', 'ovulation', 2, 7, null),
    (v_space_id, 'Ultrasound — pregnancy check', 'prewhelp', 'ovulation', 35, 8, null),
    (v_space_id, 'Prepare whelping box', 'prewhelp', 'whelping', -14, 10, null),
    (v_space_id, 'Buy whelping supplies', 'prewhelp', 'whelping', -10, 20, null),
    (v_space_id, 'X-ray — expected puppy count', 'prewhelp', 'whelping', -3, 30, null),
    (v_space_id, 'Set up night-mode camera', 'prewhelp', 'whelping', -2, 40, null),
    (v_space_id, 'Whelping box temperature check', 't1_birth', 'whelping', 0, 50, '{"every":1,"count":21}'),
    (v_space_id, 'Dew claw check with vet', 't1_birth', 'whelping', 3, 70, null),
    (v_space_id, 'Deworming #1', 't1_birth', 'whelping', 14, 80, null),
    (v_space_id, 'Puppy eye check with vet', 't1_birth', 'whelping', 18, 90, null),
    (v_space_id, 'First solid food', 't2_wean', 'whelping', 21, 100, null),
    (v_space_id, 'Socialization handling', 't2_wean', 'whelping', 21, 110, '{"every":1,"count":21}'),
    (v_space_id, 'Deworming #2', 't2_wean', 'whelping', 28, 120, null),
    (v_space_id, 'Photos for buyers — week 4', 't2_wean', 'whelping', 28, 130, null),
    (v_space_id, 'Order pedigrees', 't2_wean', 'whelping', 35, 140, null),
    (v_space_id, 'Deworming #3', 't2_wean', 'whelping', 35, 150, null),
    (v_space_id, 'Microchipping — vet visit', 't2_wean', 'whelping', 42, 160, null),
    (v_space_id, 'Weaning complete', 't2_wean', 'whelping', 42, 170, null),
    (v_space_id, 'Vaccine #1', 't3_social', 'whelping', 49, 180, null),
    (v_space_id, 'Deworming #4', 't3_social', 'whelping', 49, 190, null),
    (v_space_id, 'Contracts prepared', 't3_social', 'whelping', 56, 200, null),
    (v_space_id, 'Vet check before handover', 't3_social', 'whelping', 60, 210, null),
    (v_space_id, 'Handover day — contracts & passports', 't3_social', 'whelping', 63, 220, null);

  return v_space_id;
end;
$$;

-- Join a space via a (non-expired) invite token.
create or replace function join_space_via_invite(
  p_token text,
  p_member_name text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  select id into v_space_id from spaces
    where invite_token = p_token and invite_token_expires_at > now();

  if v_space_id is null then
    raise exception 'invite_invalid_or_expired';
  end if;

  insert into space_members (space_id, user_id, name, email)
  values (v_space_id, auth.uid(), p_member_name, (select email from auth.users where id = auth.uid()))
  on conflict (space_id, user_id) do nothing;

  insert into notifications (space_id, user_id, kind, title, body)
  select v_space_id, m.user_id, 'invite_joined', p_member_name || ' joined the space', null
  from space_members m where m.space_id = v_space_id and m.user_id <> auth.uid();

  return v_space_id;
end;
$$;

-- Rotate a space's invite token (any member may do this — no roles in MVP).
create or replace function rotate_invite(p_space_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not is_space_member(p_space_id) then
    raise exception 'not_a_member';
  end if;
  v_token := encode(gen_random_bytes(16), 'hex');
  update spaces set invite_token = v_token, invite_token_expires_at = now() + interval '7 days'
    where id = p_space_id;
  return v_token;
end;
$$;

-- ============================================================================
-- REALTIME
-- ============================================================================

alter publication supabase_realtime add table
  spaces, space_members, dogs, litters, tasks, puppies, owners,
  health_entries, expenses, documents, uploads, notifications, payers, task_templates;

-- ============================================================================
-- STORAGE
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('space-files', 'space-files', false)
on conflict (id) do nothing;

-- Files are stored at path: {space_id}/{...}. Membership check parses the first
-- path segment back to a space id.
create policy space_files_select on storage.objects for select using (
  bucket_id = 'space-files' and is_space_member((storage.foldername(name))[1]::uuid)
);
create policy space_files_insert on storage.objects for insert with check (
  bucket_id = 'space-files' and is_space_member((storage.foldername(name))[1]::uuid)
);
create policy space_files_update on storage.objects for update using (
  bucket_id = 'space-files' and is_space_member((storage.foldername(name))[1]::uuid)
);
create policy space_files_delete on storage.objects for delete using (
  bucket_id = 'space-files' and is_space_member((storage.foldername(name))[1]::uuid)
);
