-- 0007_secure_seed_templates.sql
--
-- SECURITY FIX — unauthenticated cross-tenant destructive write.
--
-- PostgREST exposes every function in the `public` schema as an RPC, and
-- Postgres grants EXECUTE to PUBLIC by default. `seed_default_templates`
-- (0005) is SECURITY DEFINER with no membership guard, and its first statement
-- is:
--
--     delete from task_templates where space_id = p_space_id;
--
-- So POST /rest/v1/rpc/seed_default_templates with only the publishable anon
-- key (which ships in the client bundle) and any space UUID would wipe that
-- kennel's customised task plan and replace it with the defaults. Verified
-- exploitable on staging: 52 templates -> 51, both custom rows destroyed, with
-- no Authorization header.
--
-- Fix: take it off the REST surface. It is only ever called from create_space()
-- (0005 line 92), which is itself SECURITY DEFINER and owned by the same role,
-- so the internal call still works. The function body is left untouched on
-- purpose — re-declaring the 51-row plan here would risk drifting from 0005.
revoke execute on function seed_default_templates(uuid) from public;
revoke execute on function seed_default_templates(uuid) from anon;
revoke execute on function seed_default_templates(uuid) from authenticated;

-- Hardening: these three all depend on auth.uid() and are only ever invoked by
-- a signed-in user, so `anon` has no business calling them.
--
-- `revoke ... from anon` alone is a no-op here: Postgres grants EXECUTE to
-- PUBLIC by default and `anon` inherits that, so the privilege must be revoked
-- from PUBLIC and then granted back to `authenticated` explicitly.
revoke execute on function create_space(text, text, text, text, text, text, text, text) from public;
revoke execute on function join_space_via_invite(text, text) from public;
revoke execute on function rotate_invite(uuid) from public;

grant execute on function create_space(text, text, text, text, text, text, text, text) to authenticated;
grant execute on function join_space_via_invite(text, text) to authenticated;
grant execute on function rotate_invite(uuid) to authenticated;

-- NOTE: is_space_member(uuid) is deliberately NOT revoked. RLS policy
-- expressions are evaluated as the calling role, so `authenticated` must retain
-- EXECUTE or every space-scoped policy in the schema starts failing.
