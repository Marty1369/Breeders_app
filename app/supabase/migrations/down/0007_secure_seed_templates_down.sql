-- Down-migration for 0007_secure_seed_templates.sql
--
-- Restores the default EXECUTE grants. NOTE: this deliberately re-opens the
-- unauthenticated cross-tenant write on seed_default_templates. Only run it if
-- you are rolling 0007 back wholesale.
grant execute on function seed_default_templates(uuid) to public;

grant execute on function create_space(text, text, text, text, text, text, text, text) to public;
grant execute on function join_space_via_invite(text, text) to public;
grant execute on function rotate_invite(uuid) to public;
