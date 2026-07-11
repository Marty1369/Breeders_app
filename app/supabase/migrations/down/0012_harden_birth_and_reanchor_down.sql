-- Down-migration for 0012. Leaves the anchor backfill in place (harmless data),
-- drops the birth hardening.
alter table birth_events drop constraint if exists birth_events_litter_seq_uniq;
-- (log_birth keeps the advisory lock; re-applying 0010 would remove it if needed.)
