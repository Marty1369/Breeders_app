-- Litter Planner — task-to-task dependencies + duration.
-- A task can depend on predecessors: its start re-flows to
--   FS (finish-to-start): predecessor.due_date + lag
--   SS (start-to-start):  predecessor.start_date + lag
-- taking the latest across all predecessors. duration_days spans the bar
-- (due_date = start_date + duration_days). Apply after 0003.

alter table tasks add column duration_days int not null default 0;
alter table tasks add column depends_on jsonb not null default '[]';
-- tasks.depends_on = [{ "taskId": uuid, "type": "FS"|"SS", "lag": int }]

alter table task_templates add column depends_on jsonb not null default '[]';
-- task_templates.depends_on = [{ "ref": <predecessor sort_order>, "type": "FS"|"SS", "lag": int }]
