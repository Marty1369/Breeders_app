-- 0011_recurrence_anchor.sql
--
-- Re-anchoring for litter-scoped recurrence rules. Rules stored only an absolute
-- start_date, so when the litter's whelping date moved the daily-care schedule
-- (weigh, box temp, clean, socialization) did NOT move with it — the first days
-- of life were left with no reminders (audit P0).
--
-- Store the key-date anchor + offset the start (and, for fixed-length rules, the
-- end) were derived from, so applyDateChange can re-flow them. Nullable — a
-- user-created rule with no anchor keeps its fixed dates.

alter table recurrence_rules add column if not exists start_anchor text;   -- 'heat'|'ovulation'|'mating'|'whelping'|'weaning'|'handover'
alter table recurrence_rules add column if not exists start_offset int;    -- days after the anchor
alter table recurrence_rules add column if not exists end_anchor   text;   -- for end_type='date' rules that track a key date
alter table recurrence_rules add column if not exists end_offset   int;
