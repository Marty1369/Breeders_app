-- 0009_fix_space_member_takeover.sql
--
-- CRITICAL security fix — cross-tenant account/space takeover via RLS.
--
-- The space_members INSERT policy (0001) allowed:
--     user_id = auth.uid() and (
--       is_space_member(space_id) or
--       not exists (select 1 from space_members m2 where m2.space_id = space_members.space_id)
--     )
--
-- The `not exists (...)` subquery is itself evaluated under RLS. A non-member's
-- SELECT on space_members is filtered by space_members_select (is_space_member),
-- so to an attacker EVERY space they don't belong to looks like it has zero
-- members. The `not exists` branch is therefore TRUE for any occupied victim
-- space, and an authenticated attacker who knows a space UUID can insert
-- themselves as a member — after which is_space_member() grants full read/write
-- across that tenant's data. Reproduced on staging: a non-member of "Alpha
-- Kennel" successfully inserted a membership row for it.
--
-- Fix: remove the RLS-blind `not exists` bootstrap branch. Legitimate membership
-- creation never uses this policy — create_space() and join_space_via_invite()
-- are SECURITY DEFINER (owned by a BYPASSRLS role) and insert members directly;
-- no client code inserts into space_members (verified: only reads + own-row
-- profile updates). So requiring is_space_member(space_id) here closes the
-- direct-insert attack surface without affecting onboarding or invites.
--
-- NOTE: the space_members UPDATE policy was also reviewed. Changing a row's
-- space_id to a victim space is already blocked by RLS (verified on staging:
-- "new row violates row-level security policy"), while same-space own-row edits
-- (MyProfile) still work — so it is left unchanged.

drop policy if exists space_members_insert on space_members;
create policy space_members_insert on space_members for insert with check (
  user_id = auth.uid() and is_space_member(space_id)
);
