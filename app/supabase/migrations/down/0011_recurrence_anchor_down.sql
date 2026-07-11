-- Down-migration for 0011_recurrence_anchor.sql
alter table recurrence_rules drop column if exists start_anchor;
alter table recurrence_rules drop column if exists start_offset;
alter table recurrence_rules drop column if exists end_anchor;
alter table recurrence_rules drop column if exists end_offset;
