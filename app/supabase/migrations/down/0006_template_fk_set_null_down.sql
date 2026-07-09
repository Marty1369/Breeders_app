-- Revert 0006: restore the original (NO ACTION) FK on tasks.template_id.
alter table tasks drop constraint tasks_template_id_fkey;
alter table tasks add constraint tasks_template_id_fkey
  foreign key (template_id) references task_templates(id);
