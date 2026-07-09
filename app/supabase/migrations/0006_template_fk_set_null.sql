-- Litter Planner — make tasks.template_id null out when its template is deleted,
-- so re-seeding the default plan (seed_default_templates deletes + re-inserts
-- templates) doesn't fail on the FK from existing tasks. Apply after 0005.

alter table tasks drop constraint tasks_template_id_fkey;
alter table tasks add constraint tasks_template_id_fkey
  foreign key (template_id) references task_templates(id) on delete set null;
