-- Down-migration for 0009_fix_space_member_takeover.sql
--
-- Restores the original 0001 policy. NOTE: this deliberately re-opens the
-- cross-tenant takeover. Only run it to roll 0009 back wholesale.
drop policy if exists space_members_insert on space_members;
create policy space_members_insert on space_members for insert with check (
  user_id = auth.uid() and (
    is_space_member(space_id) or
    not exists (select 1 from space_members m2 where m2.space_id = space_members.space_id)
  )
);
