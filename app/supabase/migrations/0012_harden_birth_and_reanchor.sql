-- 0012_harden_birth_and_reanchor.sql
--
-- Fixes from the adversarial review of the overhaul:
--  * log_birth could assign duplicate seq under concurrent calls (two people
--    logging a birth at once) -> add a per-litter advisory lock + a unique
--    constraint as a backstop.
--  * recurrence rules created before 0011 have null anchors, so they still
--    don't re-flow when whelping moves -> backfill the known default rules.

-- ---- birth_events: no two events share a seq within a litter ----------------
alter table birth_events add constraint birth_events_litter_seq_uniq unique (litter_id, seq);

-- ---- log_birth: serialise seq assignment per litter -------------------------
create or replace function log_birth(p_litter_id uuid, p_type text, p_born_at timestamptz)
returns uuid
language plpgsql
as $$
declare
  v_space  uuid;
  v_letter text;
  v_seq    int;
  v_puppy  uuid;
  v_event  uuid;
begin
  if p_type not in ('born', 'stillborn') then
    raise exception 'invalid birth type: %', p_type;
  end if;

  select space_id, letter into v_space, v_letter from litters where id = p_litter_id;
  if v_space is null then
    raise exception 'litter not found or not accessible';
  end if;

  -- Serialise concurrent births for this litter so seq/name can't collide.
  perform pg_advisory_xact_lock(hashtext(p_litter_id::text));

  select coalesce(max(seq), 0) + 1 into v_seq from birth_events where litter_id = p_litter_id;

  if p_type = 'born' then
    insert into puppies (space_id, litter_id, name, litter_affix, birth_date_time)
    values (v_space, p_litter_id, coalesce(v_letter, '') || v_seq::text, v_letter, p_born_at)
    returning id into v_puppy;
  end if;

  insert into birth_events (space_id, litter_id, seq, born_at, type, puppy_id)
  values (v_space, p_litter_id, v_seq, p_born_at, p_type, v_puppy)
  returning id into v_event;

  return v_event;
end $$;

revoke execute on function log_birth(uuid, text, timestamptz) from public;
grant execute on function log_birth(uuid, text, timestamptz) to authenticated;

-- ---- backfill anchors on pre-0011 default litter rules ----------------------
update recurrence_rules set start_anchor = 'whelping', start_offset = 0
  where scope = 'litter' and start_anchor is null
    and name in ('Weigh puppies', 'Clean whelping box');

update recurrence_rules set start_anchor = 'whelping', start_offset = 0,
       end_anchor = 'whelping', end_offset = 21
  where scope = 'litter' and start_anchor is null
    and name = 'Whelping box temperature';

update recurrence_rules set start_anchor = 'whelping', start_offset = 21
  where scope = 'litter' and start_anchor is null
    and name = 'Socialization — 15 min handling';
