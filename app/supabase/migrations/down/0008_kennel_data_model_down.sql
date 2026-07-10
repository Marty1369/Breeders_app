-- Down-migration for 0008_kennel_data_model.sql

alter publication supabase_realtime drop table breed_catalog, whelping_sessions, birth_events, dam_vitals;

drop table if exists dam_vitals;
drop table if exists birth_events;
drop table if exists whelping_sessions;
drop table if exists breed_catalog;

alter table owners drop column if exists first_name;
alter table owners drop column if exists surname;
alter table owners drop column if exists street;
alter table owners drop column if exists city;
alter table owners drop column if exists postal_code;

alter table health_entries drop column if exists dog_id;
alter table health_entries drop column if exists dose;
alter table health_entries drop column if exists route;
alter table health_entries drop column if exists given_at;
alter table health_entries drop constraint if exists health_entries_type_check;
alter table health_entries add constraint health_entries_type_check
  check (type in ('vaccination','deworming','vet_check'));

alter table puppies drop column if exists price;
alter table puppies drop column if exists collar_color;
alter table puppies drop column if exists tail;
alter table puppies drop column if exists markings;

alter table litters drop column if exists breed;

alter table dogs drop column if exists color;
alter table dogs drop column if exists tail;
alter table dogs drop column if exists eyes;
alter table dogs drop column if exists eyes_exam_date;
alter table dogs drop column if exists elbows;
alter table dogs drop column if exists dentition;
alter table dogs drop column if exists bite;
alter table dogs drop column if exists titles;
alter table dogs drop column if exists show_results;
alter table dogs drop column if exists working_tests;
alter table dogs drop column if exists faults;
alter table dogs drop column if exists registry;
alter table dogs drop column if exists genetics_notes;

alter table spaces drop column if exists club;
alter table spaces drop column if exists vmvt_no;
alter table spaces drop column if exists breeds;
