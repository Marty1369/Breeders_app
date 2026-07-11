-- 0013_delete_account.sql
--
-- Self-service account deletion (primarily to make testing the signup /
-- create-space flow repeatable; also a sensible GDPR-style "delete my account").
--
-- `delete_account()` removes the CALLING user's auth account and nothing else —
-- it is parameterless and keys entirely off auth.uid(), so a member can only
-- ever delete themselves.
--
-- Cascade behaviour:
--   * space_members.user_id -> auth.users ON DELETE CASCADE, so the deleting
--     user's memberships disappear with the auth row. But we do it explicitly
--     first so we can detect a now-empty space and delete it (which cascades
--     every space-scoped table: dogs, litters, tasks, puppies, whelping, etc.).
--   * Two references to auth.users are ON DELETE NO ACTION and would otherwise
--     block the final delete for any space that SURVIVES (i.e. still has other
--     members): health_entries.by_user_id and rule_checks.done_by. Both are
--     nullable, so we null the caller's rows before removing the auth user.
--     (Rows in deleted spaces are already gone via the space cascade.)
--
-- SECURITY DEFINER + owned by postgres (which holds DELETE on auth.users) so the
-- auth-row delete is permitted. Taken off the anon REST surface — only a
-- signed-in user may delete their own account.

create or replace function delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_space_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Leave each space; if that empties it, delete the space (cascades all data).
  for v_space_id in select space_id from space_members where user_id = v_uid loop
    delete from space_members where space_id = v_space_id and user_id = v_uid;
    if not exists (select 1 from space_members m where m.space_id = v_space_id) then
      delete from spaces where id = v_space_id;
    end if;
  end loop;

  -- Null out the NO-ACTION references that survive in shared spaces, so the
  -- auth.users delete below isn't blocked. Preserves the historical rows.
  update health_entries set by_user_id = null where by_user_id = v_uid;
  update rule_checks    set done_by    = null where done_by    = v_uid;

  -- Finally remove the auth account itself. Cascades auth.identities/sessions
  -- and public.notifications.
  delete from auth.users where id = v_uid;
end;
$$;

-- Only a signed-in user may delete their own account. Postgres grants EXECUTE to
-- PUBLIC by default, so revoke from PUBLIC (and anon) then grant back explicitly.
revoke execute on function delete_account() from public;
revoke execute on function delete_account() from anon;
grant execute on function delete_account() to authenticated;
