-- Revert 0004: drop the dependency + duration columns.
alter table task_templates drop column if exists depends_on;
alter table tasks drop column if exists depends_on;
alter table tasks drop column if exists duration_days;
