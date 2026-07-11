-- Down-migration for 0010_log_birth_rpc.sql
drop function if exists log_birth(uuid, text, timestamptz);
