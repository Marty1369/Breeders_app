-- Revert 0002: drop the recurrence engine tables (this also drops their data).
alter publication supabase_realtime drop table rule_checks;
alter publication supabase_realtime drop table recurrence_rules;
drop table if exists rule_checks;
drop table if exists recurrence_rules;
