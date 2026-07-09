-- Revert 0003: drop the litter is_active flag.
alter table litters drop column if exists is_active;
