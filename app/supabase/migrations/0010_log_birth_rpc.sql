-- 0010_log_birth_rpc.sql
--
-- Atomic birth logging. The old birth log did two separate unchecked client
-- writes (insert puppy, then append to litters.whelping_log), so a mid-way
-- failure left an orphan puppy or a log entry with no puppy. This RPC creates
-- the puppy (for a live birth) and its birth_events row in one transaction and
-- returns the event id.
--
-- SECURITY INVOKER (the default): it runs as the calling user, so RLS on
-- litters / puppies / birth_events is enforced. `select ... from litters` is
-- RLS-filtered, so a non-member gets no row (v_space stays null -> raises), and
-- the inserts are gated by each table's is_space_member(space_id) WITH CHECK.
-- No SECURITY DEFINER, so there is no anon-callable privileged path.

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

-- Keep it off the anonymous surface; signed-in members only (RLS still applies).
revoke execute on function log_birth(uuid, text, timestamptz) from public;
grant execute on function log_birth(uuid, text, timestamptz) to authenticated;
